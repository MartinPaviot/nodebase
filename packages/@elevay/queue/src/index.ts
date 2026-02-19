/**
 * @elevay/queue
 * BullMQ queue management for Elevay
 */

// Export Redis client
export { default as redisConnection } from './client';

// Export queues
export * from './queues';

// Export workers
export * from './workers';

// Export outreach queues
export * from './outreach-queues';

// Export outreach workers
export * from './outreach-workers';

// Re-export BullMQ types for convenience
export type { Queue, Worker, Job } from 'bullmq';
