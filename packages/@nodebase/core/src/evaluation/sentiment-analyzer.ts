/**
 * Sentiment Analyzer - Detects sentiment in text
 * Simple keyword-based approach (can be replaced with ML model)
 */

import type { SentimentResult } from './types';

export class SentimentAnalyzer {
  private positiveKeywords = [
    'thank',
    'thanks',
    'perfect',
    'great',
    'awesome',
    'excellent',
    'amazing',
    'wonderful',
    'fantastic',
    'love',
    'appreciate',
    'helpful',
    'worked',
    'works',
    'solved',
    'fixed',
    'success',
    'good',
    'nice',
    'happy',
    'satisfied',
  ];

  private negativeKeywords = [
    'bad',
    'terrible',
    'awful',
    'horrible',
    'wrong',
    'broken',
    'failed',
    'error',
    'problem',
    'issue',
    'bug',
    'not working',
    "doesn't work",
    'disappointed',
    'frustrated',
    'annoying',
    'useless',
    'waste',
    'unhappy',
    'dissatisfied',
  ];

  /**
   * Analyze sentiment of text
   */
  analyze(text: string): SentimentResult {
    const lowerText = text.toLowerCase();

    // Count positive and negative keywords
    const positiveCount = this.positiveKeywords.filter((kw) =>
      lowerText.includes(kw)
    ).length;

    const negativeCount = this.negativeKeywords.filter((kw) =>
      lowerText.includes(kw)
    ).length;

    // Calculate sentiment score (-1 to 1)
    const totalCount = positiveCount + negativeCount;
    if (totalCount === 0) {
      return {
        sentiment: 'neutral',
        score: 0,
        confidence: 0.3, // Low confidence when no keywords found
      };
    }

    const score = (positiveCount - negativeCount) / totalCount;

    // Determine sentiment
    let sentiment: 'positive' | 'neutral' | 'negative';
    if (score > 0.2) {
      sentiment = 'positive';
    } else if (score < -0.2) {
      sentiment = 'negative';
    } else {
      sentiment = 'neutral';
    }

    // Calculate confidence based on keyword count
    const confidence = Math.min(totalCount / 3, 1); // Max confidence at 3+ keywords

    return {
      sentiment,
      score,
      confidence,
    };
  }

  /**
   * Batch analyze multiple texts
   */
  analyzeBatch(texts: string[]): SentimentResult[] {
    return texts.map((text) => this.analyze(text));
  }

  /**
   * Get average sentiment from multiple results
   */
  averageSentiment(results: SentimentResult[]): SentimentResult {
    if (results.length === 0) {
      return {
        sentiment: 'neutral',
        score: 0,
        confidence: 0,
      };
    }

    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    let sentiment: 'positive' | 'neutral' | 'negative';
    if (avgScore > 0.2) {
      sentiment = 'positive';
    } else if (avgScore < -0.2) {
      sentiment = 'negative';
    } else {
      sentiment = 'neutral';
    }

    return {
      sentiment,
      score: avgScore,
      confidence: avgConfidence,
    };
  }
}
