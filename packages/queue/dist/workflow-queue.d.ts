/**
 * Workflow Queue
 *
 * Specialized queue for executing workflows (replaces Inngest executeWorkflow function).
 */
import { Queue, Worker, Job } from "bullmq";
import type { JobData, JobResult } from "@elevay/types";
export interface WorkflowJobData extends JobData {
    workflowId: string;
    userId?: string;
    initialData?: Record<string, unknown>;
    triggeredBy?: "manual" | "cron" | "webhook";
}
export interface WorkflowJobResult extends JobResult {
    workflowId: string;
    executionId: string;
    status: "success" | "failed";
    result?: Record<string, unknown>;
    error?: string;
}
export interface WorkflowExecutor {
    (job: Job<WorkflowJobData>): Promise<WorkflowJobResult>;
}
/**
 * Get or create the workflow execution queue.
 */
export declare function getWorkflowQueue(): Queue<WorkflowJobData>;
/**
 * Add a workflow execution job to the queue.
 * This replaces the Inngest `inngest.send("workflows/execute.workflow", ...)` pattern.
 *
 * @example
 * ```typescript
 * await executeWorkflow({
 *   workflowId: "workflow_123",
 *   userId: "user_456",
 *   initialData: { trigger: "manual" },
 *   triggeredBy: "manual"
 * });
 * ```
 */
export declare function executeWorkflow(data: WorkflowJobData): Promise<void>;
/**
 * Start the workflow execution worker.
 * This replaces the Inngest function definition.
 *
 * @example
 * ```typescript
 * import { prisma } from "@/lib/db";
 * import { getExecutor } from "@/features/executions/lib/executor-registry";
 *
 * startWorkflowWorker(async (job) => {
 *   const { workflowId, userId, initialData } = job.data;
 *
 *   // Create execution record
 *   const execution = await prisma.execution.create({
 *     data: { workflowId }
 *   });
 *
 *   // Execute workflow nodes
 *   const workflow = await prisma.workflow.findUniqueOrThrow({
 *     where: { id: workflowId },
 *     include: { nodes: true, connections: true }
 *   });
 *
 *   let context = initialData || {};
 *
 *   for (const node of workflow.nodes) {
 *     const executor = getExecutor(node.type);
 *     context = await executor({ data: node.data, nodeId: node.id, userId, context });
 *   }
 *
 *   // Update execution
 *   await prisma.execution.update({
 *     where: { id: execution.id },
 *     data: { status: "SUCCESS", completedAt: new Date(), output: context }
 *   });
 *
 *   return {
 *     workflowId,
 *     executionId: execution.id,
 *     status: "success",
 *     result: context
 *   };
 * });
 * ```
 */
export declare function startWorkflowWorker(executor: WorkflowExecutor): Worker<WorkflowJobData, WorkflowJobResult>;
/**
 * Stop the workflow worker (for testing or shutdown).
 */
export declare function stopWorkflowWorker(): Promise<void>;
//# sourceMappingURL=workflow-queue.d.ts.map