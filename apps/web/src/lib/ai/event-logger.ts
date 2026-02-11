/**
 * AI Event Logger
 *
 * Benefits:
 * - Per-call observability (tokens, cost, latency)
 * - Cost tracking per agent/user/workspace
 * - Performance monitoring
 * - Debugging aid (see exact LLM calls)
 *
 * Usage:
 * ```typescript
 * const logger = new AIEventLogger();
 *
 * await logger.log({
 *   agentId: "agent_123",
 *   userId: "user_456",
 *   model: "claude-3-5-sonnet-20241022",
 *   tokensIn: 1000,
 *   tokensOut: 500,
 *   cost: 0.0225,
 *   latency: 2500,
 * });
 *
 * // Query events
 * const events = await logger.getAgentEvents("agent_123", { limit: 10 });
 * const cost = await logger.getAgentCost("agent_123", { last30Days: true });
 * ```
 */

import prisma from "../db";
import type { AIEvent } from "./claude-client";
import { nanoid } from "nanoid";

// ============================================
// TYPES
// ============================================

export interface AIEventRecord {
  id: string;
  agentId?: string | null;
  conversationId?: string | null;
  userId: string;
  workspaceId?: string | null;
  model: string;
  tier: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  latencyMs: number; // Changed from latency to match Prisma schema
  stepNumber: number;
  action: string;
  toolName?: string | null;
  timestamp: Date; // Changed from timestamp to match Prisma schema
}

export interface CostSummary {
  totalCost: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCalls: number;
  averageLatencyMs: number;
  costByTier: Record<string, number>;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  action?: string;
  tier?: string;
}

// ============================================
// AI EVENT LOGGER
// ============================================

export class AIEventLogger {
  /**
   * Log single AI event
   */
  async log(event: AIEvent & { workspaceId?: string }): Promise<void> {
    try {
      await prisma.aiEvent.create({
        data: {
          id: nanoid(),
          agentId: event.agentId || null,
          conversationId: event.conversationId || null,
          userId: event.userId,
          workspaceId: event.workspaceId || null,
          model: event.model,
          tier: event.tier,
          tokensIn: event.tokensIn,
          tokensOut: event.tokensOut,
          cost: event.cost,
          latencyMs: event.latency,
          stepNumber: event.stepNumber,
          action: event.action,
          toolName: event.toolName || null,
          timestamp: event.timestamp,
        },
      });
    } catch (error) {
      // Log to console but don't throw - logging should not break execution
      console.error("[AIEventLogger] Failed to log event:", error);
    }
  }

  /**
   * Log multiple events in batch
   */
  async logBatch(events: (AIEvent & { workspaceId?: string })[]): Promise<void> {
    try {
      await prisma.aiEvent.createMany({
        data: events.map((event) => ({
          id: nanoid(),
          agentId: event.agentId || null,
          conversationId: event.conversationId || null,
          userId: event.userId,
          workspaceId: event.workspaceId || null,
          model: event.model,
          tier: event.tier,
          tokensIn: event.tokensIn,
          tokensOut: event.tokensOut,
          cost: event.cost,
          latencyMs: event.latency,
          stepNumber: event.stepNumber,
          action: event.action,
          toolName: event.toolName || null,
          timestamp: event.timestamp,
        })),
        skipDuplicates: true,
      });
    } catch (error) {
      console.error("[AIEventLogger] Failed to log batch events:", error);
    }
  }

  // ============================================
  // QUERY METHODS
  // ============================================

  /**
   * Get events for specific agent
   */
  async getAgentEvents(
    agentId: string,
    options: QueryOptions = {}
  ): Promise<AIEventRecord[]> {
    const { limit = 100, offset = 0, startDate, endDate, action, tier } = options;

    const events = await prisma.aiEvent.findMany({
      where: {
        agentId,
        ...(startDate && { timestamp: { gte: startDate } }),
        ...(endDate && { timestamp: { lte: endDate } }),
        ...(action && { action }),
        ...(tier && { tier }),
      },
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    });

    return events;
  }

  /**
   * Get events for specific conversation
   */
  async getConversationEvents(
    conversationId: string,
    options: QueryOptions = {}
  ): Promise<AIEventRecord[]> {
    const { limit = 100, offset = 0 } = options;

    const events = await prisma.aiEvent.findMany({
      where: { conversationId },
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    });

    return events;
  }

  /**
   * Get events for specific user
   */
  async getUserEvents(
    userId: string,
    options: QueryOptions = {}
  ): Promise<AIEventRecord[]> {
    const { limit = 100, offset = 0, startDate, endDate } = options;

    const events = await prisma.aiEvent.findMany({
      where: {
        userId,
        ...(startDate && { timestamp: { gte: startDate } }),
        ...(endDate && { timestamp: { lte: endDate } }),
      },
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    });

    return events;
  }

  // ============================================
  // AGGREGATION METHODS
  // ============================================

  /**
   * Get cost summary for agent
   */
  async getAgentCost(
    agentId: string,
    options: { startDate?: Date; endDate?: Date } = {}
  ): Promise<CostSummary> {
    const { startDate, endDate } = options;

    const events = await prisma.aiEvent.findMany({
      where: {
        agentId,
        ...(startDate && { timestamp: { gte: startDate } }),
        ...(endDate && { timestamp: { lte: endDate } }),
      },
    });

    return this.calculateSummary(events);
  }

  /**
   * Get cost summary for user
   */
  async getUserCost(
    userId: string,
    options: { startDate?: Date; endDate?: Date } = {}
  ): Promise<CostSummary> {
    const { startDate, endDate } = options;

    const events = await prisma.aiEvent.findMany({
      where: {
        userId,
        ...(startDate && { timestamp: { gte: startDate } }),
        ...(endDate && { timestamp: { lte: endDate } }),
      },
    });

    return this.calculateSummary(events);
  }

  /**
   * Get cost summary for workspace
   */
  async getWorkspaceCost(
    workspaceId: string,
    options: { startDate?: Date; endDate?: Date } = {}
  ): Promise<CostSummary> {
    const { startDate, endDate } = options;

    const events = await prisma.aiEvent.findMany({
      where: {
        workspaceId,
        ...(startDate && { timestamp: { gte: startDate } }),
        ...(endDate && { timestamp: { lte: endDate } }),
      },
    });

    return this.calculateSummary(events);
  }

  /**
   * Get top agents by cost
   */
  async getTopAgentsByCost(
    userId: string,
    options: { limit?: number; startDate?: Date; endDate?: Date } = {}
  ): Promise<Array<{ agentId: string; cost: number; calls: number }>> {
    const { limit = 10, startDate, endDate } = options;

    const result = await prisma.aiEvent.groupBy({
      by: ["agentId"],
      where: {
        userId,
        agentId: { not: null },
        ...(startDate && { timestamp: { gte: startDate } }),
        ...(endDate && { timestamp: { lte: endDate } }),
      },
      _sum: {
        cost: true,
      },
      _count: true,
      orderBy: {
        _sum: {
          cost: "desc",
        },
      },
      take: limit,
    });

    return result.map((r) => ({
      agentId: r.agentId!,
      cost: r._sum.cost || 0,
      calls: r._count,
    }));
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Calculate summary statistics from events
   */
  private calculateSummary(events: AIEventRecord[]): CostSummary {
    const totalCost = events.reduce((sum, e) => sum + e.cost, 0);
    const totalTokensIn = events.reduce((sum, e) => sum + e.tokensIn, 0);
    const totalTokensOut = events.reduce((sum, e) => sum + e.tokensOut, 0);
    const totalCalls = events.length;
    const averageLatencyMs =
      totalCalls > 0 ? events.reduce((sum, e) => sum + e.latencyMs, 0) / totalCalls : 0;

    // Cost by tier
    const costByTier: Record<string, number> = {};
    for (const event of events) {
      if (!costByTier[event.tier]) {
        costByTier[event.tier] = 0;
      }
      costByTier[event.tier] += event.cost;
    }

    return {
      totalCost,
      totalTokensIn,
      totalTokensOut,
      totalCalls,
      averageLatencyMs,
      costByTier,
    };
  }

  /**
   * Get date range for "last N days"
   */
  private getDateRange(days: number): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return { startDate, endDate };
  }

  // ============================================
  // CLEANUP METHODS
  // ============================================

  /**
   * Delete old events (for GDPR compliance)
   */
  async deleteOldEvents(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.aiEvent.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const aiEventLogger = new AIEventLogger();
