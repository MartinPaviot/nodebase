/**
 * Workflow Queue
 *
 * Specialized queue for executing workflows (replaces Inngest executeWorkflow function).
 */
import { createQueue, addJob } from "./queue";
import { createWorker } from "./worker";
// ============================================
// Workflow Queue
// ============================================
let workflowQueue = null;
let workflowWorker = null;
/**
 * Get or create the workflow execution queue.
 */
export function getWorkflowQueue() {
    if (!workflowQueue) {
        workflowQueue = createQueue({
            name: "workflows",
        });
    }
    return workflowQueue;
}
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
export async function executeWorkflow(data) {
    const queue = getWorkflowQueue();
    await addJob(queue, "execute-workflow", data, {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 2000,
        },
    });
}
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
export function startWorkflowWorker(executor) {
    if (workflowWorker) {
        console.warn("[WorkflowWorker] Worker already started");
        return workflowWorker;
    }
    workflowWorker = createWorker("workflows", executor, {
        concurrency: 3, // Max 3 concurrent workflow executions
    });
    console.log("[WorkflowWorker] Started");
    return workflowWorker;
}
/**
 * Stop the workflow worker (for testing or shutdown).
 */
export async function stopWorkflowWorker() {
    if (workflowWorker) {
        await workflowWorker.close();
        workflowWorker = null;
        console.log("[WorkflowWorker] Stopped");
    }
}
