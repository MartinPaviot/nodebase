/**
 * Queue Utilities
 *
 * Helper functions for adding jobs to BullMQ queues.
 */

import { addWorkflowJob, type WorkflowJobData } from "./bullmq";
import { nanoid } from "nanoid";

/**
 * Send a workflow execution job to the queue.
 * Replaces inngest.send({ name: "workflows/execute.workflow", ... })
 *
 * @param data - Workflow execution data
 * @returns Job ID
 */
export async function sendWorkflowExecution(data: {
  workflowId: string;
  userId?: string;
  initialData?: Record<string, unknown>;
  triggeredBy?: "manual" | "webhook" | "cron";
}): Promise<string> {
  const jobData: WorkflowJobData = {
    workflowId: data.workflowId,
    userId: data.userId,
    initialData: data.initialData,
    triggeredBy: data.triggeredBy || "manual",
  };

  const job = await addWorkflowJob(jobData, {
    jobId: nanoid(),
  });

  return job.id!;
}

/**
 * Export topological sort utility (unchanged from inngest/utils.ts)
 */
export { topologicalSort } from "@/inngest/utils";
