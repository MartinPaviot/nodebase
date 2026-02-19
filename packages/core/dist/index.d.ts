import { ScanEngineConfig, ScanEngine } from './scan-engine/index.js';
export { DEFAULT_SCAN_RULES, ScanConfig, ScanContext, ScanRule, getScanEngine, initScanEngine } from './scan-engine/index.js';
import { AgentEngine } from './agent-engine/index.js';
export { AfterHook, AgentConfig, BeforeHook, ErrorHook, ExecutionContext, ExecutionResult, LifecycleHooks, costTrackingHook, errorLoggingHook, getAgentEngine, initAgentEngine, loggingHook } from './agent-engine/index.js';
export { EvalRegistry, L1Result, L2Result, L3Result, getEvalRegistry, registerL1Assertion, registerL2Criterion, runL1Eval, runL2Eval, runL3Eval } from './eval/index.js';
import '@elevay/types';

/**
 * Factory Functions
 *
 * Initialize engines with proper dependency injection.
 * This wires together all the packages:
 * - @elevay/connectors (Composio, ConnectorRegistry)
 * - @elevay/ai (AIClient)
 * - @elevay/core (ScanEngine, AgentEngine)
 */

interface CoreDependencies {
    composioClient?: any;
    connectorRegistry?: any;
    aiClient?: any;
}
/**
 * Create a ScanEngine with dependencies injected.
 *
 * @example
 * ```typescript
 * import { initComposio, getConnectorRegistry } from "@elevay/connectors";
 * import { createScanEngine } from "@elevay/core";
 *
 * const composio = initComposio({ apiKey: process.env.COMPOSIO_API_KEY });
 * const registry = getConnectorRegistry();
 *
 * const scanEngine = createScanEngine({
 *   composioClient: composio,
 *   connectorRegistry: registry
 * });
 * ```
 */
declare function createScanEngine(dependencies: CoreDependencies, config?: ScanEngineConfig): ScanEngine;
/**
 * Create an AgentEngine with dependencies injected.
 *
 * @example
 * ```typescript
 * import { initComposio, getConnectorRegistry } from "@elevay/connectors";
 * import { AIClient } from "@elevay/ai";
 * import { createAgentEngine } from "@elevay/core";
 *
 * const composio = initComposio({ apiKey: process.env.COMPOSIO_API_KEY });
 * const registry = getConnectorRegistry();
 * const aiClient = new AIClient({ apiKey: process.env.ANTHROPIC_API_KEY });
 *
 * const agentEngine = createAgentEngine({
 *   composioClient: composio,
 *   connectorRegistry: registry,
 *   aiClient: aiClient
 * });
 * ```
 */
declare function createAgentEngine(dependencies: CoreDependencies): AgentEngine;
/**
 * Initialize the entire Elevay core system.
 * This is a convenience function that sets up everything with proper dependencies.
 *
 * @example
 * ```typescript
 * import { initElevayCore } from "@elevay/core";
 *
 * const { scanEngine, agentEngine } = await initElevayCore({
 *   composioApiKey: process.env.COMPOSIO_API_KEY,
 *   anthropicApiKey: process.env.ANTHROPIC_API_KEY
 * });
 * ```
 */
declare function initElevayCore(config: {
    composioApiKey?: string;
    anthropicApiKey?: string;
    scanEngineConfig?: ScanEngineConfig;
}): Promise<{
    scanEngine: ScanEngine;
    agentEngine: AgentEngine;
    dependencies: CoreDependencies;
}>;
/**
 * Get default lifecycle hooks for the AgentEngine.
 * These hooks provide logging, cost tracking, and error handling out of the box.
 */
declare function getDefaultAgentHooks(): {
    /**
     * Logging hook - logs when an agent starts execution.
     */
    loggingHook: (context: any) => Promise<void>;
    /**
     * Cost tracking hook - logs the cost and token usage after execution.
     */
    costTrackingHook: (context: any, result: any) => Promise<void>;
    /**
     * Error logging hook - logs errors that occur during execution.
     */
    errorLoggingHook: (context: any, error: Error) => Promise<void>;
};

/**
 * Observability Layer - LangSmith-style Tracing
 *
 * Provides comprehensive tracing for agent executions:
 * - Full execution traces with tokens, cost, latency
 * - Step-by-step logging of agent decisions
 * - Tool call tracking
 * - Error tracking with context
 * - Performance metrics
 */
interface TraceStep {
    id: string;
    type: "tool_call" | "llm_call" | "decision" | "error";
    timestamp: Date;
    durationMs?: number;
    input?: Record<string, unknown>;
    output?: Record<string, unknown> | null;
    error?: {
        message: string;
        stack?: string;
        code?: string;
    };
    metadata?: Record<string, unknown>;
}
interface TraceMetrics {
    totalDurationMs: number;
    llmCalls: number;
    toolCalls: number;
    totalTokensIn: number;
    totalTokensOut: number;
    totalCost: number;
    stepsCount: number;
}
interface CreateTraceInput {
    agentId: string;
    conversationId?: string;
    userId: string;
    workspaceId: string;
    triggeredBy: string;
    userMessage?: string;
    metadata?: Record<string, unknown>;
}
interface TraceUpdateInput {
    status?: "running" | "completed" | "failed" | "cancelled" | "blocked" | "pending_review";
    output?: Record<string, unknown> | string;
    error?: {
        message: string;
        stack?: string;
        code?: string;
    };
    metrics?: Partial<TraceMetrics>;
}
declare class AgentTracer {
    private input;
    private onSave?;
    private traceId;
    private steps;
    private startTime;
    private metrics;
    constructor(input: CreateTraceInput, onSave?: ((trace: any) => Promise<void>) | undefined);
    /**
     * Get the trace ID
     */
    getTraceId(): string;
    /**
     * Log a step in the trace
     */
    logStep(step: Omit<TraceStep, "id" | "timestamp">): string;
    /**
     * Log an LLM call
     */
    logLLMCall(params: {
        model: string;
        input: string | Record<string, unknown>;
        output: string | Record<string, unknown>;
        tokensIn: number;
        tokensOut: number;
        cost: number;
        durationMs: number;
    }): string;
    /**
     * Log a tool call
     */
    logToolCall(params: {
        toolName: string;
        input: Record<string, unknown>;
        output: Record<string, unknown> | null;
        durationMs: number;
        success: boolean;
        error?: string;
    }): string;
    /**
     * Log an agent decision
     */
    logDecision(params: {
        reasoning: string;
        decision: string;
        metadata?: Record<string, unknown>;
    }): string;
    /**
     * Log an error
     */
    logError(error: Error | string): string;
    /**
     * Get current metrics
     */
    getMetrics(): TraceMetrics;
    /**
     * Get all steps
     */
    getSteps(): TraceStep[];
    /**
     * Complete the trace and save
     */
    complete(params?: {
        output?: Record<string, unknown> | string;
        status?: "completed" | "failed" | "cancelled" | "blocked" | "pending_review";
    }): Promise<void>;
}
/**
 * Create a new tracer for an agent execution
 */
declare function createTracer(input: CreateTraceInput, onSave?: (trace: any) => Promise<void>): AgentTracer;

/**
 * Multi-Turn Evaluation System
 *
 * Evaluates entire conversations, not just single messages:
 * - Goal completion tracking
 * - User satisfaction scoring
 * - Conversation quality metrics
 * - Pattern detection (successful vs failed conversations)
 */
interface EvaluationCriteria {
    goalCompletion: {
        enabled: boolean;
        expectedGoals: string[];
    };
    userSatisfaction: {
        enabled: boolean;
        indicators: string[];
    };
    conversationQuality: {
        enabled: boolean;
        metrics: string[];
    };
    customCriteria?: Record<string, unknown>;
}
interface EvaluationResult {
    id: string;
    conversationId: string;
    agentId: string;
    userId: string;
    workspaceId: string;
    goalsDetected: string[];
    goalsCompleted: string[];
    goalCompletionRate: number;
    satisfactionScore: number;
    satisfactionIndicators: Record<string, boolean>;
    qualityScores: Record<string, number>;
    overallQualityScore: number;
    turnCount: number;
    durationMs: number;
    evaluatedAt: Date;
    metadata?: Record<string, unknown>;
}
interface ConversationTurn {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
}
declare class ConversationEvaluator {
    private criteria;
    private llmEvaluate?;
    constructor(criteria: EvaluationCriteria, llmEvaluate?: ((prompt: string) => Promise<Record<string, unknown>>) | undefined);
    /**
     * Evaluate a complete conversation
     */
    evaluateConversation(params: {
        conversationId: string;
        agentId: string;
        userId: string;
        workspaceId: string;
        turns: ConversationTurn[];
        startedAt: Date;
        endedAt: Date;
    }): Promise<EvaluationResult>;
    /**
     * Evaluate goal completion
     */
    private evaluateGoalCompletion;
    /**
     * Evaluate user satisfaction
     */
    private evaluateUserSatisfaction;
    /**
     * Evaluate conversation quality
     */
    private evaluateQuality;
}
declare function createEvaluator(criteria: EvaluationCriteria, llmEvaluate?: (prompt: string) => Promise<Record<string, unknown>>): ConversationEvaluator;

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
interface InsightInput {
    agentId: string;
    workspaceId: string;
    timeframe: {
        start: Date;
        end: Date;
    };
    dataPoints: DataPoint[];
}
interface DataPoint {
    id: string;
    type: "trace" | "evaluation" | "feedback";
    timestamp: Date;
    metrics: Record<string, number>;
    metadata: Record<string, unknown>;
}
interface Insight {
    id: string;
    agentId: string;
    workspaceId: string;
    type: "failure_pattern" | "success_pattern" | "cost_optimization" | "performance_bottleneck";
    title: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    confidence: number;
    impact: {
        metric: string;
        current: number;
        potential: number;
        improvement: number;
    };
    evidence: {
        dataPoints: number;
        examples: string[];
    };
    recommendations: string[];
    detectedAt: Date;
    metadata?: Record<string, unknown>;
}
interface Pattern {
    id: string;
    name: string;
    occurrences: number;
    confidence: number;
    indicators: string[];
}
declare class InsightsAnalyzer {
    private llmAnalyze?;
    constructor(llmAnalyze?: ((prompt: string) => Promise<Record<string, unknown>>) | undefined);
    /**
     * Analyze data and generate insights
     */
    analyze(input: InsightInput): Promise<Insight[]>;
    /**
     * Detect failure patterns
     */
    private detectFailurePatterns;
    /**
     * Detect success patterns
     */
    private detectSuccessPatterns;
    /**
     * Detect cost optimization opportunities
     */
    private detectCostOptimizations;
    /**
     * Detect performance bottlenecks
     */
    private detectPerformanceBottlenecks;
}
declare function createInsightsAnalyzer(llmAnalyze?: (prompt: string) => Promise<Record<string, unknown>>): InsightsAnalyzer;

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
interface FeedbackInput {
    conversationId: string;
    messageId: string;
    type: "thumbs_up" | "thumbs_down" | "edit" | "correction";
    userId: string;
    originalText?: string;
    correctedText?: string;
    metadata?: Record<string, unknown>;
}
interface OptimizationGoal {
    metric: "success_rate" | "cost" | "latency" | "satisfaction";
    target: number;
    weight: number;
}
interface OptimizationConfig {
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
        trafficSplit: number;
        minSampleSize: number;
        significanceLevel: number;
    };
}
interface OptimizationRun {
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
        improvement: number;
    }[];
    method: "prompt_optimization" | "model_tier_optimization" | "few_shot_learning";
    metadata?: Record<string, unknown>;
}
interface ABTest {
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
    confidence: number;
    startedAt: Date;
    completedAt?: Date;
}
declare class AgentOptimizer {
    private config;
    private llmOptimize?;
    constructor(config: OptimizationConfig, llmOptimize?: ((prompt: string) => Promise<string>) | undefined);
    /**
     * Run optimization based on feedback and metrics
     */
    optimize(params: {
        currentPrompt: string;
        currentModel: string;
        currentTemperature: number;
        feedbackData: FeedbackInput[];
        metricsData: Record<string, number>;
    }): Promise<OptimizationRun>;
    /**
     * Optimize using few-shot learning from corrections
     */
    private optimizeWithFewShot;
    /**
     * Optimize prompt using LLM
     */
    private optimizePrompt;
    /**
     * Optimize model tier to reduce cost
     */
    private optimizeModelTier;
    /**
     * Create A/B test
     */
    createABTest(params: {
        controlPrompt: string;
        variantPrompt: string;
        model: string;
        temperature: number;
    }): Promise<ABTest>;
    /**
     * Evaluate A/B test and determine winner
     */
    evaluateABTest(test: ABTest): ABTest;
}
declare function createOptimizer(config: OptimizationConfig, llmOptimize?: (prompt: string) => Promise<string>): AgentOptimizer;

/**
 * Meta-Agent - Self-Modification & Auto-Building
 *
 * Enables agents to:
 * - Modify themselves based on performance data
 * - Propose improvements to their own prompts/tools
 * - Build new agents from natural language descriptions
 */
interface ModificationProposal {
    id: string;
    agentId: string;
    workspaceId: string;
    type: "prompt_update" | "tool_addition" | "tool_removal" | "parameter_tuning";
    status: "pending" | "approved" | "rejected" | "applied";
    current: {
        systemPrompt?: string;
        model?: string;
        temperature?: number;
        tools?: string[];
    };
    proposed: {
        systemPrompt?: string;
        model?: string;
        temperature?: number;
        tools?: string[];
    };
    rationale: string;
    expectedImpact: {
        metric: string;
        currentValue: number;
        expectedValue: number;
        confidence: number;
    }[];
    evidence: {
        insights: string[];
        feedback: string[];
        metrics: Record<string, number>;
    };
    createdAt: Date;
    reviewedAt?: Date;
    reviewedBy?: string;
    appliedAt?: Date;
}
interface AgentBuildRequest {
    name: string;
    description: string;
    goals: string[];
    constraints?: {
        maxCost?: number;
        maxLatency?: number;
    };
    domain?: string;
    style?: string;
}
interface BuildAgentResult {
    systemPrompt: string;
    model: string;
    temperature: number;
    suggestedTools: string[];
    suggestedTriggers: string[];
    rationale: string;
}
declare class SelfModifier {
    private llmGenerate?;
    constructor(llmGenerate?: ((prompt: string) => Promise<string>) | undefined);
    /**
     * Analyze agent performance and propose modifications
     */
    proposeModifications(params: {
        agentId: string;
        workspaceId: string;
        currentConfig: {
            systemPrompt: string;
            model: string;
            temperature: number;
            tools: string[];
        };
        insights: Array<{
            id: string;
            type: string;
            severity: string;
            description: string;
            recommendations: string[];
        }>;
        feedback: Array<{
            id: string;
            type: string;
            correctedText?: string;
        }>;
        metrics: Record<string, number>;
    }): Promise<ModificationProposal[]>;
    /**
     * Propose prompt update based on insight
     */
    private proposePromptUpdate;
    /**
     * Propose model tier change
     */
    private proposeModelChange;
    /**
     * Propose tool addition
     */
    private proposeToolAddition;
    /**
     * Propose style update based on corrections
     */
    private proposeStyleUpdate;
    /**
     * Apply an approved modification
     */
    applyModification(proposalId: string, approved: boolean): Promise<void>;
}
declare class AgentBuilder {
    private llmGenerate?;
    constructor(llmGenerate?: ((prompt: string) => Promise<string>) | undefined);
    /**
     * Build an agent from natural language description
     */
    buildAgent(request: AgentBuildRequest): Promise<BuildAgentResult>;
}
declare function createSelfModifier(llmGenerate?: (prompt: string) => Promise<string>): SelfModifier;
declare function createAgentBuilder(llmGenerate?: (prompt: string) => Promise<string>): AgentBuilder;

export { type ABTest, type AgentBuildRequest, AgentBuilder, AgentEngine, AgentOptimizer, AgentTracer, type BuildAgentResult, ConversationEvaluator, type ConversationTurn, type CoreDependencies, type CreateTraceInput, type DataPoint, type EvaluationCriteria, type EvaluationResult, type FeedbackInput, type Insight, type InsightInput, InsightsAnalyzer, type ModificationProposal, type OptimizationConfig, type OptimizationGoal, type OptimizationRun, type Pattern, ScanEngine, ScanEngineConfig, SelfModifier, type TraceMetrics, type TraceStep, type TraceUpdateInput, createAgentBuilder, createAgentEngine, createEvaluator, createInsightsAnalyzer, createOptimizer, createScanEngine, createSelfModifier, createTracer, getDefaultAgentHooks, initElevayCore };
