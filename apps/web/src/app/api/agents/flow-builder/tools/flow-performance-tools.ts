import { z } from "zod";
import type { ToolDef } from "@/lib/llm-tools";
import { prisma } from "@/lib/db";
import type { FlowStateSnapshot } from "@/features/agents/types/flow-builder-types";

export function createFlowPerformanceTools(
  agentId: string,
  userId: string,
  flowState: FlowStateSnapshot
): Record<string, ToolDef> {
  return {
    get_agent_metrics: {
      description:
        "Get aggregated performance metrics for this agent: conversations, messages, response time, token usage, tool success rate, and user feedback.",
      parameters: z.object({
        timeframe: z
          .enum(["7d", "30d"])
          .default("7d")
          .describe("Time window for metrics"),
      }),
      execute: async (args: { timeframe: string }) => {
        const days = args.timeframe === "30d" ? 30 : 7;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const metrics = await prisma.agentMetric.findMany({
          where: {
            agentId,
            date: { gte: since },
          },
          orderBy: { date: "asc" },
        });

        if (metrics.length === 0) {
          return { message: `No metrics found for the last ${args.timeframe}.`, metrics: null };
        }

        const totals = metrics.reduce(
          (acc, m) => ({
            conversations: acc.conversations + m.totalConversations,
            messages: acc.messages + m.totalMessages,
            tokens: acc.tokens + m.totalTokensUsed,
            toolCalls: acc.toolCalls + m.toolCallsCount,
            feedbackPositive: acc.feedbackPositive + m.feedbackPositive,
            feedbackNegative: acc.feedbackNegative + m.feedbackNegative,
            responseTimeSamples: m.avgResponseTimeMs > 0 ? acc.responseTimeSamples + 1 : acc.responseTimeSamples,
            responseTimeSum: acc.responseTimeSum + m.avgResponseTimeMs,
            toolSuccessRateSamples: m.toolSuccessRate > 0 ? acc.toolSuccessRateSamples + 1 : acc.toolSuccessRateSamples,
            toolSuccessRateSum: acc.toolSuccessRateSum + m.toolSuccessRate,
          }),
          {
            conversations: 0,
            messages: 0,
            tokens: 0,
            toolCalls: 0,
            feedbackPositive: 0,
            feedbackNegative: 0,
            responseTimeSamples: 0,
            responseTimeSum: 0,
            toolSuccessRateSamples: 0,
            toolSuccessRateSum: 0,
          }
        );

        const totalFeedback = totals.feedbackPositive + totals.feedbackNegative;

        return {
          timeframe: args.timeframe,
          daysWithData: metrics.length,
          totalConversations: totals.conversations,
          totalMessages: totals.messages,
          totalTokensUsed: totals.tokens,
          totalToolCalls: totals.toolCalls,
          avgResponseTimeMs: totals.responseTimeSamples > 0
            ? Math.round(totals.responseTimeSum / totals.responseTimeSamples)
            : null,
          toolSuccessRate: totals.toolSuccessRateSamples > 0
            ? `${(totals.toolSuccessRateSum / totals.toolSuccessRateSamples).toFixed(1)}%`
            : "N/A",
          feedback: {
            positive: totals.feedbackPositive,
            negative: totals.feedbackNegative,
            satisfactionRate: totalFeedback > 0
              ? `${((totals.feedbackPositive / totalFeedback) * 100).toFixed(1)}%`
              : "N/A",
          },
          message: `Agent metrics over the last ${args.timeframe}: ${totals.conversations} conversations, ${totals.messages} messages, ${totals.tokens} tokens used.`,
        };
      },
    },

    get_cost_breakdown: {
      description:
        "Get a daily cost breakdown showing how much each day costs in LLM usage. Useful for identifying cost trends.",
      parameters: z.object({
        period: z
          .enum(["day", "week"])
          .default("day")
          .describe("Granularity of the breakdown"),
        limit: z
          .number()
          .default(14)
          .describe("Number of periods to show (default 14)"),
      }),
      execute: async (args: { period: string; limit: number }) => {
        const limit = Math.min(args.limit || 14, 30);
        const since = new Date(Date.now() - limit * (args.period === "week" ? 7 : 1) * 24 * 60 * 60 * 1000);

        const events = await prisma.aiEvent.findMany({
          where: {
            agentId,
            userId,
            timestamp: { gte: since },
          },
          select: {
            timestamp: true,
            cost: true,
            tokensIn: true,
            tokensOut: true,
            model: true,
            tier: true,
          },
          orderBy: { timestamp: "asc" },
        });

        if (events.length === 0) {
          return { breakdown: [], message: "No AI events found in this period." };
        }

        // Group by date
        const byDate = new Map<string, { cost: number; tokensIn: number; tokensOut: number; calls: number }>();
        for (const e of events) {
          const dateKey = e.timestamp.toISOString().split("T")[0];
          const existing = byDate.get(dateKey) || { cost: 0, tokensIn: 0, tokensOut: 0, calls: 0 };
          existing.cost += e.cost;
          existing.tokensIn += e.tokensIn;
          existing.tokensOut += e.tokensOut;
          existing.calls += 1;
          byDate.set(dateKey, existing);
        }

        // Model tier distribution
        const tierCounts: Record<string, number> = {};
        for (const e of events) {
          tierCounts[e.tier] = (tierCounts[e.tier] || 0) + 1;
        }

        const breakdown = Array.from(byDate.entries()).map(([date, data]) => ({
          date,
          cost: `$${data.cost.toFixed(4)}`,
          tokensIn: data.tokensIn,
          tokensOut: data.tokensOut,
          llmCalls: data.calls,
        }));

        const totalCost = events.reduce((sum, e) => sum + e.cost, 0);

        return {
          breakdown,
          totalCost: `$${totalCost.toFixed(4)}`,
          totalLLMCalls: events.length,
          tierDistribution: tierCounts,
          message: `Cost breakdown: $${totalCost.toFixed(4)} total across ${events.length} LLM calls.`,
        };
      },
    },

    suggest_optimizations: {
      description:
        "Analyze the agent's flow structure and performance data to suggest concrete optimizations for cost, speed, or reliability.",
      parameters: z.object({}),
      execute: async () => {
        // Gather metrics
        const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [traces, metrics, feedbacks] = await Promise.all([
          prisma.agentTrace.findMany({
            where: { agentId, userId, startedAt: { gte: since7d } },
            select: {
              status: true,
              totalCost: true,
              totalSteps: true,
              latencyMs: true,
              l1Passed: true,
              l2Score: true,
              toolFailures: true,
              toolSuccesses: true,
            },
          }),
          prisma.agentMetric.findMany({
            where: { agentId, date: { gte: since7d } },
          }),
          prisma.agentFeedback.findMany({
            where: { agentId, timestamp: { gte: since7d } },
            select: { type: true },
          }),
        ]);

        const suggestions: string[] = [];

        // Flow structure analysis
        const nodeCount = flowState.nodes.length;
        const edgeCount = flowState.edges.length;

        if (nodeCount === 0) {
          suggestions.push("The flow is empty. Start by adding a trigger node and at least one action.");
        } else if (nodeCount === 1) {
          suggestions.push("The flow only has a trigger node. Add action nodes (AI steps, conditions, integrations) to create a useful workflow.");
        }

        // Disconnected nodes
        const connectedNodeIds = new Set<string>();
        for (const e of flowState.edges) {
          connectedNodeIds.add(e.source);
          connectedNodeIds.add(e.target);
        }
        const disconnected = flowState.nodes.filter(
          (n) => !connectedNodeIds.has(n.id) && n.type !== "messageReceived"
        );
        if (disconnected.length > 0) {
          suggestions.push(
            `${disconnected.length} node(s) are disconnected: ${disconnected.map((n) => `"${n.label}"`).join(", ")}. Connect them or remove them.`
          );
        }

        // Performance analysis
        if (traces.length > 0) {
          const failed = traces.filter((t) => t.status === "FAILED").length;
          const successRate = ((traces.length - failed) / traces.length) * 100;

          if (successRate < 80) {
            suggestions.push(
              `Success rate is ${successRate.toFixed(0)}% (${failed}/${traces.length} failed). Check the most common failure points with analyze_failures.`
            );
          }

          const avgCost = traces.reduce((s, t) => s + t.totalCost, 0) / traces.length;
          if (avgCost > 0.05) {
            suggestions.push(
              `Average cost per run is $${avgCost.toFixed(4)}. Consider using a faster/cheaper model tier (Haiku) for simpler steps.`
            );
          }

          const avgLatency = traces.filter((t) => t.latencyMs).reduce((s, t) => s + (t.latencyMs || 0), 0) /
            traces.filter((t) => t.latencyMs).length;
          if (avgLatency > 10000) {
            suggestions.push(
              `Average latency is ${(avgLatency / 1000).toFixed(1)}s. Consider splitting long prompts or reducing maxSteps.`
            );
          }

          const totalToolFails = traces.reduce((s, t) => s + t.toolFailures, 0);
          const totalToolCalls = totalToolFails + traces.reduce((s, t) => s + t.toolSuccesses, 0);
          if (totalToolCalls > 0 && totalToolFails / totalToolCalls > 0.2) {
            suggestions.push(
              `Tool failure rate is ${((totalToolFails / totalToolCalls) * 100).toFixed(0)}%. Check integration configurations and error handling.`
            );
          }
        }

        // Feedback analysis
        const edits = feedbacks.filter((f) => f.type === "USER_EDIT").length;
        const thumbsDown = feedbacks.filter((f) => f.type === "THUMBS_DOWN").length;
        if (edits > 3) {
          suggestions.push(
            `Users edited ${edits} response(s) in the last 7 days. The agent's writing style may need refinement — check Style Corrections in Agent Memory.`
          );
        }
        if (thumbsDown > 2) {
          suggestions.push(
            `${thumbsDown} negative feedback(s) received. Review the specific traces to understand what went wrong.`
          );
        }

        if (suggestions.length === 0) {
          suggestions.push("No issues detected. The agent appears to be performing well.");
        }

        return {
          flowStats: {
            nodeCount,
            edgeCount,
            disconnectedNodes: disconnected.length,
          },
          performanceStats: {
            tracesAnalyzed: traces.length,
            metricsRange: `${metrics.length} day(s)`,
            feedbackCount: feedbacks.length,
          },
          suggestions,
          message: `${suggestions.length} suggestion(s) based on flow structure and performance data.`,
        };
      },
    },
  };
}
