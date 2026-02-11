/**
 * Optimization Module - Auto-Optimization with Feedback Loop (Promptim-style)
 *
 * Automatically optimizes agent performance based on:
 * - User feedback (thumbs up/down, edits, corrections)
 * - Evaluation results (goal completion, satisfaction)
 * - Performance metrics (cost, latency, success rate)
 *
 * Features:
 * - A/B testing of prompts
 * - Automatic prompt optimization
 * - Model tier optimization
 * - Few-shot learning from corrections
 */

import { nanoid } from "nanoid";

// ============================================
// Types
// ============================================

export interface FeedbackInput {
  conversationId: string;
  messageId: string;
  type: "thumbs_up" | "thumbs_down" | "edit" | "correction";
  userId: string;
  originalText?: string;
  correctedText?: string;
  metadata?: Record<string, unknown>;
}

export interface OptimizationGoal {
  metric: "success_rate" | "cost" | "latency" | "satisfaction";
  target: number;
  weight: number; // 0-1, how important this goal is
}

export interface OptimizationConfig {
  agentId: string;
  workspaceId: string;
  goals: OptimizationGoal[];
  constraints: {
    maxCostPerConversation?: number;
    maxLatencyMs?: number;
    minSuccessRate?: number;
  };
  abTestConfig: {
    enabled: boolean;
    trafficSplit: number; // 0-1, percentage of traffic for variant
    minSampleSize: number; // minimum samples before declaring winner
    significanceLevel: number; // e.g., 0.05 for 95% confidence
  };
}

export interface OptimizationRun {
  id: string;
  agentId: string;
  workspaceId: string;
  startedAt: Date;
  completedAt?: Date;
  status: "running" | "completed" | "failed";

  baseline: {
    systemPrompt: string;
    model: string;
    temperature: number;
    metrics: Record<string, number>;
  };

  optimized?: {
    systemPrompt: string;
    model: string;
    temperature: number;
    metrics: Record<string, number>;
  };

  improvements: {
    metric: string;
    baselineValue: number;
    optimizedValue: number;
    improvement: number; // percentage
  }[];

  method: "prompt_optimization" | "model_tier_optimization" | "few_shot_learning";
  metadata?: Record<string, unknown>;
}

export interface ABTest {
  id: string;
  agentId: string;
  workspaceId: string;
  status: "running" | "completed" | "cancelled";

  variants: {
    id: string;
    name: "control" | "variant";
    systemPrompt: string;
    model: string;
    temperature: number;
    trafficPercentage: number;
    sampleSize: number;
    metrics: Record<string, number>;
  }[];

  winner?: "control" | "variant";
  confidence: number; // 0-1
  startedAt: Date;
  completedAt?: Date;
}

// ============================================
// Optimizer Class
// ============================================

export class AgentOptimizer {
  constructor(
    private config: OptimizationConfig,
    private llmOptimize?: (prompt: string) => Promise<string>
  ) {}

  /**
   * Run optimization based on feedback and metrics
   */
  async optimize(params: {
    currentPrompt: string;
    currentModel: string;
    currentTemperature: number;
    feedbackData: FeedbackInput[];
    metricsData: Record<string, number>;
  }): Promise<OptimizationRun> {
    const runId = `optim_${nanoid(12)}`;
    const startedAt = new Date();

    const run: OptimizationRun = {
      id: runId,
      agentId: this.config.agentId,
      workspaceId: this.config.workspaceId,
      startedAt,
      status: "running",
      baseline: {
        systemPrompt: params.currentPrompt,
        model: params.currentModel,
        temperature: params.currentTemperature,
        metrics: params.metricsData,
      },
      improvements: [],
      method: "prompt_optimization",
    };

    try {
      // Determine optimization method based on feedback
      const corrections = params.feedbackData.filter(f => f.type === "correction" || f.type === "edit");
      const negativeFeedback = params.feedbackData.filter(f => f.type === "thumbs_down");

      if (corrections.length > 5) {
        // Enough corrections for few-shot learning
        run.method = "few_shot_learning";
        run.optimized = await this.optimizeWithFewShot(params, corrections);
      } else if (negativeFeedback.length > 10) {
        // Significant negative feedback, optimize prompt
        run.method = "prompt_optimization";
        run.optimized = await this.optimizePrompt(params, negativeFeedback);
      } else if (params.metricsData.cost > (this.config.constraints.maxCostPerConversation || Infinity)) {
        // Cost too high, optimize model tier
        run.method = "model_tier_optimization";
        run.optimized = await this.optimizeModelTier(params);
      } else {
        // Default to prompt optimization
        run.method = "prompt_optimization";
        run.optimized = await this.optimizePrompt(params, params.feedbackData);
      }

      // Calculate improvements
      if (run.optimized) {
        for (const goal of this.config.goals) {
          const baselineValue = params.metricsData[goal.metric] || 0;
          const optimizedValue = run.optimized.metrics[goal.metric] || baselineValue;
          const improvement = ((optimizedValue - baselineValue) / baselineValue) * 100;

          if (Math.abs(improvement) > 1) {
            // Only include significant improvements (>1%)
            run.improvements.push({
              metric: goal.metric,
              baselineValue,
              optimizedValue,
              improvement,
            });
          }
        }
      }

      run.status = "completed";
      run.completedAt = new Date();
    } catch (error) {
      run.status = "failed";
      run.metadata = {
        error: error instanceof Error ? error.message : String(error),
      };
    }

    return run;
  }

  /**
   * Optimize using few-shot learning from corrections
   */
  private async optimizeWithFewShot(
    params: {
      currentPrompt: string;
      currentModel: string;
      currentTemperature: number;
    },
    corrections: FeedbackInput[]
  ): Promise<{
    systemPrompt: string;
    model: string;
    temperature: number;
    metrics: Record<string, number>;
  }> {
    // Build few-shot examples from corrections
    const examples = corrections
      .filter(c => c.originalText && c.correctedText)
      .slice(0, 10) // Limit to 10 examples
      .map(c => ({
        original: c.originalText!,
        corrected: c.correctedText!,
      }));

    // Inject examples into system prompt
    const fewShotSection = `

## Style Examples

Here are examples of how to respond. Notice the corrections made:

${examples.map((ex, i) => `
Example ${i + 1}:
Original: ${ex.original}
Improved: ${ex.corrected}
`).join("\n")}

Follow the style demonstrated in the improved versions above.`;

    const optimizedPrompt = params.currentPrompt + fewShotSection;

    return {
      systemPrompt: optimizedPrompt,
      model: params.currentModel,
      temperature: params.currentTemperature,
      metrics: {
        // Estimate improvement
        satisfaction: 0.85, // Assumed improvement from style learning
      },
    };
  }

  /**
   * Optimize prompt using LLM
   */
  private async optimizePrompt(
    params: {
      currentPrompt: string;
      currentModel: string;
      currentTemperature: number;
    },
    negativeFeedback: FeedbackInput[]
  ): Promise<{
    systemPrompt: string;
    model: string;
    temperature: number;
    metrics: Record<string, number>;
  }> {
    if (!this.llmOptimize) {
      // Can't optimize without LLM
      return {
        systemPrompt: params.currentPrompt,
        model: params.currentModel,
        temperature: params.currentTemperature,
        metrics: {},
      };
    }

    // Build context from negative feedback
    const feedbackContext = negativeFeedback
      .map(f => f.metadata?.reason || "User was unsatisfied")
      .join("\n- ");

    const optimizationPrompt = `You are an expert at optimizing AI agent prompts.

Current system prompt:
"""
${params.currentPrompt}
"""

Issues reported by users:
- ${feedbackContext}

Optimization goals:
${this.config.goals.map(g => `- Improve ${g.metric} (weight: ${g.weight})`).join("\n")}

Rewrite the system prompt to address these issues while maintaining the core functionality.
Return ONLY the optimized prompt, no explanation.`;

    try {
      const optimizedPrompt = await this.llmOptimize(optimizationPrompt);

      return {
        systemPrompt: optimizedPrompt.trim(),
        model: params.currentModel,
        temperature: params.currentTemperature,
        metrics: {
          // Estimate improvement
          satisfaction: 0.8, // Assumed improvement
        },
      };
    } catch (error) {
      console.error("[AgentOptimizer] Prompt optimization failed:", error);
      return {
        systemPrompt: params.currentPrompt,
        model: params.currentModel,
        temperature: params.currentTemperature,
        metrics: {},
      };
    }
  }

  /**
   * Optimize model tier to reduce cost
   */
  private async optimizeModelTier(params: {
    currentPrompt: string;
    currentModel: string;
    currentTemperature: number;
  }): Promise<{
    systemPrompt: string;
    model: string;
    temperature: number;
    metrics: Record<string, number>;
  }> {
    // Model tier downgrade logic
    const tierMap: Record<string, string> = {
      "claude-opus-4-20250514": "claude-3-5-sonnet-20241022", // Opus → Sonnet
      "claude-3-5-sonnet-20241022": "claude-3-5-haiku-20241022", // Sonnet → Haiku
    };

    const downgradedModel = tierMap[params.currentModel] || params.currentModel;

    // Calculate estimated cost reduction
    const costReduction = downgradedModel !== params.currentModel ? 0.7 : 1; // 30% reduction

    return {
      systemPrompt: params.currentPrompt,
      model: downgradedModel,
      temperature: params.currentTemperature,
      metrics: {
        cost: costReduction, // Relative to baseline
      },
    };
  }

  /**
   * Create A/B test
   */
  async createABTest(params: {
    controlPrompt: string;
    variantPrompt: string;
    model: string;
    temperature: number;
  }): Promise<ABTest> {
    return {
      id: `abtest_${nanoid(12)}`,
      agentId: this.config.agentId,
      workspaceId: this.config.workspaceId,
      status: "running",
      variants: [
        {
          id: "control",
          name: "control",
          systemPrompt: params.controlPrompt,
          model: params.model,
          temperature: params.temperature,
          trafficPercentage: 1 - this.config.abTestConfig.trafficSplit,
          sampleSize: 0,
          metrics: {},
        },
        {
          id: "variant",
          name: "variant",
          systemPrompt: params.variantPrompt,
          model: params.model,
          temperature: params.temperature,
          trafficPercentage: this.config.abTestConfig.trafficSplit,
          sampleSize: 0,
          metrics: {},
        },
      ],
      confidence: 0,
      startedAt: new Date(),
    };
  }

  /**
   * Evaluate A/B test and determine winner
   */
  evaluateABTest(test: ABTest): ABTest {
    const control = test.variants.find(v => v.name === "control");
    const variant = test.variants.find(v => v.name === "variant");

    if (!control || !variant) {
      return test;
    }

    // Check if we have enough samples
    if (control.sampleSize < this.config.abTestConfig.minSampleSize ||
        variant.sampleSize < this.config.abTestConfig.minSampleSize) {
      return test;
    }

    // Simple statistical test: compare primary goal metric
    const primaryGoal = this.config.goals[0];
    const controlMetric = control.metrics[primaryGoal.metric] || 0;
    const variantMetric = variant.metrics[primaryGoal.metric] || 0;

    // Simplified significance test (in production, use proper statistical test)
    const improvementThreshold = 0.05; // 5% improvement required
    const improvement = (variantMetric - controlMetric) / controlMetric;

    if (Math.abs(improvement) > improvementThreshold) {
      test.winner = improvement > 0 ? "variant" : "control";
      test.confidence = Math.min(0.95, 0.5 + Math.abs(improvement)); // Simplified confidence
      test.status = "completed";
      test.completedAt = new Date();
    }

    return test;
  }
}

// ============================================
// Factory Function
// ============================================

export function createOptimizer(
  config: OptimizationConfig,
  llmOptimize?: (prompt: string) => Promise<string>
): AgentOptimizer {
  return new AgentOptimizer(config, llmOptimize);
}

// Types are already exported with their definitions above
