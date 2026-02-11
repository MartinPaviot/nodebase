"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useSuspenseSwarms,
  useCreateSwarm,
  useCancelSwarm,
  useDeleteSwarm,
} from "../hooks/use-agents";
import {
  Stack,
  Plus,
  Trash,
  CircleNotch,
  Play,
  StopCircle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Copy,
} from "@phosphor-icons/react";
import { formatDistanceToNow } from "date-fns";
import { SwarmStatus, SwarmTaskStatus } from "@/generated/prisma";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

interface AgentSwarmsProps {
  agentId: string;
}

const swarmStatusConfig: Record<
  SwarmStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
  PENDING: {
    label: "Pending",
    variant: "secondary",
    icon: <Clock className="size-3" />,
  },
  RUNNING: {
    label: "Running",
    variant: "default",
    icon: <Play className="size-3" />,
  },
  COMPLETED: {
    label: "Completed",
    variant: "outline",
    icon: <CheckCircle className="size-3" />,
  },
  FAILED: {
    label: "Failed",
    variant: "destructive",
    icon: <XCircle className="size-3" />,
  },
  CANCELLED: {
    label: "Cancelled",
    variant: "secondary",
    icon: <StopCircle className="size-3" />,
  },
};

const taskStatusConfig: Record<
  SwarmTaskStatus,
  { label: string; color: string }
> = {
  PENDING: { label: "Pending", color: "text-muted-foreground" },
  RUNNING: { label: "Running", color: "text-blue-500" },
  COMPLETED: { label: "Completed", color: "text-green-500" },
  FAILED: { label: "Failed", color: "text-destructive" },
};

export function AgentSwarms({ agentId }: AgentSwarmsProps) {
  const swarms = useSuspenseSwarms(agentId);
  const createSwarm = useCreateSwarm();
  const cancelSwarm = useCancelSwarm();
  const deleteSwarm = useDeleteSwarm();
  const trpc = useTRPC();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSwarmId, setSelectedSwarmId] = useState<string | null>(null);
  const [selectedTaskOutput, setSelectedTaskOutput] = useState<{
    input: Record<string, unknown>;
    output: string | null;
    error: string | null;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    taskTemplate: "",
    itemsText: "",
  });

  // Fetch selected swarm details
  const { data: selectedSwarm, refetch: refetchSwarm } = useQuery({
    ...trpc.agents.getSwarm.queryOptions({ id: selectedSwarmId! }),
    enabled: !!selectedSwarmId,
    refetchInterval: (query) => {
      // Auto-refresh if swarm is running
      if (query.state.data?.status === "RUNNING") {
        return 2000;
      }
      return false;
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Parse items - support JSON array or CSV
    let items: Record<string, unknown>[];
    try {
      // Try JSON first
      const trimmed = formData.itemsText.trim();
      if (trimmed.startsWith("[")) {
        items = JSON.parse(trimmed);
      } else {
        // Parse as CSV
        const lines = trimmed.split("\n").filter((line) => line.trim());
        if (lines.length === 0) {
          throw new Error("No items provided");
        }

        // First line is headers
        const headers = lines[0].split(",").map((h) => h.trim());
        items = lines.slice(1).map((line) => {
          const values = line.split(",").map((v) => v.trim());
          const item: Record<string, string> = {};
          headers.forEach((header, i) => {
            item[header] = values[i] || "";
          });
          return item;
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Items must be a non-empty array");
      }
    } catch (error) {
      toast.error(
        `Invalid items format: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return;
    }

    createSwarm.mutate(
      {
        agentId,
        name: formData.name,
        taskTemplate: formData.taskTemplate,
        items,
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setFormData({ name: "", taskTemplate: "", itemsText: "" });
        },
      }
    );
  };

  const handleCancel = (id: string) => {
    if (confirm("Are you sure you want to cancel this swarm?")) {
      cancelSwarm.mutate({ id });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this swarm?")) {
      deleteSwarm.mutate({ id });
    }
  };

  const copyOutput = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Output copied to clipboard");
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Stack className="size-5" />
            Agent Swarms
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                onClick={() =>
                  setFormData({ name: "", taskTemplate: "", itemsText: "" })
                }
              >
                <Plus className="size-4 mr-2" />
                New Swarm
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Agent Swarm</DialogTitle>
                <DialogDescription>
                  Create a swarm to execute hundreds of tasks in parallel. The
                  agent will be cloned for each task.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Swarm Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Process customer emails, Generate reports"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template">Task Template</Label>
                  <Textarea
                    id="template"
                    value={formData.taskTemplate}
                    onChange={(e) =>
                      setFormData({ ...formData, taskTemplate: e.target.value })
                    }
                    placeholder="Write a response to this customer inquiry:

Customer Name: {{name}}
Email: {{email}}
Message: {{message}}"
                    className="min-h-[150px] font-mono text-sm"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {"{{variable}}"} placeholders that will be replaced with
                    values from each item.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="items">Items (JSON or CSV)</Label>
                  <Textarea
                    id="items"
                    value={formData.itemsText}
                    onChange={(e) =>
                      setFormData({ ...formData, itemsText: e.target.value })
                    }
                    placeholder={`JSON format:
[
  {"name": "John", "email": "john@example.com", "message": "..."},
  {"name": "Jane", "email": "jane@example.com", "message": "..."}
]

Or CSV format:
name,email,message
John,john@example.com,Hello...
Jane,jane@example.com,Hi...`}
                    className="min-h-[150px] font-mono text-sm"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste a JSON array or CSV data. Up to 1000 items.
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createSwarm.isPending}>
                    {createSwarm.isPending && (
                      <CircleNotch className="size-4 mr-2 animate-spin" />
                    )}
                    Create Swarm
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {swarms.data.items.length === 0 ? (
            <div className="text-center py-8">
              <Stack className="size-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No swarms created yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a swarm to run parallel tasks with your agent.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {swarms.data.items.map((swarm) => {
                  const progress =
                    swarm.totalTasks > 0
                      ? ((swarm.completedTasks + swarm.failedTasks) /
                          swarm.totalTasks) *
                        100
                      : 0;

                  return (
                    <div
                      key={swarm.id}
                      className="p-4 rounded-lg border hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium">{swarm.name}</span>
                            <Badge variant={swarmStatusConfig[swarm.status].variant}>
                              {swarmStatusConfig[swarm.status].icon}
                              <span className="ml-1">
                                {swarmStatusConfig[swarm.status].label}
                              </span>
                            </Badge>
                          </div>

                          <div className="space-y-2">
                            <Progress value={progress} className="h-2" />
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="text-green-600">
                                {swarm.completedTasks} completed
                              </span>
                              <span className="text-destructive">
                                {swarm.failedTasks} failed
                              </span>
                              <span>
                                {swarm.totalTasks -
                                  swarm.completedTasks -
                                  swarm.failedTasks}{" "}
                                pending
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground mt-2">
                            Created{" "}
                            {formatDistanceToNow(swarm.createdAt, {
                              addSuffix: true,
                            })}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setSelectedSwarmId(swarm.id)}
                            title="View details"
                          >
                            <Eye className="size-4" />
                          </Button>
                          {(swarm.status === "RUNNING" ||
                            swarm.status === "PENDING") && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleCancel(swarm.id)}
                              disabled={cancelSwarm.isPending}
                              title="Cancel swarm"
                            >
                              <StopCircle className="size-4 text-orange-500" />
                            </Button>
                          )}
                          {swarm.status !== "RUNNING" && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleDelete(swarm.id)}
                              disabled={deleteSwarm.isPending}
                              title="Delete swarm"
                            >
                              <Trash className="size-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Swarm Detail Sheet */}
      <Sheet
        open={!!selectedSwarmId}
        onOpenChange={(open) => {
          if (!open) setSelectedSwarmId(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{selectedSwarm?.name || "Swarm Details"}</SheetTitle>
            <SheetDescription>
              View task progress and results
            </SheetDescription>
          </SheetHeader>

          {selectedSwarm && (
            <div className="mt-6 space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">
                    {selectedSwarm.totalTasks}
                  </p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-500/10">
                  <p className="text-2xl font-bold text-green-600">
                    {selectedSwarm.completedTasks}
                  </p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-destructive/10">
                  <p className="text-2xl font-bold text-destructive">
                    {selectedSwarm.failedTasks}
                  </p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-500/10">
                  <p className="text-2xl font-bold text-blue-600">
                    {selectedSwarm.totalTasks -
                      selectedSwarm.completedTasks -
                      selectedSwarm.failedTasks}
                  </p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>

              {/* Progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progress</span>
                  <Badge variant={swarmStatusConfig[selectedSwarm.status].variant}>
                    {swarmStatusConfig[selectedSwarm.status].icon}
                    <span className="ml-1">
                      {swarmStatusConfig[selectedSwarm.status].label}
                    </span>
                  </Badge>
                </div>
                <Progress
                  value={
                    selectedSwarm.totalTasks > 0
                      ? ((selectedSwarm.completedTasks +
                          selectedSwarm.failedTasks) /
                          selectedSwarm.totalTasks) *
                        100
                      : 0
                  }
                  className="h-3"
                />
              </div>

              {/* Task Template */}
              <div>
                <Label className="text-sm font-medium">Task Template</Label>
                <pre className="mt-2 p-3 rounded-lg bg-muted text-xs overflow-auto max-h-[100px]">
                  {selectedSwarm.taskTemplate}
                </pre>
              </div>

              {/* Tasks List */}
              <div>
                <Label className="text-sm font-medium">Tasks</Label>
                <ScrollArea className="h-[300px] mt-2">
                  <div className="space-y-2">
                    {selectedSwarm.tasks.map((task, index) => (
                      <div
                        key={task.id}
                        className="p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() =>
                          setSelectedTaskOutput({
                            input: task.input as Record<string, unknown>,
                            output: task.output,
                            error: task.error,
                          })
                        }
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              Task #{index + 1}
                            </span>
                            <span
                              className={`text-xs ${taskStatusConfig[task.status].color}`}
                            >
                              {taskStatusConfig[task.status].label}
                            </span>
                          </div>
                          <Eye className="size-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          Input: {JSON.stringify(task.input).slice(0, 100)}...
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Task Output Dialog */}
      <Dialog
        open={!!selectedTaskOutput}
        onOpenChange={(open) => {
          if (!open) setSelectedTaskOutput(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Task Result</DialogTitle>
          </DialogHeader>

          {selectedTaskOutput && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Input</Label>
                <pre className="mt-2 p-3 rounded-lg bg-muted text-xs overflow-auto max-h-[100px]">
                  {JSON.stringify(selectedTaskOutput.input, null, 2)}
                </pre>
              </div>

              {selectedTaskOutput.output && (
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Output</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyOutput(selectedTaskOutput.output!)}
                    >
                      <Copy className="size-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <ScrollArea className="h-[300px] mt-2">
                    <pre className="p-3 rounded-lg bg-muted text-xs whitespace-pre-wrap">
                      {selectedTaskOutput.output}
                    </pre>
                  </ScrollArea>
                </div>
              )}

              {selectedTaskOutput.error && (
                <div>
                  <Label className="text-sm font-medium text-destructive">
                    Error
                  </Label>
                  <pre className="mt-2 p-3 rounded-lg bg-destructive/10 text-xs text-destructive overflow-auto">
                    {selectedTaskOutput.error}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
