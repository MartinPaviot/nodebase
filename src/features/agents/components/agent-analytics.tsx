"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSuspenseAgentAnalytics } from "../hooks/use-agents";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  ChatCircle,
  Lightning,
  ThumbsUp,
  Coins,
} from "@phosphor-icons/react";

interface AgentAnalyticsProps {
  agentId: string;
}

export function AgentAnalytics({ agentId }: AgentAnalyticsProps) {
  const analytics = useSuspenseAgentAnalytics(agentId);

  const stats = [
    {
      title: "Total Conversations",
      value: analytics.data.totals.conversations,
      icon: ChatCircle,
      color: "text-blue-500",
    },
    {
      title: "Total Messages",
      value: analytics.data.totals.messages,
      icon: Lightning,
      color: "text-green-500",
    },
    {
      title: "Tokens Used",
      value: analytics.data.totals.tokens.toLocaleString(),
      icon: Coins,
      color: "text-amber-500",
    },
    {
      title: "Satisfaction Rate",
      value: analytics.data.satisfactionRate
        ? `${analytics.data.satisfactionRate.toFixed(0)}%`
        : "N/A",
      icon: ThumbsUp,
      color: "text-purple-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`size-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.data.dailyMetrics.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data yet. Start chatting with your agent!
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.data.dailyMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <Bar dataKey="conversations" fill="#3b82f6" name="Conversations" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Messages Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.data.dailyMetrics.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data yet. Start chatting with your agent!
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.data.dailyMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <Line
                    type="monotone"
                    dataKey="messages"
                    stroke="#10b981"
                    name="Messages"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Token Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Token Usage</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.data.dailyMetrics.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground">
              No data yet. Start chatting with your agent!
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.data.dailyMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value: number) => [value.toLocaleString(), "Tokens"]}
                />
                <Bar dataKey="tokens" fill="#f59e0b" name="Tokens" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
