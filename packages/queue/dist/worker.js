/**
 * Worker
 *
 * BullMQ Worker wrapper with graceful shutdown and error handling.
 */
import { Worker as BullWorker } from "bullmq";
import { getRedisConfig } from "@nodebase/config";
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
export function createWorker(queueName, processor, options) {
    const redisUrl = options?.redisUrl || getRedisConfig().url;
    const worker = new BullWorker(queueName, processor, {
        connection: {
            url: redisUrl,
            maxRetriesPerRequest: getRedisConfig().maxRetriesPerRequest,
        },
        concurrency: options?.concurrency ?? 5,
        ...options,
    });
    // Graceful shutdown handling
    const shutdown = async (signal) => {
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
export async function gracefulShutdown(workers, timeoutMs = 30000) {
    console.log(`[Queue] Shutting down ${workers.length} workers...`);
    const shutdownPromises = workers.map((worker) => worker.close());
    await Promise.race([
        Promise.all(shutdownPromises),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Graceful shutdown timeout")), timeoutMs)),
    ]);
    console.log("[Queue] All workers shut down successfully");
}
