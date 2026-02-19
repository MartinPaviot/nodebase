/**
 * Worker
 *
 * BullMQ Worker wrapper with graceful shutdown and error handling.
 */
import { Worker as BullWorker, WorkerOptions, Job } from "bullmq";
import type { JobData, JobResult } from "@elevay/types";
export interface ElevayWorkerOptions extends Partial<WorkerOptions> {
    redisUrl?: string;
    concurrency?: number;
}
export type JobProcessor<T extends JobData = JobData, R extends JobResult = JobResult> = (job: Job<T>) => Promise<R>;
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
export declare function createWorker<T extends JobData = JobData, R extends JobResult = JobResult>(queueName: string, processor: JobProcessor<T, R>, options?: ElevayWorkerOptions): BullWorker<T, R>;
/**
 * Wait for all workers to finish and shutdown gracefully.
 * This is the implementation of Pattern #8: Graceful Shutdown.
 *
 * Workers have 30 seconds to complete current jobs before forced shutdown.
 */
export declare function gracefulShutdown(workers: BullWorker[], timeoutMs?: number): Promise<void>;
//# sourceMappingURL=worker.d.ts.map