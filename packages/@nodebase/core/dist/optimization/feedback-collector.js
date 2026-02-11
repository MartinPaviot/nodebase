"use strict";
/**
 * Feedback Collector - Captures all types of user feedback
 * Inspired by LangSmith's feedback loop system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedbackQuery = exports.FeedbackCollector = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class FeedbackCollector {
    /**
     * Record feedback from user
     */
    async recordFeedback(feedback) {
        try {
            // 1. Save to database
            const saved = await prisma.agentFeedback.create({
                data: {
                    traceId: feedback.traceId,
                    conversationId: feedback.conversationId,
                    userId: feedback.userId,
                    agentId: feedback.agentId,
                    type: this.mapFeedbackType(feedback.type),
                    originalOutput: feedback.originalOutput,
                    userEdit: feedback.userEdit,
                    correctionText: feedback.correctionText,
                    stepNumber: feedback.stepNumber,
                    metadata: feedback.metadata || {},
                },
            });
            console.log(`[FeedbackCollector] Recorded ${feedback.type} feedback for agent ${feedback.agentId}`);
            // 2. Update trace with feedback info
            await this.updateTrace(feedback);
            // 3. Trigger optimization job if threshold reached
            if (feedback.type === 'user_edit' ||
                feedback.type === 'explicit_correction') {
                await this.checkOptimizationThreshold(feedback.agentId);
            }
        }
        catch (error) {
            console.error('[FeedbackCollector] Failed to record feedback:', error);
            throw error;
        }
    }
    /**
     * Record thumbs up/down
     */
    async recordRating(traceId, conversationId, userId, agentId, rating) {
        await this.recordFeedback({
            traceId,
            conversationId,
            userId,
            agentId,
            type: rating === 'up' ? 'thumbs_up' : 'thumbs_down',
            originalOutput: '', // Not needed for ratings
            stepNumber: 0,
        });
    }
    /**
     * Record user edit (before sending)
     */
    async recordEdit(traceId, conversationId, userId, agentId, originalOutput, editedOutput, stepNumber) {
        await this.recordFeedback({
            traceId,
            conversationId,
            userId,
            agentId,
            type: 'user_edit',
            originalOutput,
            userEdit: editedOutput,
            stepNumber,
        });
    }
    /**
     * Record explicit correction
     */
    async recordCorrection(traceId, conversationId, userId, agentId, originalOutput, correction, stepNumber) {
        await this.recordFeedback({
            traceId,
            conversationId,
            userId,
            agentId,
            type: 'explicit_correction',
            originalOutput,
            correctionText: correction,
            stepNumber,
        });
    }
    /**
     * Record approval rejection
     */
    async recordRejection(traceId, conversationId, userId, agentId, rejectedOutput, stepNumber) {
        await this.recordFeedback({
            traceId,
            conversationId,
            userId,
            agentId,
            type: 'approval_reject',
            originalOutput: rejectedOutput,
            stepNumber,
        });
    }
    /**
     * Get feedback for an agent
     */
    async getFeedback(agentId, types, limit = 100) {
        const where = { agentId };
        if (types && types.length > 0) {
            where.type = {
                in: types.map((t) => this.mapFeedbackType(t)),
            };
        }
        return await prisma.agentFeedback.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: limit,
            include: {
                trace: {
                    select: {
                        id: true,
                        totalSteps: true,
                        totalCost: true,
                    },
                },
                conversation: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
        });
    }
    /**
     * Get feedback count by type
     */
    async getFeedbackStats(agentId, days = 30) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const feedbacks = await prisma.agentFeedback.findMany({
            where: {
                agentId,
                timestamp: { gte: since },
            },
            select: {
                type: true,
            },
        });
        const stats = {
            THUMBS_UP: 0,
            THUMBS_DOWN: 0,
            USER_EDIT: 0,
            APPROVAL_REJECT: 0,
            EXPLICIT_CORRECTION: 0,
            RETRY_REQUEST: 0,
        };
        feedbacks.forEach((f) => {
            stats[f.type] = (stats[f.type] || 0) + 1;
        });
        const total = feedbacks.length;
        const positive = stats.THUMBS_UP;
        const negative = stats.THUMBS_DOWN + stats.APPROVAL_REJECT + stats.USER_EDIT;
        return {
            total,
            byType: stats,
            positiveRate: total > 0 ? positive / total : 0,
            negativeRate: total > 0 ? negative / total : 0,
            editRate: total > 0 ? stats.USER_EDIT / total : 0,
        };
    }
    // ============================================================================
    // Private Methods
    // ============================================================================
    async updateTrace(feedback) {
        const updates = {};
        // Update feedback score
        if (feedback.type === 'thumbs_up') {
            updates.feedbackScore = 5;
        }
        else if (feedback.type === 'thumbs_down') {
            updates.feedbackScore = 1;
        }
        else if (feedback.type === 'approval_reject') {
            updates.feedbackScore = 2;
        }
        // Update edit info
        if (feedback.type === 'user_edit' && feedback.userEdit) {
            updates.userEdited = true;
            updates.editDiff = this.computeDiff(feedback.originalOutput, feedback.userEdit);
        }
        // Apply updates if any
        if (Object.keys(updates).length > 0) {
            await prisma.agentTrace.update({
                where: { id: feedback.traceId },
                data: updates,
            });
        }
    }
    computeDiff(original, edited) {
        // Simple diff computation (can be enhanced with proper diff library)
        if (original === edited) {
            return JSON.stringify({ type: 'no_change' });
        }
        const lengthDiff = edited.length - original.length;
        const changeType = lengthDiff > 50
            ? 'addition'
            : lengthDiff < -50
                ? 'deletion'
                : 'modification';
        return JSON.stringify({
            type: changeType,
            originalLength: original.length,
            editedLength: edited.length,
            lengthDiff,
            // Store first 200 chars of each for analysis
            originalSnippet: original.slice(0, 200),
            editedSnippet: edited.slice(0, 200),
        });
    }
    async checkOptimizationThreshold(agentId) {
        // Count recent edits/corrections
        const recentCount = await prisma.agentFeedback.count({
            where: {
                agentId,
                type: {
                    in: ['USER_EDIT', 'EXPLICIT_CORRECTION'],
                },
                timestamp: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
                },
            },
        });
        // Threshold: 10+ edits in last 7 days
        if (recentCount >= 10) {
            console.log(`[FeedbackCollector] Optimization threshold reached for agent ${agentId} (${recentCount} edits)`);
            // Check if optimization is already running
            const existingRun = await prisma.optimizationRun.findFirst({
                where: {
                    agentId,
                    status: { in: ['analyzing', 'testing'] },
                },
            });
            if (!existingRun) {
                // TODO: Queue optimization job
                console.log(`[FeedbackCollector] Would trigger optimization job for agent ${agentId}`);
            }
        }
    }
    mapFeedbackType(type) {
        const mapping = {
            thumbs_up: 'THUMBS_UP',
            thumbs_down: 'THUMBS_DOWN',
            user_edit: 'USER_EDIT',
            approval_reject: 'APPROVAL_REJECT',
            explicit_correction: 'EXPLICIT_CORRECTION',
            retry_request: 'RETRY_REQUEST',
        };
        return mapping[type];
    }
}
exports.FeedbackCollector = FeedbackCollector;
// ============================================================================
// Static Query Methods
// ============================================================================
class FeedbackQuery {
    /**
     * Get all feedback for a conversation
     */
    static async getConversationFeedback(conversationId) {
        return await prisma.agentFeedback.findMany({
            where: { conversationId },
            orderBy: { timestamp: 'asc' },
        });
    }
    /**
     * Get edits dataset for optimization
     */
    static async getEditsForOptimization(agentId, limit = 100) {
        return await prisma.agentFeedback.findMany({
            where: {
                agentId,
                type: { in: ['USER_EDIT', 'EXPLICIT_CORRECTION'] },
            },
            orderBy: { timestamp: 'desc' },
            take: limit,
            include: {
                trace: {
                    include: {
                        conversation: {
                            include: {
                                messages: {
                                    where: { role: 'user' },
                                    orderBy: { createdAt: 'asc' },
                                    select: {
                                        content: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
    }
}
exports.FeedbackQuery = FeedbackQuery;
