import { AgentId, UserId, WorkspaceId, RunId, EvalResult, LLMTier, AgentFetchSource, AgentAction, EvalRules } from '@elevay/types';

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

interface AgentConfig {
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
interface ExecutionContext {
    agentId: AgentId;
    userId: UserId;
    workspaceId: WorkspaceId;
    triggeredBy: string;
    userMessage?: string;
    additionalContext?: Record<string, unknown>;
}
interface ExecutionResult {
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
type BeforeHook = (context: ExecutionContext) => Promise<void>;
type AfterHook = (context: ExecutionContext, result: ExecutionResult) => Promise<void>;
type ErrorHook = (context: ExecutionContext, error: Error) => Promise<void>;
interface LifecycleHooks {
    before: BeforeHook[];
    after: AfterHook[];
    onError: ErrorHook[];
}
declare class AgentEngine {
    private hooks;
    private aiClient?;
    private composioClient?;
    private connectorRegistry?;
    constructor(dependencies?: {
        aiClient?: any;
        composioClient?: any;
        connectorRegistry?: any;
    });
    /**
     * Register a before hook.
     */
    onBefore(hook: BeforeHook): void;
    /**
     * Register an after hook.
     */
    onAfter(hook: AfterHook): void;
    /**
     * Register an error hook.
     */
    onError(hook: ErrorHook): void;
    /**
     * Execute an agent.
     */
    execute(config: AgentConfig, context: ExecutionContext): Promise<ExecutionResult>;
    /**
     * Fetch data from all configured sources.
     */
    private fetchData;
    /**
     * Build the prompt with system prompt, fetched data, and user context.
     */
    private buildPrompt;
    /**
     * Execute the LLM call.
     */
    private executeLLM;
    /**
     * Calculate cost based on tier and token usage.
     */
    private calculateCost;
    /**
     * Run evaluation on the output.
     */
    private runEval;
    /**
     * Determine if L3 evaluation should trigger.
     */
    private shouldTriggerL3;
    /**
     * Determine final decision based on all eval results.
     */
    private determineFinalDecision;
    /**
     * Determine run status based on eval result.
     */
    private determineStatus;
}
declare function initAgentEngine(): AgentEngine;
declare function getAgentEngine(): AgentEngine;
/**
 * Logging hook - logs all executions.
 */
declare const loggingHook: AfterHook;
/**
 * Cost tracking hook - tracks LLM costs.
 */
declare const costTrackingHook: AfterHook;
/**
 * Error logging hook - logs errors.
 */
declare const errorLoggingHook: ErrorHook;

export { type AfterHook, type AgentConfig, AgentEngine, type BeforeHook, type ErrorHook, type ExecutionContext, type ExecutionResult, type LifecycleHooks, costTrackingHook, errorLoggingHook, getAgentEngine, initAgentEngine, loggingHook };
