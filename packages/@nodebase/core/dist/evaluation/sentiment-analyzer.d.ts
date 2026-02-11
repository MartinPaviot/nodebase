/**
 * Sentiment Analyzer - Detects sentiment in text
 * Simple keyword-based approach (can be replaced with ML model)
 */
import type { SentimentResult } from './types';
export declare class SentimentAnalyzer {
    private positiveKeywords;
    private negativeKeywords;
    /**
     * Analyze sentiment of text
     */
    analyze(text: string): SentimentResult;
    /**
     * Batch analyze multiple texts
     */
    analyzeBatch(texts: string[]): SentimentResult[];
    /**
     * Get average sentiment from multiple results
     */
    averageSentiment(results: SentimentResult[]): SentimentResult;
}
//# sourceMappingURL=sentiment-analyzer.d.ts.map