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
export declare function getRedisConnection(): ConnectionOptions;
/**
 * Queue names
 */
export declare const QUEUE_NAMES: {
    readonly WORKFLOWS: "workflows";
};
/**
 * Default job options
 */
export declare const DEFAULT_JOB_OPTIONS: {
    attempts: number;
    backoff: {
        type: "exponential";
        delay: number;
    };
    removeOnComplete: {
        count: number;
    };
    removeOnFail: {
        count: number;
    };
};
/**
 * Worker options
 */
export declare const WORKER_OPTIONS: {
    concurrency: number;
    gracefulShutdownTimeout: number;
};
//# sourceMappingURL=config.d.ts.map