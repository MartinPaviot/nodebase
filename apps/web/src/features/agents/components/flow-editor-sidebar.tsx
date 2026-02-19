"use client";

import { useRef, useEffect, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DotsThree,
  MagicWand,
  X,
  PaperPlaneTilt,
  CircleNotch,
  Sparkle,
  Plus,
  Wrench,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { VoiceInputButton } from "@/components/ui/voice-input-button";
import { useVoiceInput } from "@/hooks/use-voice-input";

// Human-readable labels for builder tool calls
const TOOL_LABELS: Record<string, string> = {
  get_flow_state: "Reading flow...",
  add_node: "Adding node...",
  delete_node: "Removing node...",
  update_node: "Updating node...",
  connect_nodes: "Connecting nodes...",
  add_condition: "Adding condition...",
  replace_node: "Replacing node...",
  get_node_details: "Inspecting node...",
  check_integrations: "Checking integrations...",
  configure_trigger: "Setting up trigger...",
  get_recent_traces: "Loading traces...",
  get_trace_detail: "Loading trace detail...",
  get_agent_metrics: "Loading metrics...",
  suggest_optimizations: "Analyzing performance...",
};

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
  isFlowEmpty?: boolean;
  streamingToolName?: string | null;
  connectedIntegrations?: string[];
  onInputChange: (value: string) => void;
  onSubmit: (promptOverride?: string) => void;
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
  isFlowEmpty = true,
  streamingToolName,
  connectedIntegrations = [],
  onInputChange,
  onSubmit,
  onClose,
  onNewConversation,
  onSelectConversation,
}: FlowEditorSidebarProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const baseTextRef = useRef("");

  const { isListening, isTranscribing, startListening } = useVoiceInput({
    onTranscriptChange: (text) => onInputChange(text),
    onListeningEnd: () => { baseTextRef.current = input; },
    baseText: baseTextRef.current,
  });

  const handleMicClick = () => {
    baseTextRef.current = input;
    startListening();
  };

  // Auto-scroll to bottom when messages change or during streaming
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, streamingToolName]);

  // Auto-resize textarea when input changes (covers voice input + typing)
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
    }
  }, [input]);

  // Build contextual suggestions based on connected integrations
  const suggestions = useMemo(() => {
    const items: { text: string; prompt: string }[] = [];

    // Always-available suggestions
    items.push({
      text: "Answer customer questions with my knowledge base",
      prompt: "Build a workflow that receives a message, searches my knowledge base for relevant information, and replies with a helpful answer.",
    });

    // Integration-specific suggestions
    if (connectedIntegrations.includes("GMAIL")) {
      items.push({
        text: "Summarize my important emails every morning",
        prompt: "Build a workflow that fetches my recent important emails via Gmail, summarizes them with AI, and sends me a digest.",
      });
    }
    if (connectedIntegrations.includes("SLACK")) {
      items.push({
        text: "Monitor Slack and alert me on urgent messages",
        prompt: "Build a workflow that monitors Slack messages, detects urgent ones using AI, and sends me a notification.",
      });
    }
    if (connectedIntegrations.includes("GOOGLE_SHEETS")) {
      items.push({
        text: "Analyze data from my Google Sheets",
        prompt: "Build a workflow that reads data from Google Sheets, analyzes it with AI, and generates insights.",
      });
    }
    if (connectedIntegrations.includes("NOTION")) {
      items.push({
        text: "Auto-organize my Notion pages",
        prompt: "Build a workflow that reads my Notion pages, categorizes them with AI, and updates their properties.",
      });
    }

    // Generic high-value suggestions
    items.push({
      text: "Enrich incoming leads with public data",
      prompt: "Build a workflow that receives a lead's name and company, enriches it with PeopleDataLabs to find contact info and company details, and stores the results.",
    });

    return items.slice(0, 4); // Show max 4 suggestions
  }, [connectedIntegrations]);

  const handleSuggestionClick = (prompt: string) => {
    onSubmit(prompt);
  };

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
        <div className="flex-1 flex flex-col min-h-0">
          {messages.length === 0 ? (
            // Show empty state — suggestions only when flow is also empty
            <div className="flex-1 flex flex-col px-4 pt-6">
              {/* Animated workflow icon */}
              <div className="flex flex-col items-center mb-5">
                <div className="relative mb-3">
                  <div className="w-16 h-12 relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-4 bg-indigo-50 rounded border border-indigo-200/60 flex items-center justify-center animate-pulse shadow-sm">
                      <Plus className="size-2 text-indigo-400" />
                    </div>
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-px h-3 bg-gradient-to-b from-indigo-300 to-indigo-200" />
                    <div
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-4 bg-indigo-50 rounded border border-indigo-200/60 flex items-center justify-center animate-pulse shadow-sm"
                      style={{ animationDelay: "0.5s" }}
                    >
                      <Plus className="size-2 text-indigo-400" />
                    </div>
                  </div>
                </div>
                <h3 className="font-medium text-[#1a1a1a] text-[14px] mb-0.5 text-center">
                  Describe your workflow
                </h3>
                <p className="text-[12px] text-[#9CA3AF] text-center">
                  Tell me what you need, I'll build it for you.
                </p>
              </div>

              {/* Contextual suggestions — only when flow is empty */}
              {isFlowEmpty && (
                <div className="space-y-2">
                  <p className="text-[11px] text-[#9CA3AF] uppercase tracking-wider font-medium px-1">
                    Try these
                  </p>
                  {suggestions.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(suggestion.prompt)}
                      disabled={isLoading}
                      className="w-full text-left px-3 py-2.5 rounded-xl border border-[#E5E7EB] hover:border-indigo-200 hover:bg-indigo-50/50 transition-all text-[12px] text-[#374151] leading-relaxed group"
                    >
                      <span className="group-hover:text-indigo-700 transition-colors">
                        {suggestion.text}
                      </span>
                    </button>
                  ))}
                </div>
              )}
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
                    {message.role === "user" ? (
                      <div className="inline-block max-w-[90%] px-3.5 py-2.5 rounded-2xl bg-[#374151] text-white">
                        {message.content}
                      </div>
                    ) : (
                      <div className="max-w-[95%] px-3 py-2 rounded-2xl bg-[#F9FAFB] text-[#374151]">
                        {message.content ? (
                          <MarkdownRenderer
                            content={message.content}
                            className="text-[13px] leading-relaxed"
                          />
                        ) : (
                          <div className="flex items-center gap-2 text-[#9CA3AF] py-1">
                            <CircleNotch className="size-3.5 animate-spin" />
                            <span className="text-[12px]">Thinking...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Tool call indicator */}
                {isLoading && streamingToolName && (
                  <div className="flex items-center gap-2 py-1.5 px-3 rounded-xl bg-indigo-50/80 border border-indigo-100">
                    <Wrench className="size-3.5 text-indigo-500 animate-pulse" />
                    <span className="text-[12px] text-indigo-600 font-medium">
                      {TOOL_LABELS[streamingToolName] ?? streamingToolName}
                    </span>
                  </div>
                )}

                {/* Typing indicator when loading with no tool active */}
                {isLoading && !streamingToolName && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
                    <CircleNotch className="size-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                )}

                {/* Scroll anchor */}
                <div ref={scrollEndRef} />
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Input */}
        <div className="p-2.5 pt-1.5">
          <form onSubmit={handleSubmit}>
            <div className="flex items-end gap-1.5 bg-[#F9FAFB] rounded-xl px-3 py-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="Describe what you want..."
                rows={1}
                className="flex-1 bg-transparent resize-none overflow-hidden outline-none text-[12px] min-h-[20px] max-h-32 text-[#374151] placeholder:text-[#9CA3AF] leading-relaxed"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <VoiceInputButton
                isListening={isListening}
                isTranscribing={isTranscribing}
                onClick={handleMicClick}
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={cn(
                  "size-7 rounded-lg flex items-center justify-center shrink-0 transition-all",
                  !input.trim() || isLoading
                    ? "text-[#9CA3AF]"
                    : "text-white bg-indigo-500 hover:bg-indigo-600 shadow-sm"
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
