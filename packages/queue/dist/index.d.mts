import { Job, Queue, Worker, QueueEvents } from 'bullmq';
export { Job, Queue, QueueEvents, Worker } from 'bullmq';

/**
 * @nodebase/queue
 *
 * BullMQ-based job queue with:
 * - Graceful shutdown (30s timeout)
 * - Stall detection
 * - Priority queues
 * - Redis connection management
 */

interface QueueConfig {
    redisUrl: string;
    prefix?: string;
    defaultJobOptions?: {
        attempts?: number;
        backoff?: {
            type: "exponential" | "fixed";
            delay: number;
        };
        removeOnComplete?: boolean | number;
        removeOnFail?: boolean | number;
    };
}
interface JobData {
    [key: string]: unknown;
}
interface JobResult {
    success: boolean;
    data?: unknown;
    error?: string;
}
type JobProcessor<T extends JobData = JobData> = (job: Job<T>) => Promise<JobResult>;
interface WorkerOptions {
    concurrency?: number;
    limiter?: {
        max: number;
        duration: number;
    };
}
declare class QueueManager {
    private connection;
    private queues;
    private workers;
    private queueEvents;
    private config;
    private isShuttingDown;
    constructor(config: QueueConfig);
    /**
     * Get or create a queue.
     */
    getQueue<T extends JobData = JobData>(name: string): Queue<T>;
    /**
     * Create a worker for a queue.
     */
    createWorker<T extends JobData = JobData>(queueName: string, processor: JobProcessor<T>, options?: WorkerOptions): Worker<T, JobResult>;
    /**
     * Add a job to a queue.
     */
    addJob<T extends JobData = JobData>(queueName: string, data: T, options?: {
        jobId?: string;
        priority?: number;
        delay?: number;
        repeat?: {
            pattern?: string;
            every?: number;
            limit?: number;
        };
    }): Promise<Job<T, JobResult, string>>;
    /**
     * Add multiple jobs to a queue.
     */
    addBulk<T extends JobData = JobData>(queueName: string, jobs: Array<{
        data: T;
        opts?: {
            jobId?: string;
            priority?: number;
        };
    }>): Promise<Job<T, JobResult, string>[]>;
    /**
     * Get queue events for monitoring.
     */
    getQueueEvents(queueName: string): QueueEvents;
    /**
     * Get job by ID.
     */
    getJob<T extends JobData = JobData>(queueName: string, jobId: string): Promise<Job<T, JobResult, string> | null>;
    /**
     * Get queue stats.
     */
    getQueueStats(queueName: string): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
    }>;
    /**
     * Pause a queue.
     */
    pauseQueue(queueName: string): Promise<void>;
    /**
     * Resume a queue.
     */
    resumeQueue(queueName: string): Promise<void>;
    /**
     * Clean old jobs from a queue.
     */
    cleanQueue(queueName: string, options?: {
        grace?: number;
        limit?: number;
        status?: "completed" | "failed" | "delayed" | "active" | "wait";
    }): Promise<string[]>;
    /**
     * Graceful shutdown - waits for active jobs to complete.
     */
    shutdown(timeout?: number): Promise<void>;
    private getConnectionOptions;
    private setupGracefulShutdown;
}
declare function initQueue(config: QueueConfig): QueueManager;
declare function getQueue(): QueueManager;
declare const QUEUES: {
    readonly SCAN: "scan";
    readonly AGENT_EXECUTION: "agent-execution";
    readonly EVAL: "eval";
    readonly NOTIFICATION: "notification";
    readonly EMAIL: "email";
    readonly WEBHOOK: "webhook";
    readonly SCHEDULED: "scheduled";
};
type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
interface ScanJobData extends JobData {
    workspaceId: string;
    category: string;
    connectorIds: string[];
}
interface AgentExecutionJobData extends JobData {
    agentId: string;
    userId: string;
    workspaceId: string;
    triggeredBy: string;
    context?: Record<string, unknown>;
}
interface EvalJobData extends JobData {
    runId: string;
    agentId: string;
    outputContent: string;
    evalRules: Record<string, unknown>;
}
interface NotificationJobData extends JobData {
    userId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
}
interface EmailJobData extends JobData {
    to: string;
    subject: string;
    body: string;
    html?: string;
    attachments?: Array<{
        filename: string;
        content: string;
    }>;
}
interface WebhookJobData extends JobData {
    url: string;
    method: "GET" | "POST" | "PUT" | "DELETE";
    headers?: Record<string, string>;
    body?: unknown;
    retries?: number;
}

export { type AgentExecutionJobData, type EmailJobData, type EvalJobData, type JobData, type JobProcessor, type JobResult, type NotificationJobData, QUEUES, type QueueConfig, QueueManager, type QueueName, type ScanJobData, type WebhookJobData, type WorkerOptions, getQueue, initQueue };
