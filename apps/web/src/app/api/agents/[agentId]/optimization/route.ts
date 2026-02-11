import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createOptimizer } from "@nodebase/core";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agentId } = await params;
    const body = await req.json();
    const { days = 7 } = body;

    // Verify agent belongs to user's workspace
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        userId: true,
        workspaceId: true,
        systemPrompt: true,
        model: true,
        temperature: true,
      },
    });

    if (!agent || agent.userId !== session.user.id) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Fetch feedback data
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const feedback = await prisma.agentFeedback.findMany({
      where: {
        agentId,
        workspaceId: agent.workspaceId,
        createdAt: { gte: startDate },
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
        createdAt: true,
      },
    });

    // Calculate metrics from traces
    const traces = await prisma.agentTrace.findMany({
      where: {
        agentId,
        workspaceId: agent.workspaceId,
        createdAt: { gte: startDate },
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
      satisfaction: 0.5, // Would come from feedback thumbs up/down ratio
    };

    // Create optimizer
    const optimizer = createOptimizer({
      agentId,
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
        enabled: false, // TODO: Enable A/B testing UI
        trafficSplit: 0.2,
        minSampleSize: 50,
        significanceLevel: 0.05,
      },
    });

    // Run optimization
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

    // Save optimization run to database
    const savedRun = await prisma.optimizationRun.create({
      data: {
        agentId,
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

    return NextResponse.json({
      optimizationRun: savedRun,
      improvements: optimizationRun.improvements,
    });
  } catch (error) {
    console.error("Error running optimization:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run optimization" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agentId } = await params;

    // Verify agent belongs to user's workspace
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { userId: true, workspaceId: true },
    });

    if (!agent || agent.userId !== session.user.id) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Fetch optimization runs
    const runs = await prisma.optimizationRun.findMany({
      where: {
        agentId,
        workspaceId: agent.workspaceId,
      },
      orderBy: { startedAt: "desc" },
      take: 10,
    });

    return NextResponse.json({ runs });
  } catch (error) {
    console.error("Error fetching optimization runs:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch optimization runs" },
      { status: 500 }
    );
  }
}
