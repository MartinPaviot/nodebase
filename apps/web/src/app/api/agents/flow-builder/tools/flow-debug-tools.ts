import { z } from "zod";
import type { ToolDef } from "@/lib/llm-tools";
import { prisma } from "@/lib/db";

export function createFlowDebugTools(
  agentId: string,
  userId: string
): Record<string, ToolDef> {
  return {
    get_recent_traces: {
      description:
        "Get recent execution traces for this agent. Shows status, cost, latency, token usage, and evaluation results for each run.",
      parameters: z.object({
        limit: z
          .number()
          .default(5)
          .describe("Number of traces to return (default 5, max 20)"),
        status: z
          .enum(["COMPLETED", "FAILED", "ALL"])
          .default("ALL")
          .describe("Filter by execution status"),
      }),
      execute: async (args: { limit: number; status: string }) => {
        const limit = Math.min(args.limit || 5, 20);
        const where: Record<string, unknown> = { agentId, userId };
        if (args.status !== "ALL") {
          where.status = args.status;
        }

        const traces = await prisma.agentTrace.findMany({
          where,
          orderBy: { startedAt: "desc" },
          take: limit,
          select: {
            id: true,
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
            toolSuccesses: true,
            toolFailures: true,
            feedbackScore: true,
          },
        });

        if (traces.length === 0) {
          return {
            traces: [],
            message: args.status === "ALL"
              ? "No execution traces found for this agent."
              : `No ${args.status} traces found for this agent.`,
          };
        }

        return {
          traces: traces.map((t) => ({
            id: t.id,
            startedAt: t.startedAt.toISOString(),
            completedAt: t.completedAt?.toISOString() || null,
            status: t.status,
            steps: t.totalSteps,
            tokensIn: t.totalTokensIn,
            tokensOut: t.totalTokensOut,
            cost: `$${t.totalCost.toFixed(4)}`,
            latencyMs: t.latencyMs,
            toolSuccesses: t.toolSuccesses,
            toolFailures: t.toolFailures,
            l1Passed: t.l1Passed,
            l2Score: t.l2Score,
            l3Triggered: t.l3Triggered,
            l3Blocked: t.l3Blocked,
            feedbackScore: t.feedbackScore,
          })),
          count: traces.length,
          message: `Found ${traces.length} trace(s).`,
        };
      },
    },

    get_trace_detail: {
      description:
        "Get detailed information about a specific execution trace, including step-by-step execution log, tool calls, and evaluation results.",
      parameters: z.object({
        traceId: z
          .string()
          .describe("The trace ID to inspect"),
      }),
      execute: async (args: { traceId: string }) => {
        const trace = await prisma.agentTrace.findFirst({
          where: { id: args.traceId, agentId, userId },
          include: {
            aiEvents: {
              orderBy: { timestamp: "asc" },
              select: {
                model: true,
                tier: true,
                tokensIn: true,
                tokensOut: true,
                cost: true,
                latencyMs: true,
                action: true,
                toolName: true,
                evalResult: true,
                stepNumber: true,
              },
            },
          },
        });

        if (!trace) {
          return { error: true, message: `Trace "${args.traceId}" not found.` };
        }

        // Parse steps and toolCalls from JSON
        let steps: unknown[] = [];
        let toolCalls: unknown[] = [];
        try {
          steps = Array.isArray(trace.steps) ? trace.steps : JSON.parse(trace.steps as string);
        } catch { /* empty */ }
        try {
          toolCalls = Array.isArray(trace.toolCalls) ? trace.toolCalls : JSON.parse(trace.toolCalls as string);
        } catch { /* empty */ }

        return {
          id: trace.id,
          status: trace.status,
          startedAt: trace.startedAt.toISOString(),
          completedAt: trace.completedAt?.toISOString() || null,
          totalSteps: trace.totalSteps,
          totalCost: `$${trace.totalCost.toFixed(4)}`,
          latencyMs: trace.latencyMs,
          evaluation: {
            l1Passed: trace.l1Passed,
            l1Failures: trace.l1Failures,
            l2Score: trace.l2Score,
            l2Breakdown: trace.l2Breakdown,
            l3Triggered: trace.l3Triggered,
            l3Blocked: trace.l3Blocked,
          },
          feedback: {
            score: trace.feedbackScore,
            comment: trace.feedbackComment,
            userEdited: trace.userEdited,
          },
          steps,
          toolCalls,
          aiEvents: trace.aiEvents,
        };
      },
    },

    analyze_failures: {
      description:
        "Analyze failure patterns across recent executions. Groups failures by type and identifies the most common issues.",
      parameters: z.object({
        timeframe: z
          .enum(["24h", "7d", "30d"])
          .default("7d")
          .describe("Time window to analyze"),
      }),
      execute: async (args: { timeframe: string }) => {
        const now = new Date();
        const hoursMap: Record<string, number> = { "24h": 24, "7d": 168, "30d": 720 };
        const hours = hoursMap[args.timeframe] || 168;
        const since = new Date(now.getTime() - hours * 60 * 60 * 1000);

        const traces = await prisma.agentTrace.findMany({
          where: {
            agentId,
            userId,
            startedAt: { gte: since },
          },
          select: {
            status: true,
            totalSteps: true,
            totalCost: true,
            l1Passed: true,
            l2Score: true,
            l3Blocked: true,
            toolFailures: true,
            toolSuccesses: true,
          },
        });

        const total = traces.length;
        const failed = traces.filter((t) => t.status === "FAILED").length;
        const completed = traces.filter((t) => t.status === "COMPLETED").length;
        const l1Failures = traces.filter((t) => t.l1Passed === false).length;
        const l3Blocks = traces.filter((t) => t.l3Blocked === true).length;
        const toolFailures = traces.reduce((sum, t) => sum + t.toolFailures, 0);
        const toolSuccesses = traces.reduce((sum, t) => sum + t.toolSuccesses, 0);
        const totalCost = traces.reduce((sum, t) => sum + t.totalCost, 0);
        const avgL2 = traces.filter((t) => t.l2Score != null).length > 0
          ? traces.filter((t) => t.l2Score != null).reduce((sum, t) => sum + (t.l2Score || 0), 0) /
            traces.filter((t) => t.l2Score != null).length
          : null;

        return {
          timeframe: args.timeframe,
          totalRuns: total,
          completedRuns: completed,
          failedRuns: failed,
          successRate: total > 0 ? `${((completed / total) * 100).toFixed(1)}%` : "N/A",
          totalCost: `$${totalCost.toFixed(4)}`,
          avgCostPerRun: total > 0 ? `$${(totalCost / total).toFixed(4)}` : "N/A",
          l1FailureCount: l1Failures,
          l3BlockCount: l3Blocks,
          toolFailureCount: toolFailures,
          toolSuccessRate: toolSuccesses + toolFailures > 0
            ? `${((toolSuccesses / (toolSuccesses + toolFailures)) * 100).toFixed(1)}%`
            : "N/A",
          avgL2Score: avgL2 != null ? avgL2.toFixed(2) : "N/A",
          issues: [
            ...(failed > 0 ? [`${failed} execution(s) failed completely`] : []),
            ...(l1Failures > 0 ? [`${l1Failures} run(s) failed L1 assertions (deterministic checks)`] : []),
            ...(l3Blocks > 0 ? [`${l3Blocks} run(s) blocked by L3 LLM-as-Judge`] : []),
            ...(toolFailures > 0 ? [`${toolFailures} tool call(s) failed across all runs`] : []),
          ],
          message: total === 0
            ? `No executions found in the last ${args.timeframe}.`
            : `Analyzed ${total} runs over the last ${args.timeframe}. Success rate: ${((completed / total) * 100).toFixed(1)}%.`,
        };
      },
    },
  };
}
