/**
 * Daily Briefing Worker (BullMQ)
 *
 * Generates daily briefings for users with:
 * - Recent agent activity
 * - Pending approvals
 * - Key insights
 * - Cost/usage summary
 *
 * Scheduled daily at 8 AM user timezone
 */

import { Worker, Queue } from "bullmq";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { ClaudeClient } from "@/lib/ai/claude-client";

const REDIS_CONNECTION = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
};

interface BriefingJobData {
  userId: string;
  date: Date;
}

interface AgentSummary {
  agentId: string;
  agentName: string;
  traces: number;
  successRate: number;
  totalCost: number;
  pendingApprovals: number;
}

/**
 * Generate daily briefing for a user
 */
async function generateBriefing(userId: string, date: Date): Promise<void> {
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date(date);
  today.setHours(0, 0, 0, 0);

  // Get user's agents
  const agents = await prisma.agent.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
    },
  });

  if (agents.length === 0) {
    console.log(`[Briefing] User ${userId} has no agents, skipping`);
    return;
  }

  const agentIds = agents.map((a) => a.id);

  // Get traces from last 24h
  const traces = await prisma.agentTrace.findMany({
    where: {
      agentId: { in: agentIds },
      startedAt: {
        gte: yesterday,
        lt: today,
      },
    },
    select: {
      id: true,
      agentId: true,
      status: true,
      totalCost: true,
    },
  });

  // Get pending approvals
  const pendingApprovals = await prisma.conversationActivity.findMany({
    where: {
      conversation: {
        agent: {
          userId,
        },
      },
      requiresConfirmation: true,
      confirmedAt: null,
      rejectedAt: null,
      createdAt: {
        gte: yesterday,
      },
    },
    select: {
      id: true,
      title: true,
      conversation: {
        select: {
          agentId: true,
        },
      },
    },
  });

  // Build agent summaries
  const agentSummaries: AgentSummary[] = agents.map((agent) => {
    const agentTraces = traces.filter((t) => t.agentId === agent.id);
    const agentApprovals = pendingApprovals.filter(
      (a) => a.conversation.agentId === agent.id
    );

    const successfulTraces = agentTraces.filter((t) => t.status === "COMPLETED");

    return {
      agentId: agent.id,
      agentName: agent.name,
      traces: agentTraces.length,
      successRate:
        agentTraces.length > 0
          ? (successfulTraces.length / agentTraces.length) * 100
          : 0,
      totalCost: agentTraces.reduce((sum, t) => sum + (t.totalCost || 0), 0),
      pendingApprovals: agentApprovals.length,
    };
  });

  // Filter to agents with activity
  const activeAgents = agentSummaries.filter(
    (s) => s.traces > 0 || s.pendingApprovals > 0
  );

  if (activeAgents.length === 0) {
    console.log(`[Briefing] No activity for user ${userId}, skipping`);
    return;
  }

  // Generate briefing content using Claude
  const briefingPrompt = `You are a helpful AI assistant generating a daily briefing for a user.

Here's the activity summary for yesterday (${yesterday.toLocaleDateString()}):

${activeAgents
  .map(
    (agent) => `
**${agent.agentName}**
- Runs: ${agent.traces}
- Success rate: ${Math.round(agent.successRate)}%
- Cost: $${agent.totalCost.toFixed(4)}
- Pending approvals: ${agent.pendingApprovals}
`
  )
  .join("\n")}

Generate a concise, friendly daily briefing (2-3 paragraphs max) that:
1. Highlights key activities and metrics
2. Calls out any pending approvals that need attention
3. Notes any concerning trends (low success rates, high costs)
4. Keeps a positive, encouraging tone

Start with a greeting and end with a call to action if there are pending approvals.`;

  const claude = new ClaudeClient(process.env.ANTHROPIC_API_KEY!);

  const response = await claude.chat({
    model: "fast",
    systemPrompt: briefingPrompt,
    messages: [{ role: "user", content: "Generate today's briefing." }],
    userId,
  });

  const briefingContent = response.content;

  // Check if briefing already exists for this date
  const existing = await prisma.dailyBriefing.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
  });

  if (existing) {
    // Update existing
    await prisma.dailyBriefing.update({
      where: { id: existing.id },
      data: {
        content: briefingContent,
        agentsSummary: activeAgents as unknown as Prisma.JsonArray,
      },
    });
    console.log(`[Briefing] Updated briefing for user ${userId}`);
  } else {
    // Create new
    await prisma.dailyBriefing.create({
      data: {
        userId,
        date: today,
        content: briefingContent,
        agentsSummary: activeAgents as unknown as Prisma.JsonArray,
      },
    });
    console.log(`[Briefing] Created briefing for user ${userId}`);
  }

  // TODO: Send email if Gmail connected
  // TODO: Send in-app notification
}

/**
 * BullMQ Worker for daily briefings
 */
export const briefingWorker = new Worker<BriefingJobData>(
  "daily-briefing",
  async (job) => {
    const { userId, date } = job.data;
    console.log(`[Briefing Worker] Generating briefing for user ${userId}`);

    try {
      await generateBriefing(userId, date);
      return { success: true, userId };
    } catch (error) {
      console.error(`[Briefing Worker] Error for user ${userId}:`, error);
      throw error;
    }
  },
  {
    connection: REDIS_CONNECTION,
    limiter: {
      max: 10, // Max 10 briefings per minute
      duration: 60000,
    },
  }
);

/**
 * BullMQ Queue for scheduling daily briefings
 */
export const briefingQueue = new Queue<BriefingJobData>("daily-briefing", {
  connection: REDIS_CONNECTION,
});

/**
 * Schedule daily briefing for a user
 */
export async function scheduleDailyBriefing(
  userId: string,
  hour: number = 8
): Promise<void> {
  // Schedule repeating job at specified hour (default 8 AM)
  await briefingQueue.add(
    `daily-${userId}`,
    {
      userId,
      date: new Date(),
    },
    {
      repeat: {
        pattern: `0 ${hour} * * *`, // Cron: every day at specified hour
      },
      jobId: `daily-briefing-${userId}`,
    }
  );

  console.log(`[Briefing] Scheduled daily briefing for user ${userId} at ${hour}:00`);
}

/**
 * Unschedule daily briefing for a user
 */
export async function unscheduleDailyBriefing(userId: string): Promise<void> {
  await briefingQueue.removeRepeatableByKey(`daily-briefing-${userId}`);
  console.log(`[Briefing] Unscheduled daily briefing for user ${userId}`);
}

// Worker lifecycle
briefingWorker.on("completed", (job) => {
  console.log(`[Briefing Worker] Job ${job.id} completed`);
});

briefingWorker.on("failed", (job, error) => {
  console.error(`[Briefing Worker] Job ${job?.id} failed:`, error);
});
