"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { ChatHeader } from "@/features/agents/components/chat-header";
import { BuilderChat } from "@/features/agents/components/builder-chat";
import { Suspense } from "react";
import { CircleNotch } from "@phosphor-icons/react";

function BuilderContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialPrompt = searchParams.get("prompt") || undefined;

  const handleAgentCreated = (agentId: string, agentName: string) => {
    // Optionally navigate to the agent's flow editor after creation
    // For now, we let the user click "Go to Agent" in the chat
    console.log("Agent created:", agentId, agentName);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <ChatHeader />
      <div className="flex-1 overflow-hidden">
        <BuilderChat
          initialPrompt={initialPrompt}
          onAgentCreated={handleAgentCreated}
        />
      </div>
    </div>
  );
}

export default function AgentBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <CircleNotch className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <BuilderContent />
    </Suspense>
  );
}
