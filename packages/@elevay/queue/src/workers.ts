/**
 * BullMQ Worker implementations
 */

import { Worker, Job } from 'bullmq';
import redisConnection from './client';

// Worker configuration
const workerOptions = {
  connection: redisConnection,
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000, // 10 jobs per second max
  },
};

// Conversation Evaluation Worker
export const conversationEvalWorker = new Worker(
  'conversation-eval',
  async (job: Job) => {
    const { conversationId, agentId } = job.data;
    
    console.log(`[conversation-eval] Processing ${conversationId}...`);
    
    // Import dynamically to avoid circular deps
    const { MultiTurnEvaluator } = await import('@elevay/core');
    const evaluator = new MultiTurnEvaluator();
    
    const result = await evaluator.evaluateConversation(conversationId);
    
    console.log(`[conversation-eval] ✅ Completed ${conversationId}`);
    return result;
  },
  workerOptions
);

// Insights Generation Worker
export const insightsWorker = new Worker(
  'insights',
  async (job: Job) => {
    const { agentId, timeframe } = job.data;
    
    console.log(`[insights] Generating insights for agent ${agentId}...`);
    
    const { InsightsEngine } = await import('@elevay/core');
    const engine = new InsightsEngine();
    
    const insights = await engine.generateInsights(agentId, timeframe || {
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      to: new Date(),
    });
    
    console.log(`[insights] ✅ Completed for agent ${agentId}`);
    return insights;
  },
  workerOptions
);

// Agent Optimization Worker
export const optimizationWorker = new Worker(
  'optimization',
  async (job: Job) => {
    const { agentId, reason } = job.data;
    
    console.log(`[optimization] Optimizing agent ${agentId} (reason: ${reason})...`);
    
    const { AutoOptimizer } = await import('@elevay/core');
    const optimizer = new AutoOptimizer();
    
    const result = await optimizer.optimizeAgent(agentId);
    
    console.log(`[optimization] ✅ Completed for agent ${agentId}`);
    return result;
  },
  workerOptions
);

// A/B Test Check Worker
export const abTestCheckWorker = new Worker(
  'ab-test-check',
  async (job: Job) => {
    console.log('[ab-test-check] Checking running A/B tests...');
    
    const { ABTestManager } = await import('@elevay/core');
    const manager = new ABTestManager();
    
    // Get all running tests and check if they have enough data
    const runningTests = await manager.getRunningTests();
    
    for (const test of runningTests) {
      if (test.variantATraces >= 50 && test.variantBTraces >= 50) {
        console.log(`[ab-test-check] Test ${test.id} has enough data, analyzing...`);
        // Auto-select winner if significant difference
        if (test.variantAScore && test.variantBScore) {
          const diff = Math.abs(test.variantAScore - test.variantBScore);
          if (diff > 0.1) { // 10% difference threshold
            const winner = test.variantAScore > test.variantBScore ? 'A' : 'B';
            console.log(`[ab-test-check] Auto-selecting winner: ${winner}`);
            await manager.selectWinner(test.id, winner);
          }
        }
      }
    }
    
    console.log('[ab-test-check] ✅ Completed');
  },
  workerOptions
);

// Error handlers
conversationEvalWorker.on('failed', (job, err) => {
  console.error(`[conversation-eval] ❌ Job ${job?.id} failed:`, err);
});

insightsWorker.on('failed', (job, err) => {
  console.error(`[insights] ❌ Job ${job?.id} failed:`, err);
});

optimizationWorker.on('failed', (job, err) => {
  console.error(`[optimization] ❌ Job ${job?.id} failed:`, err);
});

abTestCheckWorker.on('failed', (job, err) => {
  console.error(`[ab-test-check] ❌ Job ${job?.id} failed:`, err);
});

// Graceful shutdown
export async function closeWorkers() {
  await Promise.all([
    conversationEvalWorker.close(),
    insightsWorker.close(),
    optimizationWorker.close(),
    abTestCheckWorker.close(),
  ]);
}

// Export all workers
export const workers = {
  conversationEval: conversationEvalWorker,
  insights: insightsWorker,
  optimization: optimizationWorker,
  abTestCheck: abTestCheckWorker,
};
