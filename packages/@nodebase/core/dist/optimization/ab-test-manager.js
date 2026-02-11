"use strict";
/**
 * A/B Test Manager - Manages prompt A/B testing
 * Automatically routes traffic and tracks results
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ABTestManager = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class ABTestManager {
    /**
     * Start a new A/B test
     */
    async startABTest(config) {
        const test = await prisma.agentABTest.create({
            data: {
                agentId: config.agentId,
                variantAPrompt: config.variantAPrompt,
                variantBPrompt: config.variantBPrompt,
                trafficSplit: config.trafficSplit,
                status: 'RUNNING',
            },
        });
        console.log(`[ABTestManager] Started A/B test ${test.id} for agent ${config.agentId} (${(config.trafficSplit * 100).toFixed(0)}% to B)`);
        return test.id;
    }
    /**
     * Get active A/B test for an agent
     */
    async getActiveTest(agentId) {
        const test = await prisma.agentABTest.findFirst({
            where: {
                agentId,
                status: 'RUNNING',
            },
            orderBy: { startedAt: 'desc' },
        });
        if (!test)
            return null;
        return {
            id: test.id,
            agentId: test.agentId,
            status: 'running',
            trafficSplit: test.trafficSplit,
            variantATraces: test.variantATraces,
            variantBTraces: test.variantBTraces,
            variantAScore: test.variantAScore || undefined,
            variantBScore: test.variantBScore || undefined,
            winningVariant: test.winningVariant || undefined,
            startedAt: test.startedAt,
            endedAt: test.endedAt || undefined,
        };
    }
    /**
     * Select variant for this execution (routing logic)
     */
    async selectVariant(agentId) {
        const test = await this.getActiveTest(agentId);
        if (!test) {
            return null; // No active test, use default
        }
        // Route based on traffic split
        const random = Math.random();
        if (random < test.trafficSplit) {
            return 'B'; // Use new prompt
        }
        else {
            return 'A'; // Use current prompt
        }
    }
    /**
     * Get prompt for variant
     */
    async getPromptForVariant(agentId, variant) {
        const test = await prisma.agentABTest.findFirst({
            where: {
                agentId,
                status: 'RUNNING',
            },
            orderBy: { startedAt: 'desc' },
        });
        if (!test)
            return null;
        return variant === 'A' ? test.variantAPrompt : test.variantBPrompt;
    }
    /**
     * Record trace result for variant
     */
    async recordTraceResult(agentId, variant, score) {
        const test = await prisma.agentABTest.findFirst({
            where: {
                agentId,
                status: 'RUNNING',
            },
            orderBy: { startedAt: 'desc' },
        });
        if (!test)
            return;
        // Update trace count and average score
        if (variant === 'A') {
            const newCount = test.variantATraces + 1;
            const currentScore = test.variantAScore || 0;
            const newScore = (currentScore * test.variantATraces + score) / newCount;
            await prisma.agentABTest.update({
                where: { id: test.id },
                data: {
                    variantATraces: newCount,
                    variantAScore: newScore,
                },
            });
        }
        else {
            const newCount = test.variantBTraces + 1;
            const currentScore = test.variantBScore || 0;
            const newScore = (currentScore * test.variantBTraces + score) / newCount;
            await prisma.agentABTest.update({
                where: { id: test.id },
                data: {
                    variantBTraces: newCount,
                    variantBScore: newScore,
                },
            });
        }
        // Check if test should complete (enough samples)
        await this.checkTestCompletion(test.id);
    }
    /**
     * Check if test has enough samples to determine winner
     */
    async checkTestCompletion(testId) {
        const test = await prisma.agentABTest.findUnique({
            where: { id: testId },
        });
        if (!test || test.status !== 'RUNNING')
            return;
        // Minimum samples: 50 per variant
        const minSamples = 50;
        if (test.variantATraces < minSamples || test.variantBTraces < minSamples) {
            return;
        }
        // Calculate winner
        const scoreA = test.variantAScore || 0;
        const scoreB = test.variantBScore || 0;
        // Need significant difference (5+ points)
        const significantDiff = 5;
        if (Math.abs(scoreA - scoreB) < significantDiff) {
            // No clear winner yet, continue testing
            return;
        }
        // Determine winner
        const winner = scoreB > scoreA ? 'B' : 'A';
        await prisma.agentABTest.update({
            where: { id: testId },
            data: {
                status: 'COMPLETED',
                endedAt: new Date(),
                winningVariant: winner,
            },
        });
        console.log(`[ABTestManager] Test ${testId} completed. Winner: ${winner} (A: ${scoreA.toFixed(1)}, B: ${scoreB.toFixed(1)})`);
        // If B wins, update agent prompt
        if (winner === 'B') {
            await this.rolloutWinner(test.agentId, test.variantBPrompt);
        }
    }
    /**
     * Manually select winner and rollout
     */
    async selectWinner(testId, winner) {
        const test = await prisma.agentABTest.findUnique({
            where: { id: testId },
        });
        if (!test) {
            throw new Error(`Test ${testId} not found`);
        }
        await prisma.agentABTest.update({
            where: { id: testId },
            data: {
                status: 'COMPLETED',
                endedAt: new Date(),
                winningVariant: winner,
            },
        });
        // Rollout winner
        if (winner === 'B') {
            await this.rolloutWinner(test.agentId, test.variantBPrompt);
        }
        console.log(`[ABTestManager] Manually selected winner ${winner} for test ${testId}`);
    }
    /**
     * Cancel an A/B test
     */
    async cancelTest(testId) {
        await prisma.agentABTest.update({
            where: { id: testId },
            data: {
                status: 'CANCELLED',
                endedAt: new Date(),
            },
        });
        console.log(`[ABTestManager] Cancelled test ${testId}`);
    }
    /**
     * Rollout winning prompt to agent
     */
    async rolloutWinner(agentId, newPrompt) {
        await prisma.agent.update({
            where: { id: agentId },
            data: {
                systemPrompt: newPrompt,
            },
        });
        console.log(`[ABTestManager] Rolled out winning prompt to agent ${agentId}`);
    }
    /**
     * Get all A/B tests for an agent
     */
    async getTests(agentId, limit = 10) {
        const tests = await prisma.agentABTest.findMany({
            where: { agentId },
            orderBy: { startedAt: 'desc' },
            take: limit,
        });
        return tests.map((test) => ({
            id: test.id,
            agentId: test.agentId,
            status: test.status.toLowerCase(),
            variantATraces: test.variantATraces,
            variantBTraces: test.variantBTraces,
            variantAScore: test.variantAScore || undefined,
            variantBScore: test.variantBScore || undefined,
            winningVariant: test.winningVariant || undefined,
            startedAt: test.startedAt,
            endedAt: test.endedAt || undefined,
        }));
    }
    /**
     * Get test by ID
     */
    async getTest(testId) {
        const test = await prisma.agentABTest.findUnique({
            where: { id: testId },
        });
        if (!test)
            return null;
        return {
            id: test.id,
            agentId: test.agentId,
            status: test.status.toLowerCase(),
            trafficSplit: test.trafficSplit,
            variantATraces: test.variantATraces,
            variantBTraces: test.variantBTraces,
            variantAScore: test.variantAScore || undefined,
            variantBScore: test.variantBScore || undefined,
            winningVariant: test.winningVariant || undefined,
            startedAt: test.startedAt,
            endedAt: test.endedAt || undefined,
        };
    }
}
exports.ABTestManager = ABTestManager;
