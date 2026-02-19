/**
 * BullMQ Queue definitions
 */

import { Queue } from 'bullmq';
import redisConnection from './client';

// Queue options
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  removeOnComplete: {
    count: 100, // Keep last 100 completed jobs
  },
  removeOnFail: {
    count: 500, // Keep last 500 failed jobs
  },
};

// Define queues
export const conversationEvalQueue = new Queue('conversation-eval', {
  connection: redisConnection,
  defaultJobOptions,
});

export const insightsQueue = new Queue('insights', {
  connection: redisConnection,
  defaultJobOptions,
});

export const optimizationQueue = new Queue('optimization', {
  connection: redisConnection,
  defaultJobOptions,
});

export const abTestCheckQueue = new Queue('ab-test-check', {
  connection: redisConnection,
  defaultJobOptions,
});

// Export all queues
export const queues = {
  conversationEval: conversationEvalQueue,
  insights: insightsQueue,
  optimization: optimizationQueue,
  abTestCheck: abTestCheckQueue,
};

// Helper to add jobs to queues
export async function addConversationEval(conversationId: string, agentId: string) {
  return conversationEvalQueue.add(
    'evaluate-conversation',
    { conversationId, agentId },
    { priority: 2 }
  );
}

export async function addGenerateInsights(agentId: string, timeframe?: { from: Date; to: Date }) {
  return insightsQueue.add(
    'generate-insights',
    { agentId, timeframe },
    { priority: 3 }
  );
}

export async function addOptimization(agentId: string, reason: string) {
  return optimizationQueue.add(
    'optimize-agent',
    { agentId, reason },
    { priority: 1 } // High priority
  );
}

export async function addABTestCheck() {
  return abTestCheckQueue.add(
    'check-ab-tests',
    {},
    { priority: 3, repeat: { pattern: '0 * * * *' } } // Every hour
  );
}

// Graceful shutdown
export async function closeQueues() {
  await Promise.all([
    conversationEvalQueue.close(),
    insightsQueue.close(),
    optimizationQueue.close(),
    abTestCheckQueue.close(),
  ]);
  await redisConnection.quit();
}
