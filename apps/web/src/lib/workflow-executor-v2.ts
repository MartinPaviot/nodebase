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
import { topologicalSort } from "@/lib/workflow/utils";
import { getExecutor } from "@/features/executions/lib/executor-registry";
import { NodeType } from "@prisma/client";
import { WorkflowState, WorkflowStatus } from "./workflow-state";
import { NotFoundError, WorkflowExecutionError } from "./errors";
import type { StepTools, PublishFn } from "@/features/executions/types";

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
  NodeType.CALENDAR_TRIGGER,
];

// Special context keys used by executors to control flow
const SELECTED_BRANCH_KEY = "__selectedBranch";
const PAUSE_KEY = "__pause";

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
const mockPublish: PublishFn = async () => {};

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

  // Build node map and adjacency list for graph traversal
  const nodeMap = new Map(workflow.nodes.map((n) => [n.id, n]));
  const adjacencyList = buildAdjacencyList(workflow.connections);

  // Find start nodes (trigger nodes or nodes with no incoming connections)
  const nodesWithIncoming = new Set(workflow.connections.map((c) => c.toNodeId));
  const startNodes = workflow.nodes.filter(
    (n) => !nodesWithIncoming.has(n.id) || TRIGGER_NODE_TYPES.includes(n.type)
  );

  // Count executable nodes for progress tracking
  const executableNodeCount = workflow.nodes.filter(
    (n) => !TRIGGER_NODE_TYPES.includes(n.type)
  ).length;

  // ============================================
  // STATE INITIALIZATION
  // ============================================

  let state: WorkflowState;
  let resumeNodeId: string | null = null;

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

    // Get the node to resume from (the next node after the last checkpoint)
    const resumePoint = state.getResumePoint();
    if (resumePoint) {
      // Find the next nodes after the resume point
      const edges = adjacencyList.get(resumePoint.nodeId);
      if (edges && edges.length > 0) {
        resumeNodeId = edges[0].toNodeId;
      }
    }

    console.log(
      `Resuming workflow ${workflowId} from execution ${resumeFromExecutionId} at node ${resumeNodeId}`
    );
  } else {
    // Create new execution
    state = await WorkflowState.create(
      workflowId,
      userId,
      initialData,
      executableNodeCount
    );
  }

  // Inject execution ID into context so executors can reference it
  state.updateContext({ __executionId: state.getExecutionId() });

  // Mark as running
  state.setStatus(WorkflowStatus.RUNNING);
  await state.saveCheckpoint();

  // ============================================
  // GRAPH TRAVERSAL EXECUTION
  // ============================================

  const step = createMockStepTools();

  // Determine starting point: resume node or first node after triggers
  let currentNodeIds: string[];

  if (resumeNodeId) {
    currentNodeIds = [resumeNodeId];
  } else {
    // Start from the first non-trigger nodes connected to start nodes
    currentNodeIds = [];
    for (const startNode of startNodes) {
      if (TRIGGER_NODE_TYPES.includes(startNode.type)) {
        // Follow edges from trigger nodes to get first executable nodes
        const edges = adjacencyList.get(startNode.id) || [];
        for (const edge of edges) {
          currentNodeIds.push(edge.toNodeId);
        }
      } else {
        currentNodeIds.push(startNode.id);
      }
    }
  }

  const executedNodes = new Set<string>();

  while (currentNodeIds.length > 0) {
    const nodeId = currentNodeIds.shift()!;

    // Skip already-executed nodes (prevents cycles)
    if (executedNodes.has(nodeId)) continue;

    const node = nodeMap.get(nodeId);
    if (!node) continue;

    // Skip trigger nodes
    if (TRIGGER_NODE_TYPES.includes(node.type)) continue;

    console.log(
      `Executing node ${state.getCurrentStep() + 1}/${state.getTotalSteps()}: ${node.type} (${node.name})`
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

      // Check if the node requested a pause (async operations like recording)
      if (newContext[PAUSE_KEY]) {
        const { [PAUSE_KEY]: _, ...cleanContext } = newContext;
        state.setContext(cleanContext);
        state.incrementStep();
        await state.createCheckpoint(node.id, node.type);
        await state.markPaused(node.id);

        console.log(`⏸ Node ${node.type} requested pause (async operation)`);

        return {
          success: true,
          executionId: state.getExecutionId(),
          output: cleanContext as Record<string, unknown>,
          checkpointsCount: state.getCheckpoints().length,
        };
      }

      // Update state with new context
      state.setContext(newContext);
      state.incrementStep();
      executedNodes.add(nodeId);

      // Create checkpoint after successful execution
      await state.createCheckpoint(node.id, node.type);

      console.log(`✓ Node ${node.type} (${node.name}) completed successfully`);

      // Determine next nodes based on branching
      const edges = adjacencyList.get(nodeId) || [];

      if (node.type === NodeType.CONDITION && newContext[SELECTED_BRANCH_KEY]) {
        // CONDITION node: only follow the selected branch
        const selectedBranch = newContext[SELECTED_BRANCH_KEY] as string;
        const branchEdges = edges.filter((e) => e.fromOutput === selectedBranch);

        for (const edge of branchEdges) {
          currentNodeIds.push(edge.toNodeId);
        }

        console.log(`  → Branch selected: "${selectedBranch}" (${branchEdges.length} next nodes)`);
      } else {
        // Regular node: follow all outgoing edges
        for (const edge of edges) {
          currentNodeIds.push(edge.toNodeId);
        }
      }
    } catch (error) {
      console.error(`✗ Node ${node.type} (${node.name}) failed:`, error);

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
// GRAPH HELPERS
// ============================================

interface AdjacencyEdge {
  toNodeId: string;
  fromOutput: string;
  toInput: string;
}

/**
 * Build adjacency list from connections for graph traversal.
 * Each node maps to its outgoing edges with branch info.
 */
function buildAdjacencyList(
  connections: Array<{ fromNodeId: string; toNodeId: string; fromOutput: string; toInput: string }>
): Map<string, AdjacencyEdge[]> {
  const adj = new Map<string, AdjacencyEdge[]>();

  for (const conn of connections) {
    const edges = adj.get(conn.fromNodeId) || [];
    edges.push({
      toNodeId: conn.toNodeId,
      fromOutput: conn.fromOutput,
      toInput: conn.toInput,
    });
    adj.set(conn.fromNodeId, edges);
  }

  return adj;
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
