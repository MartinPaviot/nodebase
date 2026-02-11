/**
 * Feedback Collector - Captures all types of user feedback
 * Inspired by LangSmith's feedback loop system
 */
import type { Feedback, FeedbackType } from './types';
export declare class FeedbackCollector {
    /**
     * Record feedback from user
     */
    recordFeedback(feedback: Feedback): Promise<void>;
    /**
     * Record thumbs up/down
     */
    recordRating(traceId: string, conversationId: string, userId: string, agentId: string, rating: 'up' | 'down'): Promise<void>;
    /**
     * Record user edit (before sending)
     */
    recordEdit(traceId: string, conversationId: string, userId: string, agentId: string, originalOutput: string, editedOutput: string, stepNumber: number): Promise<void>;
    /**
     * Record explicit correction
     */
    recordCorrection(traceId: string, conversationId: string, userId: string, agentId: string, originalOutput: string, correction: string, stepNumber: number): Promise<void>;
    /**
     * Record approval rejection
     */
    recordRejection(traceId: string, conversationId: string, userId: string, agentId: string, rejectedOutput: string, stepNumber: number): Promise<void>;
    /**
     * Get feedback for an agent
     */
    getFeedback(agentId: string, types?: FeedbackType[], limit?: number): Promise<any>;
    /**
     * Get feedback count by type
     */
    getFeedbackStats(agentId: string, days?: number): Promise<{
        total: any;
        byType: Record<string, number>;
        positiveRate: number;
        negativeRate: number;
        editRate: number;
    }>;
    private updateTrace;
    private computeDiff;
    private checkOptimizationThreshold;
    private mapFeedbackType;
}
export declare class FeedbackQuery {
    /**
     * Get all feedback for a conversation
     */
    static getConversationFeedback(conversationId: string): Promise<any>;
    /**
     * Get edits dataset for optimization
     */
    static getEditsForOptimization(agentId: string, limit?: number): Promise<any>;
}
//# sourceMappingURL=feedback-collector.d.ts.map