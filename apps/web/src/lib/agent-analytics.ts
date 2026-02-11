import prisma from "./db";
import { subDays, startOfDay, format } from "date-fns";

export async function recordMetric(agentId: string, metric: {
  conversations?: number;
  messages?: number;
  responseTimeMs?: number;
  tokensUsed?: number;
  toolCalls?: number;
  toolSuccess?: boolean;
  feedbackPositive?: boolean;
}) {
  const today = startOfDay(new Date());

  await prisma.agentMetric.upsert({
    where: { agentId_date: { agentId, date: today } },
    create: {
      agentId,
      date: today,
      totalConversations: metric.conversations || 0,
      totalMessages: metric.messages || 0,
      totalTokensUsed: metric.tokensUsed || 0,
      toolCallsCount: metric.toolCalls || 0,
      feedbackPositive: metric.feedbackPositive ? 1 : 0,
      feedbackNegative: metric.feedbackPositive === false ? 1 : 0,
    },
    update: {
      totalConversations: metric.conversations
        ? { increment: metric.conversations }
        : undefined,
      totalMessages: metric.messages
        ? { increment: metric.messages }
        : undefined,
      totalTokensUsed: metric.tokensUsed
        ? { increment: metric.tokensUsed }
        : undefined,
      toolCallsCount: metric.toolCalls
        ? { increment: metric.toolCalls }
        : undefined,
      feedbackPositive: metric.feedbackPositive
        ? { increment: 1 }
        : undefined,
      feedbackNegative: metric.feedbackPositive === false
        ? { increment: 1 }
        : undefined,
    },
  });
}

export async function getAgentAnalytics(agentId: string, days = 30) {
  const startDate = subDays(new Date(), days);

  const metrics = await prisma.agentMetric.findMany({
    where: {
      agentId,
      date: { gte: startDate },
    },
    orderBy: { date: "asc" },
  });

  // Calculate aggregates
  const totals = metrics.reduce(
    (acc, m) => ({
      conversations: acc.conversations + m.totalConversations,
      messages: acc.messages + m.totalMessages,
      tokens: acc.tokens + m.totalTokensUsed,
      toolCalls: acc.toolCalls + m.toolCallsCount,
      positive: acc.positive + m.feedbackPositive,
      negative: acc.negative + m.feedbackNegative,
    }),
    { conversations: 0, messages: 0, tokens: 0, toolCalls: 0, positive: 0, negative: 0 }
  );

  const satisfactionRate = totals.positive + totals.negative > 0
    ? (totals.positive / (totals.positive + totals.negative)) * 100
    : null;

  return {
    period: { start: startDate, end: new Date(), days },
    totals,
    satisfactionRate,
    dailyMetrics: metrics.map((m) => ({
      date: format(m.date, "yyyy-MM-dd"),
      conversations: m.totalConversations,
      messages: m.totalMessages,
      tokens: m.totalTokensUsed,
    })),
  };
}

export async function getUserAnalytics(userId: string, days = 30) {
  const startDate = subDays(new Date(), days);

  const agents = await prisma.agent.findMany({
    where: { userId },
    select: { id: true, name: true },
  });

  const agentIds = agents.map((a) => a.id);

  const metrics = await prisma.agentMetric.groupBy({
    by: ["agentId"],
    where: {
      agentId: { in: agentIds },
      date: { gte: startDate },
    },
    _sum: {
      totalConversations: true,
      totalMessages: true,
      totalTokensUsed: true,
    },
  });

  // Get daily totals across all agents
  const dailyMetrics = await prisma.agentMetric.findMany({
    where: {
      agentId: { in: agentIds },
      date: { gte: startDate },
    },
    orderBy: { date: "asc" },
  });

  // Aggregate daily metrics across all agents
  const dailyTotalsMap = new Map<string, { conversations: number; messages: number; tokens: number }>();
  for (const m of dailyMetrics) {
    const dateKey = format(m.date, "yyyy-MM-dd");
    const existing = dailyTotalsMap.get(dateKey) || { conversations: 0, messages: 0, tokens: 0 };
    dailyTotalsMap.set(dateKey, {
      conversations: existing.conversations + m.totalConversations,
      messages: existing.messages + m.totalMessages,
      tokens: existing.tokens + m.totalTokensUsed,
    });
  }

  const dailyTotals = Array.from(dailyTotalsMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Calculate overall totals
  const overallTotals = metrics.reduce(
    (acc, m) => ({
      conversations: acc.conversations + (m._sum.totalConversations || 0),
      messages: acc.messages + (m._sum.totalMessages || 0),
      tokens: acc.tokens + (m._sum.totalTokensUsed || 0),
    }),
    { conversations: 0, messages: 0, tokens: 0 }
  );

  return {
    period: { start: startDate, end: new Date(), days },
    totals: overallTotals,
    dailyMetrics: dailyTotals,
    agents: agents.map((agent) => {
      const metric = metrics.find((m) => m.agentId === agent.id);
      return {
        id: agent.id,
        name: agent.name,
        conversations: metric?._sum.totalConversations || 0,
        messages: metric?._sum.totalMessages || 0,
        tokens: metric?._sum.totalTokensUsed || 0,
      };
    }),
  };
}
