"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  useSuspenseMemories,
  useSetMemory,
  useDeleteMemory,
} from "../hooks/use-agents";
import {
  Brain,
  Plus,
  Trash,
  CircleNotch,
  PencilSimple,
} from "@phosphor-icons/react";
import { formatDistanceToNow } from "date-fns";
import { MemoryCategory } from "@/generated/prisma";

interface AgentMemoryProps {
  agentId: string;
}

const categoryLabels: Record<MemoryCategory, string> = {
  GENERAL: "General",
  PREFERENCE: "Preference",
  CONTEXT: "Context",
  HISTORY: "History",
  INSTRUCTION: "Instruction",
};

const categoryColors: Record<MemoryCategory, string> = {
  GENERAL: "bg-gray-100 text-gray-800",
  PREFERENCE: "bg-blue-100 text-blue-800",
  CONTEXT: "bg-purple-100 text-purple-800",
  HISTORY: "bg-green-100 text-green-800",
  INSTRUCTION: "bg-orange-100 text-orange-800",
};

export function AgentMemory({ agentId }: AgentMemoryProps) {
  const memories = useSuspenseMemories(agentId);
  const setMemory = useSetMemory();
  const deleteMemory = useDeleteMemory();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<{
    key: string;
    value: string;
    category: MemoryCategory;
  } | null>(null);

  const [formData, setFormData] = useState({
    key: "",
    value: "",
    category: "GENERAL" as MemoryCategory,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMemory.mutate(
      {
        agentId,
        key: formData.key,
        value: formData.value,
        category: formData.category,
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setFormData({ key: "", value: "", category: "GENERAL" });
          setEditingMemory(null);
        },
      }
    );
  };

  const handleEdit = (memory: {
    key: string;
    value: string;
    category: MemoryCategory;
  }) => {
    setEditingMemory(memory);
    setFormData({
      key: memory.key,
      value: memory.value,
      category: memory.category,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this memory?")) {
      deleteMemory.mutate({ id });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="size-5" />
            Agent Memory
          </CardTitle>
          <Badge variant="outline">Editable by Agent</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Information the agent remembers across conversations. The agent can add, update, or delete memories.
        </p>
        <div className="pt-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              onClick={() => {
                setEditingMemory(null);
                setFormData({ key: "", value: "", category: "GENERAL" });
              }}
            >
              <Plus className="size-4 mr-2" />
              Add Memory
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingMemory ? "Edit Memory" : "Add New Memory"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key">Key</Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) =>
                    setFormData({ ...formData, key: e.target.value })
                  }
                  placeholder="e.g., user_name, preferred_language"
                  disabled={!!editingMemory}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Value</Label>
                <Textarea
                  id="value"
                  value={formData.value}
                  onChange={(e) =>
                    setFormData({ ...formData, value: e.target.value })
                  }
                  placeholder="The information to remember..."
                  rows={4}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: MemoryCategory) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={setMemory.isPending}>
                  {setMemory.isPending && (
                    <CircleNotch className="size-4 mr-2 animate-spin" />
                  )}
                  {editingMemory ? "Update" : "Save"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {memories.data.length === 0 ? (
          <div className="text-center py-8">
            <Brain className="size-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No memories stored yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add memories to give your agent persistent knowledge.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {memories.data.map((memory) => (
                <div
                  key={memory.id}
                  className="p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm font-semibold bg-muted px-2 py-0.5 rounded">
                          {memory.key}
                        </code>
                        <Badge
                          variant="secondary"
                          className={categoryColors[memory.category]}
                        >
                          {categoryLabels[memory.category]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {memory.value}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Updated{" "}
                        {formatDistanceToNow(memory.updatedAt, {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          handleEdit({
                            key: memory.key,
                            value: memory.value,
                            category: memory.category,
                          })
                        }
                      >
                        <PencilSimple className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(memory.id)}
                        disabled={deleteMemory.isPending}
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
  );
}
