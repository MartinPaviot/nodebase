/**
 * Hallucination Detector - Detects potential hallucinations
 * Simple heuristic-based approach
 */
import type { TraceData } from './types';
export declare class HallucinationDetector {
    private hallucinationIndicators;
    /**
     * Detect potential hallucinations in conversation
     */
    detect(messages: any[], traces: TraceData[]): Promise<boolean>;
    /**
     * Check if text contains placeholder patterns
     */
    private hasPlaceholders;
    /**
     * Get tool failure rate from traces
     */
    private getToolFailureRate;
    /**
     * Detect specific hallucination patterns
     */
    detectPatterns(text: string): string[];
    /**
     * Check for vague references (might indicate fabrication)
     */
    private hasVagueReferences;
    /**
     * Check for uncertain language
     */
    private hasUncertainLanguage;
}
//# sourceMappingURL=hallucination-detector.d.ts.map