/**
 * Multi-Turn Evaluation System
 *
 * Evaluates entire conversations, not just single messages:
 * - Goal completion tracking
 * - User satisfaction scoring
 * - Conversation quality metrics
 * - Pattern detection (successful vs failed conversations)
 */

import { nanoid } from "nanoid";

// ============================================
// Types
// ============================================

export interface EvaluationCriteria {
  goalCompletion: {
    enabled: boolean;
    expectedGoals: string[]; // e.g., ["book_meeting", "answer_question"]
  };
  userSatisfaction: {
    enabled: boolean;
    indicators: string[]; // e.g., ["positive_feedback", "task_completion"]
  };
  conversationQuality: {
    enabled: boolean;
    metrics: string[]; // e.g., ["coherence", "relevance", "helpfulness"]
  };
  customCriteria?: Record<string, unknown>;
}

export interface EvaluationResult {
  id: string;
  conversationId: string;
  agentId: string;
  userId: string;
  workspaceId: string;

  // Goal completion
  goalsDetected: string[];
  goalsCompleted: string[];
  goalCompletionRate: number; // 0-1

  // User satisfaction
  satisfactionScore: number; // 0-1
  satisfactionIndicators: Record<string, boolean>;

  // Conversation quality
  qualityScores: Record<string, number>; // 0-1 per metric
  overallQualityScore: number; // 0-1

  // Metadata
  turnCount: number;
  durationMs: number;
  evaluatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface ConversationTurn {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ============================================
// Multi-Turn Evaluator
// ============================================

export class ConversationEvaluator {
  constructor(
    private criteria: EvaluationCriteria,
    private llmEvaluate?: (prompt: string) => Promise<Record<string, unknown>>
  ) {}

  /**
   * Evaluate a complete conversation
   */
  async evaluateConversation(params: {
    conversationId: string;
    agentId: string;
    userId: string;
    workspaceId: string;
    turns: ConversationTurn[];
    startedAt: Date;
    endedAt: Date;
  }): Promise<EvaluationResult> {
    const durationMs = params.endedAt.getTime() - params.startedAt.getTime();

    // Evaluate goal completion
    const goalResults = await this.evaluateGoalCompletion(params.turns);

    // Evaluate user satisfaction
    const satisfactionResults = await this.evaluateUserSatisfaction(params.turns);

    // Evaluate conversation quality
    const qualityResults = await this.evaluateQuality(params.turns);

    return {
      id: `eval_${nanoid(12)}`,
      conversationId: params.conversationId,
      agentId: params.agentId,
      userId: params.userId,
      workspaceId: params.workspaceId,
      goalsDetected: goalResults.detected,
      goalsCompleted: goalResults.completed,
      goalCompletionRate: goalResults.completionRate,
      satisfactionScore: satisfactionResults.score,
      satisfactionIndicators: satisfactionResults.indicators,
      qualityScores: qualityResults.scores,
      overallQualityScore: qualityResults.overallScore,
      turnCount: params.turns.length,
      durationMs,
      evaluatedAt: new Date(),
    };
  }

  /**
   * Evaluate goal completion
   */
  private async evaluateGoalCompletion(turns: ConversationTurn[]): Promise<{
    detected: string[];
    completed: string[];
    completionRate: number;
  }> {
    if (!this.criteria.goalCompletion.enabled) {
      return { detected: [], completed: [], completionRate: 1 };
    }

    const detected: string[] = [];
    const completed: string[] = [];

    // Use LLM to detect goals if available
    if (this.llmEvaluate) {
      const conversationText = turns
        .map(t => `${t.role}: ${t.content}`)
        .join("\n");

      const prompt = `Analyze this conversation and identify which goals were detected and completed.

Expected goals: ${this.criteria.goalCompletion.expectedGoals.join(", ")}

Conversation:
${conversationText}

Return a JSON object with:
- detected: array of goal names that were discussed
- completed: array of goal names that were successfully completed

Example: {"detected": ["book_meeting"], "completed": ["book_meeting"]}`;

      try {
        const result = await this.llmEvaluate(prompt);
        detected.push(...(result.detected as string[] || []));
        completed.push(...(result.completed as string[] || []));
      } catch (error) {
        console.error("[ConversationEvaluator] Goal evaluation failed:", error);
      }
    } else {
      // Fallback: Simple keyword matching
      const conversationText = turns
        .map(t => t.content.toLowerCase())
        .join(" ");

      for (const goal of this.criteria.goalCompletion.expectedGoals) {
        if (conversationText.includes(goal.toLowerCase())) {
          detected.push(goal);
          // Simple heuristic: if mentioned and no "failed" or "unable", mark as completed
          if (!conversationText.includes("failed") && !conversationText.includes("unable")) {
            completed.push(goal);
          }
        }
      }
    }

    const completionRate = detected.length > 0
      ? completed.length / detected.length
      : 1;

    return { detected, completed, completionRate };
  }

  /**
   * Evaluate user satisfaction
   */
  private async evaluateUserSatisfaction(turns: ConversationTurn[]): Promise<{
    score: number;
    indicators: Record<string, boolean>;
  }> {
    if (!this.criteria.userSatisfaction.enabled) {
      return { score: 1, indicators: {} };
    }

    const indicators: Record<string, boolean> = {};

    // Use LLM for sophisticated analysis if available
    if (this.llmEvaluate) {
      const conversationText = turns
        .map(t => `${t.role}: ${t.content}`)
        .join("\n");

      const prompt = `Analyze user satisfaction in this conversation.

Look for these indicators: ${this.criteria.userSatisfaction.indicators.join(", ")}

Conversation:
${conversationText}

Return a JSON object with:
- score: overall satisfaction score from 0 to 1
- indicators: object with boolean for each indicator

Example: {"score": 0.8, "indicators": {"positive_feedback": true, "task_completion": true}}`;

      try {
        const result = await this.llmEvaluate(prompt);
        Object.assign(indicators, result.indicators || {});
        return {
          score: (result.score as number) || 0.5,
          indicators: result.indicators as Record<string, boolean> || {},
        };
      } catch (error) {
        console.error("[ConversationEvaluator] Satisfaction evaluation failed:", error);
      }
    }

    // Fallback: Simple sentiment analysis
    const userTurns = turns.filter(t => t.role === "user");
    const positiveWords = ["thanks", "great", "perfect", "excellent", "helpful", "yes"];
    const negativeWords = ["bad", "wrong", "no", "terrible", "unhelpful", "frustrated"];

    let positiveCount = 0;
    let negativeCount = 0;

    for (const turn of userTurns) {
      const content = turn.content.toLowerCase();
      positiveCount += positiveWords.filter(w => content.includes(w)).length;
      negativeCount += negativeWords.filter(w => content.includes(w)).length;
    }

    const score = Math.max(0, Math.min(1,
      (positiveCount - negativeCount) / Math.max(1, userTurns.length)
    ));

    return { score: score || 0.5, indicators };
  }

  /**
   * Evaluate conversation quality
   */
  private async evaluateQuality(turns: ConversationTurn[]): Promise<{
    scores: Record<string, number>;
    overallScore: number;
  }> {
    if (!this.criteria.conversationQuality.enabled) {
      return { scores: {}, overallScore: 1 };
    }

    const scores: Record<string, number> = {};

    // Use LLM for quality assessment if available
    if (this.llmEvaluate) {
      const conversationText = turns
        .map(t => `${t.role}: ${t.content}`)
        .join("\n");

      const prompt = `Evaluate the quality of this conversation on these metrics: ${this.criteria.conversationQuality.metrics.join(", ")}

Conversation:
${conversationText}

Rate each metric from 0 to 1 (0 = very poor, 1 = excellent).

Return a JSON object with scores for each metric.

Example: {"coherence": 0.9, "relevance": 0.85, "helpfulness": 0.8}`;

      try {
        const result = await this.llmEvaluate(prompt);
        Object.assign(scores, result);
      } catch (error) {
        console.error("[ConversationEvaluator] Quality evaluation failed:", error);
      }
    } else {
      // Fallback: Basic heuristics
      for (const metric of this.criteria.conversationQuality.metrics) {
        // Simple heuristic: if conversation is long enough and has back-and-forth, score higher
        if (metric === "coherence") {
          scores[metric] = Math.min(1, turns.length / 10);
        } else if (metric === "relevance") {
          scores[metric] = 0.7; // Default moderate score
        } else if (metric === "helpfulness") {
          scores[metric] = 0.7; // Default moderate score
        } else {
          scores[metric] = 0.5; // Default neutral score
        }
      }
    }

    // Calculate overall score as average of all metrics
    const overallScore = Object.values(scores).length > 0
      ? Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.values(scores).length
      : 0.5;

    return { scores, overallScore };
  }
}

// ============================================
// Factory Function
// ============================================

export function createEvaluator(
  criteria: EvaluationCriteria,
  llmEvaluate?: (prompt: string) => Promise<Record<string, unknown>>
): ConversationEvaluator {
  return new ConversationEvaluator(criteria, llmEvaluate);
}

// Types are already exported with their definitions above
