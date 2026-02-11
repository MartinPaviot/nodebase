/**
 * Queue Definitions
 *
 * BullMQ queue instances and job addition functions.
 */

import { Queue, JobsOptions } from "bullmq";
import { getRedisConnection, QUEUE_NAMES, DEFAULT_JOB_OPTIONS } from "./config";
import type { WorkflowJobData } from "./types";

/**
 * Workflow queue instance (lazy-loaded to avoid early Redis connection)
 */
let workflowQueue: Queue<WorkflowJobData> | null = null;

function getWorkflowQueue(): Queue<WorkflowJobData> {
  if (!workflowQueue) {
    workflowQueue = new Queue<WorkflowJobData>(
      QUEUE_NAMES.WORKFLOWS,
      {
        connection: getRedisConnection(),
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }
    );
  }
  return workflowQueue;
}

/**
 * Export for direct access if needed
 */
export { getWorkflowQueue as workflowQueue };

/**
 * Add a workflow job to the queue
 */
export async function addWorkflowJob(
  data: WorkflowJobData,
  opts?: JobsOptions
) {
  return getWorkflowQueue().add("execute-workflow", data, opts);
}
