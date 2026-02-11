/**
 * Agent Engine
 *
 * Executes agents with:
 * - Lifecycle hooks (before/after)
 * - Data fetching from connectors
 * - LLM calls with tiering
 * - Eval integration
 * - Cost tracking
 */

import { nanoid } from "nanoid";
import {
  type AgentId,
  type UserId,
  type WorkspaceId,
  type RunId,
  type LLMTier,
  type AgentRun,
  type AgentFetchSource,
  type AgentAction,
  type EvalRules,
  type EvalResult,
  AgentExecutionError,
} from "@nodebase/types";
import { createTracer } from "../observability";

// ============================================
// Types
// ============================================

export interface AgentConfig {
  id: AgentId;
  name: string;
  systemPrompt: string;
  llmTier: LLMTier;
  temperature: number;
  maxStepsPerRun: number;
  fetchSources: AgentFetchSource[];
  actions: AgentAction[];
  evalRules: EvalRules;
}

export interface ExecutionContext {
  agentId: AgentId;
  userId: UserId;
  workspaceId: WorkspaceId;
  triggeredBy: string;
  userMessage?: string;
  additionalContext?: Record<string, unknown>;
}

export interface ExecutionResult {
  runId: RunId;
  output: {
    type: string;
    content: string;
    metadata?: Record<string, unknown>;
  };
  llmUsage: {
    model: string;
    tokensIn: number;
    tokensOut: number;
    cost: number;
    latencyMs: number;
  };
  evalResult: EvalResult;
  status: "completed" | "pending_review" | "blocked" | "failed";
}

// ============================================
// Lifecycle Hooks
// ============================================

export type BeforeHook = (context: ExecutionContext) => Promise<void>;
export type AfterHook = (context: ExecutionContext, result: ExecutionResult) => Promise<void>;
export type ErrorHook = (context: ExecutionContext, error: Error) => Promise<void>;

export interface LifecycleHooks {
  before: BeforeHook[];
  after: AfterHook[];
  onError: ErrorHook[];
}

// ============================================
// Agent Engine Class
// ============================================

export class AgentEngine {
  private hooks: LifecycleHooks = {
    before: [],
    after: [],
    onError: [],
  };
  private aiClient?: any; // AIClient from @nodebase/ai
  private composioClient?: any; // ComposioClient from @nodebase/connectors
  private connectorRegistry?: any; // ConnectorRegistry from @nodebase/connectors

  constructor(dependencies?: {
    aiClient?: any;
    composioClient?: any;
    connectorRegistry?: any;
  }) {
    this.aiClient = dependencies?.aiClient;
    this.composioClient = dependencies?.composioClient;
    this.connectorRegistry = dependencies?.connectorRegistry;
  }

  /**
   * Register a before hook.
   */
  onBefore(hook: BeforeHook): void {
    this.hooks.before.push(hook);
  }

  /**
   * Register an after hook.
   */
  onAfter(hook: AfterHook): void {
    this.hooks.after.push(hook);
  }

  /**
   * Register an error hook.
   */
  onError(hook: ErrorHook): void {
    this.hooks.onError.push(hook);
  }

  /**
   * Execute an agent.
   */
  async execute(
    config: AgentConfig,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const runId = `run_${nanoid(10)}`;
    const startTime = Date.now();

    // Create tracer for observability
    const tracer = createTracer({
      agentId: context.agentId,
      workspaceId: context.workspaceId,
      userId: context.userId,
      triggeredBy: context.triggeredBy,
      metadata: {
        agentName: config.name,
        llmTier: config.llmTier,
        temperature: config.temperature,
        maxStepsPerRun: config.maxStepsPerRun,
      },
    });

    try {
      // Run before hooks
      for (const hook of this.hooks.before) {
        await hook(context);
      }

      // 1. Fetch data from sources
      tracer.logDecision({
        reasoning: `Fetching data from ${config.fetchSources.length} sources`,
        decision: "fetch_data",
        metadata: { sources: config.fetchSources.map((s) => s.source) },
      });
      const fetchedData = await this.fetchData(config.fetchSources, context, tracer);

      // 2. Build prompt with fetched data
      const prompt = this.buildPrompt(config, context, fetchedData);

      // 3. Execute LLM call
      const llmStartTime = Date.now();
      const llmResult = await this.executeLLM(config, prompt, context);
      const llmDuration = Date.now() - llmStartTime;

      // Log LLM call in tracer
      tracer.logLLMCall({
        model: llmResult.model,
        input: prompt,
        output: llmResult.content,
        tokensIn: llmResult.tokensIn,
        tokensOut: llmResult.tokensOut,
        cost: llmResult.cost,
        durationMs: llmDuration,
      });

      // 4. Run eval
      const evalResult = await this.runEval(config.evalRules, llmResult.content, context);

      // Log eval result
      tracer.logDecision({
        reasoning: `Eval: L1=${evalResult.l1Passed}, L2=${evalResult.l2Score}, L3=${evalResult.l3Triggered ? "triggered" : "skipped"}`,
        decision: evalResult.finalDecision,
        metadata: {
          l1Passed: evalResult.l1Passed,
          l2Score: evalResult.l2Score,
          l3Triggered: evalResult.l3Triggered,
          l3Blocked: evalResult.l3Blocked,
        },
      });

      // 5. Determine status based on eval
      const status = this.determineStatus(evalResult, config.evalRules);

      const result: ExecutionResult = {
        runId,
        output: {
          type: "text",
          content: llmResult.content,
          metadata: { fetchedData },
        },
        llmUsage: {
          model: llmResult.model,
          tokensIn: llmResult.tokensIn,
          tokensOut: llmResult.tokensOut,
          cost: llmResult.cost,
          latencyMs: Date.now() - startTime,
        },
        evalResult,
        status,
      };

      // Complete the trace
      await tracer.complete({
        output: llmResult.content,
        status,
      });

      // Run after hooks
      for (const hook of this.hooks.after) {
        await hook(context, result);
      }

      return result;
    } catch (error) {
      // Log error in tracer
      tracer.logError(error as Error);
      await tracer.complete({ status: "failed" });

      // Run error hooks
      for (const hook of this.hooks.onError) {
        await hook(context, error as Error);
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
  private async fetchData(
    sources: AgentFetchSource[],
    context: ExecutionContext,
    tracer: ReturnType<typeof createTracer>
  ): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};

    for (const source of sources) {
      const toolStartTime = Date.now();
      try {
        // Use ComposioClient if injected
        if (this.composioClient && source.query) {
          try {
            const data = await this.composioClient.executeAction(
              context.workspaceId,
              {
                name: `${source.source}_${source.query}`,
                input: source.filters || {},
              }
            );
            results[source.source] = data;

            // Log successful tool call
            tracer.logToolCall({
              toolName: source.source,
              input: source.filters || {},
              output: data,
              durationMs: Date.now() - toolStartTime,
              success: true,
            });
          } catch (composioError) {
            console.error(
              `Composio fetch failed for ${source.source}:`,
              composioError
            );
            results[source.source] = { error: "fetch_failed" };

            // Log failed tool call
            tracer.logToolCall({
              toolName: source.source,
              input: source.filters || {},
              output: null,
              durationMs: Date.now() - toolStartTime,
              success: false,
              error: composioError instanceof Error ? composioError.message : String(composioError),
            });
          }
        } else {
          // Mock data when Composio not injected
          results[source.source] = {
            _mock: true,
            message: "Inject ComposioClient for real data",
          };

          // Log mock tool call
          tracer.logToolCall({
            toolName: source.source,
            input: source.filters || {},
            output: results[source.source] as Record<string, unknown>,
            durationMs: Date.now() - toolStartTime,
            success: true,
          });
        }
      } catch (error) {
        console.error(`Failed to fetch from ${source.source}:`, error);
        results[source.source] = { error: "fetch_failed" };

        // Log failed tool call
        tracer.logToolCall({
          toolName: source.source,
          input: source.filters || {},
          output: null,
          durationMs: Date.now() - toolStartTime,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Build the prompt with system prompt, fetched data, and user context.
   */
  private buildPrompt(
    config: AgentConfig,
    context: ExecutionContext,
    fetchedData: Record<string, unknown>
  ): string {
    const parts: string[] = [];

    // System prompt
    parts.push(config.systemPrompt);

    // Fetched data context
    if (Object.keys(fetchedData).length > 0) {
      parts.push("\n## Available Data\n");
      for (const [source, data] of Object.entries(fetchedData)) {
        parts.push(`### ${source}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`);
      }
    }

    // Additional context
    if (context.additionalContext) {
      parts.push("\n## Additional Context\n");
      parts.push(JSON.stringify(context.additionalContext, null, 2));
    }

    // User message
    if (context.userMessage) {
      parts.push("\n## User Request\n");
      parts.push(context.userMessage);
    }

    return parts.join("\n");
  }

  /**
   * Execute the LLM call.
   */
  private async executeLLM(
    config: AgentConfig,
    prompt: string,
    context: ExecutionContext
  ): Promise<{
    content: string;
    model: string;
    tokensIn: number;
    tokensOut: number;
    cost: number;
  }> {
    // Use @nodebase/ai to make the actual call
    // Note: AIClient should be injected via constructor in production
    // For now, we'll use a placeholder structure

    try {
      const modelMap: Record<LLMTier, string> = {
        haiku: "claude-3-5-haiku-20241022",
        sonnet: "claude-sonnet-4-20250514",
        opus: "claude-opus-4-20250514",
      };

      // Use AIClient if injected
      if (this.aiClient) {
        try {
          const result = await this.aiClient.message({
            tier: config.llmTier,
            systemPrompt: prompt,
            messages: [
              {
                role: "user",
                content: context.userMessage || "Process the data and respond.",
              },
            ],
            temperature: config.temperature,
            maxTokens: 4096,
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
            ),
          };
        } catch (aiError) {
          console.error("AIClient execution failed:", aiError);
          // Fallback to mock
        }
      }

      // Mock implementation when AIClient not injected (testing/development)
      return {
        content:
          "This is a mock response from the agent. Inject AIClient for real responses.",
        model: modelMap[config.llmTier],
        tokensIn: prompt.length / 4, // Rough estimation
        tokensOut: 100, // Mock value
        cost: this.calculateCost(config.llmTier, prompt.length / 4, 100),
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
  private calculateCost(tier: LLMTier, tokensIn: number, tokensOut: number): number {
    const pricing: Record<LLMTier, { input: number; output: number }> = {
      haiku: { input: 0.001, output: 0.005 }, // $1 / $5 per million tokens
      sonnet: { input: 0.003, output: 0.015 }, // $3 / $15 per million tokens
      opus: { input: 0.015, output: 0.075 }, // $15 / $75 per million tokens
    };

    const rates = pricing[tier];
    return (tokensIn * rates.input + tokensOut * rates.output) / 1_000_000;
  }

  /**
   * Run evaluation on the output.
   */
  private async runEval(
    rules: EvalRules,
    content: string,
    context: ExecutionContext
  ): Promise<EvalResult> {
    // Import eval functions
    const { runL1Eval, runL2Eval, runL3Eval } = await import("../eval");

    // Run L1 (assertions)
    const l1Result = runL1Eval(content, rules.l1.assertions);

    // Run L2 (LLM scoring) if L1 passed
    let l2Score = 0;
    let l2Breakdown: Record<string, number> = {};
    if (l1Result.passed) {
      const l2Result = await runL2Eval(content, rules.l2.criteria);
      l2Score = l2Result.score;
      l2Breakdown = l2Result.breakdown;
    }

    // Determine if L3 should trigger
    const l3Triggered = this.shouldTriggerL3(rules, l1Result.passed, l2Score);

    // Run L3 if triggered
    let l3Blocked = false;
    let l3Reason: string | undefined;
    if (l3Triggered) {
      const l3Result = await runL3Eval(content, rules.l3.triggerConditions);
      l3Blocked = l3Result.blocked;
      l3Reason = l3Result.reason;
    }

    // Determine final decision
    const finalDecision = this.determineFinalDecision(
      l1Result.passed,
      l2Score,
      l3Blocked,
      rules
    );

    return {
      runId: `run_${nanoid(10)}`,
      l1Passed: l1Result.passed,
      l1Assertions: l1Result.assertions,
      l2Score,
      l2Breakdown,
      l3Triggered,
      l3Blocked,
      l3Reason,
      finalDecision,
    };
  }

  /**
   * Determine if L3 evaluation should trigger.
   */
  private shouldTriggerL3(
    rules: EvalRules,
    l1Passed: boolean,
    l2Score: number
  ): boolean {
    // Always trigger L3 if L1 failed or L2 score is below threshold
    if (!l1Passed) return true;
    if (l2Score < rules.minConfidence) return true;

    // Trigger based on rule conditions
    if (rules.requireApproval) return true;

    return false;
  }

  /**
   * Determine final decision based on all eval results.
   */
  private determineFinalDecision(
    l1Passed: boolean,
    l2Score: number,
    l3Blocked: boolean,
    rules: EvalRules
  ): "auto_send" | "needs_review" | "blocked" {
    // Blocked if L3 said so
    if (l3Blocked) return "blocked";

    // Blocked if L1 failed
    if (!l1Passed) return "blocked";

    // Auto-send if above threshold and no approval required
    if (l2Score >= rules.autoSendThreshold && !rules.requireApproval) {
      return "auto_send";
    }

    // Otherwise needs review
    return "needs_review";
  }

  /**
   * Determine run status based on eval result.
   */
  private determineStatus(
    evalResult: EvalResult,
    rules: EvalRules
  ): "completed" | "pending_review" | "blocked" | "failed" {
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
}

// ============================================
// Singleton Instance
// ============================================

let _agentEngine: AgentEngine | null = null;

export function initAgentEngine(): AgentEngine {
  _agentEngine = new AgentEngine();
  return _agentEngine;
}

export function getAgentEngine(): AgentEngine {
  if (!_agentEngine) {
    _agentEngine = new AgentEngine();
  }
  return _agentEngine;
}

// ============================================
// Default Hooks
// ============================================

/**
 * Logging hook - logs all executions.
 */
export const loggingHook: AfterHook = async (context, result) => {
  console.log(`[Agent ${context.agentId}] Run ${result.runId} completed`, {
    status: result.status,
    cost: result.llmUsage.cost,
    latency: result.llmUsage.latencyMs,
  });
};

/**
 * Cost tracking hook - tracks LLM costs.
 */
export const costTrackingHook: AfterHook = async (context, result) => {
  // TODO: Save to database or metrics system
  console.log(`[Cost] Agent ${context.agentId}: $${result.llmUsage.cost.toFixed(4)}`);
};

/**
 * Error logging hook - logs errors.
 */
export const errorLoggingHook: ErrorHook = async (context, error) => {
  console.error(`[Agent ${context.agentId}] Error:`, error.message);
};
