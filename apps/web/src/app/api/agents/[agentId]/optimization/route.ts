import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
        timestamp: { gte: startDate },
      },
      select: {
        id: true,
        conversationId: true,
        traceId: true,
        type: true,
        userId: true,
        originalOutput: true,
        correctionText: true,
        metadata: true,
        timestamp: true,
      },
    });

    // Calculate metrics from traces
    const traces = await prisma.agentTrace.findMany({
      where: {
        agentId,
        ...(agent.workspaceId ? { workspaceId: agent.workspaceId } : {}),
        startedAt: { gte: startDate },
      },
      select: {
        status: true,
        totalCost: true,
        latencyMs: true,
      },
    });

    const successCount = traces.filter((t) => t.status === "COMPLETED").length;
    const metrics = {
      success_rate: traces.length > 0 ? successCount / traces.length : 0,
      cost: traces.reduce((sum, t) => sum + t.totalCost, 0) / Math.max(traces.length, 1),
      latency: traces.reduce((sum, t) => sum + (t.latencyMs || 0), 0) / Math.max(traces.length, 1),
      satisfaction: 0.5,
    };

    // Save optimization run to database
    const savedRun = await prisma.optimizationRun.create({
      data: {
        agentId,
        triggeredBy: "manual",
        status: "analyzing",
        editPatterns: [],
        promptVariations: [],
        testResults: [],
        recommendation: `Optimization run initiated. Analyzed ${traces.length} traces and ${feedback.length} feedback items.`,
      },
    });

    return NextResponse.json({
      optimizationRun: savedRun,
      metrics,
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

    // Verify agent belongs to user
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { userId: true },
    });

    if (!agent || agent.userId !== session.user.id) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Fetch optimization runs
    const runs = await prisma.optimizationRun.findMany({
      where: { agentId },
      orderBy: { triggeredAt: "desc" },
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
