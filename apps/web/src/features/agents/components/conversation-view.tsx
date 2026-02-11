"use client";

import { ChatInterface } from "./chat-interface";
import { useSuspenseConversation } from "../hooks/use-agents";

interface ConversationViewProps {
  conversationId: string;
}

export function ConversationView({ conversationId }: ConversationViewProps) {
  const conversation = useSuspenseConversation(conversationId);

  return (
    <ChatInterface
      conversationId={conversationId}
      agentName={conversation.data.agent.name}
      agentAvatar={conversation.data.agent.avatar}
      initialMessages={conversation.data.messages}
    />
  );
}
