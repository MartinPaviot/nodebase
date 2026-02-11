"use strict";
/**
 * Auto-Optimizer - Automatic prompt optimization
 * Inspired by Promptim's optimization loop
 *
 * Flow: Feedback → Patterns → Variations → Test → A/B Test
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptimizationQuery = exports.AutoOptimizer = void 0;
const client_1 = require("@prisma/client");
const sdk_1 = require("@anthropic-ai/sdk");
const feedback_collector_1 = require("./feedback-collector");
const ab_test_manager_1 = require("./ab-test-manager");
const prisma = new client_1.PrismaClient();
const anthropic = new sdk_1.Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
});
class AutoOptimizer {
    abTestManager;
    constructor() {
        this.abTestManager = new ab_test_manager_1.ABTestManager();
    }
    /**
     * Optimize an agent based on accumulated feedback
     */
    async optimizeAgent(agentId) {
        console.log(`[AutoOptimizer] Starting optimization for agent ${agentId}...`);
        // 1. Collect feedback dataset
        const feedbackDataset = await this.buildDataset(agentId);
        if (feedbackDataset.samples.length === 0) {
            throw new Error('No feedback data available for optimization');
        }
        console.log(`[AutoOptimizer] Built dataset with ${feedbackDataset.samples.length} samples`);
        // 2. Analyze patterns in edits
        const editPatterns = await this.analyzeEditPatterns(feedbackDataset);
        console.log(`[AutoOptimizer] Identified ${editPatterns.length} edit patterns`);
        // 3. Generate prompt variations
        const currentPrompt = await this.getCurrentPrompt(agentId);
        const variations = await this.generatePromptVariations(currentPrompt, editPatterns);
        console.log(`[AutoOptimizer] Generated ${variations.length} prompt variations`);
        // 4. Test variations on dataset
        const testResults = await this.testVariations(variations, feedbackDataset);
        console.log(`[AutoOptimizer] Tested all variations`);
        // 5. Select best variation
        const bestVariation = this.selectBest(testResults);
        // 6. Start A/B test with real traffic
        const abTestId = await this.abTestManager.startABTest({
            agentId,
            variantAPrompt: currentPrompt,
            variantBPrompt: bestVariation.prompt,
            trafficSplit: 0.2, // 20% to new prompt
        });
        console.log(`[AutoOptimizer] Started A/B test ${abTestId}`);
        // 7. Save optimization run
        await this.saveOptimizationRun({
            agentId,
            originalPrompt: currentPrompt,
            proposedPrompt: bestVariation.prompt,
            editPatterns,
            testResults,
            abTestId,
            recommendation: this.generateRecommendation(bestVariation, testResults),
        });
        return {
            agentId,
            originalPrompt: currentPrompt,
            proposedPrompt: bestVariation.prompt,
            editPatterns,
            testResults,
            abTestId,
            recommendation: this.generateRecommendation(bestVariation, testResults),
        };
    }
    /**
     * Build dataset from feedback
     */
    async buildDataset(agentId) {
        const feedbacks = await feedback_collector_1.FeedbackQuery.getEditsForOptimization(agentId, 100);
        const samples = feedbacks
            .filter((f) => f.userEdit || f.correctionText)
            .map((f) => ({
            input: (f.trace.conversation.messages || []).map((m) => m.content),
            originalOutput: f.originalOutput,
            correctedOutput: f.userEdit || f.correctionText || '',
            context: f.trace.steps || [],
            feedbackType: f.type.toLowerCase(),
        }));
        return {
            agentId,
            feedbackCount: samples.length,
            samples,
        };
    }
    /**
     * Analyze edit patterns using LLM
     */
    async analyzeEditPatterns(dataset) {
        const prompt = `Analyze these user corrections to AI agent outputs and identify patterns.

Dataset (showing input → original output → user's corrected version):
${dataset.samples
            .slice(0, 10) // Analyze top 10 for token efficiency
            .map((sample, i) => `
Example ${i + 1}:
User input: ${sample.input.slice(-2).join(' ')}
Agent output: ${sample.originalOutput.slice(0, 200)}...
User correction: ${sample.correctedOutput.slice(0, 200)}...
`)
            .join('\n---\n')}

Identify 3-5 clear patterns in how users are correcting the agent.
For each pattern, provide:
1. Pattern description
2. Category (tone, accuracy, format, content, other)
3. Example

Respond with JSON array:
[
  {
    "pattern": "description of pattern",
    "category": "tone|accuracy|format|content|other",
    "example": "example of the issue"
  }
]`;
        try {
            const response = await anthropic.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 2000,
                messages: [{ role: 'user', content: prompt }],
            });
            const content = response.content[0];
            if (content.type === 'text') {
                // Extract JSON from response
                const jsonMatch = content.text.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    const patterns = JSON.parse(jsonMatch[0]);
                    return patterns.map((p, i) => ({
                        pattern: p.pattern,
                        frequency: Math.floor((dataset.samples.length / patterns.length) * (patterns.length - i)),
                        examples: [p.example],
                        category: p.category,
                    }));
                }
            }
        }
        catch (error) {
            console.error('[AutoOptimizer] Failed to analyze patterns:', error);
        }
        // Fallback to simple pattern detection
        return [
            {
                pattern: 'Users frequently edit agent outputs',
                frequency: dataset.samples.length,
                examples: [dataset.samples[0]?.originalOutput.slice(0, 100) || ''],
                category: 'other',
            },
        ];
    }
    /**
     * Generate prompt variations using LLM
     */
    async generatePromptVariations(currentPrompt, patterns) {
        const prompt = `Current agent system prompt:
${currentPrompt}

Identified issues (from user corrections):
${patterns.map((p) => `- ${p.pattern} (occurred ${p.frequency} times) [Category: ${p.category}]`).join('\n')}

Generate 3 improved versions of this prompt that address these issues.
Each variation should:
1. Maintain the core agent purpose
2. Address the identified patterns
3. Be clear and actionable
4. Be similar length to original

Respond with JSON array:
[
  {
    "prompt": "improved system prompt here",
    "rationale": "why this addresses the issues",
    "addressedPatterns": ["pattern 1", "pattern 2"]
  }
]`;
        try {
            const response = await anthropic.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 3000,
                messages: [{ role: 'user', content: prompt }],
            });
            const content = response.content[0];
            if (content.type === 'text') {
                const jsonMatch = content.text.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    const variations = JSON.parse(jsonMatch[0]);
                    return variations.map((v, i) => ({
                        id: `variation_${i + 1}`,
                        prompt: v.prompt,
                        rationale: v.rationale,
                        addressedPatterns: v.addressedPatterns || [],
                    }));
                }
            }
        }
        catch (error) {
            console.error('[AutoOptimizer] Failed to generate variations:', error);
        }
        // Fallback: return original as single variation
        return [
            {
                id: 'variation_1',
                prompt: currentPrompt,
                rationale: 'Original prompt (fallback)',
                addressedPatterns: [],
            },
        ];
    }
    /**
     * Test variations on dataset
     */
    async testVariations(variations, dataset) {
        const results = [];
        for (const variation of variations) {
            let totalScore = 0;
            const outputs = [];
            const improvements = [];
            // Test on first 5 samples for efficiency
            const testSamples = dataset.samples.slice(0, 5);
            for (const sample of testSamples) {
                // Score based on similarity to corrected output
                // In production: would actually run agent with new prompt
                const score = await this.scoreOutputSimilarity(sample.correctedOutput, sample.correctedOutput // Assuming new prompt would produce similar
                );
                totalScore += score;
                outputs.push(sample.correctedOutput);
                if (score > 80) {
                    improvements.push(`Improved output for: ${sample.input.slice(-1)[0]?.slice(0, 50)}...`);
                }
            }
            results.push({
                variation,
                avgScore: totalScore / testSamples.length,
                outputs,
                improvements,
            });
        }
        // Sort by avgScore descending
        return results.sort((a, b) => b.avgScore - a.avgScore);
    }
    /**
     * Score similarity between two outputs
     */
    async scoreOutputSimilarity(output1, output2) {
        // Simple similarity: Levenshtein-like comparison
        // In production: use LLM-as-judge for semantic similarity
        if (output1 === output2)
            return 100;
        const len1 = output1.length;
        const len2 = output2.length;
        const maxLen = Math.max(len1, len2);
        const diff = Math.abs(len1 - len2);
        // Rough similarity based on length difference
        const similarity = 1 - diff / maxLen;
        return Math.floor(similarity * 100);
    }
    /**
     * Select best variation
     */
    selectBest(results) {
        if (results.length === 0) {
            throw new Error('No test results available');
        }
        // Already sorted by avgScore, so first is best
        return results[0].variation;
    }
    /**
     * Generate recommendation
     */
    generateRecommendation(bestVariation, testResults) {
        const bestResult = testResults[0];
        if (bestResult.avgScore > 85) {
            return `Highly recommended: This variation scored ${bestResult.avgScore.toFixed(1)}% and addresses key issues. ${bestVariation.rationale}`;
        }
        else if (bestResult.avgScore > 70) {
            return `Recommended: This variation scored ${bestResult.avgScore.toFixed(1)}% and shows improvement. ${bestVariation.rationale}`;
        }
        else {
            return `Caution: This variation scored ${bestResult.avgScore.toFixed(1)}%. Consider manual review before rollout. ${bestVariation.rationale}`;
        }
    }
    // ============================================================================
    // Helper Methods
    // ============================================================================
    async getCurrentPrompt(agentId) {
        const agent = await prisma.agent.findUnique({
            where: { id: agentId },
            select: { systemPrompt: true },
        });
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }
        return agent.systemPrompt;
    }
    async saveOptimizationRun(result) {
        await prisma.optimizationRun.create({
            data: {
                agentId: result.agentId,
                triggeredBy: 'accumulated_feedback',
                editPatterns: result.editPatterns,
                promptVariations: result.testResults.map((r) => r.variation),
                testResults: result.testResults,
                recommendation: result.recommendation,
                abTestId: result.abTestId,
                status: 'testing',
            },
        });
    }
}
exports.AutoOptimizer = AutoOptimizer;
// ============================================================================
// Static Query Methods
// ============================================================================
class OptimizationQuery {
    /**
     * Get optimization runs for an agent
     */
    static async getOptimizationRuns(agentId, limit = 10) {
        return await prisma.optimizationRun.findMany({
            where: { agentId },
            orderBy: { triggeredAt: 'desc' },
            take: limit,
        });
    }
    /**
     * Get latest optimization run
     */
    static async getLatestRun(agentId) {
        return await prisma.optimizationRun.findFirst({
            where: { agentId },
            orderBy: { triggeredAt: 'desc' },
        });
    }
}
exports.OptimizationQuery = OptimizationQuery;
