/**
 * Multi-turn Evaluator - Evaluates complete conversations
 * Inspired by LangSmith's multi-turn evaluation capabilities
 */

import { PrismaClient } from '@prisma/client';
import type {
  ConversationEvalResult,
  ConversationData,
  TraceData,
  GoalCompletionResult,
} from './types';
import { SentimentAnalyzer } from './sentiment-analyzer';
import { HallucinationDetector } from './hallucination-detector';

const prisma = new PrismaClient();

export class MultiTurnEvaluator {
  private sentimentAnalyzer: SentimentAnalyzer;
  private hallucinationDetector: HallucinationDetector;

  constructor() {
    this.sentimentAnalyzer = new SentimentAnalyzer();
    this.hallucinationDetector = new HallucinationDetector();
  }

  /**
   * Evaluate a complete conversation
   */
  async evaluateConversation(conversationId: string): Promise<ConversationEvalResult> {
    // 1. Load full conversation with messages and traces
    const conversation = await this.loadConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const messages = conversation.messages;
    const traces = await this.loadTraces(conversationId);

    // 2. Goal completion detection
    const goalCompleted = await this.detectGoalCompletion(messages, traces);

    // 3. Satisfaction inference (from user signals)
    const satisfaction = await this.inferSatisfaction(messages, traces);

    // 4. Categorize conversation
    const categories = await this.categorize(messages);

    // 5. Detect failure modes
    const failures = await this.detectFailures(traces, messages);

    // 6. Generate improvement suggestions
    const suggestions = await this.suggestImprovements(traces, failures);

    // 7. Save evaluation to database
    await this.saveEvaluation(conversationId, {
      conversationId,
      goalCompleted: goalCompleted.completed,
      goalCompletionConfidence: goalCompleted.confidence,
      userSatisfactionScore: satisfaction,
      categories,
      failureModes: failures,
      improvementSuggestions: suggestions,
      metadata: {
        totalSteps: traces.reduce((sum, t) => sum + t.totalSteps, 0),
        totalCost: traces.reduce((sum, t) => sum + t.totalCost, 0),
        evaluatedAt: new Date().toISOString(),
      },
    });

    return {
      conversationId,
      goalCompleted: goalCompleted.completed,
      goalCompletionConfidence: goalCompleted.confidence,
      userSatisfactionScore: satisfaction,
      categories,
      failureModes: failures,
      improvementSuggestions: suggestions,
      metadata: {
        totalSteps: traces.reduce((sum, t) => sum + t.totalSteps, 0),
        totalCost: traces.reduce((sum, t) => sum + t.totalCost, 0),
      },
    };
  }

  /**
   * Detect if the user's goal was completed
   * Uses simple heuristics + sentiment analysis
   */
  private async detectGoalCompletion(
    messages: any[],
    traces: TraceData[]
  ): Promise<GoalCompletionResult> {
    // Check for explicit success signals
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
    if (lastUserMessage) {
      const content = lastUserMessage.content.toLowerCase();

      // Positive signals
      const positiveKeywords = [
        'thank',
        'thanks',
        'perfect',
        'great',
        'awesome',
        'excellent',
        'worked',
        'works',
        'done',
        'solved',
      ];

      const hasPositiveSignal = positiveKeywords.some((kw) =>
        content.includes(kw)
      );

      if (hasPositiveSignal) {
        return {
          completed: true,
          confidence: 0.8,
          reasoning: 'User expressed satisfaction with positive keywords',
        };
      }

      // Negative signals
      const negativeKeywords = [
        "didn't work",
        'not working',
        'failed',
        'error',
        'problem',
        'issue',
        'wrong',
        'broken',
      ];

      const hasNegativeSignal = negativeKeywords.some((kw) =>
        content.includes(kw)
      );

      if (hasNegativeSignal) {
        return {
          completed: false,
          confidence: 0.7,
          reasoning: 'User expressed dissatisfaction or reported issues',
        };
      }
    }

    // Check if conversation ended naturally (not aborted)
    const lastTrace = traces[traces.length - 1];
    if (lastTrace && lastTrace.status === 'COMPLETED') {
      return {
        completed: true,
        confidence: 0.6,
        reasoning: 'Conversation completed without errors',
      };
    }

    // Check tool success rate
    const totalTools = traces.reduce(
      (sum, t) => sum + t.toolSuccesses + t.toolFailures,
      0
    );
    const successRate =
      totalTools > 0
        ? traces.reduce((sum, t) => sum + t.toolSuccesses, 0) / totalTools
        : 1;

    if (successRate > 0.8) {
      return {
        completed: true,
        confidence: 0.5 + successRate * 0.3,
        reasoning: `High tool success rate (${(successRate * 100).toFixed(0)}%)`,
      };
    }

    // Default: uncertain
    return {
      completed: false,
      confidence: 0.3,
      reasoning: 'No clear completion signals detected',
    };
  }

  /**
   * Infer user satisfaction from signals
   */
  private async inferSatisfaction(
    messages: any[],
    traces: TraceData[]
  ): Promise<number> {
    let score = 3; // Default neutral

    // Check for positive sentiment in last user message
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
    if (lastUserMessage) {
      const sentiment = await this.sentimentAnalyzer.analyze(
        lastUserMessage.content
      );
      if (sentiment.sentiment === 'positive') {
        score += 1.5 * sentiment.confidence;
      } else if (sentiment.sentiment === 'negative') {
        score -= 1.5 * sentiment.confidence;
      }
    }

    // Check for user edits (negative signal)
    const hasEdits = traces.some((t) => t.userEdited);
    if (hasEdits) {
      score -= 1;
    }

    // Check tool failures (negative signal)
    const avgToolFailures =
      traces.reduce((sum, t) => sum + t.toolFailures, 0) / traces.length;
    if (avgToolFailures > 0) {
      score -= Math.min(avgToolFailures * 0.5, 1.5);
    }

    // Check explicit feedback
    const explicitFeedback = traces.find((t) => t.feedbackScore !== null);
    if (explicitFeedback) {
      score = explicitFeedback.feedbackScore!;
    }

    // Clamp to 1-5 range
    return Math.max(1, Math.min(5, Math.round(score * 10) / 10));
  }

  /**
   * Categorize conversation by topic
   */
  private async categorize(messages: any[]): Promise<string[]> {
    const conversationText = messages
      .map((m) => m.content)
      .join(' ')
      .toLowerCase();

    const categories: string[] = [];

    // Simple keyword-based categorization
    // TODO: Replace with embedding-based similarity
    const categoryKeywords: Record<string, string[]> = {
      sales: ['deal', 'lead', 'prospect', 'quote', 'proposal', 'crm', 'pipeline'],
      support: ['ticket', 'issue', 'bug', 'help', 'problem', 'error', 'fix'],
      marketing: ['campaign', 'email', 'newsletter', 'content', 'seo', 'analytics'],
      research: ['analyze', 'research', 'data', 'insight', 'report', 'study'],
      hr: ['candidate', 'resume', 'interview', 'hire', 'onboard', 'employee'],
      finance: ['invoice', 'payment', 'billing', 'expense', 'budget', 'revenue'],
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const matches = keywords.filter((kw) => conversationText.includes(kw));
      if (matches.length >= 2) {
        categories.push(category);
      }
    }

    return categories.length > 0 ? categories : ['general'];
  }

  /**
   * Detect failure modes
   */
  private async detectFailures(
    traces: TraceData[],
    messages: any[]
  ): Promise<string[]> {
    const failures: string[] = [];

    // Check for blocked L3 eval
    if (traces.some((t: any) => t.l3Blocked)) {
      failures.push('unsafe_output');
    }

    // Check for high tool failure rate
    const totalTools = traces.reduce(
      (sum, t) => sum + t.toolSuccesses + t.toolFailures,
      0
    );
    const failureRate =
      totalTools > 0
        ? traces.reduce((sum, t) => sum + t.toolFailures, 0) / totalTools
        : 0;

    if (failureRate > 0.3) {
      failures.push('tool_errors');
    }

    // Check for max steps reached
    if (traces.some((t) => t.totalSteps >= 5)) {
      failures.push('max_steps_reached');
    }

    // Check for hallucinations
    const hasHallucination = await this.hallucinationDetector.detect(
      messages,
      traces
    );
    if (hasHallucination) {
      failures.push('hallucination');
    }

    return failures;
  }

  /**
   * Suggest improvements based on failures
   */
  private async suggestImprovements(
    traces: TraceData[],
    failures: string[]
  ): Promise<string[]> {
    if (failures.length === 0) return [];

    const suggestions: string[] = [];

    if (failures.includes('tool_errors')) {
      suggestions.push('Review tool configurations and error handling');
    }

    if (failures.includes('hallucination')) {
      suggestions.push('Add RAG context or increase grounding in system prompt');
    }

    if (failures.includes('max_steps_reached')) {
      suggestions.push('Increase maxSteps or simplify task decomposition');
    }

    if (failures.includes('unsafe_output')) {
      suggestions.push('Review and strengthen safety guardrails');
    }

    return suggestions;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async loadConversation(
    conversationId: string
  ): Promise<ConversationData | null> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return conversation as ConversationData | null;
  }

  private async loadTraces(conversationId: string): Promise<TraceData[]> {
    const traces = await prisma.agentTrace.findMany({
      where: { conversationId },
      orderBy: { startedAt: 'asc' },
    });

    return traces as TraceData[];
  }

  private async saveEvaluation(
    conversationId: string,
    result: ConversationEvalResult
  ): Promise<void> {
    await prisma.conversationEvaluation.upsert({
      where: { conversationId },
      create: {
        conversationId,
        goalCompleted: result.goalCompleted,
        goalCompletionConfidence: result.goalCompletionConfidence,
        userSatisfactionScore: result.userSatisfactionScore,
        categories: result.categories,
        failureModes: result.failureModes,
        improvementSuggestions: result.improvementSuggestions,
        metadata: result.metadata,
      },
      update: {
        goalCompleted: result.goalCompleted,
        goalCompletionConfidence: result.goalCompletionConfidence,
        userSatisfactionScore: result.userSatisfactionScore,
        categories: result.categories,
        failureModes: result.failureModes,
        improvementSuggestions: result.improvementSuggestions,
        metadata: result.metadata,
        evaluatedAt: new Date(),
      },
    });
  }
}

// ============================================================================
// Static Methods for Querying Evaluations
// ============================================================================

export class EvaluationQuery {
  /**
   * Get evaluation for a conversation
   */
  static async getEvaluation(conversationId: string) {
    return await prisma.conversationEvaluation.findUnique({
      where: { conversationId },
      include: {
        conversation: {
          select: {
            id: true,
            title: true,
            agentId: true,
          },
        },
      },
    });
  }

  /**
   * Get evaluations for an agent
   */
  static async getAgentEvaluations(agentId: string, limit: number = 50) {
    return await prisma.conversationEvaluation.findMany({
      where: {
        conversation: {
          agentId,
        },
      },
      orderBy: { evaluatedAt: 'desc' },
      take: limit,
      include: {
        conversation: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }

  /**
   * Get agent performance metrics from evaluations
   */
  static async getPerformanceMetrics(agentId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const evals = await prisma.conversationEvaluation.findMany({
      where: {
        conversation: {
          agentId,
        },
        evaluatedAt: { gte: since },
      },
    });

    const total = evals.length;
    if (total === 0) {
      return null;
    }

    const goalCompletionRate =
      evals.filter((e) => e.goalCompleted).length / total;
    const avgSatisfaction =
      evals.reduce((sum, e) => sum + e.userSatisfactionScore, 0) / total;

    // Count failure modes
    const failureModeCounts: Record<string, number> = {};
    evals.forEach((e) => {
      e.failureModes.forEach((mode) => {
        failureModeCounts[mode] = (failureModeCounts[mode] || 0) + 1;
      });
    });

    return {
      total,
      goalCompletionRate,
      avgSatisfaction,
      failureModeCounts,
      commonFailures: Object.entries(failureModeCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([mode, count]) => ({ mode, count, percentage: count / total })),
    };
  }
}
