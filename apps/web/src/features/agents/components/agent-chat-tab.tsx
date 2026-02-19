"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { ChatInterface } from "./chat-interface";
import { getAgentConfig } from "./flow-editor-header";
import type { FlowExecutionState } from "./flow-editor-canvas";
import { getNodeIconConfig } from "@/features/agents/lib/node-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icon } from "@iconify/react";
import {
  MagnifyingGlass,
  Plus,
  ChatCircle,
  CircleNotch,
  ArrowsClockwise,
  Chats,
  Robot,
  GitBranch,
  Sparkle,
} from "@phosphor-icons/react";
import { isToday, isYesterday, format } from "date-fns";
import { cn } from "@/lib/utils";
import { useConversations, useCreateConversation } from "../hooks/use-agents";

// Mirror the types from chat-interface.tsx (not exported)
interface FlowNode {
  id: string;
  type: string;
  data?: {
    label?: string;
    composioActionName?: string;
    actionId?: string;
    icon?: string;
    [key: string]: unknown;
  };
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface ConversationStarter {
  id: string;
  text: string;
  enabled: boolean;
}

// Phosphor icon map for dynamic rendering (same as flow-editor.tsx)
const PHOSPHOR_MAP: Record<string, typeof Chats> = {
  Chats, Robot, GitBranch, MagnifyingGlass, ArrowsClockwise, Sparkle, ChatCircle,
};

interface AgentChatTabProps {
  agentId: string;
  agentName: string;
  agentAvatar?: string | null;
  conversationId: string | null;
  onConversationChange: (id: string | null) => void;
  flowNodes?: FlowNode[];
  flowEdges?: FlowEdge[];
  initialGreeting?: string;
  conversationStarters?: ConversationStarter[];
}

export function AgentChatTab({
  agentId,
  agentName,
  agentAvatar,
  conversationId,
  onConversationChange,
  flowNodes,
  flowEdges,
  initialGreeting,
  conversationStarters,
}: AgentChatTabProps) {
  const conversations = useConversations(agentId);
  const createConversation = useCreateConversation();
  const [search, setSearch] = useState("");

  // Execution state tracking (for dynamic header)
  const [executionState, setExecutionState] = useState<FlowExecutionState | null>(null);
  const [retryFn, setRetryFn] = useState<(() => void) | null>(null);

  // Stable refs to avoid re-render loops
  const executionRunningRef = useRef(false);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  // Wrapper: update execution state + refetch conversations when execution completes
  // Uses refs to keep the callback identity stable (avoids infinite re-renders)
  const handleExecutionStateChange = useCallback((state: FlowExecutionState | null) => {
    const wasRunning = executionRunningRef.current;
    executionRunningRef.current = state?.isRunning ?? false;
    setExecutionState(state);
    if (wasRunning && state && !state.isRunning) {
      // Execution just finished — refetch conversations to pick up title changes
      conversationsRef.current.refetch();
    }
  }, []);

  // Auto-create first conversation on mount if none selected
  const autoCreatedRef = useRef(false);
  useEffect(() => {
    if (!conversationId && !autoCreatedRef.current) {
      autoCreatedRef.current = true;
      createConversation.mutate(
        { agentId },
        {
          onSuccess: (conversation) => {
            onConversationChange(conversation.id);
          },
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, agentId]);

  // Compute current node label + icon from execution state (same logic as flow-editor.tsx)
  const currentNodeLabel = useMemo(() => {
    if (!executionState?.isRunning || !executionState.currentNodeId) return null;
    const node = flowNodes?.find((n) => n.id === executionState.currentNodeId);
    return node?.data?.label || null;
  }, [executionState, flowNodes]);

  const currentNodeIconConfig = useMemo(() => {
    if (!executionState?.currentNodeId) {
      return { type: "phosphor" as const, phosphorIcon: "Chats", bgColor: "bg-blue-500" };
    }
    const node = flowNodes?.find((n) => n.id === executionState.currentNodeId);
    if (!node) return { type: "phosphor" as const, phosphorIcon: "Chats", bgColor: "bg-blue-500" };
    return getNodeIconConfig(node.type, node.data as { icon?: string } | undefined);
  }, [executionState, flowNodes]);

  // Group conversations by date
  const groupedConversations = useMemo(() => {
    if (!conversations.data?.items) return {};

    let filtered = conversations.data.items.filter((c) => !c.isArchived);
    if (search) {
      filtered = filtered.filter((c) =>
        c.title?.toLowerCase().includes(search.toLowerCase())
      );
    }

    const groups: Record<string, typeof filtered> = {};
    for (const conversation of filtered) {
      const date = new Date(conversation.updatedAt);
      let key: string;
      if (isToday(date)) key = "Today";
      else if (isYesterday(date)) key = "Yesterday";
      else key = format(date, "MMMM d");

      if (!groups[key]) groups[key] = [];
      groups[key].push(conversation);
    }
    return groups;
  }, [conversations.data, search]);

  const handleNewConversation = useCallback(() => {
    createConversation.mutate(
      { agentId },
      {
        onSuccess: (conversation) => {
          onConversationChange(conversation.id);
        },
      }
    );
  }, [agentId, createConversation, onConversationChange]);

  const handleRestart = useCallback(() => {
    onConversationChange(null);
    setExecutionState(null);
    setRetryFn(null);
    createConversation.mutate(
      { agentId },
      {
        onSuccess: (conversation) => {
          onConversationChange(conversation.id);
        },
      }
    );
  }, [agentId, createConversation, onConversationChange]);

  const config = getAgentConfig(agentName);
  const AgentIcon = config.icon;

  // Determine if execution failed (for Retry from failed button)
  const hasFailed = executionState?.errorNodeIds?.length && !executionState.isRunning && retryFn;

  return (
    <div className="flex h-full bg-white">
      {/* Conversation sidebar */}
      <div className="w-[260px] border-r border-[#E5E7EB] flex-col bg-white shrink-0 hidden lg:flex">
        {/* Search + New */}
        <div className="p-3 flex items-center gap-2 border-b border-[#E5E7EB]">
          <div className="relative flex-1">
            <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#9CA3AF]" />
            <Input
              placeholder="Search conversations"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm border-[#E5E7EB]"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6]"
            onClick={handleNewConversation}
            disabled={createConversation.isPending}
            title="New conversation"
          >
            {createConversation.isPending ? (
              <CircleNotch className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
          </Button>
        </div>

        {/* Conversations list */}
        <ScrollArea className="flex-1">
          <div className="px-2 py-2">
            {conversations.isLoading && (
              <div className="flex items-center justify-center py-8">
                <CircleNotch className="size-5 animate-spin text-[#9CA3AF]" />
              </div>
            )}

            {!conversations.isLoading && Object.keys(groupedConversations).length === 0 && (
              <div className="text-center py-8 px-3">
                <ChatCircle className="size-8 text-[#D1D5DB] mx-auto mb-2" />
                <p className="text-sm text-[#9CA3AF]">No conversations yet</p>
              </div>
            )}

            {Object.entries(groupedConversations).map(([date, convs]) => (
              <div key={date}>
                <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider px-2 pt-3 pb-1.5">
                  {date}
                </p>
                <div className="space-y-0.5">
                  {convs.map((conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() => onConversationChange(conversation.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors text-left group",
                        conversationId === conversation.id
                          ? "bg-[#F3F4F6] text-[#111827]"
                          : "hover:bg-[#F9FAFB] text-[#374151]"
                      )}
                    >
                      <ChatCircle
                        className={cn(
                          "size-4 shrink-0",
                          conversationId === conversation.id
                            ? "text-[#374151]"
                            : "text-[#9CA3AF] group-hover:text-[#6B7280]"
                        )}
                      />
                      <span className="truncate flex-1 text-[13px]">
                        {conversation.title || "New conversation"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {conversationId ? (
          <>
            {/* Dynamic header — shows current executing node (like Test panel) */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E5E7EB] shrink-0">
              <div className="flex items-center gap-2">
                {/* Node icon — dynamic during execution, agent icon when idle */}
                {executionState?.isRunning && currentNodeIconConfig ? (
                  <div className={`size-[22px] rounded-[5px] ${currentNodeIconConfig.bgColor} flex items-center justify-center`}>
                    {currentNodeIconConfig.type === "phosphor" ? (
                      (() => {
                        const PhIcon = PHOSPHOR_MAP[currentNodeIconConfig.phosphorIcon] || Chats;
                        return <PhIcon className="size-3 text-white" weight="fill" />;
                      })()
                    ) : (
                      <Icon icon={currentNodeIconConfig.icon} className={`size-3 ${currentNodeIconConfig.icon.startsWith("logos:") ? "" : "text-white"}`} />
                    )}
                  </div>
                ) : (
                  <div className={`size-[26px] rounded-[6px] bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                    <AgentIcon className="size-3.5 text-white" weight="fill" />
                  </div>
                )}
                <span className="text-sm font-medium text-[#374151]">
                  {executionState?.isRunning && currentNodeLabel
                    ? currentNodeLabel
                    : agentName
                  }
                </span>
                {executionState?.isRunning && (
                  <CircleNotch className="size-3.5 animate-spin text-blue-500" />
                )}
              </div>

              {/* Right side — Retry from failed OR New chat */}
              {hasFailed ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => retryFn()}
                    className="text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors px-2 py-1 rounded-lg hover:bg-orange-50"
                  >
                    Retry from failed
                  </button>
                  <button
                    onClick={handleRestart}
                    className="text-sm font-medium text-[#374151] hover:text-[#111827] transition-colors px-2 py-1 rounded-lg hover:bg-[#F3F4F6]"
                  >
                    Restart
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleRestart}
                  className="flex items-center gap-1.5 text-sm font-medium text-[#374151] hover:text-[#111827] transition-colors px-2.5 py-1.5 rounded-lg hover:bg-[#F3F4F6]"
                >
                  <ArrowsClockwise className="size-3.5" />
                  New chat
                </button>
              )}
            </div>

            {/* ChatInterface — flow execution mode (same as Test) */}
            <div className="flex-1 min-h-0">
              <ChatInterface
                key={conversationId}
                conversationId={conversationId}
                agentId={agentId}
                agentName={agentName}
                agentAvatar={agentAvatar}
                flowNodes={flowNodes}
                flowEdges={flowEdges}
                mode="chat"
                onExecutionStateChange={handleExecutionStateChange}
                onRetryFromFailed={(fn) => setRetryFn(() => fn)}
                initialGreeting={initialGreeting}
                conversationStarters={conversationStarters}
              />
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className={`size-16 rounded-2xl bg-gradient-to-br ${config.gradient} flex items-center justify-center mx-auto shadow-sm`}>
                <AgentIcon className="size-8 text-white" weight="fill" />
              </div>
              <h3 className="text-lg font-semibold text-[#1a1a1a] mt-5 mb-1.5">
                Chat with {agentName}
              </h3>
              <p className="text-[#6B7280] text-sm mb-5 max-w-xs mx-auto">
                Start a conversation to interact with your agent using its configured flow.
              </p>
              <Button
                onClick={handleNewConversation}
                disabled={createConversation.isPending}
                className="gap-2"
              >
                {createConversation.isPending ? (
                  <CircleNotch className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                New conversation
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
