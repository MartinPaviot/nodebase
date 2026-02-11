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
    static getTrace(traceId: string): Promise<any>;
    /**
     * Get traces for an agent
     */
    static getAgentTraces(agentId: string, limit?: number): Promise<any>;
    /**
     * Get traces for a conversation
     */
    static getConversationTraces(conversationId: string): Promise<any>;
    /**
     * Get metrics for an agent
     */
    static getAgentMetrics(agentId: string, days?: number): Promise<{
        total: any;
        completed: any;
        failed: any;
        successRate: number;
        avgCost: number;
        avgLatency: number;
        avgSteps: number;
        avgFeedback: number;
    }>;
}
//# sourceMappingURL=tracer.d.ts.map