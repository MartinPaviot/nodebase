/**
 * Intent Analyzer - Natural Language → Structured Agent Intent
 * Uses Claude to parse user descriptions and extract agent specifications
 */
import type { AgentIntent } from './types';
export declare class IntentAnalyzer {
    /**
     * Analyze user description and extract structured agent intent
     */
    analyzeIntent(description: string, requirements?: string[]): Promise<AgentIntent>;
    /**
     * Build the analysis prompt for Claude
     */
    private buildAnalysisPrompt;
    /**
     * Suggest tools based on detected intent
     */
    suggestTools(intent: AgentIntent): string[];
    /**
     * Map category to default model tier
     */
    getRecommendedModelTier(intent: AgentIntent): 'haiku' | 'sonnet' | 'opus';
}
//# sourceMappingURL=intent-analyzer.d.ts.map