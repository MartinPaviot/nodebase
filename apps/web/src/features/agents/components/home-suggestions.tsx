"use client";

import { Button } from "@/components/ui/button";
import {
  Globe,
  Envelope,
  Phone,
  Crosshair,
  Calendar,
  LinkedinLogo,
  Headset,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useCreateAgentFromPrompt } from "../hooks/use-agents";

const suggestions = [
  {
    label: "Personal website",
    icon: Globe,
    color: "text-emerald-600 bg-emerald-100",
    prompt: "Create a personal website assistant that helps me manage my portfolio and blog content",
  },
  {
    label: "Customer support email",
    icon: Envelope,
    color: "text-indigo-600 bg-indigo-100",
    prompt: "Create a customer support email agent that handles inquiries, refunds, and escalates complex issues",
  },
  {
    label: "Outbound sales calls",
    icon: Phone,
    color: "text-cyan-600 bg-cyan-100",
    prompt: "Create an outbound sales agent that qualifies leads and schedules demos",
  },
  {
    label: "Lead gen",
    icon: Crosshair,
    color: "text-emerald-600 bg-emerald-100",
    prompt: "Create a lead generation agent that researches and qualifies potential customers",
  },
  {
    label: "Meeting recorder",
    icon: Calendar,
    color: "text-violet-600 bg-violet-100",
    prompt: "Create a meeting recorder agent that transcribes meetings and extracts action items",
  },
  {
    label: "LinkedIn outreach",
    icon: LinkedinLogo,
    color: "text-emerald-600 bg-emerald-100",
    prompt: "Create a LinkedIn outreach agent that sends personalized connection requests and follow-ups",
  },
  {
    label: "Support chatbot",
    icon: Headset,
    color: "text-pink-600 bg-pink-100",
    prompt: "Create a support chatbot that answers FAQs and helps customers troubleshoot issues",
  },
];

export function HomeSuggestions() {
  const router = useRouter();
  const createAgent = useCreateAgentFromPrompt();

  const handleSuggestionClick = (prompt: string) => {
    createAgent.mutate(
      { prompt, capabilities: [] },
      {
        onSuccess: (agent) => {
          router.push(`/agents/${agent.id}`);
        },
      }
    );
  };

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {suggestions.map((suggestion) => (
        <Button
          key={suggestion.label}
          variant="outline"
          size="sm"
          className="rounded-full h-9 gap-2 bg-card hover:bg-accent"
          onClick={() => handleSuggestionClick(suggestion.prompt)}
          disabled={createAgent.isPending}
        >
          <span className={`size-5 rounded-full flex items-center justify-center ${suggestion.color}`}>
            <suggestion.icon className="size-3" />
          </span>
          {suggestion.label}
        </Button>
      ))}
    </div>
  );
}
