/**
 * Worker Factory Functions
 *
 * Creates BullMQ workers with proper configuration.
 */

import { Worker, Job, Processor } from "bullmq";
import { getRedisConnection, QUEUE_NAMES, WORKER_OPTIONS } from "./config";
import type { WorkflowJobData, WorkflowJobResult } from "./types";

/**
 * Start the workflow worker
 */
export function startWorkflowWorker(
  processor: Processor<WorkflowJobData, WorkflowJobResult>
): Worker<WorkflowJobData, WorkflowJobResult> {
  const worker = new Worker<WorkflowJobData, WorkflowJobResult>(
    QUEUE_NAMES.WORKFLOWS,
    processor,
    {
      connection: getRedisConnection(),
      ...WORKER_OPTIONS,
    }
  );

  // Log worker events
  worker.on("completed", (job: Job) => {
    console.log(`[WorkflowWorker] Job ${job.id} completed`);
  });

  worker.on("failed", (job: Job | undefined, error: Error) => {
    console.error(`[WorkflowWorker] Job ${job?.id} failed:`, error);
  });

  worker.on("error", (error: Error) => {
    console.error("[WorkflowWorker] Worker error:", error);
  });

  return worker;
}
