"use client";

import { useRouter } from "next/navigation";
import {
  useSuspenseAgent,
  useSuspenseConversations,
  useCreateConversation,
} from "../hooks/use-agents";
import { ConversationSidebar } from "./conversation-sidebar";

interface ChatLayoutProps {
  agentId: string;
  children: React.ReactNode;
}

export function ChatLayout({ agentId, children }: ChatLayoutProps) {
  const router = useRouter();
  const agent = useSuspenseAgent(agentId);
  const conversations = useSuspenseConversations(agentId);
  const createConversation = useCreateConversation();

  const handleNewConversation = () => {
    createConversation.mutate(
      { agentId },
      {
        onSuccess: (conversation) => {
          router.push(`/agents/${agentId}/chat/${conversation.id}`);
        },
      }
    );
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Conversation Sidebar */}
      <ConversationSidebar
        agentId={agentId}
        agentName={agent.data.name}
        agentIcon={agent.data.avatar || undefined}
        conversations={conversations.data.items}
        onNewConversation={handleNewConversation}
        isCreating={createConversation.isPending}
      />

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">{children}</div>
    </div>
  );
}
