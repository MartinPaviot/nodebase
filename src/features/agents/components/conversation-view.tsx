"use client";

import { ChatInterface } from "./chat-interface";
import { useSuspenseConversation } from "../hooks/use-agents";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

interface ConversationViewProps {
  conversationId: string;
}

export function ConversationView({ conversationId }: ConversationViewProps) {
  const conversation = useSuspenseConversation(conversationId);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={`/agents/${conversation.data.agentId}`}>
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-medium">
            {conversation.data.title || "New conversation"}
          </h1>
          <p className="text-sm text-muted-foreground">
            with {conversation.data.agent.name}
          </p>
        </div>
      </div>

      {/* Chat Interface */}
      <ChatInterface
        conversationId={conversationId}
        agentName={conversation.data.agent.name}
        agentAvatar={conversation.data.agent.avatar}
        initialMessages={conversation.data.messages}
      />
    </div>
  );
}
