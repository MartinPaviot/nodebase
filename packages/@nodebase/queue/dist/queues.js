"use strict";
/**
 * BullMQ Queue definitions
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queues = exports.abTestCheckQueue = exports.optimizationQueue = exports.insightsQueue = exports.conversationEvalQueue = void 0;
exports.addConversationEval = addConversationEval;
exports.addGenerateInsights = addGenerateInsights;
exports.addOptimization = addOptimization;
exports.addABTestCheck = addABTestCheck;
exports.closeQueues = closeQueues;
const bullmq_1 = require("bullmq");
const client_1 = __importDefault(require("./client"));
// Queue options
const defaultJobOptions = {
    attempts: 3,
    backoff: {
        type: 'exponential',
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
exports.conversationEvalQueue = new bullmq_1.Queue('conversation-eval', {
    connection: client_1.default,
    defaultJobOptions,
});
exports.insightsQueue = new bullmq_1.Queue('insights', {
    connection: client_1.default,
    defaultJobOptions,
});
exports.optimizationQueue = new bullmq_1.Queue('optimization', {
    connection: client_1.default,
    defaultJobOptions,
});
exports.abTestCheckQueue = new bullmq_1.Queue('ab-test-check', {
    connection: client_1.default,
    defaultJobOptions,
});
// Export all queues
exports.queues = {
    conversationEval: exports.conversationEvalQueue,
    insights: exports.insightsQueue,
    optimization: exports.optimizationQueue,
    abTestCheck: exports.abTestCheckQueue,
};
// Helper to add jobs to queues
async function addConversationEval(conversationId, agentId) {
    return exports.conversationEvalQueue.add('evaluate-conversation', { conversationId, agentId }, { priority: 2 });
}
async function addGenerateInsights(agentId, timeframe) {
    return exports.insightsQueue.add('generate-insights', { agentId, timeframe }, { priority: 3 });
}
async function addOptimization(agentId, reason) {
    return exports.optimizationQueue.add('optimize-agent', { agentId, reason }, { priority: 1 } // High priority
    );
}
async function addABTestCheck() {
    return exports.abTestCheckQueue.add('check-ab-tests', {}, { priority: 3, repeat: { pattern: '0 * * * *' } } // Every hour
    );
}
// Graceful shutdown
async function closeQueues() {
    await Promise.all([
        exports.conversationEvalQueue.close(),
        exports.insightsQueue.close(),
        exports.optimizationQueue.close(),
        exports.abTestCheckQueue.close(),
    ]);
    await client_1.default.quit();
}
