"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSuspenseTemplates, useCreateFromTemplate } from "../hooks/use-agents";
import { CircleNotch, Sparkle, Plus } from "@phosphor-icons/react";
import { TemplateCategory } from "@/generated/prisma";
import { useRouter } from "next/navigation";

const categoryLabels: Record<TemplateCategory, string> = {
  PRODUCTIVITY: "Productivity",
  SALES: "Sales",
  MARKETING: "Marketing",
  SUPPORT: "Support",
  RESEARCH: "Research",
  CREATIVE: "Creative",
  OPERATIONS: "Operations",
  CUSTOM: "Custom",
};

const categoryColors: Record<TemplateCategory, string> = {
  PRODUCTIVITY: "bg-blue-100 text-blue-800",
  SALES: "bg-green-100 text-green-800",
  MARKETING: "bg-amber-100 text-amber-800",
  SUPPORT: "bg-purple-100 text-purple-800",
  RESEARCH: "bg-orange-100 text-orange-800",
  CREATIVE: "bg-pink-100 text-pink-800",
  OPERATIONS: "bg-cyan-100 text-cyan-800",
  CUSTOM: "bg-gray-100 text-gray-800",
};

interface AgentTemplatesProps {
  onCreated?: () => void;
}

export function AgentTemplates({ onCreated }: AgentTemplatesProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [agentName, setAgentName] = useState("");

  const templates = useSuspenseTemplates(
    selectedCategory === "all" ? undefined : selectedCategory
  );
  const createFromTemplate = useCreateFromTemplate();

  const handleCreate = () => {
    if (!selectedTemplate) return;

    createFromTemplate.mutate(
      {
        templateId: selectedTemplate.id,
        name: agentName || undefined,
      },
      {
        onSuccess: (data) => {
          setSelectedTemplate(null);
          setAgentName("");
          onCreated?.();
          router.push(`/agents/${data.id}`);
        },
      }
    );
  };

  const categories = ["all", ...Object.keys(categoryLabels)] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkle className="size-6" />
            Agent Templates
          </h2>
          <p className="text-muted-foreground mt-1">
            Get started quickly with pre-configured agents
          </p>
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.data.map((template) => (
            <Card
              key={template.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{template.icon}</span>
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <Badge
                        variant="secondary"
                        className={`mt-1 ${categoryColors[template.category]}`}
                      >
                        {categoryLabels[template.category]}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {template.subtitle || template.description}
                </p>
                {Array.isArray(template.suggestedTools) &&
                  template.suggestedTools.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {(template.suggestedTools as string[])
                        .slice(0, 3)
                        .map((tool) => (
                          <Badge
                            key={tool}
                            variant="outline"
                            className="text-xs"
                          >
                            {tool}
                          </Badge>
                        ))}
                      {template.suggestedTools.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{template.suggestedTools.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                <Dialog
                  open={selectedTemplate?.id === template.id}
                  onOpenChange={(open) =>
                    open
                      ? setSelectedTemplate({ id: template.id, name: template.name })
                      : setSelectedTemplate(null)
                  }
                >
                  <DialogTrigger asChild>
                    <Button className="w-full" size="sm">
                      <Plus className="size-4 mr-2" />
                      Use Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Agent from Template</DialogTitle>
                      <DialogDescription>
                        Create a new agent based on the "{template.name}" template.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Agent Name (optional)</Label>
                        <Input
                          id="name"
                          value={agentName}
                          onChange={(e) => setAgentName(e.target.value)}
                          placeholder={template.name}
                        />
                        <p className="text-xs text-muted-foreground">
                          Leave blank to use the template name
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted p-4">
                        <h4 className="font-medium mb-2">Template includes:</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Pre-configured system prompt</li>
                          <li>• Optimized temperature setting</li>
                          {Array.isArray(template.suggestedTools) &&
                            template.suggestedTools.length > 0 && (
                              <li>
                                • Suggested tools:{" "}
                                {(template.suggestedTools as string[]).join(
                                  ", "
                                )}
                              </li>
                            )}
                        </ul>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setSelectedTemplate(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreate}
                        disabled={createFromTemplate.isPending}
                      >
                        {createFromTemplate.isPending && (
                          <CircleNotch className="size-4 mr-2 animate-spin" />
                        )}
                        Create Agent
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
