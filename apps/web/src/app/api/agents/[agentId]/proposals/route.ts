import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createSelfModifier } from "@nodebase/core";

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
    const status = searchParams.get("status") || undefined;

    // Verify agent belongs to user's workspace
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { userId: true, workspaceId: true },
    });

    if (!agent || agent.userId !== session.user.id) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Fetch modification proposals
    const proposals = await prisma.modificationProposal.findMany({
      where: {
        agentId,
        workspaceId: agent.workspaceId,
        ...(status && { status: status as "pending" | "approved" | "rejected" | "applied" }),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ proposals });
  } catch (error) {
    console.error("Error fetching proposals:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch proposals" },
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

    // Fetch insights
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const insights = await prisma.agentInsight.findMany({
      where: {
        agentId,
        workspaceId: agent.workspaceId,
        detectedAt: { gte: startDate },
        severity: { in: ["critical", "high"] }, // Only critical/high severity
      },
      select: {
        id: true,
        type: true,
        severity: true,
        description: true,
        recommendations: true,
      },
    });

    // Fetch feedback
    const feedback = await prisma.agentFeedback.findMany({
      where: {
        agentId,
        workspaceId: agent.workspaceId,
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        type: true,
        correctedText: true,
      },
    });

    // Calculate metrics
    const traces = await prisma.agentTrace.findMany({
      where: {
        agentId,
        workspaceId: agent.workspaceId,
        createdAt: { gte: startDate },
      },
      select: {
        status: true,
        totalCost: true,
      },
    });

    const successCount = traces.filter((t) => t.status === "completed").length;
    const metrics = {
      success_rate: traces.length > 0 ? successCount / traces.length : 0,
      cost: traces.reduce((sum, t) => sum + t.totalCost, 0),
    };

    // Create self-modifier
    const modifier = createSelfModifier();

    // Propose modifications
    const proposals = await modifier.proposeModifications({
      agentId,
      workspaceId: agent.workspaceId,
      currentConfig: {
        systemPrompt: agent.systemPrompt || "",
        model: agent.model,
        temperature: agent.temperature || 0.7,
        tools: [], // TODO: Fetch actual tools from AgentTool
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

    // Save proposals to database
    const savedProposals = await Promise.all(
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

    return NextResponse.json({
      proposals: savedProposals,
      count: savedProposals.length,
    });
  } catch (error) {
    console.error("Error generating proposals:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate proposals" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const { proposalId, action } = body; // action: "approve" | "reject"

    if (!proposalId || !action) {
      return NextResponse.json(
        { error: "Missing proposalId or action" },
        { status: 400 }
      );
    }

    // Verify agent belongs to user
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { userId: true, workspaceId: true },
    });

    if (!agent || agent.userId !== session.user.id) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Fetch proposal
    const proposal = await prisma.modificationProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal || proposal.agentId !== agentId) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    if (action === "approve") {
      // Apply the modification to the agent
      const updateData: any = {};
      if (proposal.proposed.systemPrompt) {
        updateData.systemPrompt = proposal.proposed.systemPrompt;
      }
      if (proposal.proposed.model) {
        updateData.model = proposal.proposed.model;
      }
      if (proposal.proposed.temperature !== undefined) {
        updateData.temperature = proposal.proposed.temperature;
      }

      await prisma.agent.update({
        where: { id: agentId },
        data: updateData,
      });

      // Update proposal status
      await prisma.modificationProposal.update({
        where: { id: proposalId },
        data: {
          status: "applied",
          reviewedAt: new Date(),
          reviewedBy: session.user.id,
          appliedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Proposal applied successfully",
      });
    } else if (action === "reject") {
      // Update proposal status
      await prisma.modificationProposal.update({
        where: { id: proposalId },
        data: {
          status: "rejected",
          reviewedAt: new Date(),
          reviewedBy: session.user.id,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Proposal rejected",
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error updating proposal:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update proposal" },
      { status: 500 }
    );
  }
}
