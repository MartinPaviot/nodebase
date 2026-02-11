/**
 * Worker
 * 
 * BullMQ Worker wrapper with graceful shutdown and error handling.
 */

import { Worker as BullWorker, WorkerOptions, Job } from "bullmq";
import { getRedisConfig } from "@nodebase/config";
import type { JobData, JobResult } from "@nodebase/types";

export interface NodebaseWorkerOptions extends Partial<WorkerOptions> {
  redisUrl?: string;
  concurrency?: number;
}

export type JobProcessor<T extends JobData = JobData, R extends JobResult = JobResult> = (
  job: Job<T>
) => Promise<R>;

/**
 * Create a BullMQ worker with graceful shutdown.
 * 
 * @example
 * ```typescript
 * const worker = createWorker("emails", async (job) => {
 *   await sendEmail(job.data);
 *   return { sent: true };
 * }, {
 *   concurrency: 5
 * });
 * ```
 */
export function createWorker<T extends JobData = JobData, R extends JobResult = JobResult>(
  queueName: string,
  processor: JobProcessor<T, R>,
  options?: NodebaseWorkerOptions
): BullWorker<T, R> {
  const redisUrl = options?.redisUrl || getRedisConfig().url;

  const worker = new BullWorker<T, R>(queueName, processor, {
    connection: {
      url: redisUrl,
      maxRetriesPerRequest: getRedisConfig().maxRetriesPerRequest,
    },
    concurrency: options?.concurrency ?? 5,
    ...options,
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`[Worker ${queueName}] Received ${signal}, shutting down gracefully...`);
    
    await worker.close();
    
    console.log(`[Worker ${queueName}] Shutdown complete`);
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Error handling
  worker.on("failed", (job, err) => {
    console.error(`[Worker ${queueName}] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error(`[Worker ${queueName}] Error:`, err);
  });

  return worker;
}

/**
 * Wait for all workers to finish and shutdown gracefully.
 * This is the implementation of Pattern #8: Graceful Shutdown.
 * 
 * Workers have 30 seconds to complete current jobs before forced shutdown.
 */
export async function gracefulShutdown(workers: BullWorker[], timeoutMs = 30000): Promise<void> {
  console.log(`[Queue] Shutting down ${workers.length} workers...`);

  const shutdownPromises = workers.map((worker) => worker.close());

  await Promise.race([
    Promise.all(shutdownPromises),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Graceful shutdown timeout")), timeoutMs)
    ),
  ]);

  console.log("[Queue] All workers shut down successfully");
}
