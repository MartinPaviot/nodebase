// Legacy Inngest types (kept for compatibility during migration)
// TODO: Remove these once all executors are updated
import { Realtime } from "@inngest/realtime";
import type { GetStepTools, Inngest } from "inngest";

export type WorkflowContext = Record<string, unknown>;

// Legacy type - kept for backward compatibility
export type StepTools = GetStepTools<Inngest.Any>;

// Node executor params - includes Inngest step/publish (still used by all executors)
// TODO: Remove step/publish once migrated to BullMQ (Pattern #7)
export interface NodeExecutorParams<TData = Record<string, unknown>> {
    data: TData;
    nodeId: string;
    userId: string;
    context: WorkflowContext;
    step: StepTools;
    publish: Realtime.PublishFn;
};

export type NodeExecutor<TData = Record<string, unknown>> = (
    params: NodeExecutorParams<TData>,
) => Promise<WorkflowContext>;
