import {
  AgentEngine,
  AgentTracer,
  costTrackingHook,
  createTracer,
  errorLoggingHook,
  getAgentEngine,
  initAgentEngine,
  loggingHook
} from "./chunk-7DJ5KVIK.mjs";
import {
  getEvalRegistry,
  registerL1Assertion,
  registerL2Criterion,
  runL1Eval,
  runL2Eval,
  runL3Eval
} from "./chunk-XWVGOFKV.mjs";
import {
  getEvalRegistry,
  registerL1Assertion,
  registerL2Criterion,
  runL1Eval,
  runL2Eval,
  runL3Eval
} from "./chunk-XWVGOFKV.mjs";
import {
  DEFAULT_SCAN_RULES,
  ScanEngine,
  getScanEngine,
  initScanEngine
} from "./chunk-SRWXAKTH.mjs";

// src/factory.ts
function createScanEngine(dependencies, config) {
  return new ScanEngine(config, {
    composioClient: dependencies.composioClient,
    connectorRegistry: dependencies.connectorRegistry
  });
}
function createAgentEngine(dependencies) {
  return new AgentEngine({
    composioClient: dependencies.composioClient,
    connectorRegistry: dependencies.connectorRegistry,
    aiClient: dependencies.aiClient
  });
}
async function initElevayCore(config) {
  const dependencies = {};
  if (config.composioApiKey) {
    try {
      const { initComposio, initConnectorRegistry } = await import("@elevay/connectors");
      dependencies.composioClient = initComposio({
        apiKey: config.composioApiKey
      });
      dependencies.connectorRegistry = initConnectorRegistry();
      console.log("\u2713 Composio initialized");
    } catch (error) {
      console.warn(
        "\u26A0 Failed to initialize Composio:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
  if (config.anthropicApiKey) {
    try {
      const { AIClient } = await import("@elevay/ai");
      dependencies.aiClient = new AIClient({
        apiKey: config.anthropicApiKey
      });
      console.log("\u2713 AIClient initialized");
    } catch (error) {
      console.warn(
        "\u26A0 Failed to initialize AIClient:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
  const scanEngine = createScanEngine(dependencies, config.scanEngineConfig);
  const agentEngine = createAgentEngine(dependencies);
  return {
    scanEngine,
    agentEngine,
    dependencies
  };
}
function getDefaultAgentHooks() {
  return {
    /**
     * Logging hook - logs when an agent starts execution.
     */
    loggingHook: async (context) => {
      console.log(
        `[Agent ${context.agentId}] Starting execution for user ${context.userId}`
      );
    },
    /**
     * Cost tracking hook - logs the cost and token usage after execution.
     */
    costTrackingHook: async (context, result) => {
      console.log(
        `[Agent ${context.agentId}] Execution completed:`,
        `
  Model: ${result.llmUsage.model}`,
        `
  Tokens: ${result.llmUsage.tokensIn} in / ${result.llmUsage.tokensOut} out`,
        `
  Cost: $${result.llmUsage.cost.toFixed(4)}`,
        `
  Latency: ${result.llmUsage.latencyMs}ms`,
        `
  Status: ${result.status}`
      );
    },
    /**
     * Error logging hook - logs errors that occur during execution.
     */
    errorLoggingHook: async (context, error) => {
      console.error(
        `[Agent ${context.agentId}] Execution failed:`,
        error.message
      );
    }
  };
}

// src/evaluation/index.ts
import { nanoid } from "nanoid";
var ConversationEvaluator = class {
  constructor(criteria, llmEvaluate) {
    this.criteria = criteria;
    this.llmEvaluate = llmEvaluate;
  }
  /**
   * Evaluate a complete conversation
   */
  async evaluateConversation(params) {
    const durationMs = params.endedAt.getTime() - params.startedAt.getTime();
    const goalResults = await this.evaluateGoalCompletion(params.turns);
    const satisfactionResults = await this.evaluateUserSatisfaction(params.turns);
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
      evaluatedAt: /* @__PURE__ */ new Date()
    };
  }
  /**
   * Evaluate goal completion
   */
  async evaluateGoalCompletion(turns) {
    if (!this.criteria.goalCompletion.enabled) {
      return { detected: [], completed: [], completionRate: 1 };
    }
    const detected = [];
    const completed = [];
    if (this.llmEvaluate) {
      const conversationText = turns.map((t) => `${t.role}: ${t.content}`).join("\n");
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
        detected.push(...result.detected || []);
        completed.push(...result.completed || []);
      } catch (error) {
        console.error("[ConversationEvaluator] Goal evaluation failed:", error);
      }
    } else {
      const conversationText = turns.map((t) => t.content.toLowerCase()).join(" ");
      for (const goal of this.criteria.goalCompletion.expectedGoals) {
        if (conversationText.includes(goal.toLowerCase())) {
          detected.push(goal);
          if (!conversationText.includes("failed") && !conversationText.includes("unable")) {
            completed.push(goal);
          }
        }
      }
    }
    const completionRate = detected.length > 0 ? completed.length / detected.length : 1;
    return { detected, completed, completionRate };
  }
  /**
   * Evaluate user satisfaction
   */
  async evaluateUserSatisfaction(turns) {
    if (!this.criteria.userSatisfaction.enabled) {
      return { score: 1, indicators: {} };
    }
    const indicators = {};
    if (this.llmEvaluate) {
      const conversationText = turns.map((t) => `${t.role}: ${t.content}`).join("\n");
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
          score: result.score || 0.5,
          indicators: result.indicators || {}
        };
      } catch (error) {
        console.error("[ConversationEvaluator] Satisfaction evaluation failed:", error);
      }
    }
    const userTurns = turns.filter((t) => t.role === "user");
    const positiveWords = ["thanks", "great", "perfect", "excellent", "helpful", "yes"];
    const negativeWords = ["bad", "wrong", "no", "terrible", "unhelpful", "frustrated"];
    let positiveCount = 0;
    let negativeCount = 0;
    for (const turn of userTurns) {
      const content = turn.content.toLowerCase();
      positiveCount += positiveWords.filter((w) => content.includes(w)).length;
      negativeCount += negativeWords.filter((w) => content.includes(w)).length;
    }
    const score = Math.max(0, Math.min(
      1,
      (positiveCount - negativeCount) / Math.max(1, userTurns.length)
    ));
    return { score: score || 0.5, indicators };
  }
  /**
   * Evaluate conversation quality
   */
  async evaluateQuality(turns) {
    if (!this.criteria.conversationQuality.enabled) {
      return { scores: {}, overallScore: 1 };
    }
    const scores = {};
    if (this.llmEvaluate) {
      const conversationText = turns.map((t) => `${t.role}: ${t.content}`).join("\n");
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
      for (const metric of this.criteria.conversationQuality.metrics) {
        if (metric === "coherence") {
          scores[metric] = Math.min(1, turns.length / 10);
        } else if (metric === "relevance") {
          scores[metric] = 0.7;
        } else if (metric === "helpfulness") {
          scores[metric] = 0.7;
        } else {
          scores[metric] = 0.5;
        }
      }
    }
    const overallScore = Object.values(scores).length > 0 ? Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.values(scores).length : 0.5;
    return { scores, overallScore };
  }
};
function createEvaluator(criteria, llmEvaluate) {
  return new ConversationEvaluator(criteria, llmEvaluate);
}

// src/insights/index.ts
import { nanoid as nanoid2 } from "nanoid";
var InsightsAnalyzer = class {
  constructor(llmAnalyze) {
    this.llmAnalyze = llmAnalyze;
  }
  /**
   * Analyze data and generate insights
   */
  async analyze(input) {
    const insights = [];
    const failurePatterns = await this.detectFailurePatterns(input);
    insights.push(...failurePatterns);
    const successPatterns = await this.detectSuccessPatterns(input);
    insights.push(...successPatterns);
    const costInsights = await this.detectCostOptimizations(input);
    insights.push(...costInsights);
    const performanceInsights = await this.detectPerformanceBottlenecks(input);
    insights.push(...performanceInsights);
    return insights.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.confidence - a.confidence;
    });
  }
  /**
   * Detect failure patterns
   */
  async detectFailurePatterns(input) {
    const insights = [];
    const failures = input.dataPoints.filter(
      (dp) => dp.metadata.status === "failed" || dp.metrics.success === 0
    );
    if (failures.length === 0) return insights;
    const failureRate = failures.length / input.dataPoints.length;
    if (failureRate > 0.1) {
      const examples = failures.slice(0, 5).map((f) => f.id);
      let failureReasons = [];
      if (this.llmAnalyze && failures.length > 0) {
        const failureContext = failures.slice(0, 10).map((f) => ({
          error: f.metadata.error,
          context: f.metadata.context
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
          failureReasons = analysis.commonPatterns || [];
        } catch (error) {
          console.error("[InsightsAnalyzer] Failure pattern analysis failed:", error);
        }
      }
      insights.push({
        id: `insight_${nanoid2(10)}`,
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
          improvement: (0.95 - (1 - failureRate)) / (1 - failureRate) * 100
        },
        evidence: {
          dataPoints: failures.length,
          examples
        },
        recommendations: failureReasons.length > 0 ? failureReasons : [
          "Review error logs for common patterns",
          "Add better error handling",
          "Validate inputs before execution"
        ],
        detectedAt: /* @__PURE__ */ new Date()
      });
    }
    return insights;
  }
  /**
   * Detect success patterns
   */
  async detectSuccessPatterns(input) {
    const insights = [];
    const successes = input.dataPoints.filter(
      (dp) => dp.metadata.status === "completed" && (dp.metrics.satisfaction || 0) > 0.8
    );
    if (successes.length > input.dataPoints.length * 0.3) {
      const examples = successes.slice(0, 5).map((s) => s.id);
      insights.push({
        id: `insight_${nanoid2(10)}`,
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
          improvement: (1 - successes.length / input.dataPoints.length) / (successes.length / input.dataPoints.length) * 100
        },
        evidence: {
          dataPoints: successes.length,
          examples
        },
        recommendations: [
          "Analyze successful patterns to replicate across all conversations",
          "Use successful examples for few-shot learning"
        ],
        detectedAt: /* @__PURE__ */ new Date()
      });
    }
    return insights;
  }
  /**
   * Detect cost optimization opportunities
   */
  async detectCostOptimizations(input) {
    const insights = [];
    const costs = input.dataPoints.map((dp) => dp.metrics.cost || 0).filter((c) => c > 0);
    if (costs.length === 0) return insights;
    const avgCost = costs.reduce((sum, c) => sum + c, 0) / costs.length;
    const maxCost = Math.max(...costs);
    const expensive = costs.filter((c) => c > avgCost * 2);
    if (expensive.length > 0) {
      insights.push({
        id: `insight_${nanoid2(10)}`,
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
          potential: avgCost * 0.7,
          // 30% reduction
          improvement: 30
        },
        evidence: {
          dataPoints: expensive.length,
          examples: input.dataPoints.filter((dp) => (dp.metrics.cost || 0) > avgCost * 2).slice(0, 5).map((dp) => dp.id)
        },
        recommendations: [
          "Use cheaper models (Haiku instead of Sonnet) for simple queries",
          "Implement caching for repeated queries",
          "Optimize prompts to reduce token usage",
          "Set maxTokens limits to prevent runaway costs"
        ],
        detectedAt: /* @__PURE__ */ new Date()
      });
    }
    return insights;
  }
  /**
   * Detect performance bottlenecks
   */
  async detectPerformanceBottlenecks(input) {
    const insights = [];
    const latencies = input.dataPoints.map((dp) => dp.metrics.latencyMs || 0).filter((l) => l > 0);
    if (latencies.length === 0) return insights;
    const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
    if (p95Latency > 1e4) {
      insights.push({
        id: `insight_${nanoid2(10)}`,
        agentId: input.agentId,
        workspaceId: input.workspaceId,
        type: "performance_bottleneck",
        title: "Slow response times detected",
        description: `P95 latency is ${(p95Latency / 1e3).toFixed(1)}s (avg: ${(avgLatency / 1e3).toFixed(1)}s)`,
        severity: p95Latency > 2e4 ? "high" : "medium",
        confidence: 0.95,
        impact: {
          metric: "latency",
          current: avgLatency,
          potential: avgLatency * 0.5,
          // 50% reduction
          improvement: 50
        },
        evidence: {
          dataPoints: latencies.length,
          examples: input.dataPoints.filter((dp) => (dp.metrics.latencyMs || 0) > p95Latency).slice(0, 5).map((dp) => dp.id)
        },
        recommendations: [
          "Use parallel tool calls when possible",
          "Cache frequently accessed data",
          "Optimize database queries",
          "Use streaming for long responses"
        ],
        detectedAt: /* @__PURE__ */ new Date()
      });
    }
    return insights;
  }
};
function createInsightsAnalyzer(llmAnalyze) {
  return new InsightsAnalyzer(llmAnalyze);
}

// src/optimization/index.ts
import { nanoid as nanoid3 } from "nanoid";
var AgentOptimizer = class {
  constructor(config, llmOptimize) {
    this.config = config;
    this.llmOptimize = llmOptimize;
  }
  /**
   * Run optimization based on feedback and metrics
   */
  async optimize(params) {
    const runId = `optim_${nanoid3(12)}`;
    const startedAt = /* @__PURE__ */ new Date();
    const run = {
      id: runId,
      agentId: this.config.agentId,
      workspaceId: this.config.workspaceId,
      startedAt,
      status: "running",
      baseline: {
        systemPrompt: params.currentPrompt,
        model: params.currentModel,
        temperature: params.currentTemperature,
        metrics: params.metricsData
      },
      improvements: [],
      method: "prompt_optimization"
    };
    try {
      const corrections = params.feedbackData.filter((f) => f.type === "correction" || f.type === "edit");
      const negativeFeedback = params.feedbackData.filter((f) => f.type === "thumbs_down");
      if (corrections.length > 5) {
        run.method = "few_shot_learning";
        run.optimized = await this.optimizeWithFewShot(params, corrections);
      } else if (negativeFeedback.length > 10) {
        run.method = "prompt_optimization";
        run.optimized = await this.optimizePrompt(params, negativeFeedback);
      } else if (params.metricsData.cost > (this.config.constraints.maxCostPerConversation || Infinity)) {
        run.method = "model_tier_optimization";
        run.optimized = await this.optimizeModelTier(params);
      } else {
        run.method = "prompt_optimization";
        run.optimized = await this.optimizePrompt(params, params.feedbackData);
      }
      if (run.optimized) {
        for (const goal of this.config.goals) {
          const baselineValue = params.metricsData[goal.metric] || 0;
          const optimizedValue = run.optimized.metrics[goal.metric] || baselineValue;
          const improvement = (optimizedValue - baselineValue) / baselineValue * 100;
          if (Math.abs(improvement) > 1) {
            run.improvements.push({
              metric: goal.metric,
              baselineValue,
              optimizedValue,
              improvement
            });
          }
        }
      }
      run.status = "completed";
      run.completedAt = /* @__PURE__ */ new Date();
    } catch (error) {
      run.status = "failed";
      run.metadata = {
        error: error instanceof Error ? error.message : String(error)
      };
    }
    return run;
  }
  /**
   * Optimize using few-shot learning from corrections
   */
  async optimizeWithFewShot(params, corrections) {
    const examples = corrections.filter((c) => c.originalText && c.correctedText).slice(0, 10).map((c) => ({
      original: c.originalText,
      corrected: c.correctedText
    }));
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
        satisfaction: 0.85
        // Assumed improvement from style learning
      }
    };
  }
  /**
   * Optimize prompt using LLM
   */
  async optimizePrompt(params, negativeFeedback) {
    if (!this.llmOptimize) {
      return {
        systemPrompt: params.currentPrompt,
        model: params.currentModel,
        temperature: params.currentTemperature,
        metrics: {}
      };
    }
    const feedbackContext = negativeFeedback.map((f) => f.metadata?.reason || "User was unsatisfied").join("\n- ");
    const optimizationPrompt = `You are an expert at optimizing AI agent prompts.

Current system prompt:
"""
${params.currentPrompt}
"""

Issues reported by users:
- ${feedbackContext}

Optimization goals:
${this.config.goals.map((g) => `- Improve ${g.metric} (weight: ${g.weight})`).join("\n")}

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
          satisfaction: 0.8
          // Assumed improvement
        }
      };
    } catch (error) {
      console.error("[AgentOptimizer] Prompt optimization failed:", error);
      return {
        systemPrompt: params.currentPrompt,
        model: params.currentModel,
        temperature: params.currentTemperature,
        metrics: {}
      };
    }
  }
  /**
   * Optimize model tier to reduce cost
   */
  async optimizeModelTier(params) {
    const tierMap = {
      "claude-opus-4-20250514": "claude-3-5-sonnet-20241022",
      // Opus → Sonnet
      "claude-3-5-sonnet-20241022": "claude-3-5-haiku-20241022"
      // Sonnet → Haiku
    };
    const downgradedModel = tierMap[params.currentModel] || params.currentModel;
    const costReduction = downgradedModel !== params.currentModel ? 0.7 : 1;
    return {
      systemPrompt: params.currentPrompt,
      model: downgradedModel,
      temperature: params.currentTemperature,
      metrics: {
        cost: costReduction
        // Relative to baseline
      }
    };
  }
  /**
   * Create A/B test
   */
  async createABTest(params) {
    return {
      id: `abtest_${nanoid3(12)}`,
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
          metrics: {}
        },
        {
          id: "variant",
          name: "variant",
          systemPrompt: params.variantPrompt,
          model: params.model,
          temperature: params.temperature,
          trafficPercentage: this.config.abTestConfig.trafficSplit,
          sampleSize: 0,
          metrics: {}
        }
      ],
      confidence: 0,
      startedAt: /* @__PURE__ */ new Date()
    };
  }
  /**
   * Evaluate A/B test and determine winner
   */
  evaluateABTest(test) {
    const control = test.variants.find((v) => v.name === "control");
    const variant = test.variants.find((v) => v.name === "variant");
    if (!control || !variant) {
      return test;
    }
    if (control.sampleSize < this.config.abTestConfig.minSampleSize || variant.sampleSize < this.config.abTestConfig.minSampleSize) {
      return test;
    }
    const primaryGoal = this.config.goals[0];
    const controlMetric = control.metrics[primaryGoal.metric] || 0;
    const variantMetric = variant.metrics[primaryGoal.metric] || 0;
    const improvementThreshold = 0.05;
    const improvement = (variantMetric - controlMetric) / controlMetric;
    if (Math.abs(improvement) > improvementThreshold) {
      test.winner = improvement > 0 ? "variant" : "control";
      test.confidence = Math.min(0.95, 0.5 + Math.abs(improvement));
      test.status = "completed";
      test.completedAt = /* @__PURE__ */ new Date();
    }
    return test;
  }
};
function createOptimizer(config, llmOptimize) {
  return new AgentOptimizer(config, llmOptimize);
}

// src/meta-agent/index.ts
import { nanoid as nanoid4 } from "nanoid";
var SelfModifier = class {
  constructor(llmGenerate) {
    this.llmGenerate = llmGenerate;
  }
  /**
   * Analyze agent performance and propose modifications
   */
  async proposeModifications(params) {
    const proposals = [];
    const criticalInsights = params.insights.filter(
      (i) => i.severity === "critical" || i.severity === "high"
    );
    for (const insight of criticalInsights) {
      if (insight.type === "failure_pattern") {
        const proposal = await this.proposePromptUpdate(params, insight);
        if (proposal) proposals.push(proposal);
      } else if (insight.type === "cost_optimization") {
        const proposal = await this.proposeModelChange(params, insight);
        if (proposal) proposals.push(proposal);
      } else if (insight.type === "performance_bottleneck") {
        const proposal = await this.proposeToolAddition(params, insight);
        if (proposal) proposals.push(proposal);
      }
    }
    const corrections = params.feedback.filter((f) => f.correctedText);
    if (corrections.length > 5) {
      const proposal = await this.proposeStyleUpdate(params, corrections);
      if (proposal) proposals.push(proposal);
    }
    return proposals;
  }
  /**
   * Propose prompt update based on insight
   */
  async proposePromptUpdate(params, insight) {
    if (!this.llmGenerate) return null;
    const modificationPrompt = `You are an AI agent optimization expert.

Current system prompt:
"""
${params.currentConfig.systemPrompt}
"""

Problem identified:
${insight.description}

Recommendations:
${insight.recommendations.join("\n- ")}

Generate an improved system prompt that addresses this problem.
Include specific instructions to prevent the identified failure pattern.
Return ONLY the improved prompt, no explanation.`;
    try {
      const improvedPrompt = await this.llmGenerate(modificationPrompt);
      return {
        id: `proposal_${nanoid4(12)}`,
        agentId: params.agentId,
        workspaceId: params.workspaceId,
        type: "prompt_update",
        status: "pending",
        current: {
          systemPrompt: params.currentConfig.systemPrompt
        },
        proposed: {
          systemPrompt: improvedPrompt.trim()
        },
        rationale: `Addresses ${insight.type}: ${insight.description}`,
        expectedImpact: [
          {
            metric: "success_rate",
            currentValue: params.metrics.success_rate || 0.5,
            expectedValue: (params.metrics.success_rate || 0.5) * 1.3,
            // 30% improvement
            confidence: 0.7
          }
        ],
        evidence: {
          insights: [insight.id],
          feedback: [],
          metrics: params.metrics
        },
        createdAt: /* @__PURE__ */ new Date()
      };
    } catch (error) {
      console.error("[SelfModifier] Prompt update proposal failed:", error);
      return null;
    }
  }
  /**
   * Propose model tier change
   */
  async proposeModelChange(params, insight) {
    const tierDowngrade = {
      "claude-opus-4-20250514": "claude-3-5-sonnet-20241022",
      "claude-3-5-sonnet-20241022": "claude-3-5-haiku-20241022"
    };
    const currentModel = params.currentConfig.model;
    const proposedModel = tierDowngrade[currentModel];
    if (!proposedModel || proposedModel === currentModel) {
      return null;
    }
    return {
      id: `proposal_${nanoid4(12)}`,
      agentId: params.agentId,
      workspaceId: params.workspaceId,
      type: "parameter_tuning",
      status: "pending",
      current: {
        model: currentModel
      },
      proposed: {
        model: proposedModel
      },
      rationale: `Reduce costs while maintaining quality. ${insight.description}`,
      expectedImpact: [
        {
          metric: "cost",
          currentValue: params.metrics.cost || 0,
          expectedValue: (params.metrics.cost || 0) * 0.3,
          // 70% cost reduction
          confidence: 0.9
        }
      ],
      evidence: {
        insights: [insight.id],
        feedback: [],
        metrics: params.metrics
      },
      createdAt: /* @__PURE__ */ new Date()
    };
  }
  /**
   * Propose tool addition
   */
  async proposeToolAddition(params, insight) {
    const toolSuggestions = insight.recommendations.filter((r) => r.includes("cache") || r.includes("parallel") || r.includes("optimize")).map((r) => {
      if (r.includes("cache")) return "caching_tool";
      if (r.includes("parallel")) return "parallel_executor";
      return "optimization_tool";
    });
    if (toolSuggestions.length === 0) return null;
    return {
      id: `proposal_${nanoid4(12)}`,
      agentId: params.agentId,
      workspaceId: params.workspaceId,
      type: "tool_addition",
      status: "pending",
      current: {
        tools: params.currentConfig.tools
      },
      proposed: {
        tools: [...params.currentConfig.tools, ...toolSuggestions]
      },
      rationale: `Add tools to improve performance: ${insight.description}`,
      expectedImpact: [
        {
          metric: "latency",
          currentValue: params.metrics.latency || 0,
          expectedValue: (params.metrics.latency || 0) * 0.6,
          // 40% latency reduction
          confidence: 0.6
        }
      ],
      evidence: {
        insights: [insight.id],
        feedback: [],
        metrics: params.metrics
      },
      createdAt: /* @__PURE__ */ new Date()
    };
  }
  /**
   * Propose style update based on corrections
   */
  async proposeStyleUpdate(params, corrections) {
    if (!this.llmGenerate) return null;
    const examples = corrections.slice(0, 5).map((c) => c.correctedText).join("\n\n");
    const stylePrompt = `Analyze these corrected responses and extract the preferred writing style:

${examples}

Describe the style in 2-3 sentences (tone, structure, formality level, etc.).`;
    try {
      const styleDescription = await this.llmGenerate(stylePrompt);
      const updatedPrompt = `${params.currentConfig.systemPrompt}

## Writing Style

${styleDescription}

Follow this style in all your responses.`;
      return {
        id: `proposal_${nanoid4(12)}`,
        agentId: params.agentId,
        workspaceId: params.workspaceId,
        type: "prompt_update",
        status: "pending",
        current: {
          systemPrompt: params.currentConfig.systemPrompt
        },
        proposed: {
          systemPrompt: updatedPrompt
        },
        rationale: "Incorporate user's preferred writing style based on corrections",
        expectedImpact: [
          {
            metric: "satisfaction",
            currentValue: params.metrics.satisfaction || 0.5,
            expectedValue: 0.85,
            confidence: 0.8
          }
        ],
        evidence: {
          insights: [],
          feedback: corrections.map((_, i) => `feedback_${i}`),
          metrics: params.metrics
        },
        createdAt: /* @__PURE__ */ new Date()
      };
    } catch (error) {
      console.error("[SelfModifier] Style update proposal failed:", error);
      return null;
    }
  }
  /**
   * Apply an approved modification
   */
  async applyModification(proposalId, approved) {
    console.log(`[SelfModifier] ${approved ? "Applying" : "Rejecting"} proposal ${proposalId}`);
  }
};
var AgentBuilder = class {
  constructor(llmGenerate) {
    this.llmGenerate = llmGenerate;
  }
  /**
   * Build an agent from natural language description
   */
  async buildAgent(request) {
    if (!this.llmGenerate) {
      throw new Error("LLM generation required for agent building");
    }
    const buildPrompt = `You are an AI agent architect. Build a complete agent specification from this request:

Name: ${request.name}
Description: ${request.description}
Goals:
${request.goals.map((g) => `- ${g}`).join("\n")}

${request.constraints ? `Constraints:
${request.constraints.maxCost ? `- Max cost: $${request.constraints.maxCost}/conversation` : ""}
${request.constraints.maxLatency ? `- Max latency: ${request.constraints.maxLatency}ms` : ""}` : ""}

${request.domain ? `Domain: ${request.domain}` : ""}
${request.style ? `Communication style: ${request.style}` : ""}

Generate a complete agent specification with:
1. System prompt (detailed instructions for the agent)
2. Recommended model (haiku/sonnet/opus based on complexity)
3. Temperature (0-1)
4. Suggested tools (composio apps that would be useful)
5. Suggested triggers (when the agent should run)
6. Rationale for your choices

Return a JSON object with this structure:
{
  "systemPrompt": "...",
  "model": "claude-3-5-haiku-20241022",
  "temperature": 0.7,
  "suggestedTools": ["gmail", "calendar"],
  "suggestedTriggers": ["scheduled", "webhook"],
  "rationale": "..."
}`;
    try {
      const response = await this.llmGenerate(buildPrompt);
      const result = JSON.parse(response);
      return {
        systemPrompt: result.systemPrompt,
        model: result.model || "claude-3-5-sonnet-20241022",
        temperature: result.temperature || 0.7,
        suggestedTools: result.suggestedTools || [],
        suggestedTriggers: result.suggestedTriggers || [],
        rationale: result.rationale || "Agent built based on requirements"
      };
    } catch (error) {
      console.error("[AgentBuilder] Agent building failed:", error);
      throw new Error(`Failed to build agent: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
};
function createSelfModifier(llmGenerate) {
  return new SelfModifier(llmGenerate);
}
function createAgentBuilder(llmGenerate) {
  return new AgentBuilder(llmGenerate);
}
export {
  AgentBuilder,
  AgentEngine,
  AgentOptimizer,
  AgentTracer,
  ConversationEvaluator,
  DEFAULT_SCAN_RULES,
  InsightsAnalyzer,
  ScanEngine,
  SelfModifier,
  costTrackingHook,
  createAgentBuilder,
  createAgentEngine,
  createEvaluator,
  createInsightsAnalyzer,
  createOptimizer,
  createScanEngine,
  createSelfModifier,
  createTracer,
  errorLoggingHook,
  getAgentEngine,
  getDefaultAgentHooks,
  getEvalRegistry,
  getScanEngine,
  initAgentEngine,
  initElevayCore,
  initScanEngine,
  loggingHook,
  registerL1Assertion,
  registerL2Criterion,
  runL1Eval,
  runL2Eval,
  runL3Eval
};
