/**
 * Observability Router - Phase 4.1
 *
 * Provides tracing, metrics, and analytics for agent executions.
 * Inspired by LangSmith-style observability.
 */

import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import prisma from "@/lib/db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const observabilityRouter = createTRPCRouter({
  /**
   * Get agent traces with pagination
   */
  getAgentTraces: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        status: z.enum(["RUNNING", "COMPLETED", "FAILED", "TIMEOUT", "CANCELLED"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify agent ownership
      const agent = await prisma.agent.findUnique({
        where: { id: input.agentId },
        select: { userId: true },
      });

      if (!agent || agent.userId !== ctx.auth.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to view traces for this agent",
        });
      }

      const where = {
        agentId: input.agentId,
        ...(input.status ? { status: input.status } : {}),
      };

      const [traces, total] = await Promise.all([
        prisma.agentTrace.findMany({
          where,
          orderBy: { startedAt: "desc" },
          take: input.limit,
          skip: input.offset,
          select: {
            id: true,
            conversationId: true,
            startedAt: true,
            completedAt: true,
            status: true,
            totalSteps: true,
            totalTokensIn: true,
            totalTokensOut: true,
            totalCost: true,
            latencyMs: true,
            l1Passed: true,
            l2Score: true,
            l3Triggered: true,
            l3Blocked: true,
          },
        }),
        prisma.agentTrace.count({ where }),
      ]);

      return {
        traces,
        total,
        hasMore: input.offset + input.limit < total,
      };
    }),

  /**
   * Get detailed trace with all events
   */
  getTraceDetail: protectedProcedure
    .input(z.object({ traceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const trace = await prisma.agentTrace.findUnique({
        where: { id: input.traceId },
        include: {
          conversation: {
            select: {
              id: true,
              agent: {
                select: {
                  id: true,
                  name: true,
                  userId: true,
                },
              },
            },
          },
        },
      });

      if (!trace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Trace not found",
        });
      }

      if (trace.conversation.agent.userId !== ctx.auth.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to view this trace",
        });
      }

      // Parse steps and tool calls from JSON fields
      const steps = (trace.steps as unknown as Array<{
        id: string;
        type: string;
        timestamp: string;
        input?: unknown;
        output?: unknown;
        durationMs?: number;
      }>) || [];

      const toolCalls = (trace.toolCalls as unknown as Array<{
        id: string;
        toolName: string;
        input: unknown;
        output: unknown;
        success: boolean;
        durationMs: number;
      }>) || [];

      return {
        ...trace,
        steps,
        toolCalls,
      };
    }),

  /**
   * Get aggregated metrics for an agent
   */
  getAgentMetrics: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        timeframe: z.enum(["24h", "7d", "30d", "all"]).default("7d"),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify agent ownership
      const agent = await prisma.agent.findUnique({
        where: { id: input.agentId },
        select: { userId: true },
      });

      if (!agent || agent.userId !== ctx.auth.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to view metrics for this agent",
        });
      }

      // Calculate time threshold
      const now = new Date();
      const timeThresholds = {
        "24h": new Date(now.getTime() - 24 * 60 * 60 * 1000),
        "7d": new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        "30d": new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        "all": new Date(0),
      };

      const since = timeThresholds[input.timeframe];

      // Get traces within timeframe
      const traces = await prisma.agentTrace.findMany({
        where: {
          agentId: input.agentId,
          startedAt: { gte: since },
        },
        select: {
          status: true,
          totalSteps: true,
          totalTokensIn: true,
          totalTokensOut: true,
          totalCost: true,
          latencyMs: true,
          l1Passed: true,
          l2Score: true,
          l3Triggered: true,
          l3Blocked: true,
        },
      });

      // Get feedback within timeframe
      const feedbacks = await prisma.agentFeedback.findMany({
        where: {
          agentId: input.agentId,
          timestamp: { gte: since },
        },
        select: {
          type: true,
        },
      });

      // Calculate aggregates
      const totalRuns = traces.length;
      const successfulRuns = traces.filter((t) => t.status === "COMPLETED").length;
      const failedRuns = traces.filter((t) => t.status === "FAILED").length;
      const blockedRuns = traces.filter((t) => t.l3Blocked === true).length;

      const totalCost = traces.reduce((sum, t) => sum + (t.totalCost || 0), 0);
      const totalTokensIn = traces.reduce((sum, t) => sum + (t.totalTokensIn || 0), 0);
      const totalTokensOut = traces.reduce((sum, t) => sum + (t.totalTokensOut || 0), 0);
      const avgLatency = traces.length > 0
        ? traces.reduce((sum, t) => sum + (t.latencyMs || 0), 0) / traces.length
        : 0;
      const avgSteps = traces.length > 0
        ? traces.reduce((sum, t) => sum + (t.totalSteps || 0), 0) / traces.length
        : 0;

      const avgL2Score = traces.filter((t) => t.l2Score !== null).length > 0
        ? traces.filter((t) => t.l2Score !== null).reduce((sum, t) => sum + (t.l2Score || 0), 0) /
          traces.filter((t) => t.l2Score !== null).length
        : null;

      const thumbsUp = feedbacks.filter((f) => f.type === "THUMBS_UP").length;
      const thumbsDown = feedbacks.filter((f) => f.type === "THUMBS_DOWN").length;
      const edits = feedbacks.filter((f) => f.type === "USER_EDIT").length;

      return {
        timeframe: input.timeframe,
        totalRuns,
        successfulRuns,
        failedRuns,
        blockedRuns,
        successRate: totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0,
        totalCost,
        totalTokensIn,
        totalTokensOut,
        avgLatency: Math.round(avgLatency),
        avgSteps: Math.round(avgSteps * 10) / 10,
        avgL2Score: avgL2Score ? Math.round(avgL2Score) : null,
        feedback: {
          thumbsUp,
          thumbsDown,
          edits,
          satisfaction: thumbsUp + thumbsDown > 0
            ? (thumbsUp / (thumbsUp + thumbsDown)) * 100
            : null,
        },
      };
    }),

  /**
   * Get cost breakdown by time period
   */
  getCostBreakdown: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        period: z.enum(["day", "week", "month"]).default("day"),
        limit: z.number().min(1).max(90).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify agent ownership
      const agent = await prisma.agent.findUnique({
        where: { id: input.agentId },
        select: { userId: true },
      });

      if (!agent || agent.userId !== ctx.auth.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to view cost data for this agent",
        });
      }

      // Get all traces with costs
      const traces = await prisma.agentTrace.findMany({
        where: {
          agentId: input.agentId,
          totalCost: { gt: 0 },
        },
        select: {
          startedAt: true,
          totalCost: true,
          totalTokensIn: true,
          totalTokensOut: true,
        },
        orderBy: { startedAt: "desc" },
      });

      // Group by period
      const breakdown: Record<string, {
        date: string;
        cost: number;
        tokensIn: number;
        tokensOut: number;
        runs: number;
      }> = {};

      traces.forEach((trace) => {
        const date = trace.startedAt;
        let key: string;

        if (input.period === "day") {
          key = date.toISOString().split("T")[0]; // YYYY-MM-DD
        } else if (input.period === "week") {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split("T")[0];
        } else {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        }

        if (!breakdown[key]) {
          breakdown[key] = {
            date: key,
            cost: 0,
            tokensIn: 0,
            tokensOut: 0,
            runs: 0,
          };
        }

        breakdown[key].cost += trace.totalCost;
        breakdown[key].tokensIn += trace.totalTokensIn || 0;
        breakdown[key].tokensOut += trace.totalTokensOut || 0;
        breakdown[key].runs += 1;
      });

      return Object.values(breakdown)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, input.limit);
    }),
});
