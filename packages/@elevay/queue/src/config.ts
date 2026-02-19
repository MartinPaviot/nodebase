/**
 * Queue Configuration
 *
 * Redis connection and queue settings.
 */

import { ConnectionOptions } from "bullmq";

/**
 * Redis connection configuration.
 * Reads from REDIS_URL env var (Upstash format supported).
 */
export function getRedisConnection(): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error(
      "REDIS_URL environment variable is required for BullMQ. " +
      "Get one from https://upstash.com or use a local Redis instance."
    );
  }

  // Parse Redis URL
  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    port: parseInt(url.port || "6379", 10),
    password: url.password || undefined,
    username: url.username || undefined,
    // Upstash uses TLS
    tls: url.protocol === "rediss:" ? {} : undefined,
  };
}

/**
 * Queue names
 */
export const QUEUE_NAMES = {
  WORKFLOWS: "workflows",
} as const;

/**
 * Default job options
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 2000,
  },
  removeOnComplete: {
    count: 100, // Keep last 100 completed jobs
  },
  removeOnFail: {
    count: 500, // Keep last 500 failed jobs for debugging
  },
};

/**
 * Worker options
 */
export const WORKER_OPTIONS = {
  concurrency: 10,
  // Pattern #8: Graceful shutdown with 30s timeout
  gracefulShutdownTimeout: 30000,
};
