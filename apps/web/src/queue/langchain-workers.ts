// @ts-nocheck
// TODO: Uses planned Prisma models (AgentTrace, AgentInsight, etc.) not yet in schema
/**
 * LangChain Background Workers (BullMQ)
 *
 * Replaces Inngest cron jobs with BullMQ workers:
 * - dailyInsightsGeneration
 * - weeklyOptimization
 * - weeklyModificationProposals
 */

import { createWorker } from "@nodebase/queue";
import prisma from "@/lib/db";
import {
  createInsightsAnalyzer,
  createOptimizer,
  createSelfModifier,
  type DataPoint,
} from "@nodebase/core";

// ============================================
// Daily Insights Generation Worker
// ============================================

export const insightsWorker = createWorker(
  "langchain:insights",
  async (job) => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find active agents
    const agentsWithActivity = await prisma.agent.findMany({
      where: {
        agentTraces: {
          some: {
            createdAt: { gte: sevenDaysAgo },
          },
        },
      },
      select: {
        id: true,
        workspaceId: true,
      },
    });

    console.log(`[Insights] Found ${agentsWithActivity.length} active agents`);
    let totalInsights = 0;

    // Generate insights for each agent
    for (const agent of agentsWithActivity) {
      // Fetch traces
      const traces = await prisma.agentTrace.findMany({
        where: {
          agentId: agent.id,
          createdAt: { gte: sevenDaysAgo },
        },
        select: {
          id: true,
          status: true,
          totalTokensUsed: true,
          totalCost: true,
          totalDuration: true,
          steps: true,
          errorLogs: true,
          createdAt: true,
        },
      });

      if (traces.length === 0) continue;

      // Convert to data points
      const dataPoints: DataPoint[] = traces.map((trace) => ({
        id: trace.id,
        type: "trace" as const,
        timestamp: trace.createdAt,
        metrics: {
          success: trace.status === "completed" ? 1 : 0,
          cost: trace.totalCost,
          latencyMs: trace.totalDuration,
          tokens: trace.totalTokensUsed,
        },
        metadata: {
          status: trace.status,
          error: trace.errorLogs?.[0] || null,
        },
      }));

      // Run analysis
      const analyzer = createInsightsAnalyzer();
      const insights = await analyzer.analyze({
        agentId: agent.id,
        workspaceId: agent.workspaceId,
        timeframe: {
          start: sevenDaysAgo,
          end: new Date(),
        },
        dataPoints,
      });

      // Save to database
      await Promise.all(
        insights.map((insight) =>
          prisma.agentInsight.create({
            data: {
              agentId: agent.id,
              workspaceId: agent.workspaceId,
              type: insight.type,
              title: insight.title,
              description: insight.description,
              severity: insight.severity,
              confidence: insight.confidence,
              impact: insight.impact,
              evidence: insight.evidence,
              recommendations: insight.recommendations,
              detectedAt: insight.detectedAt,
            },
          })
        )
      );

      totalInsights += insights.length;
      console.log(`[Insights] Generated ${insights.length} insights for agent ${agent.id}`);
    }

    return {
      agentsProcessed: agentsWithActivity.length,
      totalInsights,
    };
  },
  {
    connection: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
    },
    limiter: {
      max: 10, // Max 10 jobs per interval
      duration: 60000, // Per minute
    },
  }
);

// ============================================
// Weekly Optimization Worker
// ============================================

export const optimizationWorker = createWorker(
  "langchain:optimization",
  async (job) => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find agents with critical/high severity insights
    const agentsNeedingOptimization = await prisma.agent.findMany({
      where: {
        agentInsights: {
          some: {
            detectedAt: { gte: sevenDaysAgo },
            severity: { in: ["critical", "high"] },
          },
        },
      },
      select: {
        id: true,
        workspaceId: true,
        systemPrompt: true,
        model: true,
        temperature: true,
      },
    });

    console.log(`[Optimization] Found ${agentsNeedingOptimization.length} agents needing optimization`);

    for (const agent of agentsNeedingOptimization) {
      // Fetch feedback
      const feedback = await prisma.agentFeedback.findMany({
        where: {
          agentId: agent.id,
          createdAt: { gte: sevenDaysAgo },
        },
        select: {
          id: true,
          conversationId: true,
          messageId: true,
          type: true,
          userId: true,
          originalText: true,
          correctedText: true,
          metadata: true,
        },
      });

      // Calculate metrics
      const traces = await prisma.agentTrace.findMany({
        where: {
          agentId: agent.id,
          createdAt: { gte: sevenDaysAgo },
        },
        select: {
          status: true,
          totalCost: true,
          totalDuration: true,
        },
      });

      const successCount = traces.filter((t) => t.status === "completed").length;
      const metrics = {
        success_rate: traces.length > 0 ? successCount / traces.length : 0,
        cost: traces.reduce((sum, t) => sum + t.totalCost, 0) / Math.max(traces.length, 1),
        latency: traces.reduce((sum, t) => sum + t.totalDuration, 0) / Math.max(traces.length, 1),
        satisfaction: 0.5,
      };

      // Run optimization
      const optimizer = createOptimizer({
        agentId: agent.id,
        workspaceId: agent.workspaceId,
        goals: [
          { metric: "success_rate", target: 0.95, weight: 0.4 },
          { metric: "cost", target: 0.01, weight: 0.3 },
          { metric: "latency", target: 2000, weight: 0.2 },
          { metric: "satisfaction", target: 0.9, weight: 0.1 },
        ],
        constraints: {
          maxCostPerConversation: 0.05,
          maxLatencyMs: 5000,
          minSuccessRate: 0.8,
        },
        abTestConfig: {
          enabled: false,
          trafficSplit: 0.2,
          minSampleSize: 50,
          significanceLevel: 0.05,
        },
      });

      const optimizationRun = await optimizer.optimize({
        currentPrompt: agent.systemPrompt || "",
        currentModel: agent.model,
        currentTemperature: agent.temperature || 0.7,
        feedbackData: feedback.map((f) => ({
          conversationId: f.conversationId,
          messageId: f.messageId,
          type: f.type as "thumbs_up" | "thumbs_down" | "edit" | "correction",
          userId: f.userId,
          originalText: f.originalText || undefined,
          correctedText: f.correctedText || undefined,
          metadata: f.metadata as Record<string, unknown> | undefined,
        })),
        metricsData: metrics,
      });

      // Save optimization run
      await prisma.optimizationRun.create({
        data: {
          agentId: agent.id,
          workspaceId: agent.workspaceId,
          status: optimizationRun.status,
          method: optimizationRun.method,
          baselinePrompt: optimizationRun.baseline.systemPrompt,
          baselineModel: optimizationRun.baseline.model,
          baselineTemperature: optimizationRun.baseline.temperature,
          baselineMetrics: optimizationRun.baseline.metrics,
          optimizedPrompt: optimizationRun.optimized?.systemPrompt,
          optimizedModel: optimizationRun.optimized?.model,
          optimizedTemperature: optimizationRun.optimized?.temperature,
          optimizedMetrics: optimizationRun.optimized?.metrics || {},
          improvements: optimizationRun.improvements,
          metadata: optimizationRun.metadata || {},
          startedAt: optimizationRun.startedAt,
          completedAt: optimizationRun.completedAt,
        },
      });

      console.log(`[Optimization] Completed optimization for agent ${agent.id}`);
    }

    return {
      agentsOptimized: agentsNeedingOptimization.length,
    };
  },
  {
    connection: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
    },
    limiter: {
      max: 5,
      duration: 60000,
    },
  }
);

// ============================================
// Weekly Modification Proposals Worker
// ============================================

export const proposalsWorker = createWorker(
  "langchain:proposals",
  async (job) => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find agents with low success rate or high cost
    const agents = await prisma.agent.findMany({
      where: {
        agentTraces: {
          some: {
            createdAt: { gte: sevenDaysAgo },
          },
        },
      },
      select: {
        id: true,
        workspaceId: true,
        systemPrompt: true,
        model: true,
        temperature: true,
        agentTraces: {
          where: {
            createdAt: { gte: sevenDaysAgo },
          },
          select: {
            status: true,
            totalCost: true,
          },
        },
      },
    });

    // Filter underperforming agents
    const underperformingAgents = agents.filter((agent) => {
      const successCount = agent.agentTraces.filter((t) => t.status === "completed").length;
      const successRate = successCount / agent.agentTraces.length;
      const avgCost =
        agent.agentTraces.reduce((sum, t) => sum + t.totalCost, 0) / agent.agentTraces.length;

      return successRate < 0.7 || avgCost > 0.03;
    });

    console.log(`[Proposals] Found ${underperformingAgents.length} underperforming agents`);

    for (const agent of underperformingAgents) {
      // Fetch insights and feedback
      const insights = await prisma.agentInsight.findMany({
        where: {
          agentId: agent.id,
          detectedAt: { gte: sevenDaysAgo },
          severity: { in: ["critical", "high"] },
        },
        select: {
          id: true,
          type: true,
          severity: true,
          description: true,
          recommendations: true,
        },
      });

      const feedback = await prisma.agentFeedback.findMany({
        where: {
          agentId: agent.id,
          createdAt: { gte: sevenDaysAgo },
        },
        select: {
          id: true,
          type: true,
          correctedText: true,
        },
      });

      // Calculate metrics
      const successCount = agent.agentTraces.filter((t) => t.status === "completed").length;
      const metrics = {
        success_rate: successCount / agent.agentTraces.length,
        cost: agent.agentTraces.reduce((sum, t) => sum + t.totalCost, 0),
      };

      // Create modifier
      const modifier = createSelfModifier();

      // Propose modifications
      const proposals = await modifier.proposeModifications({
        agentId: agent.id,
        workspaceId: agent.workspaceId,
        currentConfig: {
          systemPrompt: agent.systemPrompt || "",
          model: agent.model,
          temperature: agent.temperature || 0.7,
          tools: [],
        },
        insights: insights.map((i) => ({
          id: i.id,
          type: i.type,
          severity: i.severity,
          description: i.description,
          recommendations: i.recommendations as string[],
        })),
        feedback: feedback.map((f) => ({
          id: f.id,
          type: f.type,
          correctedText: f.correctedText || undefined,
        })),
        metrics,
      });

      // Save proposals
      await Promise.all(
        proposals.map((proposal) =>
          prisma.modificationProposal.create({
            data: {
              agentId: proposal.agentId,
              workspaceId: proposal.workspaceId,
              type: proposal.type,
              status: proposal.status,
              current: proposal.current,
              proposed: proposal.proposed,
              rationale: proposal.rationale,
              expectedImpact: proposal.expectedImpact,
              evidence: proposal.evidence,
              createdAt: proposal.createdAt,
            },
          })
        )
      );

      console.log(`[Proposals] Generated ${proposals.length} proposals for agent ${agent.id}`);
    }

    return {
      agentsProcessed: underperformingAgents.length,
    };
  },
  {
    connection: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
    },
    limiter: {
      max: 5,
      duration: 60000,
    },
  }
);
