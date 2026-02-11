/**
 * Multi-turn Evaluator - Evaluates complete conversations
 * Inspired by LangSmith's multi-turn evaluation capabilities
 */
import type { ConversationEvalResult } from './types';
export declare class MultiTurnEvaluator {
    private sentimentAnalyzer;
    private hallucinationDetector;
    constructor();
    /**
     * Evaluate a complete conversation
     */
    evaluateConversation(conversationId: string): Promise<ConversationEvalResult>;
    /**
     * Detect if the user's goal was completed
     * Uses simple heuristics + sentiment analysis
     */
    private detectGoalCompletion;
    /**
     * Infer user satisfaction from signals
     */
    private inferSatisfaction;
    /**
     * Categorize conversation by topic
     */
    private categorize;
    /**
     * Detect failure modes
     */
    private detectFailures;
    /**
     * Suggest improvements based on failures
     */
    private suggestImprovements;
    private loadConversation;
    private loadTraces;
    private saveEvaluation;
}
export declare class EvaluationQuery {
    /**
     * Get evaluation for a conversation
     */
    static getEvaluation(conversationId: string): Promise<any>;
    /**
     * Get evaluations for an agent
     */
    static getAgentEvaluations(agentId: string, limit?: number): Promise<any>;
    /**
     * Get agent performance metrics from evaluations
     */
    static getPerformanceMetrics(agentId: string, days?: number): Promise<{
        total: any;
        goalCompletionRate: number;
        avgSatisfaction: number;
        failureModeCounts: Record<string, number>;
        commonFailures: {
            mode: string;
            count: number;
            percentage: number;
        }[];
    }>;
}
//# sourceMappingURL=multi-turn-evaluator.d.ts.map