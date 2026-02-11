"use client";

import { ChatHeader } from "@/features/agents/components/chat-header";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <ChatHeader />
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
