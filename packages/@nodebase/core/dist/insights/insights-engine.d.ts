/**
 * Insights Engine - Auto-categorization and pattern detection
 * Inspired by LangSmith Insights Agent
 */
import type { AgentInsights } from './types';
export declare class InsightsEngine {
    /**
     * Generate insights for an agent over a timeframe
     */
    generateInsights(agentId: string, timeframe: {
        from: Date;
        to: Date;
    }): Promise<AgentInsights>;
    /**
     * Cluster conversations by similarity
     * Simple keyword-based clustering (can be replaced with embeddings)
     */
    private clusterConversations;
    /**
     * Identify usage patterns from clusters
     */
    private identifyPatterns;
    /**
     * Detect anomalies (cost, latency, failures)
     */
    private detectAnomalies;
    /**
     * Find optimization opportunities
     */
    private findOptimizationOpportunities;
    private loadTraces;
    private extractKeywords;
    private generateClusterLabel;
    private generateRecommendation;
    private saveInsights;
}
export declare class InsightsQuery {
    /**
     * Get latest insights for an agent
     */
    static getLatestInsights(agentId: string): Promise<any>;
    /**
     * Get all insights for an agent
     */
    static getAgentInsights(agentId: string, limit?: number): Promise<any>;
}
//# sourceMappingURL=insights-engine.d.ts.map