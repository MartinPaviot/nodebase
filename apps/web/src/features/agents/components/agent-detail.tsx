"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  useSuspenseAgent,
  useSuspenseConversations,
  useCreateConversation,
} from "../hooks/use-agents";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Robot,
  ChatCircle,
  Plus,
  CircleNotch,
  Envelope,
  Globe,
  Clock,
  PushPin,
  Archive,
  ShareNetwork,
  Lightning,
  Phone,
} from "@phosphor-icons/react";
import Link from "next/link";
import { ConversationMenu } from "./conversation-menu";
import { AddActionModal } from "./add-action-modal";
import { toast } from "sonner";

// Source icons mapping
const sourceIcons: Record<string, typeof ChatCircle> = {
  CHAT: ChatCircle,
  EMBED: Globe,
  EMAIL: Envelope,
  PHONE: Phone,
  SLACK: ChatCircle,
  WEBHOOK: Lightning,
  SCHEDULE: Clock,
};

interface AgentDetailProps {
  agentId: string;
}

export function AgentDetail({ agentId }: AgentDetailProps) {
  const router = useRouter();
  const agent = useSuspenseAgent(agentId);
  const conversations = useSuspenseConversations(agentId);
  const createConversation = useCreateConversation();
  const [showArchived, setShowArchived] = useState(false);
  const [showAddToolModal, setShowAddToolModal] = useState(false);

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

  const modelLabels: Record<string, string> = {
    ANTHROPIC: "Claude",
    OPENAI: "GPT-4o",
    GEMINI: "Gemini",
  };

  // Separate and sort conversations: pinned first, then by date
  const { pinnedConversations, regularConversations, archivedConversations } = useMemo(() => {
    const items = conversations.data.items;
    const pinned = items.filter((c) => c.isPinned && !c.isArchived);
    const regular = items.filter((c) => !c.isPinned && !c.isArchived);
    const archived = items.filter((c) => c.isArchived);
    return {
      pinnedConversations: pinned,
      regularConversations: regular,
      archivedConversations: archived,
    };
  }, [conversations.data.items]);

  const displayedConversations = showArchived
    ? archivedConversations
    : [...pinnedConversations, ...regularConversations];

  return (
    <div className="flex-1 overflow-auto bg-[#FAF9F6]">
      {/* Agent Header - Lindy style simple */}
      <div className="px-10 pt-10 pb-8">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-5">
            {/* Agent Avatar - Lindy gold/amber square icon */}
            <div className="size-16 rounded-2xl bg-[#FEF3C7] flex items-center justify-center shadow-sm">
              <Robot className="size-8 text-[#D97706]" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-[28px] font-semibold text-[#1a1a1a] leading-tight">
                {agent.data.name}
              </h1>
              {agent.data.description && (
                <p className="text-[#6B7280] mt-2 max-w-2xl text-[15px] leading-relaxed">
                  {agent.data.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#F3F4F6] text-[#374151] text-[13px] font-medium">
                  {modelLabels[agent.data.model] || agent.data.model}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#F3F4F6] text-[#374151] text-[13px] font-medium">
                  Temp: {agent.data.temperature.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Single action button - Lindy style */}
          <Button
            onClick={handleNewConversation}
            disabled={createConversation.isPending}
            className="bg-[#F4D03F] hover:bg-[#E6C147] text-[#1a1a1a] font-medium rounded-full px-6 h-11 shadow-none"
          >
            {createConversation.isPending ? (
              <CircleNotch className="size-4 animate-spin mr-2" />
            ) : (
              <Plus className="size-4 mr-2" strokeWidth={2.5} />
            )}
            New chat
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="px-10 pb-10">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Conversations List - Lindy style with coral/peach border */}
          <div className="lg:col-span-2 rounded-2xl border-[3px] border-[#F9A8A8] bg-white p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="flex items-center gap-2.5 text-[16px] font-semibold text-[#1a1a1a]">
                <ChatCircle className="size-5 text-[#6B7280]" />
                Conversations
              </h3>
              <div className="flex items-center gap-2">
                {archivedConversations.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="show-archived"
                      checked={showArchived}
                      onCheckedChange={setShowArchived}
                      className="data-[state=checked]:bg-[#10b981]"
                    />
                    <Label htmlFor="show-archived" className="text-[13px] text-[#6B7280] flex items-center gap-1.5 cursor-pointer">
                      <Archive className="size-3.5" />
                      Archived ({archivedConversations.length})
                    </Label>
                  </div>
                )}
              </div>
            </div>

            {displayedConversations.length === 0 ? (
              <div className="text-center py-12">
                <div className="size-16 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mx-auto mb-4">
                  <ChatCircle className="size-8 text-[#9CA3AF]" />
                </div>
                <p className="text-[#6B7280] text-[15px]">
                  {showArchived ? "No archived conversations." : "No conversations yet."}
                </p>
                {!showArchived && (
                  <Button
                    className="mt-5 rounded-full bg-[#F4D03F] hover:bg-[#E6C147] text-[#1a1a1a] font-medium px-5 shadow-none"
                    onClick={handleNewConversation}
                    disabled={createConversation.isPending}
                  >
                    Start your first conversation
                  </Button>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[420px]">
                <div className="space-y-1">
                  {/* Pinned Section Header */}
                  {!showArchived && pinnedConversations.length > 0 && (
                    <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF] font-semibold tracking-wide py-2 uppercase">
                      <PushPin className="size-3" />
                      Pinned
                    </div>
                  )}

                  {displayedConversations.map((conversation, index) => {
                    const SourceIcon = sourceIcons[conversation.source] || ChatCircle;
                    const isPinned = conversation.isPinned;
                    const isFirstRegular = !showArchived && isPinned === false && index === pinnedConversations.length && pinnedConversations.length > 0;

                    return (
                      <div key={conversation.id}>
                        {/* Regular Section Header */}
                        {isFirstRegular && (
                          <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF] font-semibold tracking-wide py-2 mt-4 uppercase">
                            <ChatCircle className="size-3" />
                            Recent
                          </div>
                        )}
                        <div className="flex items-center justify-between p-3 rounded-xl border border-[#e5e7eb] hover:bg-[#F9FAFB] transition-colors group">
                          <Link
                            href={`/agents/${agentId}/chat/${conversation.id}`}
                            className="flex-1 min-w-0 flex items-start gap-3"
                          >
                            <div className="shrink-0 mt-0.5">
                              <SourceIcon className="size-4 text-[#9CA3AF]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-[14px] text-[#1a1a1a] truncate">
                                  {conversation.title || "New conversation"}
                                </p>
                                {isPinned && (
                                  <PushPin className="size-3 text-[#F4D03F] shrink-0" />
                                )}
                                {conversation.shareToken && (
                                  <ShareNetwork className="size-3 text-[#9CA3AF] shrink-0" />
                                )}
                              </div>
                              <p className="text-[13px] text-[#6B7280] mt-0.5">
                                {conversation.messages[0]?.createdAt
                                  ? formatDistanceToNow(conversation.messages[0].createdAt, { addSuffix: true })
                                  : "No messages yet"}
                              </p>
                            </div>
                          </Link>
                          <ConversationMenu conversation={conversation} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Configuration Panel - Lindy style simple */}
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6">
            <h3 className="text-[16px] font-semibold text-[#1a1a1a] mb-5">Configuration</h3>
            <div className="space-y-5">
              <div>
                <p className="text-[13px] font-semibold text-[#374151] mb-1.5">System Prompt</p>
                <p className="text-[13px] text-[#6B7280] leading-relaxed line-clamp-8">
                  {agent.data.systemPrompt}
                </p>
              </div>

              {agent.data.context && (
                <div>
                  <p className="text-[13px] font-semibold text-[#374151] mb-1.5">Context</p>
                  <p className="text-[13px] text-[#6B7280] whitespace-pre-wrap line-clamp-4 leading-relaxed">
                    {agent.data.context}
                  </p>
                </div>
              )}

              {agent.data.credential && (
                <div>
                  <p className="text-[13px] font-semibold text-[#374151] mb-1.5">API Credential</p>
                  <p className="text-[13px] text-[#6B7280]">
                    {agent.data.credential.name}
                  </p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-semibold text-[#374151]">Tools & Integrations</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddToolModal(true)}
                    className="h-7 text-[12px] text-[#6B7280] hover:text-[#1a1a1a]"
                  >
                    <Plus className="size-3 mr-1" />
                    Add
                  </Button>
                </div>

                {agent.data.agentTools.length > 0 ? (
                  <div className="space-y-2">
                    {agent.data.agentTools.map((tool) => (
                      <div
                        key={tool.id}
                        className="text-[13px] p-3 rounded-xl bg-[#F9FAFB] border border-[#e5e7eb]"
                      >
                        <p className="font-medium text-[#374151]">{tool.name}</p>
                        {tool.description && (
                          <p className="text-[#6B7280] text-[12px] mt-0.5">
                            {tool.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-[#e5e7eb] rounded-xl">
                    <p className="text-[13px] text-[#6B7280]">No tools configured yet</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddToolModal(true)}
                      className="mt-2 text-[12px]"
                    >
                      <Plus className="size-3 mr-1" />
                      Add your first tool
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Tool Modal - transparent integration, no "Composio" branding */}
      <AddActionModal
        open={showAddToolModal}
        onOpenChange={setShowAddToolModal}
        agentId={agentId}
        onSelectAction={() => {
          // Tool automatically saved via agentId prop
          toast.success("Tool added successfully");
          // Refresh agent data to show new tool
          agent.refetch();
        }}
      />
    </div>
  );
}
