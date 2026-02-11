"use strict";
/**
 * Queue Configuration
 *
 * Redis connection and queue settings.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKER_OPTIONS = exports.DEFAULT_JOB_OPTIONS = exports.QUEUE_NAMES = void 0;
exports.getRedisConnection = getRedisConnection;
/**
 * Redis connection configuration.
 * Reads from REDIS_URL env var (Upstash format supported).
 */
function getRedisConnection() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        throw new Error("REDIS_URL environment variable is required for BullMQ. " +
            "Get one from https://upstash.com or use a local Redis instance.");
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
exports.QUEUE_NAMES = {
    WORKFLOWS: "workflows",
};
/**
 * Default job options
 */
exports.DEFAULT_JOB_OPTIONS = {
    attempts: 3,
    backoff: {
        type: "exponential",
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
exports.WORKER_OPTIONS = {
    concurrency: 10,
    // Pattern #8: Graceful shutdown with 30s timeout
    gracefulShutdownTimeout: 30000,
};
