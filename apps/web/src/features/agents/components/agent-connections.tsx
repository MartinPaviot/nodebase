"use client";

import { useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useSuspenseConnections,
  useSuspenseAvailableAgents,
  useCreateConnection,
  useUpdateConnection,
  useDeleteConnection,
} from "../hooks/use-agents";
import {
  Users,
  Plus,
  Trash,
  CircleNotch,
  Robot,
  Link,
} from "@phosphor-icons/react";

interface AgentConnectionsProps {
  agentId: string;
}

function AvailableAgentsList({
  agentId,
  onSelect,
}: {
  agentId: string;
  onSelect: (agent: { id: string; name: string }) => void;
}) {
  const availableAgents = useSuspenseAvailableAgents(agentId);

  if (availableAgents.data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No other agents available. Create more agents to connect them.
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-[200px] overflow-y-auto">
      {availableAgents.data.map((agent) => (
        <button
          key={agent.id}
          type="button"
          onClick={() => onSelect({ id: agent.id, name: agent.name })}
          className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
        >
          <Avatar className="size-10">
            {agent.avatar ? <AvatarImage src={agent.avatar} /> : null}
            <AvatarFallback>
              <Robot className="size-5" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{agent.name}</p>
            {agent.description && (
              <p className="text-xs text-muted-foreground truncate">
                {agent.description}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

export function AgentConnections({ agentId }: AgentConnectionsProps) {
  const connections = useSuspenseConnections(agentId);
  const createConnection = useCreateConnection();
  const updateConnection = useUpdateConnection();
  const deleteConnection = useDeleteConnection();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    alias: "",
    description: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) return;

    createConnection.mutate(
      {
        sourceAgentId: agentId,
        targetAgentId: selectedAgent.id,
        alias: formData.alias,
        description: formData.description,
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setSelectedAgent(null);
          setFormData({ alias: "", description: "" });
        },
      }
    );
  };

  const handleToggle = (connectionId: string, enabled: boolean) => {
    updateConnection.mutate({ id: connectionId, enabled });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to remove this connection?")) {
      deleteConnection.mutate({ id });
    }
  };

  const generateAlias = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 50);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="size-5" />
          Connected Agents
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              onClick={() => {
                setSelectedAgent(null);
                setFormData({ alias: "", description: "" });
              }}
            >
              <Plus className="size-4 mr-2" />
              Connect Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Connect to Another Agent</DialogTitle>
              <DialogDescription>
                Allow this agent to communicate with another agent you own.
              </DialogDescription>
            </DialogHeader>
            {!selectedAgent ? (
              <div className="py-4">
                <Label className="mb-3 block">Select an agent to connect</Label>
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center py-8">
                      <CircleNotch className="size-6 animate-spin text-muted-foreground" />
                    </div>
                  }
                >
                  <AvailableAgentsList
                    agentId={agentId}
                    onSelect={(agent) => {
                      setSelectedAgent(agent);
                      setFormData({
                        alias: generateAlias(agent.name),
                        description: `Ask ${agent.name} for help with tasks they specialize in.`,
                      });
                    }}
                  />
                </Suspense>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Avatar className="size-10">
                    <AvatarFallback>
                      <Robot className="size-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedAgent.name}</p>
                    <button
                      type="button"
                      onClick={() => setSelectedAgent(null)}
                      className="text-xs text-primary hover:underline"
                    >
                      Change selection
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alias">Tool Alias</Label>
                  <Input
                    id="alias"
                    value={formData.alias}
                    onChange={(e) =>
                      setFormData({ ...formData, alias: e.target.value })
                    }
                    placeholder="e.g., research_assistant"
                    pattern="^[a-z][a-z0-9_]*$"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    The name this agent will use to call the other agent.
                    Lowercase letters, numbers, and underscores only.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Describe when to use this connection..."
                    rows={3}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    This description helps the AI understand when to call this
                    agent.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createConnection.isPending}>
                    {createConnection.isPending && (
                      <CircleNotch className="size-4 mr-2 animate-spin" />
                    )}
                    Connect
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {connections.data.length === 0 ? (
          <div className="text-center py-8">
            <Link className="size-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No connected agents yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Connect this agent to others to enable multi-agent collaboration.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {connections.data.map((connection) => (
                <div
                  key={connection.id}
                  className="p-4 rounded-lg border hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Avatar className="size-10 mt-0.5">
                        {connection.targetAgent.avatar ? (
                          <AvatarImage src={connection.targetAgent.avatar} />
                        ) : null}
                        <AvatarFallback>
                          <Robot className="size-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">
                            {connection.targetAgent.name}
                          </span>
                          <Badge
                            variant={connection.enabled ? "default" : "secondary"}
                          >
                            {connection.enabled ? "Active" : "Disabled"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          Tool alias:{" "}
                          <code className="bg-muted px-1 rounded">
                            talk_to_{connection.alias}
                          </code>
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {connection.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={connection.enabled}
                        onCheckedChange={(checked) =>
                          handleToggle(connection.id, checked)
                        }
                        disabled={updateConnection.isPending}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDelete(connection.id)}
                        disabled={deleteConnection.isPending}
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

        {connections.data.length > 0 && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>How it works:</strong> When this agent needs help from a
              connected agent, it can use the{" "}
              <code className="bg-muted px-1 rounded">talk_to_[alias]</code>{" "}
              tool. The connected agent will receive the message and respond.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
