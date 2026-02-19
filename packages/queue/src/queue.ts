/**
 * Queue
 * 
 * BullMQ Queue wrapper with type-safety and configuration.
 */

import { Queue as BullQueue, QueueOptions } from "bullmq";
import { getRedisConfig } from "@elevay/config";
import type { JobData, JobOptions } from "@elevay/types";

export interface ElevayQueueOptions extends Partial<QueueOptions> {
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
export function createQueue<T extends JobData = JobData>(
  options: ElevayQueueOptions
): BullQueue<T> {
  const redisUrl = options.redisUrl || getRedisConfig().url;

  return new BullQueue<T>(options.name, {
    connection: {
      url: redisUrl,
      maxRetriesPerRequest: getRedisConfig().maxRetriesPerRequest,
    },
    ...options,
  });
}

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
export async function addJob<T extends JobData = JobData>(
  queue: BullQueue<T>,
  jobName: string,
  data: T,
  options?: JobOptions
): Promise<void> {
  await (queue as any).add(jobName, data, {
    attempts: options?.attempts ?? 3,
    backoff: options?.backoff ?? {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: options?.removeOnComplete ?? 100,
    removeOnFail: options?.removeOnFail ?? 50,
    ...options,
  });
}
