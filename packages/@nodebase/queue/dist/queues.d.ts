/**
 * BullMQ Queue definitions
 */
import { Queue } from 'bullmq';
export declare const conversationEvalQueue: Queue<any, any, string, any, any, string>;
export declare const insightsQueue: Queue<any, any, string, any, any, string>;
export declare const optimizationQueue: Queue<any, any, string, any, any, string>;
export declare const abTestCheckQueue: Queue<any, any, string, any, any, string>;
export declare const queues: {
    conversationEval: Queue<any, any, string, any, any, string>;
    insights: Queue<any, any, string, any, any, string>;
    optimization: Queue<any, any, string, any, any, string>;
    abTestCheck: Queue<any, any, string, any, any, string>;
};
export declare function addConversationEval(conversationId: string, agentId: string): Promise<import("bullmq").Job<any, any, string>>;
export declare function addGenerateInsights(agentId: string, timeframe?: {
    from: Date;
    to: Date;
}): Promise<import("bullmq").Job<any, any, string>>;
export declare function addOptimization(agentId: string, reason: string): Promise<import("bullmq").Job<any, any, string>>;
export declare function addABTestCheck(): Promise<import("bullmq").Job<any, any, string>>;
export declare function closeQueues(): Promise<void>;
//# sourceMappingURL=queues.d.ts.map