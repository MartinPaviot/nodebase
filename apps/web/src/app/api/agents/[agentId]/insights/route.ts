import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

    // Verify agent belongs to user
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
        generatedAt: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { generatedAt: "desc" },
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

    // Verify agent belongs to user
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { userId: true, workspaceId: true },
    });

    if (!agent || agent.userId !== session.user.id) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    // Fetch traces for analysis
    const traces = await prisma.agentTrace.findMany({
      where: {
        agentId,
        ...(agent.workspaceId ? { workspaceId: agent.workspaceId } : {}),
        startedAt: { gte: startDate },
      },
      select: {
        id: true,
        status: true,
        totalTokensIn: true,
        totalTokensOut: true,
        totalCost: true,
        latencyMs: true,
        steps: true,
        startedAt: true,
      },
    });

    // Create a basic insight record
    const savedInsight = await prisma.agentInsight.create({
      data: {
        agentId,
        timeframeStart: startDate,
        timeframeEnd: endDate,
        clusters: [],
        patterns: [],
        anomalies: [],
        opportunities: [],
      },
    });

    return NextResponse.json({
      insights: [savedInsight],
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
