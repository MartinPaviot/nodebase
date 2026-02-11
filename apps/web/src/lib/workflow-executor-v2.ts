/**
 * Workflow Executor V2 - LangGraph-style State Management
 *
 * Improvements over V1:
 * - Explicit state management (no implicit context passing)
 * - Automatic checkpointing after each node
 * - Resume capability from last checkpoint
 * - Better error handling with error checkpoints
 * - Type-safe state access
 *
 * Migration path:
 * 1. Test V2 in parallel with V1
 * 2. Gradually migrate workflows to V2
 * 3. Deprecate V1 once all workflows migrated
 */

import prisma from "./db";
import { topologicalSort } from "@/inngest/utils";
import { getExecutor } from "@/features/executions/lib/executor-registry";
import { NodeType } from "@prisma/client";
import { WorkflowState, WorkflowStatus } from "./workflow-state";
import { NotFoundError, WorkflowExecutionError } from "./errors";
import type { StepTools } from "@/features/executions/types";
import type { Realtime } from "@inngest/realtime";

const WORKFLOW_TIMEOUT_MS = 30000; // 30 seconds per workflow

interface ExecuteWorkflowParams {
  workflowId: string;
  userId: string;
  initialData?: Record<string, unknown>;
  resumeFromExecutionId?: string; // Optional: resume from checkpoint
}

interface ExecuteWorkflowResult {
  success: boolean;
  executionId: string;
  output?: Record<string, unknown>;
  error?: string;
  checkpointsCount?: number;
}

// Trigger node types that should be skipped during execution
const TRIGGER_NODE_TYPES: string[] = [
  NodeType.INITIAL,
  NodeType.MANUAL_TRIGGER,
  NodeType.GOOGLE_FORM_TRIGGER,
  NodeType.STRIPE_TRIGGER,
];

/**
 * Mock Inngest step tools for synchronous execution.
 */
function createMockStepTools(): StepTools {
  return {
    run: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
      return fn();
    },
    ai: {
      wrap: async <T>(
        name: string,
        fn: Function,
        options: Record<string, unknown>
      ): Promise<T> => {
        return fn(options) as Promise<T>;
      },
    },
    sleep: async () => {},
    sleepUntil: async () => {},
    sendEvent: async () => ({ ids: [] }),
    invoke: async () => ({}),
    waitForEvent: async () => null,
  } as unknown as StepTools;
}

/**
 * Mock publish function - no-op for sync execution
 */
const mockPublish: Realtime.PublishFn = async () => {};

// ============================================
// MAIN EXECUTOR
// ============================================

/**
 * Execute workflow with explicit state management
 * Supports resume from checkpoint
 */
export async function executeWorkflowV2({
  workflowId,
  userId,
  initialData = {},
  resumeFromExecutionId,
}: ExecuteWorkflowParams): Promise<ExecuteWorkflowResult> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(WorkflowExecutionError.timeout(workflowId, "workflow", WORKFLOW_TIMEOUT_MS)),
      WORKFLOW_TIMEOUT_MS
    );
  });

  try {
    const result = await Promise.race([
      executeWorkflowInternal({
        workflowId,
        userId,
        initialData,
        resumeFromExecutionId,
      }),
      timeoutPromise,
    ]);
    return result;
  } catch (error) {
    if (error instanceof WorkflowExecutionError) {
      return {
        success: false,
        executionId: resumeFromExecutionId || "unknown",
        error: error.message,
      };
    }
    return {
      success: false,
      executionId: resumeFromExecutionId || "unknown",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function executeWorkflowInternal({
  workflowId,
  userId,
  initialData,
  resumeFromExecutionId,
}: ExecuteWorkflowParams): Promise<ExecuteWorkflowResult> {
  // Fetch workflow with nodes and connections
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId, userId },
    include: {
      nodes: true,
      connections: true,
    },
  });

  if (!workflow) {
    throw new NotFoundError("Workflow", workflowId);
  }

  // Sort nodes topologically
  const sortedNodes = topologicalSort(workflow.nodes, workflow.connections);
  const executableNodes = sortedNodes.filter(
    (node) => !TRIGGER_NODE_TYPES.includes(node.type)
  );

  // ============================================
  // STATE INITIALIZATION
  // ============================================

  let state: WorkflowState;

  if (resumeFromExecutionId) {
    // Resume from checkpoint
    state = await WorkflowState.resume(resumeFromExecutionId);

    if (!state.canResume()) {
      throw new WorkflowExecutionError(
        workflowId,
        null,
        "Cannot resume: execution is not in a resumable state",
        false
      );
    }

    console.log(
      `Resuming workflow ${workflowId} from execution ${resumeFromExecutionId} at step ${state.getCurrentStep()}`
    );
  } else {
    // Create new execution
    state = await WorkflowState.create(
      workflowId,
      userId,
      initialData,
      executableNodes.length
    );
  }

  // Mark as running
  state.setStatus(WorkflowStatus.RUNNING);
  await state.saveCheckpoint();

  // ============================================
  // NODE EXECUTION LOOP
  // ============================================

  const step = createMockStepTools();
  const resumePoint = state.getResumePoint();
  let shouldSkip = resumePoint !== null;

  for (const node of executableNodes) {
    // Skip nodes until we reach resume point
    if (shouldSkip) {
      if (node.id === resumePoint?.nodeId) {
        shouldSkip = false;
        console.log(`Resumed at node: ${node.type} (${node.id})`);
      }
      continue;
    }

    console.log(
      `Executing node ${state.getCurrentStep() + 1}/${state.getTotalSteps()}: ${node.type}`
    );

    try {
      // Get executor for this node type
      const executor = getExecutor(node.type as NodeType);

      // Execute node with current context
      const currentContext = state.getContext();
      const newContext = await executor({
        data: node.data as Record<string, unknown>,
        nodeId: node.id,
        userId,
        context: currentContext,
        step,
        publish: mockPublish,
      });

      // Update state with new context
      state.setContext(newContext);
      state.incrementStep();

      // Create checkpoint after successful execution
      await state.createCheckpoint(node.id, node.type);

      console.log(`✓ Node ${node.type} completed successfully`);
    } catch (error) {
      console.error(`✗ Node ${node.type} failed:`, error);

      // Create error checkpoint
      await state.createErrorCheckpoint(
        node.id,
        node.type,
        error instanceof Error ? error : new Error(String(error))
      );

      // Mark execution as failed
      await state.markFailed(
        error instanceof Error ? error : new Error(String(error))
      );

      throw new WorkflowExecutionError(
        workflowId,
        node.id,
        `Node "${node.type}" failed: ${error instanceof Error ? error.message : String(error)}`,
        true // Most workflow errors are retryable
      );
    }
  }

  // ============================================
  // COMPLETION
  // ============================================

  await state.markCompleted();

  console.log(
    `✓ Workflow ${workflowId} completed successfully with ${state.getCheckpoints().length} checkpoints`
  );

  return {
    success: true,
    executionId: state.getExecutionId(),
    output: state.getContext() as Record<string, unknown>,
    checkpointsCount: state.getCheckpoints().length,
  };
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Execute workflow synchronously (blocking)
 * Wrapper for backward compatibility with V1
 */
export async function executeWorkflowSync({
  workflowId,
  userId,
  initialData = {},
}: {
  workflowId: string;
  userId: string;
  initialData?: Record<string, unknown>;
}): Promise<{
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
}> {
  const result = await executeWorkflowV2({
    workflowId,
    userId,
    initialData,
  });

  return {
    success: result.success,
    output: result.output,
    error: result.error,
  };
}

/**
 * Resume workflow execution from last checkpoint
 */
export async function resumeWorkflow({
  executionId,
}: {
  executionId: string;
}): Promise<ExecuteWorkflowResult> {
  // Load execution with workflow to get user info
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: { workflow: { select: { userId: true } } },
  });

  if (!execution) {
    throw new NotFoundError("Execution", executionId);
  }

  return executeWorkflowV2({
    workflowId: execution.workflowId,
    userId: execution.workflow.userId,
    resumeFromExecutionId: executionId,
  });
}

/**
 * Get execution state
 */
export async function getExecutionState(
  executionId: string
): Promise<WorkflowState> {
  return WorkflowState.resume(executionId);
}
