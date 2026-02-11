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

import { nanoid } from "nanoid";

// ============================================
// Types
// ============================================

export interface TraceStep {
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

export interface TraceMetrics {
  totalDurationMs: number;
  llmCalls: number;
  toolCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
  stepsCount: number;
}

export interface CreateTraceInput {
  agentId: string;
  conversationId?: string;
  userId: string;
  workspaceId: string;
  triggeredBy: string;
  userMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface TraceUpdateInput {
  status?: "running" | "completed" | "failed" | "cancelled" | "blocked" | "pending_review";
  output?: Record<string, unknown> | string;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  metrics?: Partial<TraceMetrics>;
}

// ============================================
// Tracer Class
// ============================================

export class AgentTracer {
  private traceId: string;
  private steps: TraceStep[] = [];
  private startTime: number;
  private metrics: TraceMetrics = {
    totalDurationMs: 0,
    llmCalls: 0,
    toolCalls: 0,
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalCost: 0,
    stepsCount: 0,
  };

  constructor(
    private input: CreateTraceInput,
    private onSave?: (trace: any) => Promise<void>
  ) {
    this.traceId = `trace_${nanoid(12)}`;
    this.startTime = Date.now();
  }

  /**
   * Get the trace ID
   */
  getTraceId(): string {
    return this.traceId;
  }

  /**
   * Log a step in the trace
   */
  logStep(step: Omit<TraceStep, "id" | "timestamp">): string {
    const stepId = `step_${nanoid(10)}`;
    const fullStep: TraceStep = {
      ...step,
      id: stepId,
      timestamp: new Date(),
    };

    this.steps.push(fullStep);
    this.metrics.stepsCount++;

    // Update metrics based on step type
    if (step.type === "llm_call") {
      this.metrics.llmCalls++;
      if (step.metadata?.tokensIn) {
        this.metrics.totalTokensIn += step.metadata.tokensIn as number;
      }
      if (step.metadata?.tokensOut) {
        this.metrics.totalTokensOut += step.metadata.tokensOut as number;
      }
      if (step.metadata?.cost) {
        this.metrics.totalCost += step.metadata.cost as number;
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
  logLLMCall(params: {
    model: string;
    input: string | Record<string, unknown>;
    output: string | Record<string, unknown>;
    tokensIn: number;
    tokensOut: number;
    cost: number;
    durationMs: number;
  }): string {
    return this.logStep({
      type: "llm_call",
      input: typeof params.input === "string" ? { prompt: params.input } : params.input,
      output: typeof params.output === "string" ? { response: params.output } : params.output,
      durationMs: params.durationMs,
      metadata: {
        model: params.model,
        tokensIn: params.tokensIn,
        tokensOut: params.tokensOut,
        cost: params.cost,
      },
    });
  }

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
  }): string {
    return this.logStep({
      type: "tool_call",
      input: params.input,
      output: params.output,
      durationMs: params.durationMs,
      error: params.error
        ? { message: params.error }
        : undefined,
      metadata: {
        toolName: params.toolName,
        success: params.success,
      },
    });
  }

  /**
   * Log an agent decision
   */
  logDecision(params: {
    reasoning: string;
    decision: string;
    metadata?: Record<string, unknown>;
  }): string {
    return this.logStep({
      type: "decision",
      input: { reasoning: params.reasoning },
      output: { decision: params.decision },
      metadata: params.metadata,
    });
  }

  /**
   * Log an error
   */
  logError(error: Error | string): string {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    return this.logStep({
      type: "error",
      error: {
        message: errorMessage,
        stack: errorStack,
      },
    });
  }

  /**
   * Get current metrics
   */
  getMetrics(): TraceMetrics {
    return {
      ...this.metrics,
      totalDurationMs: Date.now() - this.startTime,
    };
  }

  /**
   * Get all steps
   */
  getSteps(): TraceStep[] {
    return [...this.steps];
  }

  /**
   * Complete the trace and save
   */
  async complete(params?: {
    output?: Record<string, unknown> | string;
    status?: "completed" | "failed" | "cancelled" | "blocked" | "pending_review";
  }): Promise<void> {
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
      completedAt: new Date(),
      durationMs: finalMetrics.totalDurationMs,
    };

    if (this.onSave) {
      await this.onSave(trace);
    }
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Create a new tracer for an agent execution
 */
export function createTracer(
  input: CreateTraceInput,
  onSave?: (trace: any) => Promise<void>
): AgentTracer {
  return new AgentTracer(input, onSave);
}

// Types are already exported with their definitions above
