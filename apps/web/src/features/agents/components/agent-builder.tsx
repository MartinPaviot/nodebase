"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CircleNotch, Sparkle, MagicWand, Check, PencilSimple } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useCreateAgent } from "../hooks/use-agents";

interface GeneratedConfig {
  name: string;
  description: string;
  systemPrompt: string;
  temperature: number;
  suggestedCategory: string;
}

export function AgentBuilder() {
  const router = useRouter();
  const createAgent = useCreateAgent();
  const [step, setStep] = useState<"describe" | "review" | "creating">("describe");
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [config, setConfig] = useState<GeneratedConfig | null>(null);
  const [editMode, setEditMode] = useState(false);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setIsGenerating(true);

    try {
      const response = await fetch("/api/agents/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let text = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value);
      }

      // Parse the JSON from the stream
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setConfig(parsed);
        setStep("review");
      }
    } catch (error) {
      console.error("Failed to generate:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreate = () => {
    if (!config) return;
    setStep("creating");

    createAgent.mutate(
      {
        name: config.name,
        description: config.description,
        systemPrompt: config.systemPrompt,
        temperature: config.temperature,
        model: "ANTHROPIC",
      },
      {
        onSuccess: (agent) => {
          router.push(`/agents/${agent.id}`);
        },
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      {step === "describe" && (
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <MagicWand className="size-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Describe your AI agent</h2>
            <p className="text-muted-foreground text-sm">
              Tell us what you want your agent to do. Be as specific as possible.
            </p>
          </div>

          {/* Input */}
          <div className="space-y-4">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Example: Create a customer support agent that handles refund requests, answers product questions, and escalates complex issues..."
              rows={5}
              className="resize-none text-base bg-card border-2 focus:border-primary/50 transition-colors"
            />

            {/* Quick suggestions */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
                Quick ideas
              </Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Meeting scheduler", emoji: "📅" },
                  { label: "Email assistant", emoji: "📧" },
                  { label: "Lead qualifier", emoji: "🎯" },
                  { label: "Research assistant", emoji: "🔍" },
                  { label: "Content writer", emoji: "✍️" },
                ].map((example) => (
                  <Button
                    key={example.label}
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setDescription(`Create a ${example.label.toLowerCase()} that helps me manage my daily tasks efficiently.`)}
                  >
                    <span className="mr-1.5">{example.emoji}</span>
                    {example.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={!description.trim() || isGenerating}
            size="lg"
            className="w-full h-12 text-base"
          >
            {isGenerating ? (
              <>
                <CircleNotch className="size-5 mr-2 animate-spin" />
                Generating your agent...
              </>
            ) : (
              <>
                <Sparkle className="size-5 mr-2" />
                Generate Agent
              </>
            )}
          </Button>
        </div>
      )}

      {step === "review" && config && (
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="size-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Check className="size-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Review your agent</h2>
            <p className="text-muted-foreground text-sm">
              Make sure everything looks good before creating.
            </p>
          </div>

          <Card className="border-2">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Configuration</h3>
                <Button variant="ghost" size="sm" onClick={() => setEditMode(!editMode)}>
                  <PencilSimple className="size-4 mr-1" />
                  {editMode ? "Done" : "Edit"}
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Name</Label>
                  {editMode ? (
                    <Input
                      value={config.name}
                      onChange={(e) => setConfig({ ...config, name: e.target.value })}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-base font-medium mt-1">{config.name}</p>
                  )}
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Description</Label>
                  {editMode ? (
                    <Input
                      value={config.description}
                      onChange={(e) => setConfig({ ...config, description: e.target.value })}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
                  )}
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">System Prompt</Label>
                  {editMode ? (
                    <Textarea
                      value={config.systemPrompt}
                      onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                      rows={8}
                      className="mt-1"
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap bg-muted/50 p-4 rounded-xl max-h-48 overflow-auto border">
                      {config.systemPrompt}
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Temperature: {config.temperature}
                  </Label>
                  {editMode && (
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={config.temperature}
                      onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                      className="w-full mt-2"
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("describe")} className="flex-1 h-12">
              Back
            </Button>
            <Button onClick={handleCreate} className="flex-1 h-12">
              <Check className="size-4 mr-2" />
              Create Agent
            </Button>
          </div>
        </div>
      )}

      {step === "creating" && (
        <div className="text-center py-16">
          <CircleNotch className="size-10 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg font-medium">Creating your agent...</p>
          <p className="text-sm text-muted-foreground mt-1">This will only take a moment</p>
        </div>
      )}
    </div>
  );
}
