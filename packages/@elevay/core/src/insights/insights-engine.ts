/**
 * Insights Engine - Auto-categorization and pattern detection
 * Inspired by LangSmith Insights Agent
 */

import { PrismaClient } from '@prisma/client';
import type {
  AgentInsights,
  ConversationCluster,
  UsagePattern,
  Anomaly,
  OptimizationOpportunity,
  TraceWithConversation,
} from './types';

const prisma = new PrismaClient();

export class InsightsEngine {
  /**
   * Generate insights for an agent over a timeframe
   */
  async generateInsights(
    agentId: string,
    timeframe: { from: Date; to: Date }
  ): Promise<AgentInsights> {
    console.log(`[InsightsEngine] Generating insights for agent ${agentId}...`);

    // 1. Load all traces for agent in timeframe
    const traces = await this.loadTraces(agentId, timeframe);

    if (traces.length === 0) {
      console.log('[InsightsEngine] No traces found in timeframe');
      return {
        agentId,
        timeframe,
        totalConversations: 0,
        clusters: [],
        patterns: [],
        anomalies: [],
        opportunities: [],
      };
    }

    // 2. Cluster conversations by similarity
    const clusters = await this.clusterConversations(traces);

    // 3. Identify common patterns
    const patterns = await this.identifyPatterns(clusters, traces);

    // 4. Detect anomalies
    const anomalies = await this.detectAnomalies(traces);

    // 5. Surface optimization opportunities
    const opportunities = await this.findOptimizationOpportunities(traces, patterns);

    // 6. Save insights to database
    await this.saveInsights(agentId, {
      agentId,
      timeframe,
      totalConversations: traces.length,
      clusters,
      patterns,
      anomalies,
      opportunities,
    });

    console.log(`[InsightsEngine] Generated insights: ${clusters.length} clusters, ${patterns.length} patterns, ${anomalies.length} anomalies`);

    return {
      agentId,
      timeframe,
      totalConversations: traces.length,
      clusters,
      patterns,
      anomalies,
      opportunities,
    };
  }

  /**
   * Cluster conversations by similarity
   * Simple keyword-based clustering (can be replaced with embeddings)
   */
  private async clusterConversations(
    traces: TraceWithConversation[]
  ): Promise<ConversationCluster[]> {
    // Extract keywords from conversations
    const traceKeywords = traces.map((trace) => ({
      traceId: trace.id,
      keywords: this.extractKeywords(
        trace.conversation.messages.map((m) => m.content).join(' ')
      ),
      cost: trace.totalCost,
      satisfaction: trace.feedbackScore || 3,
    }));

    // Simple clustering: group by common keywords
    const clusters: ConversationCluster[] = [];
    const assigned = new Set<string>();

    for (const trace of traceKeywords) {
      if (assigned.has(trace.traceId)) continue;

      // Find similar traces (2+ common keywords)
      const similar = traceKeywords.filter((other) => {
        if (assigned.has(other.traceId) || other.traceId === trace.traceId) {
          return false;
        }
        const commonKeywords = trace.keywords.filter((kw) =>
          other.keywords.includes(kw)
        );
        return commonKeywords.length >= 2;
      });

      // Create cluster
      const clusterTraces = [trace, ...similar];
      const allKeywords = clusterTraces.flatMap((t) => t.keywords);
      const keywordCounts: Record<string, number> = {};
      allKeywords.forEach((kw) => {
        keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
      });

      const commonKeywords = Object.entries(keywordCounts)
        .filter(([, count]) => count >= clusterTraces.length / 2)
        .map(([kw]) => kw)
        .slice(0, 5);

      clusters.push({
        id: `cluster_${clusters.length + 1}`,
        label: this.generateClusterLabel(commonKeywords),
        size: clusterTraces.length,
        traceIds: clusterTraces.map((t) => t.traceId),
        commonKeywords,
        avgSatisfaction:
          clusterTraces.reduce((sum, t) => sum + t.satisfaction, 0) /
          clusterTraces.length,
        avgCost:
          clusterTraces.reduce((sum, t) => sum + t.cost, 0) / clusterTraces.length,
      });

      clusterTraces.forEach((t) => assigned.add(t.traceId));
    }

    // Handle unclustered traces
    const unclustered = traceKeywords.filter((t) => !assigned.has(t.traceId));
    if (unclustered.length > 0) {
      clusters.push({
        id: 'cluster_other',
        label: 'Other conversations',
        size: unclustered.length,
        traceIds: unclustered.map((t) => t.traceId),
        commonKeywords: [],
        avgSatisfaction:
          unclustered.reduce((sum, t) => sum + t.satisfaction, 0) /
          unclustered.length,
        avgCost:
          unclustered.reduce((sum, t) => sum + t.cost, 0) / unclustered.length,
      });
    }

    return clusters;
  }

  /**
   * Identify usage patterns from clusters
   */
  private async identifyPatterns(
    clusters: ConversationCluster[],
    traces: TraceWithConversation[]
  ): Promise<UsagePattern[]> {
    const patterns: UsagePattern[] = [];

    for (const cluster of clusters) {
      const clusterTraces = traces.filter((t) =>
        cluster.traceIds.includes(t.id)
      );

      // Find most used tools in this cluster
      const toolUsage: Record<string, number> = {};
      clusterTraces.forEach((trace) => {
        const toolCalls = trace.toolCalls as any[];
        if (Array.isArray(toolCalls)) {
          toolCalls.forEach((call) => {
            const toolName = call.toolName || 'unknown';
            toolUsage[toolName] = (toolUsage[toolName] || 0) + 1;
          });
        }
      });

      const commonTools = Object.entries(toolUsage)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([tool]) => tool);

      // Find common failures
      const failures: string[] = [];
      const avgFailureRate =
        clusterTraces.reduce((sum, t) => sum + t.toolFailures, 0) /
        clusterTraces.length;

      if (avgFailureRate > 0.5) {
        failures.push('high_tool_failure_rate');
      }

      patterns.push({
        clusterId: cluster.id,
        label: cluster.label,
        frequency: cluster.size,
        commonTools,
        commonFailures: failures,
        avgSatisfaction: cluster.avgSatisfaction,
        recommendation: this.generateRecommendation(cluster, commonTools, failures),
      });
    }

    return patterns;
  }

  /**
   * Detect anomalies (cost, latency, failures)
   */
  private async detectAnomalies(traces: TraceWithConversation[]): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // Calculate averages
    const avgCost = traces.reduce((sum, t) => sum + t.totalCost, 0) / traces.length;
    const avgLatency =
      traces.reduce((sum, t) => sum + (t.latencyMs || 0), 0) / traces.length;

    // Detect cost anomalies (3x average)
    traces.forEach((trace) => {
      if (trace.totalCost > avgCost * 3) {
        anomalies.push({
          type: 'high_cost',
          traceId: trace.id,
          value: trace.totalCost,
          expected: avgCost,
          severity: trace.totalCost > avgCost * 5 ? 'high' : 'medium',
          description: `Cost ${trace.totalCost.toFixed(2)} is ${(trace.totalCost / avgCost).toFixed(1)}x higher than average`,
        });
      }

      // Detect latency anomalies
      if (trace.latencyMs && trace.latencyMs > avgLatency * 3) {
        anomalies.push({
          type: 'high_latency',
          traceId: trace.id,
          value: trace.latencyMs,
          expected: avgLatency,
          severity: trace.latencyMs > avgLatency * 5 ? 'high' : 'medium',
          description: `Latency ${trace.latencyMs}ms is ${(trace.latencyMs / avgLatency).toFixed(1)}x higher than average`,
        });
      }

      // Detect tool failure anomalies
      if (trace.toolFailures > 3) {
        anomalies.push({
          type: 'tool_failures',
          traceId: trace.id,
          value: trace.toolFailures,
          expected: 0,
          severity: 'high',
          description: `${trace.toolFailures} tool failures in single conversation`,
        });
      }

      // Detect low satisfaction
      if (trace.feedbackScore && trace.feedbackScore <= 2) {
        anomalies.push({
          type: 'low_satisfaction',
          traceId: trace.id,
          value: trace.feedbackScore,
          expected: 3,
          severity: 'medium',
          description: `Low user satisfaction score: ${trace.feedbackScore}/5`,
        });
      }
    });

    return anomalies;
  }

  /**
   * Find optimization opportunities
   */
  private async findOptimizationOpportunities(
    traces: TraceWithConversation[],
    patterns: UsagePattern[]
  ): Promise<OptimizationOpportunity[]> {
    const opportunities: OptimizationOpportunity[] = [];

    // Opportunity 1: Model downgrade for simple patterns
    const simplePatterns = patterns.filter(
      (p) =>
        p.avgSatisfaction > 4.0 &&
        p.frequency > traces.length * 0.2 // >20% of conversations
    );

    if (simplePatterns.length > 0) {
      const totalAffected = simplePatterns.reduce((sum, p) => sum + p.frequency, 0);
      const avgCost =
        traces.reduce((sum, t) => sum + t.totalCost, 0) / traces.length;
      const estimatedSavings = totalAffected * avgCost * 0.7; // 70% savings with Haiku

      opportunities.push({
        type: 'model_downgrade',
        impact: 'Reduce cost by ~70% for high-satisfaction conversations',
        suggestion: `Switch to Haiku for "${simplePatterns[0].label}" pattern (${totalAffected} conversations)`,
        estimatedSavings,
        affectedConversations: totalAffected,
      });
    }

    // Opportunity 2: Caching for repeated queries
    const keywords = traces.flatMap((t) =>
      this.extractKeywords(t.conversation.messages.map((m) => m.content).join(' '))
    );
    const keywordCounts: Record<string, number> = {};
    keywords.forEach((kw) => {
      keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
    });

    const frequentKeywords = Object.entries(keywordCounts)
      .filter(([, count]) => count > traces.length * 0.1) // >10% frequency
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    if (frequentKeywords.length > 0) {
      opportunities.push({
        type: 'caching',
        impact: 'Reduce latency by ~80% for frequent queries',
        suggestion: `Cache responses for: ${frequentKeywords.map(([kw]) => kw).join(', ')}`,
        affectedConversations: frequentKeywords[0][1],
      });
    }

    // Opportunity 3: RAG for hallucination-prone topics
    // (Would need hallucination detection data)

    return opportunities;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async loadTraces(
    agentId: string,
    timeframe: { from: Date; to: Date }
  ): Promise<TraceWithConversation[]> {
    const traces = await prisma.agentTrace.findMany({
      where: {
        agentId,
        startedAt: {
          gte: timeframe.from,
          lte: timeframe.to,
        },
      },
      include: {
        conversation: {
          select: {
            id: true,
            messages: {
              select: {
                role: true,
                content: true,
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    return traces as TraceWithConversation[];
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction (lowercase, split, filter)
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'is',
      'was',
      'are',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'can',
      'this',
      'that',
      'these',
      'those',
      'i',
      'you',
      'he',
      'she',
      'it',
      'we',
      'they',
      'my',
      'your',
      'his',
      'her',
      'its',
      'our',
      'their',
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word))
      .slice(0, 20); // Top 20 keywords
  }

  private generateClusterLabel(keywords: string[]): string {
    if (keywords.length === 0) return 'General conversations';
    return keywords.slice(0, 3).join(', ') + ' discussions';
  }

  private generateRecommendation(
    cluster: ConversationCluster,
    commonTools: string[],
    failures: string[]
  ): string {
    if (cluster.avgSatisfaction < 3) {
      return 'Review and improve conversation quality';
    }

    if (failures.length > 0) {
      return `Fix tool failures: ${commonTools.join(', ')}`;
    }

    if (cluster.avgCost > 0.5) {
      return 'Consider model downgrade to reduce costs';
    }

    return 'Performing well, continue monitoring';
  }

  private async saveInsights(
    agentId: string,
    insights: AgentInsights
  ): Promise<void> {
    await prisma.agentInsight.create({
      data: {
        agentId,
        timeframeStart: insights.timeframe.from,
        timeframeEnd: insights.timeframe.to,
        clusters: insights.clusters,
        patterns: insights.patterns,
        anomalies: insights.anomalies,
        opportunities: insights.opportunities,
      },
    });
  }
}

// ============================================================================
// Static Methods for Querying Insights
// ============================================================================

export class InsightsQuery {
  /**
   * Get latest insights for an agent
   */
  static async getLatestInsights(agentId: string) {
    return await prisma.agentInsight.findFirst({
      where: { agentId },
      orderBy: { generatedAt: 'desc' },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get all insights for an agent
   */
  static async getAgentInsights(agentId: string, limit: number = 10) {
    return await prisma.agentInsight.findMany({
      where: { agentId },
      orderBy: { generatedAt: 'desc' },
      take: limit,
    });
  }
}
