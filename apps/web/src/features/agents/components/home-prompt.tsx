"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  PaperPlaneTilt,
  CircleNotch,
  Sparkle,
  Paperclip,
  Microphone,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useCreateAgentFromPrompt } from "../hooks/use-agents";

export function HomePrompt() {
  const router = useRouter();
  const createAgent = useCreateAgentFromPrompt();
  const [prompt, setPrompt] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || createAgent.isPending) return;

    createAgent.mutate(
      { prompt: prompt.trim(), capabilities: [] },
      {
        onSuccess: (agent) => {
          router.push(`/agents/${agent.id}`);
        },
      }
    );
  };

  const isLoading = createAgent.isPending;

  return (
    <form onSubmit={handleSubmit}>
      <div className="relative bg-card rounded-2xl border-2 border-border shadow-lg hover:shadow-xl transition-shadow focus-within:border-primary/50 focus-within:shadow-xl">
        {/* Input area */}
        <div className="flex items-center p-4">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Build an agent or perform a task"
            disabled={isLoading}
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground disabled:opacity-50"
          />
        </div>

        {/* Bottom bar with actions */}
        <div className="flex items-center justify-between px-4 pb-4">
          <div className="flex items-center gap-1">
            {/* Build apps button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full h-8 text-xs gap-1.5"
              onClick={() => setPrompt("Build an app that ")}
            >
              <Sparkle className="size-3.5" />
              Build apps
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {/* Attachment */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-full text-muted-foreground hover:text-foreground"
              disabled={isLoading}
            >
              <Paperclip className="size-4" />
            </Button>

            {/* Voice */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-full text-muted-foreground hover:text-foreground"
              disabled={isLoading}
            >
              <Microphone className="size-4" />
            </Button>

            {/* Submit */}
            <Button
              type="submit"
              size="icon"
              className="size-9 rounded-full"
              disabled={isLoading || !prompt.trim()}
            >
              {isLoading ? (
                <CircleNotch className="size-4 animate-spin" />
              ) : (
                <PaperPlaneTilt className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
