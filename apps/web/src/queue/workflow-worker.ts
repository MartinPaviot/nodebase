/**
 * Workflow Worker (BullMQ)
 *
 * Replaces Inngest executeWorkflow function.
 * Executes workflows from the queue with proper error handling.
 */

import { startWorkflowWorker, type WorkflowJobData, type WorkflowJobResult } from "./bullmq";
import prisma from "@/lib/db";
import { ExecutionStatus, NodeType } from "@prisma/client";
import { getExecutor } from "@/features/executions/lib/executor-registry";
import { topologicalSort } from "@/lib/workflow/utils";
import { stubStep, stubPublish } from "./compat";
import type { Job } from "bullmq";

/**
 * Workflow execution worker.
 * Processes workflow execution jobs from the queue.
 */
export const workflowWorker = startWorkflowWorker(async (job: Job<WorkflowJobData>): Promise<WorkflowJobResult> => {
  const { workflowId, userId, initialData, triggeredBy } = job.data;

  console.log(`[WorkflowWorker] Processing workflow ${workflowId} (job ${job.id})`);

  try {
    // 1. Create execution record
    const execution = await prisma.execution.create({
      data: {
        workflowId,
        inngestEventId: job.id || `bullmq_${Date.now()}`,
        status: ExecutionStatus.RUNNING,
      },
    });

    // 2. Fetch workflow with nodes and connections
    const workflow = await prisma.workflow.findUniqueOrThrow({
      where: { id: workflowId },
      include: {
        nodes: true,
        connections: true,
      },
    });

    // 3. Sort nodes topologically
    const sortedNodes = topologicalSort(workflow.nodes, workflow.connections);

    // 4. Get user ID from workflow if not provided
    const executionUserId = userId || workflow.userId;

    // 5. Execute each node in order
    let context: Record<string, unknown> = initialData || {};

    for (const node of sortedNodes) {
      console.log(`[WorkflowWorker] Executing node ${node.id} (${node.type})`);

      const executor = getExecutor(node.type as NodeType);

      context = await executor({
        data: node.data as Record<string, unknown>,
        nodeId: node.id,
        userId: executionUserId,
        context,
        step: stubStep as any, // Compatibility stubs for legacy executors
        publish: stubPublish as any,
      });
    }

    // 6. Update execution as successful
    await prisma.execution.update({
      where: { id: execution.id },
      data: {
        status: ExecutionStatus.SUCCESS,
        completedAt: new Date(),
        output: context as any, // Cast to any to avoid JSON type complexity
      },
    });

    console.log(`[WorkflowWorker] Workflow ${workflowId} completed successfully`);

    return {
      workflowId,
      executionId: execution.id,
      status: "success",
      result: context,
    };
  } catch (error) {
    console.error(`[WorkflowWorker] Workflow ${workflowId} failed:`, error);

    // Update execution as failed
    await prisma.execution.update({
      where: { inngestEventId: job.id },
      data: {
        status: ExecutionStatus.FAILED,
        error: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
        completedAt: new Date(),
      },
    });

    return {
      workflowId,
      executionId: "",
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});
