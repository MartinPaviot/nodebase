/**
 * A/B Test Manager - Manages prompt A/B testing
 * Automatically routes traffic and tracks results
 */
import type { ABTestConfig, ABTestResult } from './types';
export declare class ABTestManager {
    /**
     * Start a new A/B test
     */
    startABTest(config: ABTestConfig): Promise<string>;
    /**
     * Get active A/B test for an agent
     */
    getActiveTest(agentId: string): Promise<ABTestResult | null>;
    /**
     * Select variant for this execution (routing logic)
     */
    selectVariant(agentId: string): Promise<'A' | 'B' | null>;
    /**
     * Get prompt for variant
     */
    getPromptForVariant(agentId: string, variant: 'A' | 'B'): Promise<string | null>;
    /**
     * Record trace result for variant
     */
    recordTraceResult(agentId: string, variant: 'A' | 'B', score: number): Promise<void>;
    /**
     * Check if test has enough samples to determine winner
     */
    private checkTestCompletion;
    /**
     * Manually select winner and rollout
     */
    selectWinner(testId: string, winner: 'A' | 'B'): Promise<void>;
    /**
     * Cancel an A/B test
     */
    cancelTest(testId: string): Promise<void>;
    /**
     * Rollout winning prompt to agent
     */
    private rolloutWinner;
    /**
     * Get all A/B tests for an agent
     */
    getTests(agentId: string, limit?: number): Promise<ABTestResult[]>;
    /**
     * Get test by ID
     */
    getTest(testId: string): Promise<ABTestResult | null>;
}
//# sourceMappingURL=ab-test-manager.d.ts.map