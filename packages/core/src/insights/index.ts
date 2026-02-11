/**
 * Insights Engine - Pattern Detection & Analysis
 *
 * Analyzes agent performance data to detect:
 * - Common failure patterns
 * - Successful conversation patterns
 * - Cost optimization opportunities
 * - Performance bottlenecks
 * - User behavior patterns
 */

import { nanoid } from "nanoid";

// ============================================
// Types
// ============================================

export interface InsightInput {
  agentId: string;
  workspaceId: string;
  timeframe: {
    start: Date;
    end: Date;
  };
  dataPoints: DataPoint[];
}

export interface DataPoint {
  id: string;
  type: "trace" | "evaluation" | "feedback";
  timestamp: Date;
  metrics: Record<string, number>;
  metadata: Record<string, unknown>;
}

export interface Insight {
  id: string;
  agentId: string;
  workspaceId: string;
  type: "failure_pattern" | "success_pattern" | "cost_optimization" | "performance_bottleneck";
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number; // 0-1
  impact: {
    metric: string; // e.g., "success_rate", "cost", "latency"
    current: number;
    potential: number;
    improvement: number; // percentage
  };
  evidence: {
    dataPoints: number;
    examples: string[]; // IDs of example conversations/traces
  };
  recommendations: string[];
  detectedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface Pattern {
  id: string;
  name: string;
  occurrences: number;
  confidence: number;
  indicators: string[];
}

// ============================================
// Insights Analyzer
// ============================================

export class InsightsAnalyzer {
  constructor(
    private llmAnalyze?: (prompt: string) => Promise<Record<string, unknown>>
  ) {}

  /**
   * Analyze data and generate insights
   */
  async analyze(input: InsightInput): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Detect failure patterns
    const failurePatterns = await this.detectFailurePatterns(input);
    insights.push(...failurePatterns);

    // Detect success patterns
    const successPatterns = await this.detectSuccessPatterns(input);
    insights.push(...successPatterns);

    // Detect cost optimization opportunities
    const costInsights = await this.detectCostOptimizations(input);
    insights.push(...costInsights);

    // Detect performance bottlenecks
    const performanceInsights = await this.detectPerformanceBottlenecks(input);
    insights.push(...performanceInsights);

    return insights.sort((a, b) => {
      // Sort by severity first, then confidence
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.confidence - a.confidence;
    });
  }

  /**
   * Detect failure patterns
   */
  private async detectFailurePatterns(input: InsightInput): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Group data points by failure type
    const failures = input.dataPoints.filter(
      dp => dp.metadata.status === "failed" || dp.metrics.success === 0
    );

    if (failures.length === 0) return insights;

    // Analyze failure patterns
    const failureRate = failures.length / input.dataPoints.length;

    if (failureRate > 0.1) {
      // More than 10% failure rate
      const examples = failures.slice(0, 5).map(f => f.id);

      // Use LLM to analyze failure patterns if available
      let failureReasons: string[] = [];
      if (this.llmAnalyze && failures.length > 0) {
        const failureContext = failures.slice(0, 10).map(f => ({
          error: f.metadata.error,
          context: f.metadata.context,
        }));

        const prompt = `Analyze these failure cases and identify common patterns:

${JSON.stringify(failureContext, null, 2)}

Return a JSON object with:
- commonPatterns: array of pattern descriptions
- rootCause: likely root cause
- recommendations: array of specific actions to fix

Example: {
  "commonPatterns": ["Missing required field", "Invalid credentials"],
  "rootCause": "Configuration issue",
  "recommendations": ["Validate config before execution", "Add retry logic"]
}`;

        try {
          const analysis = await this.llmAnalyze(prompt);
          failureReasons = analysis.commonPatterns as string[] || [];
        } catch (error) {
          console.error("[InsightsAnalyzer] Failure pattern analysis failed:", error);
        }
      }

      insights.push({
        id: `insight_${nanoid(10)}`,
        agentId: input.agentId,
        workspaceId: input.workspaceId,
        type: "failure_pattern",
        title: `High failure rate detected (${(failureRate * 100).toFixed(1)}%)`,
        description: `Agent is failing frequently. Common reasons: ${failureReasons.join(", ") || "unknown"}`,
        severity: failureRate > 0.3 ? "critical" : "high",
        confidence: Math.min(1, failures.length / 10),
        impact: {
          metric: "success_rate",
          current: 1 - failureRate,
          potential: 0.95,
          improvement: ((0.95 - (1 - failureRate)) / (1 - failureRate)) * 100,
        },
        evidence: {
          dataPoints: failures.length,
          examples,
        },
        recommendations: failureReasons.length > 0
          ? failureReasons
          : [
            "Review error logs for common patterns",
            "Add better error handling",
            "Validate inputs before execution",
          ],
        detectedAt: new Date(),
      });
    }

    return insights;
  }

  /**
   * Detect success patterns
   */
  private async detectSuccessPatterns(input: InsightInput): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Identify highly successful conversations
    const successes = input.dataPoints.filter(
      dp => dp.metadata.status === "completed" &&
           (dp.metrics.satisfaction || 0) > 0.8
    );

    if (successes.length > input.dataPoints.length * 0.3) {
      // More than 30% highly successful
      const examples = successes.slice(0, 5).map(s => s.id);

      insights.push({
        id: `insight_${nanoid(10)}`,
        agentId: input.agentId,
        workspaceId: input.workspaceId,
        type: "success_pattern",
        title: "Strong performance on specific types of conversations",
        description: "Agent shows consistent success with certain conversation patterns",
        severity: "low",
        confidence: Math.min(1, successes.length / 20),
        impact: {
          metric: "success_rate",
          current: successes.length / input.dataPoints.length,
          potential: 1,
          improvement: ((1 - (successes.length / input.dataPoints.length)) / (successes.length / input.dataPoints.length)) * 100,
        },
        evidence: {
          dataPoints: successes.length,
          examples,
        },
        recommendations: [
          "Analyze successful patterns to replicate across all conversations",
          "Use successful examples for few-shot learning",
        ],
        detectedAt: new Date(),
      });
    }

    return insights;
  }

  /**
   * Detect cost optimization opportunities
   */
  private async detectCostOptimizations(input: InsightInput): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Calculate average cost per conversation
    const costs = input.dataPoints
      .map(dp => dp.metrics.cost || 0)
      .filter(c => c > 0);

    if (costs.length === 0) return insights;

    const avgCost = costs.reduce((sum, c) => sum + c, 0) / costs.length;
    const maxCost = Math.max(...costs);

    // Check for expensive conversations
    const expensive = costs.filter(c => c > avgCost * 2);

    if (expensive.length > 0) {
      insights.push({
        id: `insight_${nanoid(10)}`,
        agentId: input.agentId,
        workspaceId: input.workspaceId,
        type: "cost_optimization",
        title: `${expensive.length} conversations cost >2x average`,
        description: `Some conversations are significantly more expensive than average. Avg: $${avgCost.toFixed(4)}, Max: $${maxCost.toFixed(4)}`,
        severity: expensive.length > costs.length * 0.2 ? "medium" : "low",
        confidence: 0.9,
        impact: {
          metric: "cost",
          current: avgCost,
          potential: avgCost * 0.7, // 30% reduction
          improvement: 30,
        },
        evidence: {
          dataPoints: expensive.length,
          examples: input.dataPoints
            .filter(dp => (dp.metrics.cost || 0) > avgCost * 2)
            .slice(0, 5)
            .map(dp => dp.id),
        },
        recommendations: [
          "Use cheaper models (Haiku instead of Sonnet) for simple queries",
          "Implement caching for repeated queries",
          "Optimize prompts to reduce token usage",
          "Set maxTokens limits to prevent runaway costs",
        ],
        detectedAt: new Date(),
      });
    }

    return insights;
  }

  /**
   * Detect performance bottlenecks
   */
  private async detectPerformanceBottlenecks(input: InsightInput): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Calculate average latency
    const latencies = input.dataPoints
      .map(dp => dp.metrics.latencyMs || 0)
      .filter(l => l > 0);

    if (latencies.length === 0) return insights;

    const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

    // Check for slow conversations
    if (p95Latency > 10000) {
      // P95 > 10 seconds
      insights.push({
        id: `insight_${nanoid(10)}`,
        agentId: input.agentId,
        workspaceId: input.workspaceId,
        type: "performance_bottleneck",
        title: "Slow response times detected",
        description: `P95 latency is ${(p95Latency / 1000).toFixed(1)}s (avg: ${(avgLatency / 1000).toFixed(1)}s)`,
        severity: p95Latency > 20000 ? "high" : "medium",
        confidence: 0.95,
        impact: {
          metric: "latency",
          current: avgLatency,
          potential: avgLatency * 0.5, // 50% reduction
          improvement: 50,
        },
        evidence: {
          dataPoints: latencies.length,
          examples: input.dataPoints
            .filter(dp => (dp.metrics.latencyMs || 0) > p95Latency)
            .slice(0, 5)
            .map(dp => dp.id),
        },
        recommendations: [
          "Use parallel tool calls when possible",
          "Cache frequently accessed data",
          "Optimize database queries",
          "Use streaming for long responses",
        ],
        detectedAt: new Date(),
      });
    }

    return insights;
  }
}

// ============================================
// Factory Function
// ============================================

export function createInsightsAnalyzer(
  llmAnalyze?: (prompt: string) => Promise<Record<string, unknown>>
): InsightsAnalyzer {
  return new InsightsAnalyzer(llmAnalyze);
}

// Types are already exported with their definitions above
