"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Newspaper,
  CheckCircle,
  Clock,
  TrendUp,
  CaretDown,
  CaretUp,
} from "@phosphor-icons/react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface AgentSummary {
  agentId: string;
  agentName: string;
  traces: number;
  successRate: number;
  totalCost: number;
  pendingApprovals: number;
}

export function DailyBriefingWidget() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(true);

  // Fetch today's briefing
  const { data: briefing, isLoading } = useQuery(
    trpc.briefing.getTodaysBriefing.queryOptions()
  );

  // Fetch stats
  const { data: stats } = useQuery(
    trpc.briefing.getBriefingStats.queryOptions()
  );

  // Mark as read mutation
  const markReadMutation = useMutation(
    trpc.briefing.markAsRead.mutationOptions({
      onSuccess: () => {
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ["briefing"] });
      },
    })
  );

  // Loading state
  if (isLoading) {
    return <BriefingSkeleton />;
  }

  // No briefing available
  if (!briefing) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Daily Briefing</CardTitle>
          </div>
          <CardDescription>
            Your daily briefing will appear here once generated.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const agentsSummary = briefing.agentsSummary as unknown as AgentSummary[];
  const totalPendingApprovals = agentsSummary.reduce(
    (sum, agent) => sum + agent.pendingApprovals,
    0
  );

  return (
    <Card className={cn(
      "transition-all duration-200",
      !briefing.readAt && "border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/20"
    )}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Newspaper className={cn(
              "h-5 w-5",
              !briefing.readAt ? "text-blue-600" : "text-muted-foreground"
            )} />
            <div>
              <CardTitle className="text-lg">Daily Briefing</CardTitle>
              <CardDescription>
                {new Date(briefing.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!briefing.readAt && (
              <Badge variant="default" className="bg-blue-600">
                New
              </Badge>
            )}
            {stats && stats.unread > 0 && (
              <Badge variant="secondary">
                {stats.unread} unread
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <CaretUp className="h-4 w-4" />
              ) : (
                <CaretDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Briefing Content */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
              {briefing.content}
            </p>
          </div>

          {/* Agent Summaries */}
          {agentsSummary.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                Agent Activity
              </h4>
              <div className="grid gap-3">
                {agentsSummary.map((agent) => (
                  <div
                    key={agent.agentId}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{agent.agentName}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <TrendUp className="h-3 w-3" />
                          {agent.traces} runs
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          {Math.round(agent.successRate)}% success
                        </span>
                        {agent.pendingApprovals > 0 && (
                          <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                            <Clock className="h-3 w-3" />
                            {agent.pendingApprovals} pending
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      ${agent.totalCost.toFixed(4)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-4 border-t">
            {!briefing.readAt ? (
              <Button
                size="sm"
                onClick={() => markReadMutation.mutate({ briefingId: briefing.id })}
                disabled={markReadMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark as Read
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Read on {new Date(briefing.readAt).toLocaleTimeString()}</span>
              </div>
            )}

            {totalPendingApprovals > 0 && (
              <Button size="sm" variant="outline" asChild>
                <a href="/approvals">
                  View {totalPendingApprovals} Pending {totalPendingApprovals === 1 ? "Approval" : "Approvals"}
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function BriefingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}
