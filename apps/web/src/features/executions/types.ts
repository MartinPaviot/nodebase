export type WorkflowContext = Record<string, unknown>;

// Step tools interface — matches the BullMQ compat layer (queue/compat.ts)
export interface StepTools {
    run: <T>(name: string, fn: () => Promise<T> | T) => Promise<T>;
    ai: {
        wrap: <TArgs extends unknown[], TResult>(
            name: string,
            fn: (...args: TArgs) => Promise<TResult>,
            ...args: TArgs
        ) => Promise<TResult>;
    };
}

// Publish function for realtime status updates
export type PublishFn = (message: unknown) => Promise<void>;

export interface NodeExecutorParams<TData = Record<string, unknown>> {
    data: TData;
    nodeId: string;
    userId: string;
    context: WorkflowContext;
    step: StepTools;
    publish: PublishFn;
}

export type NodeExecutor<TData = Record<string, unknown>> = (
    params: NodeExecutorParams<TData>,
) => Promise<WorkflowContext>;
