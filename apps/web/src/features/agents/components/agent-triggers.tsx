"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useSuspenseTriggers,
  useCreateTrigger,
  useUpdateTrigger,
  useDeleteTrigger,
} from "../hooks/use-agents";
import { AgentEmailSettings } from "./agent-email-settings";
import {
  Lightning,
  Plus,
  Trash,
  CircleNotch,
  Clock,
  Plugs,
  Envelope,
  Calendar,
  Copy,
} from "@phosphor-icons/react";
import { formatDistanceToNow } from "date-fns";
import { TriggerType } from "@prisma/client";
import { toast } from "sonner";

interface AgentTriggersProps {
  agentId: string;
}

const triggerTypeConfig: Record<
  TriggerType,
  { label: string; icon: React.ReactNode; description: string }
> = {
  SCHEDULE: {
    label: "Schedule",
    icon: <Clock className="size-4" />,
    description: "Run on a schedule (cron)",
  },
  WEBHOOK: {
    label: "Webhook",
    icon: <Plugs className="size-4" />,
    description: "Triggered by HTTP request",
  },
  EMAIL: {
    label: "Email",
    icon: <Envelope className="size-4" />,
    description: "Triggered by incoming email",
  },
  CHAT: {
    label: "Chat",
    icon: <Calendar className="size-4" />,
    description: "Triggered by chat message",
  },
  AGENT_MESSAGE: {
    label: "Agent Message",
    icon: <Lightning className="size-4" />,
    description: "Triggered by another agent",
  },
};

export function AgentTriggers({ agentId }: AgentTriggersProps) {
  const triggers = useSuspenseTriggers(agentId);
  const createTrigger = useCreateTrigger();
  const updateTrigger = useUpdateTrigger();
  const deleteTrigger = useDeleteTrigger();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    type: "SCHEDULE" as TriggerType,
    cronExpression: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTrigger.mutate(
      {
        agentId,
        name: formData.name,
        type: formData.type,
        cronExpression:
          formData.type === "SCHEDULE" ? formData.cronExpression : undefined,
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setFormData({ name: "", type: "SCHEDULE", cronExpression: "" });
        },
      }
    );
  };

  const handleToggle = (triggerId: string, enabled: boolean) => {
    updateTrigger.mutate({ id: triggerId, enabled });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this trigger?")) {
      deleteTrigger.mutate({ id });
    }
  };

  const copyWebhookUrl = (triggerId: string, secret: string | null) => {
    const url = `${window.location.origin}/api/agents/webhook/${triggerId}${secret ? `?secret=${secret}` : ""}`;
    navigator.clipboard.writeText(url);
    toast.success("Webhook URL copied to clipboard");
  };

  // Check if there's an EMAIL trigger
  const hasEmailTrigger = triggers.data.some((t) => t.type === "EMAIL" && t.enabled);

  return (
    <div className="space-y-6">
      {/* Email Settings - shown when EMAIL trigger exists */}
      {hasEmailTrigger && <AgentEmailSettings agentId={agentId} />}

      <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Lightning className="size-5" />
          Triggers
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              onClick={() =>
                setFormData({ name: "", type: "SCHEDULE", cronExpression: "" })
              }
            >
              <Plus className="size-4 mr-2" />
              Add Trigger
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Trigger</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Daily summary, New email handler"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Trigger Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: TriggerType) =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(triggerTypeConfig).map(
                      ([value, config]) => (
                        <SelectItem key={value} value={value}>
                          <div className="flex items-center gap-2">
                            {config.icon}
                            <span>{config.label}</span>
                          </div>
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {triggerTypeConfig[formData.type].description}
                </p>
              </div>
              {formData.type === "SCHEDULE" && (
                <div className="space-y-2">
                  <Label htmlFor="cron">Cron Expression</Label>
                  <Input
                    id="cron"
                    value={formData.cronExpression}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        cronExpression: e.target.value,
                      })
                    }
                    placeholder="0 9 * * * (every day at 9am)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Examples: "0 9 * * *" (daily at 9am), "0 */2 * * *" (every 2
                    hours)
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createTrigger.isPending}>
                  {createTrigger.isPending && (
                    <CircleNotch className="size-4 mr-2 animate-spin" />
                  )}
                  Create
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {triggers.data.length === 0 ? (
          <div className="text-center py-8">
            <Lightning className="size-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No triggers configured yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add triggers to automate your agent.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {triggers.data.map((trigger) => (
                <div
                  key={trigger.id}
                  className="p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-muted-foreground">
                          {triggerTypeConfig[trigger.type].icon}
                        </span>
                        <span className="font-medium">{trigger.name}</span>
                        <Badge
                          variant={trigger.enabled ? "default" : "secondary"}
                        >
                          {trigger.enabled ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {trigger.cronExpression && (
                        <p className="text-sm text-muted-foreground">
                          Cron: <code>{trigger.cronExpression}</code>
                        </p>
                      )}
                      {trigger.type === "WEBHOOK" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            copyWebhookUrl(trigger.id, trigger.webhookSecret)
                          }
                        >
                          <Copy className="size-3 mr-1" />
                          Copy webhook URL
                        </Button>
                      )}
                      {trigger.lastRunAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last run:{" "}
                          {formatDistanceToNow(trigger.lastRunAt, {
                            addSuffix: true,
                          })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={trigger.enabled}
                        onCheckedChange={(checked) =>
                          handleToggle(trigger.id, checked)
                        }
                        disabled={updateTrigger.isPending}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDelete(trigger.id)}
                        disabled={deleteTrigger.isPending}
                      >
                        <Trash className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
