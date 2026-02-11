/**
 * BullMQ Worker implementations
 */
import { Worker } from 'bullmq';
export declare const conversationEvalWorker: Worker<any, any, string>;
export declare const insightsWorker: Worker<any, any, string>;
export declare const optimizationWorker: Worker<any, any, string>;
export declare const abTestCheckWorker: Worker<any, any, string>;
export declare function closeWorkers(): Promise<void>;
export declare const workers: {
    conversationEval: Worker<any, any, string>;
    insights: Worker<any, any, string>;
    optimization: Worker<any, any, string>;
    abTestCheck: Worker<any, any, string>;
};
//# sourceMappingURL=workers.d.ts.map