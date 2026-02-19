/**
 * Agent Tracer - Complete execution tracing
 * Inspired by LangSmith's tracing capabilities
 */

import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import type { LlmCallData, TraceStep, ExecutionResult } from '../agent-engine/types';

const prisma = new PrismaClient();

export interface TracerConfig {
  agentId: string;
  conversationId: string;
  userId: string;
  workspaceId: string;
  maxSteps?: number;
}

export class AgentTracer {
  private traceId: string;
  private steps: TraceStep[] = [];
  private config: TracerConfig;

  constructor(config: TracerConfig) {
    this.traceId = nanoid();
    this.config = config;
  }

  /**
   * Get the trace ID
   */
  public getTraceId(): string {
    return this.traceId;
  }

  /**
   * Start a new trace
   */
  async startTrace(): Promise<void> {
    try {
      await prisma.agentTrace.create({
        data: {
          id: this.traceId,
          agentId: this.config.agentId,
          conversationId: this.config.conversationId,
          userId: this.config.userId,
          workspaceId: this.config.workspaceId,
          status: 'RUNNING',
          steps: [],
          maxSteps: this.config.maxSteps || 5,
        },
      });

      console.log(`[AgentTracer] Started trace ${this.traceId} for agent ${this.config.agentId}`);
    } catch (error) {
      console.error('[AgentTracer] Failed to start trace:', error);
      throw error;
    }
  }

  /**
   * Record a step in the trace
   */
  async recordStep(step: TraceStep): Promise<void> {
    this.steps.push(step);

    try {
      await prisma.agentTrace.update({
        where: { id: this.traceId },
        data: {
          steps: this.steps,
          totalSteps: this.steps.length,
        },
      });
    } catch (error) {
      console.error('[AgentTracer] Failed to record step:', error);
      // Don't throw - continue execution even if tracing fails
    }
  }

  /**
   * Record an LLM call (creates AiEvent)
   */
  async recordLlmCall(call: LlmCallData): Promise<void> {
    try {
      await prisma.aiEvent.create({
        data: {
          traceId: this.traceId,
          agentId: call.agentId,
          userId: call.userId,
          workspaceId: call.workspaceId,
          model: call.model,
          tier: this.getTierFromModel(call.model),
          tokensIn: call.tokensIn,
          tokensOut: call.tokensOut,
          cost: call.cost,
          latencyMs: call.latencyMs,
          stepNumber: call.stepNumber,
          action: call.action,
          toolName: call.toolName,
          toolInput: call.toolInput,
          toolOutput: call.toolOutput,
        },
      });

      // Update trace totals
      await prisma.agentTrace.update({
        where: { id: this.traceId },
        data: {
          totalTokensIn: { increment: call.tokensIn },
          totalTokensOut: { increment: call.tokensOut },
          totalCost: { increment: call.cost },
        },
      });
    } catch (error) {
      console.error('[AgentTracer] Failed to record LLM call:', error);
      // Don't throw - continue execution
    }
  }

  /**
   * Record tool usage
   */
  async recordToolCall(
    toolName: string,
    input: Record<string, any>,
    output: any,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      const toolCalls = await this.getToolCalls();
      toolCalls.push({
        toolName,
        input,
        output,
        success,
        error,
        timestamp: new Date().toISOString(),
      });

      await prisma.agentTrace.update({
        where: { id: this.traceId },
        data: {
          toolCalls,
          toolSuccesses: { increment: success ? 1 : 0 },
          toolFailures: { increment: success ? 0 : 1 },
        },
      });
    } catch (error) {
      console.error('[AgentTracer] Failed to record tool call:', error);
    }
  }

  /**
   * Complete the trace successfully
   */
  async completeTrace(result: ExecutionResult): Promise<void> {
    try {
      await prisma.agentTrace.update({
        where: { id: this.traceId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          latencyMs: result.latencyMs,
          l1Passed: result.evalResult?.l1Passed,
          l1Failures: result.evalResult?.l1Failures,
          l2Score: result.evalResult?.l2Score,
          l2Breakdown: result.evalResult?.l2Breakdown,
          l3Triggered: result.evalResult?.l3Triggered ?? false,
          l3Blocked: result.evalResult?.l3Blocked,
        },
      });

      console.log(`[AgentTracer] Completed trace ${this.traceId} in ${result.latencyMs}ms`);
    } catch (error) {
      console.error('[AgentTracer] Failed to complete trace:', error);
    }
  }

  /**
   * Fail the trace with an error
   */
  async failTrace(error: Error): Promise<void> {
    try {
      await prisma.agentTrace.update({
        where: { id: this.traceId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      });

      console.error(`[AgentTracer] Failed trace ${this.traceId}:`, error.message);
    } catch (updateError) {
      console.error('[AgentTracer] Failed to update trace status:', updateError);
    }
  }

  /**
   * Timeout the trace
   */
  async timeoutTrace(): Promise<void> {
    try {
      await prisma.agentTrace.update({
        where: { id: this.traceId },
        data: {
          status: 'TIMEOUT',
          completedAt: new Date(),
        },
      });

      console.warn(`[AgentTracer] Trace ${this.traceId} timed out`);
    } catch (error) {
      console.error('[AgentTracer] Failed to timeout trace:', error);
    }
  }

  /**
   * Cancel the trace
   */
  async cancelTrace(): Promise<void> {
    try {
      await prisma.agentTrace.update({
        where: { id: this.traceId },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
        },
      });

      console.log(`[AgentTracer] Cancelled trace ${this.traceId}`);
    } catch (error) {
      console.error('[AgentTracer] Failed to cancel trace:', error);
    }
  }

  /**
   * Record user feedback
   */
  async recordFeedback(
    feedbackScore: number,
    feedbackComment?: string,
    userEdited: boolean = false,
    editDiff?: string
  ): Promise<void> {
    try {
      await prisma.agentTrace.update({
        where: { id: this.traceId },
        data: {
          feedbackScore,
          feedbackComment,
          userEdited,
          editDiff,
        },
      });

      console.log(`[AgentTracer] Recorded feedback for trace ${this.traceId}: ${feedbackScore}/5`);
    } catch (error) {
      console.error('[AgentTracer] Failed to record feedback:', error);
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getTierFromModel(model: string): string {
    if (model.includes('haiku')) return 'haiku';
    if (model.includes('opus')) return 'opus';
    return 'sonnet';
  }

  private async getToolCalls(): Promise<any[]> {
    try {
      const trace = await prisma.agentTrace.findUnique({
        where: { id: this.traceId },
        select: { toolCalls: true },
      });
      return (trace?.toolCalls as any[]) || [];
    } catch (error) {
      return [];
    }
  }
}

// ============================================================================
// Static Methods for Querying Traces
// ============================================================================

export class TraceQuery {
  /**
   * Get a trace by ID
   */
  static async getTrace(traceId: string) {
    return await prisma.agentTrace.findUnique({
      where: { id: traceId },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            model: true,
          },
        },
        conversation: {
          select: {
            id: true,
            title: true,
          },
        },
        aiEvents: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });
  }

  /**
   * Get traces for an agent
   */
  static async getAgentTraces(agentId: string, limit: number = 50) {
    return await prisma.agentTrace.findMany({
      where: { agentId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        conversation: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }

  /**
   * Get traces for a conversation
   */
  static async getConversationTraces(conversationId: string) {
    return await prisma.agentTrace.findMany({
      where: { conversationId },
      orderBy: { startedAt: 'asc' },
      include: {
        aiEvents: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });
  }

  /**
   * Get metrics for an agent
   */
  static async getAgentMetrics(agentId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const traces = await prisma.agentTrace.findMany({
      where: {
        agentId,
        startedAt: { gte: since },
      },
      select: {
        status: true,
        totalCost: true,
        latencyMs: true,
        totalSteps: true,
        toolSuccesses: true,
        toolFailures: true,
        feedbackScore: true,
      },
    });

    // Calculate metrics
    const total = traces.length;
    const completed = traces.filter(t => t.status === 'COMPLETED').length;
    const failed = traces.filter(t => t.status === 'FAILED').length;
    const avgCost = traces.reduce((sum, t) => sum + t.totalCost, 0) / total;
    const avgLatency = traces.reduce((sum, t) => sum + (t.latencyMs || 0), 0) / total;
    const avgSteps = traces.reduce((sum, t) => sum + t.totalSteps, 0) / total;

    const withFeedback = traces.filter(t => t.feedbackScore !== null);
    const avgFeedback = withFeedback.length > 0
      ? withFeedback.reduce((sum, t) => sum + (t.feedbackScore || 0), 0) / withFeedback.length
      : null;

    return {
      total,
      completed,
      failed,
      successRate: total > 0 ? completed / total : 0,
      avgCost,
      avgLatency,
      avgSteps,
      avgFeedback,
    };
  }
}
