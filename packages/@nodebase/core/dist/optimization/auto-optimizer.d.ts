/**
 * Auto-Optimizer - Automatic prompt optimization
 * Inspired by Promptim's optimization loop
 *
 * Flow: Feedback → Patterns → Variations → Test → A/B Test
 */
import type { OptimizationResult } from './types';
export declare class AutoOptimizer {
    private abTestManager;
    constructor();
    /**
     * Optimize an agent based on accumulated feedback
     */
    optimizeAgent(agentId: string): Promise<OptimizationResult>;
    /**
     * Build dataset from feedback
     */
    private buildDataset;
    /**
     * Analyze edit patterns using LLM
     */
    private analyzeEditPatterns;
    /**
     * Generate prompt variations using LLM
     */
    private generatePromptVariations;
    /**
     * Test variations on dataset
     */
    private testVariations;
    /**
     * Score similarity between two outputs
     */
    private scoreOutputSimilarity;
    /**
     * Select best variation
     */
    private selectBest;
    /**
     * Generate recommendation
     */
    private generateRecommendation;
    private getCurrentPrompt;
    private saveOptimizationRun;
}
export declare class OptimizationQuery {
    /**
     * Get optimization runs for an agent
     */
    static getOptimizationRuns(agentId: string, limit?: number): Promise<any>;
    /**
     * Get latest optimization run
     */
    static getLatestRun(agentId: string): Promise<any>;
}
//# sourceMappingURL=auto-optimizer.d.ts.map