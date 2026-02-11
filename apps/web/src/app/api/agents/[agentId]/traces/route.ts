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
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Verify agent belongs to user's workspace
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { userId: true, workspaceId: true },
    });

    if (!agent || agent.userId !== session.user.id) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Fetch traces
    const traces = await prisma.agentTrace.findMany({
      where: {
        agentId,
        workspaceId: agent.workspaceId,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        agentId: true,
        triggeredBy: true,
        totalTokensUsed: true,
        totalCost: true,
        totalDuration: true,
        stepsCount: true,
        status: true,
        createdAt: true,
        completedAt: true,
      },
    });

    const total = await prisma.agentTrace.count({
      where: {
        agentId,
        workspaceId: agent.workspaceId,
      },
    });

    return NextResponse.json({
      traces,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching traces:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch traces" },
      { status: 500 }
    );
  }
}
