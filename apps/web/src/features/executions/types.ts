// Legacy Inngest types (kept for compatibility during migration)
// TODO: Remove these once all executors are updated
import { Realtime } from "@inngest/realtime";
import type { GetStepTools, Inngest } from "inngest";

export type WorkflowContext = Record<string, unknown>;

// Legacy type - kept for backward compatibility
export type StepTools = GetStepTools<Inngest.Any>;

// New BullMQ-compatible interface (without step and publish)
export interface NodeExecutorParams<TData = Record<string, unknown>> {
    data: TData;
    nodeId: string;
    userId: string;
    context: WorkflowContext;
    // step and publish removed - not needed with BullMQ
    // Retry logic is handled by BullMQ worker
    // Realtime updates will be via Redis PubSub (Pattern #7)
};

// Legacy interface - kept for backward compatibility
export interface LegacyNodeExecutorParams<TData = Record<string, unknown>> extends NodeExecutorParams<TData> {
    step: StepTools;
    publish: Realtime.PublishFn;
}

export type NodeExecutor<TData = Record<string, unknown>> = (
    params: NodeExecutorParams<TData>,
) => Promise<WorkflowContext>;
