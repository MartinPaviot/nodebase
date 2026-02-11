"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock,
  Globe,
  EnvelopeSimple,
  Calendar,
  Lightning,
  Play,
  Pause,
  MagnifyingGlass,
  Robot,
  CaretRight,
} from "@phosphor-icons/react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

// Trigger type config
const TRIGGER_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  CRON: { label: "Scheduled", icon: Clock, color: "bg-blue-500" },
  WEBHOOK: { label: "Webhook", icon: Globe, color: "bg-purple-500" },
  EMAIL: { label: "Email", icon: EnvelopeSimple, color: "bg-green-500" },
  CALENDAR: { label: "Calendar", icon: Calendar, color: "bg-orange-500" },
  MANUAL: { label: "Manual", icon: Play, color: "bg-gray-500" },
};

function getTriggerConfig(type: string) {
  return TRIGGER_CONFIG[type] || { label: type, icon: Lightning, color: "bg-gray-500" };
}

function AutomationCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-12" />
        </div>
      </CardContent>
    </Card>
  );
}

type Trigger = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  cronExpression: string | null;
  lastRunAt: string | Date | null;
  createdAt: string | Date;
  agent: {
    id: string;
    name: string;
    avatar: string | null;
  };
};

function AutomationCard({
  trigger,
  onToggle,
  isToggling,
}: {
  trigger: Trigger;
  onToggle: (id: string, enabled: boolean) => void;
  isToggling: boolean;
}) {
  const config = getTriggerConfig(trigger.type);
  const TriggerIcon = config.icon;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Trigger Icon */}
          <div className={`h-10 w-10 rounded-lg ${config.color} flex items-center justify-center`}>
            <TriggerIcon className="h-5 w-5 text-white" weight="fill" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{trigger.name}</span>
              <Badge variant="outline" className="text-xs">
                {config.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
              <Robot className="h-3 w-3" />
              <Link
                href={`/agents/${trigger.agent.id}`}
                className="hover:text-primary truncate"
              >
                {trigger.agent.name}
              </Link>
              {trigger.cronExpression && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <code className="text-xs bg-muted px-1 rounded">{trigger.cronExpression}</code>
                </>
              )}
            </div>
          </div>

          {/* Last triggered */}
          <div className="text-xs text-muted-foreground text-right hidden sm:block">
            {trigger.lastRunAt ? (
              <span>Last run {formatDistanceToNow(new Date(trigger.lastRunAt), { addSuffix: true })}</span>
            ) : (
              <span>Never triggered</span>
            )}
          </div>

          {/* Toggle */}
          <Switch
            checked={trigger.enabled}
            onCheckedChange={(checked) => onToggle(trigger.id, checked)}
            disabled={isToggling}
          />

          {/* Link to agent */}
          <Link href={`/agents/${trigger.agent.id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <CaretRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function AutomationsList() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Fetch all triggers across all agents
  const triggersQuery = useQuery(
    trpc.agents.getAllTriggers.queryOptions({})
  );

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const response = await fetch("/api/trpc/agents.updateTrigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      return response.json();
    },
    onMutate: ({ id }) => {
      setTogglingId(id);
    },
    onSettled: () => {
      setTogglingId(null);
      queryClient.invalidateQueries({ queryKey: trpc.agents.getAllTriggers.queryKey({}) });
    },
  });

  const handleToggle = (id: string, enabled: boolean) => {
    toggleMutation.mutate({ id, enabled });
  };

  // Filter triggers by search
  const triggers = triggersQuery.data?.items ?? [];
  const filteredTriggers = triggers.filter((t: Trigger) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.agent.name.toLowerCase().includes(search.toLowerCase())
  );

  const enabledCount = triggers.filter((t: Trigger) => t.enabled).length;

  return (
    <div className="h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-lg font-semibold">Automations</h1>
          <p className="text-sm text-muted-foreground">
            Manage triggers and scheduled tasks across all your agents
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">
                  {triggersQuery.isLoading ? "-" : triggers.length}
                </p>
              </div>
              <Lightning className="h-8 w-8 text-primary" weight="fill" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {triggersQuery.isLoading ? "-" : enabledCount}
                </p>
              </div>
              <Play className="h-8 w-8 text-green-500" weight="fill" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Paused</p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {triggersQuery.isLoading ? "-" : triggers.length - enabledCount}
                </p>
              </div>
              <Pause className="h-8 w-8 text-muted-foreground" weight="fill" />
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search automations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* List */}
        {triggersQuery.isLoading ? (
          <div className="space-y-3">
            <AutomationCardSkeleton />
            <AutomationCardSkeleton />
            <AutomationCardSkeleton />
          </div>
        ) : filteredTriggers.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <Lightning className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No automations yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create triggers on your agents to automate tasks
              </p>
              <Button asChild>
                <Link href="/agents">Go to Agents</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTriggers.map((trigger: Trigger) => (
              <AutomationCard
                key={trigger.id}
                trigger={trigger}
                onToggle={handleToggle}
                isToggling={togglingId === trigger.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
