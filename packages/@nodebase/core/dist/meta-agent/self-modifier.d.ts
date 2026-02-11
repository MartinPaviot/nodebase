/**
 * Self-Modifier - Agents that propose their own improvements
 * Analyzes performance and suggests modifications (prompt, model, tools)
 */
import type { SelfModificationResult } from './types';
export declare class SelfModifier {
    /**
     * Analyze agent performance and propose modifications
     */
    proposeModifications(agentId: string): Promise<SelfModificationResult>;
    /**
     * Analyze agent performance over last 30 days
     */
    private analyzePerformance;
    /**
     * Check if agent is performing well
     */
    private isPerformingWell;
    /**
     * Generate modification proposals based on analysis
     */
    private generateProposals;
    /**
     * Refine prompt using Claude
     */
    private refinePrompt;
    /**
     * Save proposals to database
     */
    private saveProposals;
    /**
     * Map proposal type to Prisma enum
     */
    private mapProposalType;
    /**
     * Apply approved modification
     */
    applyModification(proposalId: string, approved: boolean): Promise<void>;
    /**
     * Extract common failures from evaluations
     */
    private extractCommonFailures;
    /**
     * Analyze tool usage from traces
     */
    private analyzeToolUsage;
    /**
     * Extract user complaints from conversation content
     */
    private extractUserComplaints;
    /**
     * Generate overall recommendation
     */
    private generateRecommendation;
}
//# sourceMappingURL=self-modifier.d.ts.map