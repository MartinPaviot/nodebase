import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createInsightsAnalyzer } from "@nodebase/core";

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
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "7");

    // Verify agent belongs to user's workspace
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { userId: true, workspaceId: true },
    });

    if (!agent || agent.userId !== session.user.id) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Fetch existing insights from database
    const existingInsights = await prisma.agentInsight.findMany({
      where: {
        agentId,
        workspaceId: agent.workspaceId,
        detectedAt: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: [
        { severity: "desc" },
        { confidence: "desc" },
      ],
      take: 20,
    });

    return NextResponse.json({
      insights: existingInsights,
    });
  } catch (error) {
    console.error("Error fetching insights:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch insights" },
      { status: 500 }
    );
  }
}

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
      select: { userId: true, workspaceId: true },
    });

    if (!agent || agent.userId !== session.user.id) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Fetch traces for analysis
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const traces = await prisma.agentTrace.findMany({
      where: {
        agentId,
        workspaceId: agent.workspaceId,
        createdAt: { gte: startDate },
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

    // Convert traces to data points for analysis
    const dataPoints = traces.map((trace) => ({
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

    // Run insights analysis
    const analyzer = createInsightsAnalyzer();
    const insights = await analyzer.analyze({
      agentId,
      workspaceId: agent.workspaceId,
      timeframe: {
        start: startDate,
        end: new Date(),
      },
      dataPoints,
    });

    // Save insights to database
    const savedInsights = await Promise.all(
      insights.map((insight) =>
        prisma.agentInsight.create({
          data: {
            agentId,
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

    return NextResponse.json({
      insights: savedInsights,
      analyzed: traces.length,
    });
  } catch (error) {
    console.error("Error generating insights:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate insights" },
      { status: 500 }
    );
  }
}
