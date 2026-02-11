"use strict";
/**
 * BullMQ Worker implementations
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workers = exports.abTestCheckWorker = exports.optimizationWorker = exports.insightsWorker = exports.conversationEvalWorker = void 0;
exports.closeWorkers = closeWorkers;
const bullmq_1 = require("bullmq");
const client_1 = __importDefault(require("./client"));
// Worker configuration
const workerOptions = {
    connection: client_1.default,
    concurrency: 5,
    limiter: {
        max: 10,
        duration: 1000, // 10 jobs per second max
    },
};
// Conversation Evaluation Worker
exports.conversationEvalWorker = new bullmq_1.Worker('conversation-eval', async (job) => {
    const { conversationId, agentId } = job.data;
    console.log(`[conversation-eval] Processing ${conversationId}...`);
    // Import dynamically to avoid circular deps
    const { MultiTurnEvaluator } = await Promise.resolve().then(() => __importStar(require('@nodebase/core')));
    const evaluator = new MultiTurnEvaluator();
    const result = await evaluator.evaluateConversation(conversationId);
    console.log(`[conversation-eval] ✅ Completed ${conversationId}`);
    return result;
}, workerOptions);
// Insights Generation Worker
exports.insightsWorker = new bullmq_1.Worker('insights', async (job) => {
    const { agentId, timeframe } = job.data;
    console.log(`[insights] Generating insights for agent ${agentId}...`);
    const { InsightsEngine } = await Promise.resolve().then(() => __importStar(require('@nodebase/core')));
    const engine = new InsightsEngine();
    const insights = await engine.generateInsights(agentId, timeframe || {
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        to: new Date(),
    });
    console.log(`[insights] ✅ Completed for agent ${agentId}`);
    return insights;
}, workerOptions);
// Agent Optimization Worker
exports.optimizationWorker = new bullmq_1.Worker('optimization', async (job) => {
    const { agentId, reason } = job.data;
    console.log(`[optimization] Optimizing agent ${agentId} (reason: ${reason})...`);
    const { AutoOptimizer } = await Promise.resolve().then(() => __importStar(require('@nodebase/core')));
    const optimizer = new AutoOptimizer();
    const result = await optimizer.optimizeAgent(agentId);
    console.log(`[optimization] ✅ Completed for agent ${agentId}`);
    return result;
}, workerOptions);
// A/B Test Check Worker
exports.abTestCheckWorker = new bullmq_1.Worker('ab-test-check', async (job) => {
    console.log('[ab-test-check] Checking running A/B tests...');
    const { ABTestManager } = await Promise.resolve().then(() => __importStar(require('@nodebase/core')));
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
}, workerOptions);
// Error handlers
exports.conversationEvalWorker.on('failed', (job, err) => {
    console.error(`[conversation-eval] ❌ Job ${job?.id} failed:`, err);
});
exports.insightsWorker.on('failed', (job, err) => {
    console.error(`[insights] ❌ Job ${job?.id} failed:`, err);
});
exports.optimizationWorker.on('failed', (job, err) => {
    console.error(`[optimization] ❌ Job ${job?.id} failed:`, err);
});
exports.abTestCheckWorker.on('failed', (job, err) => {
    console.error(`[ab-test-check] ❌ Job ${job?.id} failed:`, err);
});
// Graceful shutdown
async function closeWorkers() {
    await Promise.all([
        exports.conversationEvalWorker.close(),
        exports.insightsWorker.close(),
        exports.optimizationWorker.close(),
        exports.abTestCheckWorker.close(),
    ]);
}
// Export all workers
exports.workers = {
    conversationEval: exports.conversationEvalWorker,
    insights: exports.insightsWorker,
    optimization: exports.optimizationWorker,
    abTestCheck: exports.abTestCheckWorker,
};
