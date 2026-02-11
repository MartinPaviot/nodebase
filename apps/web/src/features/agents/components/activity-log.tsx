"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSuspenseActivities } from "../hooks/use-agents";
import { formatDistanceToNow } from "date-fns";
import {
  ChatCircle,
  PaperPlaneTilt,
  Envelope,
  Calendar,
  Brain,
  MagnifyingGlass,
  Users,
  CheckCircle,
  XCircle,
  Warning,
  Wrench,
  Hash,
} from "@phosphor-icons/react";

interface ActivityLogProps {
  conversationId: string;
}

const activityIcons: Record<string, React.ReactNode> = {
  MESSAGE_SENT: <PaperPlaneTilt className="size-4" />,
  MESSAGE_RECEIVED: <ChatCircle className="size-4" />,
  TOOL_CALLED: <Wrench className="size-4" />,
  TOOL_COMPLETED: <CheckCircle className="size-4 text-green-500" />,
  TOOL_FAILED: <XCircle className="size-4 text-red-500" />,
  EMAIL_SENT: <Envelope className="size-4" />,
  EMAIL_RECEIVED: <Envelope className="size-4" />,
  CALENDAR_EVENT_CREATED: <Calendar className="size-4" />,
  SLACK_MESSAGE_SENT: <Hash className="size-4" />,
  MEMORY_UPDATED: <Brain className="size-4" />,
  KNOWLEDGE_SEARCHED: <MagnifyingGlass className="size-4" />,
  AGENT_DELEGATED: <Users className="size-4" />,
  CONFIRMATION_REQUESTED: <Warning className="size-4 text-yellow-500" />,
  CONFIRMATION_APPROVED: <CheckCircle className="size-4 text-green-500" />,
  CONFIRMATION_REJECTED: <XCircle className="size-4 text-red-500" />,
  ERROR_OCCURRED: <Warning className="size-4 text-red-500" />,
};

const activityColors: Record<string, string> = {
  TOOL_COMPLETED: "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950",
  TOOL_FAILED: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950",
  ERROR_OCCURRED: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950",
  CONFIRMATION_REQUESTED: "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950",
  CONFIRMATION_APPROVED: "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950",
  CONFIRMATION_REJECTED: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950",
};

export function ActivityLog({ conversationId }: ActivityLogProps) {
  const activities = useSuspenseActivities(conversationId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Activity Log</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {activities.data.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No activities yet
              </p>
            ) : (
              activities.data.map((activity) => (
                <div
                  key={activity.id}
                  className={`flex items-start gap-3 p-2 rounded border ${
                    activityColors[activity.type] || "border-border"
                  }`}
                >
                  <div className="mt-0.5">
                    {activityIcons[activity.type] || <Wrench className="size-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{activity.title}</p>
                    {activity.details && (
                      <pre className="text-xs text-muted-foreground mt-1 overflow-hidden text-ellipsis whitespace-pre-wrap">
                        {JSON.stringify(activity.details, null, 2).slice(0, 100)}
                        {JSON.stringify(activity.details, null, 2).length > 100 ? "..." : ""}
                      </pre>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {activity.requiresConfirmation && !activity.confirmedAt && !activity.rejectedAt && (
                    <Badge variant="outline" className="text-yellow-600">
                      Pending
                    </Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
