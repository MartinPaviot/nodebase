/**
 * @nodebase/queue
 * BullMQ queue management for Nodebase
 */

// Export Redis client
export { default as redisConnection } from './client';

// Export queues
export * from './queues';

// Export workers
export * from './workers';

// Re-export BullMQ types for convenience
export type { Queue, Worker, Job } from 'bullmq';
