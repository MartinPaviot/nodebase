// src/agent-engine/index.ts
import { nanoid as nanoid2 } from "nanoid";
import {
  AgentExecutionError
} from "@nodebase/types";

// src/observability/index.ts
import { nanoid } from "nanoid";
var AgentTracer = class {
  constructor(input, onSave) {
    this.input = input;
    this.onSave = onSave;
    this.traceId = `trace_${nanoid(12)}`;
    this.startTime = Date.now();
  }
  traceId;
  steps = [];
  startTime;
  metrics = {
    totalDurationMs: 0,
    llmCalls: 0,
    toolCalls: 0,
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalCost: 0,
    stepsCount: 0
  };
  /**
   * Get the trace ID
   */
  getTraceId() {
    return this.traceId;
  }
  /**
   * Log a step in the trace
   */
  logStep(step) {
    const stepId = `step_${nanoid(10)}`;
    const fullStep = {
      ...step,
      id: stepId,
      timestamp: /* @__PURE__ */ new Date()
    };
    this.steps.push(fullStep);
    this.metrics.stepsCount++;
    if (step.type === "llm_call") {
      this.metrics.llmCalls++;
      if (step.metadata?.tokensIn) {
        this.metrics.totalTokensIn += step.metadata.tokensIn;
      }
      if (step.metadata?.tokensOut) {
        this.metrics.totalTokensOut += step.metadata.tokensOut;
      }
      if (step.metadata?.cost) {
        this.metrics.totalCost += step.metadata.cost;
      }
    } else if (step.type === "tool_call") {
      this.metrics.toolCalls++;
    }
    if (step.durationMs) {
      this.metrics.totalDurationMs += step.durationMs;
    }
    return stepId;
  }
  /**
   * Log an LLM call
   */
  logLLMCall(params) {
    return this.logStep({
      type: "llm_call",
      input: typeof params.input === "string" ? { prompt: params.input } : params.input,
      output: typeof params.output === "string" ? { response: params.output } : params.output,
      durationMs: params.durationMs,
      metadata: {
        model: params.model,
        tokensIn: params.tokensIn,
        tokensOut: params.tokensOut,
        cost: params.cost
      }
    });
  }
  /**
   * Log a tool call
   */
  logToolCall(params) {
    return this.logStep({
      type: "tool_call",
      input: params.input,
      output: params.output,
      durationMs: params.durationMs,
      error: params.error ? { message: params.error } : void 0,
      metadata: {
        toolName: params.toolName,
        success: params.success
      }
    });
  }
  /**
   * Log an agent decision
   */
  logDecision(params) {
    return this.logStep({
      type: "decision",
      input: { reasoning: params.reasoning },
      output: { decision: params.decision },
      metadata: params.metadata
    });
  }
  /**
   * Log an error
   */
  logError(error) {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : void 0;
    return this.logStep({
      type: "error",
      error: {
        message: errorMessage,
        stack: errorStack
      }
    });
  }
  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      totalDurationMs: Date.now() - this.startTime
    };
  }
  /**
   * Get all steps
   */
  getSteps() {
    return [...this.steps];
  }
  /**
   * Complete the trace and save
   */
  async complete(params) {
    const finalMetrics = this.getMetrics();
    const trace = {
      id: this.traceId,
      agentId: this.input.agentId,
      conversationId: this.input.conversationId,
      userId: this.input.userId,
      workspaceId: this.input.workspaceId,
      triggeredBy: this.input.triggeredBy,
      userMessage: this.input.userMessage,
      status: params?.status || "completed",
      output: params?.output,
      steps: this.steps,
      metrics: finalMetrics,
      startedAt: new Date(this.startTime),
      completedAt: /* @__PURE__ */ new Date(),
      durationMs: finalMetrics.totalDurationMs
    };
    if (this.onSave) {
      await this.onSave(trace);
    }
  }
};
function createTracer(input, onSave) {
  return new AgentTracer(input, onSave);
}

// src/agent-engine/index.ts
var AgentEngine = class {
  hooks = {
    before: [],
    after: [],
    onError: []
  };
  aiClient;
  // AIClient from @nodebase/ai
  composioClient;
  // ComposioClient from @nodebase/connectors
  connectorRegistry;
  // ConnectorRegistry from @nodebase/connectors
  constructor(dependencies) {
    this.aiClient = dependencies?.aiClient;
    this.composioClient = dependencies?.composioClient;
    this.connectorRegistry = dependencies?.connectorRegistry;
  }
  /**
   * Register a before hook.
   */
  onBefore(hook) {
    this.hooks.before.push(hook);
  }
  /**
   * Register an after hook.
   */
  onAfter(hook) {
    this.hooks.after.push(hook);
  }
  /**
   * Register an error hook.
   */
  onError(hook) {
    this.hooks.onError.push(hook);
  }
  /**
   * Execute an agent.
   */
  async execute(config, context) {
    const runId = `run_${nanoid2(10)}`;
    const startTime = Date.now();
    const tracer = createTracer({
      agentId: context.agentId,
      workspaceId: context.workspaceId,
      userId: context.userId,
      triggeredBy: context.triggeredBy,
      metadata: {
        agentName: config.name,
        llmTier: config.llmTier,
        temperature: config.temperature,
        maxStepsPerRun: config.maxStepsPerRun
      }
    });
    try {
      for (const hook of this.hooks.before) {
        await hook(context);
      }
      tracer.logDecision({
        reasoning: `Fetching data from ${config.fetchSources.length} sources`,
        decision: "fetch_data",
        metadata: { sources: config.fetchSources.map((s) => s.source) }
      });
      const fetchedData = await this.fetchData(config.fetchSources, context, tracer);
      const prompt = this.buildPrompt(config, context, fetchedData);
      const llmStartTime = Date.now();
      const llmResult = await this.executeLLM(config, prompt, context);
      const llmDuration = Date.now() - llmStartTime;
      tracer.logLLMCall({
        model: llmResult.model,
        input: prompt,
        output: llmResult.content,
        tokensIn: llmResult.tokensIn,
        tokensOut: llmResult.tokensOut,
        cost: llmResult.cost,
        durationMs: llmDuration
      });
      const evalResult = await this.runEval(config.evalRules, llmResult.content, context);
      tracer.logDecision({
        reasoning: `Eval: L1=${evalResult.l1Passed}, L2=${evalResult.l2Score}, L3=${evalResult.l3Triggered ? "triggered" : "skipped"}`,
        decision: evalResult.finalDecision,
        metadata: {
          l1Passed: evalResult.l1Passed,
          l2Score: evalResult.l2Score,
          l3Triggered: evalResult.l3Triggered,
          l3Blocked: evalResult.l3Blocked
        }
      });
      const status = this.determineStatus(evalResult, config.evalRules);
      const result = {
        runId,
        output: {
          type: "text",
          content: llmResult.content,
          metadata: { fetchedData }
        },
        llmUsage: {
          model: llmResult.model,
          tokensIn: llmResult.tokensIn,
          tokensOut: llmResult.tokensOut,
          cost: llmResult.cost,
          latencyMs: Date.now() - startTime
        },
        evalResult,
        status
      };
      await tracer.complete({
        output: llmResult.content,
        status
      });
      for (const hook of this.hooks.after) {
        await hook(context, result);
      }
      return result;
    } catch (error) {
      tracer.logError(error);
      await tracer.complete({ status: "failed" });
      for (const hook of this.hooks.onError) {
        await hook(context, error);
      }
      throw new AgentExecutionError(
        context.agentId,
        runId,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  /**
   * Fetch data from all configured sources.
   */
  async fetchData(sources, context, tracer) {
    const results = {};
    for (const source of sources) {
      const toolStartTime = Date.now();
      try {
        if (this.composioClient && source.query) {
          try {
            const data = await this.composioClient.executeAction(
              context.workspaceId,
              {
                name: `${source.source}_${source.query}`,
                input: source.filters || {}
              }
            );
            results[source.source] = data;
            tracer.logToolCall({
              toolName: source.source,
              input: source.filters || {},
              output: data,
              durationMs: Date.now() - toolStartTime,
              success: true
            });
          } catch (composioError) {
            console.error(
              `Composio fetch failed for ${source.source}:`,
              composioError
            );
            results[source.source] = { error: "fetch_failed" };
            tracer.logToolCall({
              toolName: source.source,
              input: source.filters || {},
              output: null,
              durationMs: Date.now() - toolStartTime,
              success: false,
              error: composioError instanceof Error ? composioError.message : String(composioError)
            });
          }
        } else {
          results[source.source] = {
            _mock: true,
            message: "Inject ComposioClient for real data"
          };
          tracer.logToolCall({
            toolName: source.source,
            input: source.filters || {},
            output: results[source.source],
            durationMs: Date.now() - toolStartTime,
            success: true
          });
        }
      } catch (error) {
        console.error(`Failed to fetch from ${source.source}:`, error);
        results[source.source] = { error: "fetch_failed" };
        tracer.logToolCall({
          toolName: source.source,
          input: source.filters || {},
          output: null,
          durationMs: Date.now() - toolStartTime,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    return results;
  }
  /**
   * Build the prompt with system prompt, fetched data, and user context.
   */
  buildPrompt(config, context, fetchedData) {
    const parts = [];
    parts.push(config.systemPrompt);
    if (Object.keys(fetchedData).length > 0) {
      parts.push("\n## Available Data\n");
      for (const [source, data] of Object.entries(fetchedData)) {
        parts.push(`### ${source}
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`
`);
      }
    }
    if (context.additionalContext) {
      parts.push("\n## Additional Context\n");
      parts.push(JSON.stringify(context.additionalContext, null, 2));
    }
    if (context.userMessage) {
      parts.push("\n## User Request\n");
      parts.push(context.userMessage);
    }
    return parts.join("\n");
  }
  /**
   * Execute the LLM call.
   */
  async executeLLM(config, prompt, context) {
    try {
      const modelMap = {
        fast: "claude-3-5-haiku-20241022",
        smart: "claude-3-5-sonnet-20241022",
        deep: "claude-opus-4-20250514"
      };
      if (this.aiClient) {
        try {
          const result = await this.aiClient.message({
            tier: config.llmTier,
            systemPrompt: prompt,
            messages: [
              {
                role: "user",
                content: context.userMessage || "Process the data and respond."
              }
            ],
            temperature: config.temperature,
            maxTokens: 4096
          });
          return {
            content: result.content,
            model: result.model,
            tokensIn: result.usage.inputTokens,
            tokensOut: result.usage.outputTokens,
            cost: this.calculateCost(
              config.llmTier,
              result.usage.inputTokens,
              result.usage.outputTokens
            )
          };
        } catch (aiError) {
          console.error("AIClient execution failed:", aiError);
        }
      }
      return {
        content: "This is a mock response from the agent. Inject AIClient for real responses.",
        model: modelMap[config.llmTier],
        tokensIn: prompt.length / 4,
        // Rough estimation
        tokensOut: 100,
        // Mock value
        cost: this.calculateCost(config.llmTier, prompt.length / 4, 100)
      };
    } catch (error) {
      throw new AgentExecutionError(
        config.id,
        context.userId,
        `LLM execution failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  /**
   * Calculate cost based on tier and token usage.
   */
  calculateCost(tier, tokensIn, tokensOut) {
    const pricing = {
      fast: { input: 1e-3, output: 5e-3 },
      // $1 / $5 per million tokens
      smart: { input: 3e-3, output: 0.015 },
      // $3 / $15 per million tokens
      deep: { input: 0.015, output: 0.075 }
      // $15 / $75 per million tokens
    };
    const rates = pricing[tier];
    return (tokensIn * rates.input + tokensOut * rates.output) / 1e6;
  }
  /**
   * Run evaluation on the output.
   */
  async runEval(rules, content, context) {
    const { runL1Eval, runL2Eval, runL3Eval } = await import("./eval/index.mjs");
    const l1Result = runL1Eval(content, rules.l1.assertions);
    let l2Score = 0;
    let l2Breakdown = {};
    if (l1Result.passed) {
      const l2Result = await runL2Eval(content, rules.l2.criteria);
      l2Score = l2Result.score;
      l2Breakdown = l2Result.breakdown;
    }
    const l3Triggered = this.shouldTriggerL3(rules, l1Result.passed, l2Score);
    let l3Blocked = false;
    let l3Reason;
    if (l3Triggered) {
      const l3Result = await runL3Eval(content, rules.l3.triggerConditions);
      l3Blocked = l3Result.blocked;
      l3Reason = l3Result.reason;
    }
    const finalDecision = this.determineFinalDecision(
      l1Result.passed,
      l2Score,
      l3Blocked,
      rules
    );
    return {
      runId: `run_${nanoid2(10)}`,
      l1Passed: l1Result.passed,
      l1Assertions: l1Result.assertions,
      l2Score,
      l2Breakdown,
      l3Triggered,
      l3Blocked,
      l3Reason,
      finalDecision
    };
  }
  /**
   * Determine if L3 evaluation should trigger.
   */
  shouldTriggerL3(rules, l1Passed, l2Score) {
    if (!l1Passed) return true;
    if (l2Score < rules.minConfidence) return true;
    if (rules.requireApproval) return true;
    return false;
  }
  /**
   * Determine final decision based on all eval results.
   */
  determineFinalDecision(l1Passed, l2Score, l3Blocked, rules) {
    if (l3Blocked) return "blocked";
    if (!l1Passed) return "blocked";
    if (l2Score >= rules.autoSendThreshold && !rules.requireApproval) {
      return "auto_send";
    }
    return "needs_review";
  }
  /**
   * Determine run status based on eval result.
   */
  determineStatus(evalResult, rules) {
    switch (evalResult.finalDecision) {
      case "auto_send":
        return "completed";
      case "needs_review":
        return "pending_review";
      case "blocked":
        return "blocked";
      default:
        return "pending_review";
    }
  }
};
var _agentEngine = null;
function initAgentEngine() {
  _agentEngine = new AgentEngine();
  return _agentEngine;
}
function getAgentEngine() {
  if (!_agentEngine) {
    _agentEngine = new AgentEngine();
  }
  return _agentEngine;
}
var loggingHook = async (context, result) => {
  console.log(`[Agent ${context.agentId}] Run ${result.runId} completed`, {
    status: result.status,
    cost: result.llmUsage.cost,
    latency: result.llmUsage.latencyMs
  });
};
var costTrackingHook = async (context, result) => {
  console.log(`[Cost] Agent ${context.agentId}: $${result.llmUsage.cost.toFixed(4)}`);
};
var errorLoggingHook = async (context, error) => {
  console.error(`[Agent ${context.agentId}] Error:`, error.message);
};

export {
  AgentTracer,
  createTracer,
  AgentEngine,
  initAgentEngine,
  getAgentEngine,
  loggingHook,
  costTrackingHook,
  errorLoggingHook
};
