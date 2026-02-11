/**
 * L2 Eval - Rule-Based Scoring
 *
 * Scores quality of AI output (0-100)
 * Based on heuristics and rules
 * Faster than L3 (no LLM needed)
 *
 * Dimensions:
 * - Relevance (on-topic, addresses query)
 * - Quality (grammar, structure, clarity)
 * - Tone (professional, friendly, appropriate)
 * - Completeness (all info present, no gaps)
 *
 * Usage:
 * ```typescript
 * const result = await evaluateL2(text, { minScore: 60 });
 * if (result.score < 60) {
 *   console.log("Low quality:", result.breakdown);
 * }
 * ```
 */

// ============================================
// TYPES
// ============================================

export interface L2Config {
  minScore: number; // 0-100
  weights?: {
    relevance?: number;
    quality?: number;
    tone?: number;
    completeness?: number;
  };
}

export interface ScoreDimension {
  dimension: string;
  score: number; // 0-100
  weight: number; // 0-1
  issues: string[];
}

export interface L2EvalResult {
  score: number; // 0-100 (weighted average)
  passed: boolean; // score >= minScore
  breakdown: ScoreDimension[];
  recommendations: string[];
}

// ============================================
// SCORING FUNCTIONS
// ============================================

class Scorer {
  /**
   * Score relevance (is response on-topic?)
   */
  static scoreRelevance(text: string, query?: string): ScoreDimension {
    const issues: string[] = [];
    let score = 100;

    // Check length (too short = not relevant)
    if (text.length < 50) {
      score -= 30;
      issues.push("Response too short");
    }

    // Check for filler phrases
    const fillerPhrases = [
      "I don't have enough information",
      "I cannot answer",
      "I'm not sure",
      "I don't know",
    ];

    for (const phrase of fillerPhrases) {
      if (text.toLowerCase().includes(phrase.toLowerCase())) {
        score -= 20;
        issues.push(`Contains filler: "${phrase}"`);
      }
    }

    // If query provided, check keyword overlap
    if (query) {
      const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const textLower = text.toLowerCase();
      const matchedWords = queryWords.filter((w) => textLower.includes(w));
      const overlapRatio = matchedWords.length / queryWords.length;

      if (overlapRatio < 0.3) {
        score -= 30;
        issues.push("Low keyword overlap with query");
      }
    }

    return {
      dimension: "relevance",
      score: Math.max(0, score),
      weight: 0.3,
      issues,
    };
  }

  /**
   * Score quality (grammar, structure, clarity)
   */
  static scoreQuality(text: string): ScoreDimension {
    const issues: string[] = [];
    let score = 100;

    // Check for basic grammar issues
    const grammarIssues = [
      { pattern: /\b(their|there|they're)\s+(is|are)\s+(no|not)\b/gi, desc: "their/there/they're confusion" },
      { pattern: /\b(your|you're)\s+(going|gonna)\b/gi, desc: "your/you're confusion" },
      { pattern: /\.\s*[a-z]/g, desc: "Missing capitalization after period" },
      { pattern: /[a-z]\.[A-Z]/g, desc: "Missing space after period" },
    ];

    for (const issue of grammarIssues) {
      const matches = text.match(issue.pattern);
      if (matches) {
        score -= 10 * Math.min(matches.length, 3);
        issues.push(`Grammar: ${issue.desc}`);
      }
    }

    // Check structure (paragraphs, sentences)
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const avgSentenceLength = text.length / sentences.length;

    if (avgSentenceLength > 200) {
      score -= 15;
      issues.push("Sentences too long");
    }

    if (avgSentenceLength < 10) {
      score -= 15;
      issues.push("Sentences too short");
    }

    // Check for run-on sentences (no punctuation for 150+ chars)
    const runOnRegex = /[^.!?]{150,}/g;
    const runOns = text.match(runOnRegex);
    if (runOns) {
      score -= 10 * Math.min(runOns.length, 2);
      issues.push("Run-on sentences detected");
    }

    return {
      dimension: "quality",
      score: Math.max(0, score),
      weight: 0.25,
      issues,
    };
  }

  /**
   * Score tone (professional, friendly, appropriate)
   */
  static scoreTone(text: string, expectedTone: "professional" | "friendly" | "casual" = "professional"): ScoreDimension {
    const issues: string[] = [];
    let score = 100;

    const lowerText = text.toLowerCase();

    // Check for excessive exclamation marks
    const exclamationCount = (text.match(/!/g) || []).length;
    if (exclamationCount > 3) {
      score -= 10;
      issues.push("Too many exclamation marks");
    }

    // Check for ALL CAPS
    const capsWords = text.match(/\b[A-Z]{3,}\b/g);
    if (capsWords && capsWords.length > 2) {
      score -= 15;
      issues.push("Excessive use of ALL CAPS");
    }

    // Tone-specific checks
    if (expectedTone === "professional") {
      // Check for informal language
      const informalPhrases = ["gonna", "wanna", "kinda", "sorta", "yeah", "nah", "lol"];
      for (const phrase of informalPhrases) {
        if (lowerText.includes(phrase)) {
          score -= 10;
          issues.push(`Informal language: "${phrase}"`);
        }
      }

      // Check for contractions (optional)
      const contractions = ["don't", "can't", "won't", "shouldn't", "wouldn't"];
      const contractionCount = contractions.filter((c) => lowerText.includes(c)).length;
      if (contractionCount > 3) {
        score -= 5;
        issues.push("Too many contractions for professional tone");
      }
    }

    if (expectedTone === "friendly") {
      // Check for overly formal language
      const formalPhrases = ["pursuant to", "aforementioned", "herewith", "heretofore"];
      for (const phrase of formalPhrases) {
        if (lowerText.includes(phrase)) {
          score -= 10;
          issues.push(`Too formal: "${phrase}"`);
        }
      }

      // Friendly should have some warmth
      const warmPhrases = ["thank", "appreciate", "happy", "glad", "looking forward"];
      const hasWarmth = warmPhrases.some((phrase) => lowerText.includes(phrase));
      if (!hasWarmth && text.length > 100) {
        score -= 15;
        issues.push("Lacks warmth for friendly tone");
      }
    }

    return {
      dimension: "tone",
      score: Math.max(0, score),
      weight: 0.2,
      issues,
    };
  }

  /**
   * Score completeness (all info present)
   */
  static scoreCompleteness(text: string, requiredElements?: string[]): ScoreDimension {
    const issues: string[] = [];
    let score = 100;

    // Check for closing/sign-off
    const hasClosing = /\b(best regards|sincerely|cheers|thanks|thank you|regards)\b/i.test(text);
    if (!hasClosing && text.length > 100) {
      score -= 10;
      issues.push("Missing closing/sign-off");
    }

    // Check for greeting
    const hasGreeting = /\b(hi|hello|dear|greetings)\b/i.test(text.slice(0, 50));
    if (!hasGreeting && text.length > 100) {
      score -= 10;
      issues.push("Missing greeting");
    }

    // Check required elements
    if (requiredElements) {
      for (const element of requiredElements) {
        if (!text.toLowerCase().includes(element.toLowerCase())) {
          score -= 20;
          issues.push(`Missing required element: "${element}"`);
        }
      }
    }

    // Check for incomplete sentences
    if (!text.trim().match(/[.!?]$/)) {
      score -= 15;
      issues.push("Incomplete last sentence");
    }

    return {
      dimension: "completeness",
      score: Math.max(0, score),
      weight: 0.25,
      issues,
    };
  }
}

// ============================================
// L2 EVALUATOR
// ============================================

export class L2Evaluator {
  /**
   * Evaluate text with rule-based scoring
   */
  static async evaluate(
    text: string,
    config: L2Config,
    context?: {
      query?: string;
      expectedTone?: "professional" | "friendly" | "casual";
      requiredElements?: string[];
    }
  ): Promise<L2EvalResult> {
    // Default weights
    const weights = {
      relevance: 0.3,
      quality: 0.25,
      tone: 0.2,
      completeness: 0.25,
      ...config.weights,
    };

    // Score each dimension
    const relevance = Scorer.scoreRelevance(text, context?.query);
    relevance.weight = weights.relevance;

    const quality = Scorer.scoreQuality(text);
    quality.weight = weights.quality;

    const tone = Scorer.scoreTone(text, context?.expectedTone || "professional");
    tone.weight = weights.tone;

    const completeness = Scorer.scoreCompleteness(text, context?.requiredElements);
    completeness.weight = weights.completeness;

    const breakdown = [relevance, quality, tone, completeness];

    // Calculate weighted average
    const totalScore = breakdown.reduce((sum, dim) => sum + dim.score * dim.weight, 0);

    // Collect recommendations
    const recommendations: string[] = [];
    for (const dim of breakdown) {
      if (dim.score < 70) {
        recommendations.push(`Improve ${dim.dimension}: ${dim.issues.join(", ")}`);
      }
    }

    return {
      score: Math.round(totalScore),
      passed: totalScore >= config.minScore,
      breakdown,
      recommendations,
    };
  }

  /**
   * Quick score - just return number
   */
  static async quickScore(text: string): Promise<number> {
    const result = await this.evaluate(text, { minScore: 0 });
    return result.score;
  }
}

// ============================================
// CONVENIENCE EXPORTS
// ============================================

export const evaluateL2 = L2Evaluator.evaluate;
export const quickScoreL2 = L2Evaluator.quickScore;
