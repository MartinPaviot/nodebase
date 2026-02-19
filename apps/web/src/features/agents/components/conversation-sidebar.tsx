"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MagnifyingGlass,
  Plus,
  Funnel,
  ChatCircle,
  Globe,
  Envelope,
  Phone,
  Lightning,
  Clock,
  CircleNotch,
  PushPin,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";
import { cn } from "@/lib/utils";
import type { ConversationSource } from "@prisma/client";

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

// Type matching the exact shape from getConversations query
interface ConversationItem {
  id: string;
  title: string | null;
  isArchived: boolean;
  isPinned: boolean;
  shareToken: string | null;
  source: ConversationSource;
  createdAt: Date;
  updatedAt: Date;
  messages: { createdAt: Date }[];
}

interface ConversationSidebarProps {
  agentId: string;
  agentName: string;
  agentIcon?: string;
  conversations: ConversationItem[];
  onNewConversation: () => void;
  isCreating: boolean;
}

export function ConversationSidebar({
  agentId,
  agentName,
  agentIcon,
  conversations,
  onNewConversation,
  isCreating,
}: ConversationSidebarProps) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pinned" | "archived">("all");

  // Group conversations by date
  const groupedConversations = useMemo(() => {
    let filtered = conversations;

    // Apply search filter
    if (search) {
      filtered = filtered.filter((c) =>
        c.title?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply status filter
    if (filter === "pinned") {
      filtered = filtered.filter((c) => c.isPinned);
    } else if (filter === "archived") {
      filtered = filtered.filter((c) => c.isArchived);
    } else {
      filtered = filtered.filter((c) => !c.isArchived);
    }

    // Group by date
    const groups: Record<string, ConversationItem[]> = {};

    filtered.forEach((conversation) => {
      const date = conversation.updatedAt;
      let key: string;

      if (isToday(date)) {
        key = "Today";
      } else if (isYesterday(date)) {
        key = "Yesterday";
      } else {
        key = format(date, "MMMM d");
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(conversation);
    });

    return groups;
  }, [conversations, search, filter]);

  const activeConversationId = pathname.split("/chat/")[1];

  return (
    <div className="w-72 border-r flex flex-col bg-card/50">
      {/* Agent Header */}
      <div className="p-4 border-b flex items-center gap-3">
        <div
          className="size-8 rounded-lg flex items-center justify-center text-white text-sm shrink-0"
          style={{ backgroundColor: "#E6C147" }}
        >
          {agentIcon || agentName[0]}
        </div>
        <span className="font-medium text-sm truncate">{agentName}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="ml-auto h-7 px-2">
              <span className="text-xs text-muted-foreground">Chat</span>
              <svg
                className="ml-1 size-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem asChild>
              <Link href={`/agents/${agentId}`}>Overview</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/agents/${agentId}`}>Settings</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search and Filter */}
      <div className="p-3 flex items-center gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 shrink-0">
              <Funnel className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setFilter("all")}>
              All conversations
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("pinned")}>
              Pinned only
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("archived")}>
              Archived
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={onNewConversation}
          disabled={isCreating}
        >
          {isCreating ? (
            <CircleNotch className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
        </Button>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="px-2 pb-4">
          {Object.entries(groupedConversations).map(([date, convs]) => (
            <div key={date}>
              <p className="text-xs font-medium text-muted-foreground px-2 py-2 sticky top-0 bg-card/50 backdrop-blur-sm">
                {date}
              </p>
              <div className="space-y-0.5">
                {convs.map((conversation) => {
                  const SourceIcon =
                    sourceIcons[conversation.source] || ChatCircle;
                  const isActive = activeConversationId === conversation.id;

                  return (
                    <Link
                      key={conversation.id}
                      href={`/agents/${agentId}/chat/${conversation.id}`}
                      className={cn(
                        "flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted/50 text-foreground"
                      )}
                    >
                      <SourceIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate flex-1">
                        {conversation.title || "New Task"}
                      </span>
                      {conversation.isPinned && (
                        <PushPin className="size-3 text-primary shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {Object.keys(groupedConversations).length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No conversations yet
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
