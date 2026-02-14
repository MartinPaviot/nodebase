/**
 * Agent Tracer - Complete execution tracing
 * Inspired by LangSmith's tracing capabilities
 */
import type { LlmCallData, TraceStep, ExecutionResult } from '../agent-engine/types';
export interface TracerConfig {
    agentId: string;
    conversationId: string;
    userId: string;
    workspaceId: string;
    maxSteps?: number;
}
export declare class AgentTracer {
    private traceId;
    private steps;
    private config;
    constructor(config: TracerConfig);
    /**
     * Get the trace ID
     */
    getTraceId(): string;
    /**
     * Start a new trace
     */
    startTrace(): Promise<void>;
    /**
     * Record a step in the trace
     */
    recordStep(step: TraceStep): Promise<void>;
    /**
     * Record an LLM call (creates AiEvent)
     */
    recordLlmCall(call: LlmCallData): Promise<void>;
    /**
     * Record tool usage
     */
    recordToolCall(toolName: string, input: Record<string, any>, output: any, success: boolean, error?: string): Promise<void>;
    /**
     * Complete the trace successfully
     */
    completeTrace(result: ExecutionResult): Promise<void>;
    /**
     * Fail the trace with an error
     */
    failTrace(error: Error): Promise<void>;
    /**
     * Timeout the trace
     */
    timeoutTrace(): Promise<void>;
    /**
     * Cancel the trace
     */
    cancelTrace(): Promise<void>;
    /**
     * Record user feedback
     */
    recordFeedback(feedbackScore: number, feedbackComment?: string, userEdited?: boolean, editDiff?: string): Promise<void>;
    private getTierFromModel;
    private getToolCalls;
}
export declare class TraceQuery {
    /**
     * Get a trace by ID
     */
    static getTrace(traceId: string): Promise<{
        agent: {
            id: string;
            model: import("@prisma/client").$Enums.AgentModel;
            name: string;
        };
        conversation: {
            id: string;
            title: string;
        };
        aiEvents: {
            id: string;
            agentId: string | null;
            conversationId: string | null;
            userId: string;
            workspaceId: string | null;
            model: string;
            tier: string;
            tokensIn: number;
            tokensOut: number;
            cost: number;
            latencyMs: number;
            stepNumber: number;
            action: string;
            toolName: string | null;
            toolInput: import("@prisma/client/runtime/library").JsonValue | null;
            toolOutput: import("@prisma/client/runtime/library").JsonValue | null;
            stepsUsed: number;
            evalResult: string;
            timestamp: Date;
            traceId: string | null;
        }[];
    } & {
        id: string;
        agentId: string;
        conversationId: string;
        userId: string;
        workspaceId: string;
        latencyMs: number | null;
        startedAt: Date;
        completedAt: Date | null;
        status: import("@prisma/client").$Enums.TraceStatus;
        steps: import("@prisma/client/runtime/library").JsonValue;
        totalSteps: number;
        maxSteps: number;
        totalTokensIn: number;
        totalTokensOut: number;
        totalCost: number;
        toolCalls: import("@prisma/client/runtime/library").JsonValue;
        toolSuccesses: number;
        toolFailures: number;
        l1Passed: boolean | null;
        l1Failures: import("@prisma/client/runtime/library").JsonValue | null;
        l2Score: number | null;
        l2Breakdown: import("@prisma/client/runtime/library").JsonValue | null;
        l3Triggered: boolean;
        l3Blocked: boolean | null;
        feedbackScore: number | null;
        feedbackComment: string | null;
        userEdited: boolean;
        editDiff: string | null;
    }>;
    /**
     * Get traces for an agent
     */
    static getAgentTraces(agentId: string, limit?: number): Promise<({
        conversation: {
            id: string;
            title: string;
        };
    } & {
        id: string;
        agentId: string;
        conversationId: string;
        userId: string;
        workspaceId: string;
        latencyMs: number | null;
        startedAt: Date;
        completedAt: Date | null;
        status: import("@prisma/client").$Enums.TraceStatus;
        steps: import("@prisma/client/runtime/library").JsonValue;
        totalSteps: number;
        maxSteps: number;
        totalTokensIn: number;
        totalTokensOut: number;
        totalCost: number;
        toolCalls: import("@prisma/client/runtime/library").JsonValue;
        toolSuccesses: number;
        toolFailures: number;
        l1Passed: boolean | null;
        l1Failures: import("@prisma/client/runtime/library").JsonValue | null;
        l2Score: number | null;
        l2Breakdown: import("@prisma/client/runtime/library").JsonValue | null;
        l3Triggered: boolean;
        l3Blocked: boolean | null;
        feedbackScore: number | null;
        feedbackComment: string | null;
        userEdited: boolean;
        editDiff: string | null;
    })[]>;
    /**
     * Get traces for a conversation
     */
    static getConversationTraces(conversationId: string): Promise<({
        aiEvents: {
            id: string;
            agentId: string | null;
            conversationId: string | null;
            userId: string;
            workspaceId: string | null;
            model: string;
            tier: string;
            tokensIn: number;
            tokensOut: number;
            cost: number;
            latencyMs: number;
            stepNumber: number;
            action: string;
            toolName: string | null;
            toolInput: import("@prisma/client/runtime/library").JsonValue | null;
            toolOutput: import("@prisma/client/runtime/library").JsonValue | null;
            stepsUsed: number;
            evalResult: string;
            timestamp: Date;
            traceId: string | null;
        }[];
    } & {
        id: string;
        agentId: string;
        conversationId: string;
        userId: string;
        workspaceId: string;
        latencyMs: number | null;
        startedAt: Date;
        completedAt: Date | null;
        status: import("@prisma/client").$Enums.TraceStatus;
        steps: import("@prisma/client/runtime/library").JsonValue;
        totalSteps: number;
        maxSteps: number;
        totalTokensIn: number;
        totalTokensOut: number;
        totalCost: number;
        toolCalls: import("@prisma/client/runtime/library").JsonValue;
        toolSuccesses: number;
        toolFailures: number;
        l1Passed: boolean | null;
        l1Failures: import("@prisma/client/runtime/library").JsonValue | null;
        l2Score: number | null;
        l2Breakdown: import("@prisma/client/runtime/library").JsonValue | null;
        l3Triggered: boolean;
        l3Blocked: boolean | null;
        feedbackScore: number | null;
        feedbackComment: string | null;
        userEdited: boolean;
        editDiff: string | null;
    })[]>;
    /**
     * Get metrics for an agent
     */
    static getAgentMetrics(agentId: string, days?: number): Promise<{
        total: number;
        completed: number;
        failed: number;
        successRate: number;
        avgCost: number;
        avgLatency: number;
        avgSteps: number;
        avgFeedback: number;
    }>;
}
//# sourceMappingURL=tracer.d.ts.map