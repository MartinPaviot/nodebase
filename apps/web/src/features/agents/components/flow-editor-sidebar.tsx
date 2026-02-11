"use client";

import { useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DotsThree,
  MagicWand,
  X,
  Paperclip,
  Microphone,
  PaperPlaneTilt,
  CircleNotch,
  Sparkle,
  Chats,
  Plus,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface Conversation {
  id: string;
  title: string | null;
  createdAt: Date;
  messages: { createdAt: Date }[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface FlowEditorSidebarProps {
  agentId: string;
  conversations: Conversation[];
  messages: Message[];
  input: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  onNewConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
}

export function FlowEditorSidebar({
  agentId,
  conversations,
  messages,
  input,
  isLoading,
  onInputChange,
  onSubmit,
  onClose,
  onNewConversation,
  onSelectConversation,
}: FlowEditorSidebarProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSubmit();
  };

  return (
    <div className="w-80 flex flex-col h-full p-3 pr-0">
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-[#e5e7eb]/50 overflow-hidden">
        {/* Header */}
        <div className="h-10 flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <div className="size-5 rounded-md bg-gradient-to-br from-indigo-400 to-blue-600 flex items-center justify-center">
              <Sparkle className="size-3 text-white" weight="fill" />
            </div>
            <span className="font-medium text-[13px] text-[#1a1a1a]">Agent builder</span>
          </div>
          <div className="flex items-center gap-0.5">
            <button className="size-6 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#6B7280] hover:bg-black/5 transition-colors">
              <DotsThree className="size-3.5" weight="bold" />
            </button>
            <button className="size-6 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#6B7280] hover:bg-black/5 transition-colors">
              <MagicWand className="size-3.5" />
            </button>
            <button
              onClick={onClose}
              className="size-6 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#6B7280] hover:bg-black/5 transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Conversations History or Chat */}
        <div className="flex-1 flex flex-col">
          {messages.length === 0 ? (
            // Show centered empty state
            <div className="flex-1 flex flex-col items-center justify-center px-6">
              {/* Animated workflow icon */}
              <div className="relative mb-4">
                <div className="w-16 h-12 relative">
                  {/* Top node */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-4 bg-indigo-50 rounded border border-indigo-200/60 flex items-center justify-center animate-pulse shadow-sm">
                    <Plus className="size-2 text-indigo-400" />
                  </div>
                  {/* Connection line */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-px h-3 bg-gradient-to-b from-indigo-300 to-indigo-200" />
                  {/* Bottom node */}
                  <div
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-4 bg-indigo-50 rounded border border-indigo-200/60 flex items-center justify-center animate-pulse shadow-sm"
                    style={{ animationDelay: "0.5s" }}
                  >
                    <Plus className="size-2 text-indigo-400" />
                  </div>
                </div>
              </div>

              <h3 className="font-medium text-[#1a1a1a] text-[14px] mb-0.5 text-center">
                Ask Agent Builder
              </h3>
              <p className="text-[12px] text-[#9CA3AF] text-center">
                Create or edit the workflow.
              </p>
            </div>
          ) : (
            // Show chat messages
            <ScrollArea className="flex-1">
              <div className="py-4 px-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "text-[13px] leading-relaxed",
                      message.role === "user" ? "text-right" : "text-left"
                    )}
                  >
                    <div
                      className={cn(
                        "inline-block max-w-[90%] px-3.5 py-2.5 rounded-2xl",
                        message.role === "user"
                          ? "bg-[#374151] text-white"
                          : "bg-[#F9FAFB] text-[#374151]"
                      )}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
                    <CircleNotch className="size-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Input */}
        <div className="p-2.5 pt-1.5">
          <form onSubmit={handleSubmit}>
            <div className="flex items-end gap-1 bg-[#F9FAFB] rounded-lg px-1.5 py-1">
              <button
                type="button"
                className="size-6 rounded flex items-center justify-center text-[#9CA3AF] hover:text-[#6B7280] transition-colors shrink-0"
              >
                <Paperclip className="size-3.5" />
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="Describe what you want..."
                rows={1}
                className="flex-1 bg-transparent resize-none outline-none text-[12px] min-h-[20px] max-h-20 text-[#374151] placeholder:text-[#9CA3AF]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <button
                type="button"
                className="size-6 rounded flex items-center justify-center text-[#9CA3AF] hover:text-[#6B7280] transition-colors shrink-0"
              >
                <Microphone className="size-3.5" />
              </button>
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={cn(
                  "size-6 rounded flex items-center justify-center shrink-0 transition-colors",
                  !input.trim() || isLoading
                    ? "text-[#9CA3AF]"
                    : "text-[#6366F1] hover:text-[#4F46E5]"
                )}
              >
                {isLoading ? (
                  <CircleNotch className="size-3.5 animate-spin" />
                ) : (
                  <PaperPlaneTilt className="size-3.5" weight="fill" />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
