/**
 * AgentTraceResource - Resource Pattern for AgentTrace model
 *
 * Benefits:
 * - Automatic permission checks (user owns the agent)
 * - Read-only access to traces (traces are immutable after creation)
 * - Type-safe operations
 *
 * Usage:
 * ```typescript
 * const trace = await AgentTraceResource.findById(id, auth);
 * if (!trace) throw new NotFoundError("AgentTrace", id);
 *
 * const metrics = trace.getMetrics();
 * const steps = trace.getSteps();
 * ```
 */

import prisma from "../db";
import { Authenticator } from "./authenticator";
import { NotFoundError } from "../errors";
import type { AgentTrace, TraceStatus } from "@prisma/client";

export interface TraceMetrics {
  totalSteps: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
  latencyMs: number | null;
  l2Score: number | null;
  l3Triggered: boolean;
  l3Blocked: boolean | null;
}

export interface TraceStep {
  id: string;
  type: string;
  timestamp: string;
  input?: unknown;
  output?: unknown;
  durationMs?: number;
}

export interface ToolCall {
  id: string;
  toolName: string;
  input: unknown;
  output: unknown;
  success: boolean;
  durationMs: number;
}

export class AgentTraceResource {
  private constructor(
    private trace: AgentTrace,
    private auth: Authenticator
  ) {}

  // ============================================
  // STATIC FACTORY METHODS
  // ============================================

  /**
   * Find trace by ID with permission check
   */
  static async findById(
    id: string,
    auth: Authenticator
  ): Promise<AgentTraceResource | null> {
    const trace = await prisma.agentTrace.findUnique({
      where: { id },
      include: {
        agent: {
          select: { userId: true, workspaceId: true },
        },
        conversation: {
          select: { id: true },
        },
      },
    });

    if (!trace) {
      return null;
    }

    // Check permission - user must own the agent
    auth.assertCanAccess(
      "AgentTrace",
      trace.agent.userId,
      trace.agent.workspaceId || undefined
    );

    return new AgentTraceResource(trace, auth);
  }

  /**
   * Find all traces for a specific agent
   */
  static async findByAgent(
    agentId: string,
    auth: Authenticator,
    options?: {
      status?: TraceStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<AgentTraceResource[]> {
    // Verify agent ownership
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { userId: true, workspaceId: true },
    });

    if (!agent) {
      throw new NotFoundError("Agent", agentId);
    }

    auth.assertCanAccess("Agent", agent.userId, agent.workspaceId || undefined);

    const traces = await prisma.agentTrace.findMany({
      where: {
        agentId,
        ...(options?.status ? { status: options.status } : {}),
      },
      orderBy: { startedAt: "desc" },
      take: options?.limit,
      skip: options?.offset,
      include: {
        agent: {
          select: { userId: true, workspaceId: true },
        },
        conversation: {
          select: { id: true },
        },
      },
    });

    return traces.map((trace) => new AgentTraceResource(trace, auth));
  }

  /**
   * Find all traces for a specific conversation
   */
  static async findByConversation(
    conversationId: string,
    auth: Authenticator
  ): Promise<AgentTraceResource[]> {
    const traces = await prisma.agentTrace.findMany({
      where: { conversationId },
      orderBy: { startedAt: "desc" },
      include: {
        agent: {
          select: { userId: true, workspaceId: true },
        },
        conversation: {
          select: { id: true },
        },
      },
    });

    if (traces.length === 0) {
      return [];
    }

    // Check permission on first trace (all belong to same agent)
    auth.assertCanAccess(
      "AgentTrace",
      traces[0].agent.userId,
      traces[0].agent.workspaceId || undefined
    );

    return traces.map((trace) => new AgentTraceResource(trace, auth));
  }

  // ============================================
  // GETTERS (Read-only access)
  // ============================================

  get id(): string {
    return this.trace.id;
  }

  get conversationId(): string {
    return this.trace.conversationId;
  }

  get agentId(): string {
    return this.trace.agentId;
  }

  get status(): TraceStatus {
    return this.trace.status;
  }

  get startedAt(): Date {
    return this.trace.startedAt;
  }

  get completedAt(): Date | null {
    return this.trace.completedAt;
  }

  get totalSteps(): number {
    return this.trace.totalSteps;
  }

  get totalTokensIn(): number {
    return this.trace.totalTokensIn;
  }

  get totalTokensOut(): number {
    return this.trace.totalTokensOut;
  }

  get totalCost(): number {
    return this.trace.totalCost;
  }

  get latencyMs(): number | null {
    return this.trace.latencyMs;
  }

  get l1Passed(): boolean | null {
    return this.trace.l1Passed;
  }

  get l2Score(): number | null {
    return this.trace.l2Score;
  }

  get l3Triggered(): boolean {
    return this.trace.l3Triggered;
  }

  get l3Blocked(): boolean | null {
    return this.trace.l3Blocked;
  }

  /**
   * Get metrics summary
   */
  getMetrics(): TraceMetrics {
    return {
      totalSteps: this.trace.totalSteps,
      totalTokensIn: this.trace.totalTokensIn,
      totalTokensOut: this.trace.totalTokensOut,
      totalCost: this.trace.totalCost,
      latencyMs: this.trace.latencyMs,
      l2Score: this.trace.l2Score,
      l3Triggered: this.trace.l3Triggered,
      l3Blocked: this.trace.l3Blocked,
    };
  }

  /**
   * Get parsed steps from JSON field
   */
  getSteps(): TraceStep[] {
    if (!this.trace.steps) {
      return [];
    }

    return this.trace.steps as unknown as TraceStep[];
  }

  /**
   * Get parsed tool calls from JSON field
   */
  getToolCalls(): ToolCall[] {
    if (!this.trace.toolCalls) {
      return [];
    }

    return this.trace.toolCalls as unknown as ToolCall[];
  }

  /**
   * Check if trace is completed
   */
  isCompleted(): boolean {
    return this.status === "COMPLETED";
  }

  /**
   * Check if trace failed
   */
  isFailed(): boolean {
    return this.status === "FAILED";
  }

  /**
   * Check if trace is still running
   */
  isRunning(): boolean {
    return this.status === "RUNNING";
  }

  /**
   * Get duration in milliseconds
   */
  getDuration(): number | null {
    if (!this.trace.completedAt) {
      return null;
    }

    return this.trace.completedAt.getTime() - this.trace.startedAt.getTime();
  }

  /**
   * Get safe representation for frontend
   */
  toJSON(): AgentTrace {
    return this.trace;
  }

  /**
   * Get detailed trace with parsed steps and toolCalls
   */
  toDetailedJSON(): AgentTrace & {
    steps: TraceStep[];
    toolCalls: ToolCall[];
    metrics: TraceMetrics;
  } {
    return {
      ...this.trace,
      steps: this.getSteps(),
      toolCalls: this.getToolCalls(),
      metrics: this.getMetrics(),
    } as AgentTrace & { steps: TraceStep[]; toolCalls: ToolCall[]; metrics: TraceMetrics };
  }
}
