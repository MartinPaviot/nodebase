/**
 * Queue
 *
 * BullMQ Queue wrapper with type-safety and configuration.
 */
import { Queue as BullQueue, QueueOptions } from "bullmq";
import type { JobData, JobOptions } from "@nodebase/types";
export interface NodebaseQueueOptions extends Partial<QueueOptions> {
    name: string;
    redisUrl?: string;
}
/**
 * Create a type-safe BullMQ queue.
 *
 * @example
 * ```typescript
 * const emailQueue = createQueue({ name: "emails" });
 *
 * await emailQueue.add("send-welcome", {
 *   to: "user@example.com",
 *   template: "welcome"
 * });
 * ```
 */
export declare function createQueue<T extends JobData = JobData>(options: NodebaseQueueOptions): BullQueue<T>;
/**
 * Add a job to the queue with retry logic.
 *
 * @example
 * ```typescript
 * await addJob(emailQueue, "send-welcome", data, {
 *   attempts: 3,
 *   backoff: {
 *     type: "exponential",
 *     delay: 1000
 *   }
 * });
 * ```
 */
export declare function addJob<T extends JobData = JobData>(queue: BullQueue<T>, jobName: string, data: T, options?: JobOptions): Promise<void>;
//# sourceMappingURL=queue.d.ts.map