import prisma from "@/lib/db";
import { topologicalSort } from "@/lib/workflow/utils";
import { getExecutor } from "@/features/executions/lib/executor-registry";
import { NodeType } from "@prisma/client";
import type { WorkflowContext, StepTools, PublishFn } from "@/features/executions/types";

const WORKFLOW_TIMEOUT_MS = 30000; // 30 seconds per workflow

interface ExecuteWorkflowSyncParams {
  workflowId: string;
  userId: string;
  initialData?: Record<string, unknown>;
  /** Conversation context from the chat session (for memory persistence) */
  conversationContext?: {
    recentMessages: Array<{ role: string; content: string; toolName?: string }>;
    summary?: string;
  };
  /** Agent memories to include in execution context */
  agentMemories?: Array<{ key: string; value: string; category: string }>;
}

interface ExecuteWorkflowSyncResult {
  success: boolean;
  output?: WorkflowContext;
  error?: string;
}

// Trigger node types that should be skipped during execution
const TRIGGER_NODE_TYPES: string[] = [
  NodeType.INITIAL,
  NodeType.MANUAL_TRIGGER,
  NodeType.GOOGLE_FORM_TRIGGER,
  NodeType.STRIPE_TRIGGER,
  NodeType.CALENDAR_TRIGGER,
];

/**
 * Mock Inngest step tools for synchronous execution.
 * These provide the same interface but execute directly without durability/retry.
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
    // Add other step methods as no-ops or direct execution
    sleep: async () => {},
    sleepUntil: async () => {},
    sendEvent: async () => ({ ids: [] }),
    invoke: async () => ({}),
    waitForEvent: async () => null,
  } as unknown as StepTools;
}

/**
 * Mock publish function - no-op for sync execution
 * In async mode this would publish to Inngest realtime channels
 */
const mockPublish: PublishFn = async () => {};

/**
 * Execute a workflow synchronously (blocking).
 * Used by agent tool calling to run workflows within the chat request lifecycle.
 */
export async function executeWorkflowSync({
  workflowId,
  userId,
  initialData = {},
  conversationContext,
  agentMemories,
}: ExecuteWorkflowSyncParams): Promise<ExecuteWorkflowSyncResult> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error("Workflow execution timed out")),
      WORKFLOW_TIMEOUT_MS
    );
  });

  try {
    const result = await Promise.race([
      executeWorkflowInternal({ workflowId, userId, initialData, conversationContext, agentMemories }),
      timeoutPromise,
    ]);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function executeWorkflowInternal({
  workflowId,
  userId,
  initialData,
  conversationContext,
  agentMemories,
}: ExecuteWorkflowSyncParams): Promise<ExecuteWorkflowSyncResult> {
  // Fetch workflow with nodes and connections
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId, userId },
    include: {
      nodes: true,
      connections: true,
    },
  });

  if (!workflow) {
    return {
      success: false,
      error: "Workflow not found or access denied",
    };
  }

  // Sort nodes topologically
  const sortedNodes = topologicalSort(workflow.nodes, workflow.connections);

  // Create mock step tools for sync execution
  const step = createMockStepTools();

  // Initialize context with initial data + conversation context for memory persistence
  let context: WorkflowContext = {
    ...initialData,
    ...(conversationContext ? { _conversationContext: conversationContext } : {}),
    ...(agentMemories?.length ? { _agentMemories: agentMemories } : {}),
  };

  // Execute each node sequentially
  for (const node of sortedNodes) {
    // Skip trigger nodes - they don't do anything in sync execution
    if (TRIGGER_NODE_TYPES.includes(node.type)) {
      continue;
    }

    try {
      const executor = getExecutor(node.type as NodeType);
      context = await executor({
        data: node.data as Record<string, unknown>,
        nodeId: node.id,
        userId,
        context,
        step,
        publish: mockPublish,
      });
    } catch (error) {
      return {
        success: false,
        error: `Node "${node.type}" failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  return {
    success: true,
    output: context,
  };
}
