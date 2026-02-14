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
    getFeedback(agentId: string, types?: FeedbackType[], limit?: number): Promise<({
        trace: {
            id: string;
            totalSteps: number;
            totalCost: number;
        };
        conversation: {
            id: string;
            title: string;
        };
    } & {
        id: string;
        agentId: string;
        conversationId: string;
        userId: string;
        stepNumber: number;
        timestamp: Date;
        traceId: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        type: import("@prisma/client").$Enums.FeedbackType;
        originalOutput: string;
        userEdit: string | null;
        correctionText: string | null;
    })[]>;
    /**
     * Get feedback count by type
     */
    getFeedbackStats(agentId: string, days?: number): Promise<{
        total: number;
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
    static getConversationFeedback(conversationId: string): Promise<{
        id: string;
        agentId: string;
        conversationId: string;
        userId: string;
        stepNumber: number;
        timestamp: Date;
        traceId: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        type: import("@prisma/client").$Enums.FeedbackType;
        originalOutput: string;
        userEdit: string | null;
        correctionText: string | null;
    }[]>;
    /**
     * Get edits dataset for optimization
     */
    static getEditsForOptimization(agentId: string, limit?: number): Promise<{
        id: string;
        agentId: string;
        conversationId: string;
        userId: string;
        stepNumber: number;
        timestamp: Date;
        traceId: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        type: import("@prisma/client").$Enums.FeedbackType;
        originalOutput: string;
        userEdit: string | null;
        correctionText: string | null;
    }[]>;
}
//# sourceMappingURL=feedback-collector.d.ts.map