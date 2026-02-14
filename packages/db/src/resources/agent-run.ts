/**
 * AgentRun Resource
 *
 * Provides permission-checked access to agent execution records.
 */

import { PermissionError, type LLMUsage } from "@nodebase/types";
import { prisma } from "../client";
import type { Prisma } from "@prisma/client";
import {
  BaseResource,
  type ResourceAuth,
  type QueryOptions,
  buildQueryOptions,
  workspaceScope,
} from "./base";

interface AgentRunData {
  id: string;
  agentId: string;
  userId: string;
  workspaceId: string;
  triggeredAt: Date;
  triggeredBy: string;
  dataSources: Record<string, unknown>[];
  outputType: string | null;
  outputContent: string | null;
  llmModel: string;
  llmTokensUsed: number;
  llmCost: number;
  l1Assertions: Record<string, unknown>[];
  l1Passed: boolean;
  l2Score: number;
  l2Breakdown: Record<string, unknown>;
  l3Triggered: boolean;
  l3Blocked: boolean | null;
  l3Reason: string | null;
  userAction: string | null;
  draftDiff: string | null;
  finalAction: string | null;
  finalAt: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AgentRunResource extends BaseResource<AgentRunData> {
  // ============================================
  // Static Factory Methods
  // ============================================

  /**
   * Find a run by ID with permission check.
   */
  static async findById(
    id: string,
    auth: ResourceAuth
  ): Promise<AgentRunResource | null> {
    const run = await prisma.agentRun.findUnique({
      where: { id },
    });

    if (!run) return null;

    if (run.workspaceId !== auth.workspaceId) {
      throw new PermissionError(auth.userId, "AgentRun", "read");
    }

    return new AgentRunResource(run as AgentRunData, auth);
  }

  /**
   * Find all runs for an agent.
   */
  static async findByAgent(
    auth: ResourceAuth,
    agentId: string,
    options?: QueryOptions
  ): Promise<AgentRunResource[]> {
    const runs = await prisma.agentRun.findMany({
      where: {
        ...workspaceScope(auth),
        agentId,
      },
      ...buildQueryOptions(options),
    });

    return runs.map((run: any) => new AgentRunResource(run as AgentRunData, auth));
  }

  /**
   * Find runs pending review.
   */
  static async findPendingReview(
    auth: ResourceAuth,
    options?: QueryOptions
  ): Promise<AgentRunResource[]> {
    const runs = await prisma.agentRun.findMany({
      where: {
        ...workspaceScope(auth),
        status: "pending_review",
      },
      orderBy: { triggeredAt: "desc" },
      ...buildQueryOptions(options),
    });

    return runs.map((run: any) => new AgentRunResource(run as AgentRunData, auth));
  }

  /**
   * Create a new agent run.
   */
  static async create(
    auth: ResourceAuth,
    data: {
      agentId: string;
      triggeredBy: string;
      dataSources?: Record<string, unknown>[];
      llmModel: string;
    }
  ): Promise<AgentRunResource> {
    const run = await prisma.agentRun.create({
      data: {
        agentId: data.agentId,
        userId: auth.userId,
        workspaceId: auth.workspaceId,
        triggeredBy: data.triggeredBy,
        dataSources: (data.dataSources ?? []) as unknown as Prisma.InputJsonValue,
        llmModel: data.llmModel,
        llmTokensUsed: 0,
        llmCost: 0,
        l1Assertions: [] as unknown as Prisma.InputJsonValue,
        l1Passed: false,
        l2Score: 0,
        l2Breakdown: {},
        l3Triggered: false,
        status: "running",
      },
    });

    return new AgentRunResource(run as AgentRunData, auth);
  }

  // ============================================
  // Instance Methods
  // ============================================

  /**
   * Update run with output.
   */
  async setOutput(data: {
    outputType: string;
    outputContent: string;
    llmTokensUsed: number;
    llmCost: number;
  }): Promise<AgentRunResource> {
    this.assertWrite();

    const updated = await prisma.agentRun.update({
      where: { id: this.id },
      data,
    });

    this._data = updated as AgentRunData;
    return this;
  }

  /**
   * Update run with eval results.
   */
  async setEvalResult(eval_: {
    l1Assertions: Record<string, unknown>[];
    l1Passed: boolean;
    l2Score: number;
    l2Breakdown: Record<string, unknown>;
    l3Triggered: boolean;
    l3Blocked?: boolean;
    l3Reason?: string;
    status: "pending_review" | "completed" | "blocked";
  }): Promise<AgentRunResource> {
    this.assertWrite();

    const updated = await prisma.agentRun.update({
      where: { id: this.id },
      data: {
        l1Assertions: eval_.l1Assertions as unknown as Prisma.InputJsonValue,
        l1Passed: eval_.l1Passed,
        l2Score: eval_.l2Score,
        l2Breakdown: eval_.l2Breakdown as Prisma.InputJsonValue,
        l3Triggered: eval_.l3Triggered,
        l3Blocked: eval_.l3Blocked,
        l3Reason: eval_.l3Reason,
        status: eval_.status,
      },
    });

    this._data = updated as AgentRunData;
    return this;
  }

  /**
   * Record user action on the run.
   */
  async setUserAction(data: {
    userAction: "approved" | "edited" | "rejected";
    draftDiff?: string;
    finalAction?: string;
  }): Promise<AgentRunResource> {
    this.assertWrite();

    const updated = await prisma.agentRun.update({
      where: { id: this.id },
      data: {
        ...data,
        finalAt: new Date(),
        status: "completed",
      },
    });

    this._data = updated as AgentRunData;
    return this;
  }

  /**
   * Mark as failed.
   */
  async setFailed(reason: string): Promise<AgentRunResource> {
    this.assertWrite();

    const updated = await prisma.agentRun.update({
      where: { id: this.id },
      data: {
        status: "failed",
        l3Reason: reason,
      },
    });

    this._data = updated as AgentRunData;
    return this;
  }

  // ============================================
  // Getters
  // ============================================

  get agentId(): string {
    return this._data.agentId;
  }

  get triggeredAt(): Date {
    return this._data.triggeredAt;
  }

  get triggeredBy(): string {
    return this._data.triggeredBy;
  }

  get status(): string {
    return this._data.status;
  }

  get outputType(): string | null {
    return this._data.outputType;
  }

  get outputContent(): string | null {
    return this._data.outputContent;
  }

  get llmUsage(): LLMUsage {
    return {
      model: this._data.llmModel,
      tier: this.getLLMTier(),
      tokensIn: 0, // Not tracked separately
      tokensOut: this._data.llmTokensUsed,
      cost: this._data.llmCost,
      latencyMs: 0, // Not tracked
    };
  }

  get evalSummary() {
    return {
      l1Passed: this._data.l1Passed,
      l2Score: this._data.l2Score,
      l3Triggered: this._data.l3Triggered,
      l3Blocked: this._data.l3Blocked,
    };
  }

  get userAction(): string | null {
    return this._data.userAction;
  }

  get workspaceId(): string {
    return this._data.workspaceId;
  }

  private getLLMTier(): "haiku" | "sonnet" | "opus" {
    if (this._data.llmModel.includes("haiku")) return "haiku";
    if (this._data.llmModel.includes("opus")) return "opus";
    return "sonnet";
  }

  // ============================================
  // Serialization
  // ============================================

  toJSON(): Record<string, unknown> {
    this.assertRead();

    return {
      id: this.id,
      agentId: this.agentId,
      userId: this._data.userId,
      workspaceId: this.workspaceId,
      triggeredAt: this.triggeredAt.toISOString(),
      triggeredBy: this.triggeredBy,
      status: this.status,
      outputType: this.outputType,
      outputContent: this.outputContent,
      llmUsage: this.llmUsage,
      evalSummary: this.evalSummary,
      userAction: this.userAction,
      finalAt: this._data.finalAt?.toISOString() ?? null,
      createdAt: this._data.createdAt.toISOString(),
    };
  }
}
