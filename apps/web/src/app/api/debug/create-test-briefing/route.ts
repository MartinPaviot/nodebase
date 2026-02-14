/**
 * DEBUG ENDPOINT - Create Test Briefing
 *
 * Utilisation: GET /api/debug/create-test-briefing
 *
 * Génère un briefing de test pour l'utilisateur courant
 */

import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Get current user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user's agents for realistic summary
    const agents = await prisma.agent.findMany({
      where: { userId },
      take: 3,
      select: {
        id: true,
        name: true,
      },
    });

    // Create mock agent summaries
    const agentsSummary = agents.map((agent, idx) => ({
      agentId: agent.id,
      agentName: agent.name,
      traces: Math.floor(Math.random() * 20) + 5,
      successRate: Math.random() * 30 + 70, // 70-100%
      totalCost: Math.random() * 0.5 + 0.1, // $0.10-$0.60
      pendingApprovals: idx === 0 ? Math.floor(Math.random() * 3) : 0,
    }));

    const totalRuns = agentsSummary.reduce((sum, a) => sum + a.traces, 0);
    const avgSuccess = agentsSummary.reduce((sum, a) => sum + a.successRate, 0) / agentsSummary.length;
    const totalCost = agentsSummary.reduce((sum, a) => sum + a.totalCost, 0);
    const totalPending = agentsSummary.reduce((sum, a) => sum + a.pendingApprovals, 0);

    // Generate briefing content
    const briefingContent = `Good morning! 👋

Here's what happened with your AI agents yesterday:

**Overall Activity**
Your agents completed ${totalRuns} tasks with an average success rate of ${Math.round(avgSuccess)}%. ${totalPending > 0 ? `You have ${totalPending} approval${totalPending > 1 ? 's' : ''} waiting for your review.` : 'All tasks were completed without requiring approvals.'}

**Top Performers**
${agentsSummary.map((agent, idx) =>
  `${idx + 1}. **${agent.agentName}**: ${agent.traces} runs, ${Math.round(agent.successRate)}% success rate, $${agent.totalCost.toFixed(4)} spent`
).join('\n')}

**Cost Summary**
Total spent yesterday: $${totalCost.toFixed(4)}

${totalPending > 0 ? `⚠️ **Action Required**: ${totalPending} draft${totalPending > 1 ? 's' : ''} awaiting your approval. Review them to keep your workflows moving.` : '✅ Everything is running smoothly! No action required.'}

Have a productive day! 🚀`;

    // Get today's date (midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if briefing already exists
    const existing = await prisma.dailyBriefing.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    let briefing;
    if (existing) {
      // Update existing
      briefing = await prisma.dailyBriefing.update({
        where: { id: existing.id },
        data: {
          content: briefingContent,
          agentsSummary: agentsSummary as never,
          readAt: null, // Reset read status
        },
      });
    } else {
      // Create new
      briefing = await prisma.dailyBriefing.create({
        data: {
          userId,
          date: today,
          content: briefingContent,
          agentsSummary: agentsSummary as never,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Test briefing created!",
      briefing: {
        id: briefing.id,
        date: briefing.date,
        agentCount: agentsSummary.length,
        totalRuns,
        totalPending,
      },
    });
  } catch (error) {
    console.error("Error creating test briefing:", error);
    return NextResponse.json(
      { error: "Failed to create test briefing", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
