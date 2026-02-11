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
  PushPin,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isToday, isYesterday, format } from "date-fns";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  title: string | null;
  isPinned: boolean;
  isArchived: boolean;
  updatedAt: Date;
  agentId: string;
  agent?: {
    id: string;
    name: string;
    avatar: string | null;
  };
}

interface ConversationsSidebarProps {
  conversations: Conversation[];
  activeConversationId?: string;
  onNewConversation?: () => void;
  basePath?: string; // e.g., "/chat" or "/agents/[agentId]/chat"
}

export function ConversationsSidebar({
  conversations,
  activeConversationId,
  onNewConversation,
  basePath = "/chat",
}: ConversationsSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pinned">("all");

  // Group conversations by date
  const groupedConversations = useMemo(() => {
    let filtered = conversations;

    // Apply search filter
    if (search) {
      filtered = filtered.filter(
        (c) =>
          c.title?.toLowerCase().includes(search.toLowerCase()) ||
          c.agent?.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply status filter
    if (filter === "pinned") {
      filtered = filtered.filter((c) => c.isPinned);
    }

    // Filter out archived
    filtered = filtered.filter((c) => !c.isArchived);

    // Group by date
    const groups: Record<string, typeof filtered> = {};

    filtered.forEach((conversation) => {
      const date = new Date(conversation.updatedAt);
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

  const getConversationLink = (conversation: Conversation) => {
    if (basePath.includes("[agentId]")) {
      return basePath.replace("[agentId]", conversation.agentId) + `/${conversation.id}`;
    }
    return `/agents/${conversation.agentId}/chat/${conversation.id}`;
  };

  return (
    <div className="w-64 border-r flex flex-col bg-card/50 h-full">
      {/* Search and Filter */}
      <div className="p-3 flex items-center gap-2 border-b">
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
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={onNewConversation}
        >
          <Plus className="size-4" />
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
                  const isActive = conversation.id === activeConversationId;

                  return (
                    <Link
                      key={conversation.id}
                      href={getConversationLink(conversation)}
                      className={cn(
                        "flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <span className="flex-1 truncate">
                        {conversation.title || "New conversation"}
                      </span>
                      {conversation.isPinned && (
                        <PushPin className="size-3 text-muted-foreground shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {Object.keys(groupedConversations).length === 0 && (
            <div className="text-center py-8 px-4">
              <p className="text-sm text-muted-foreground mb-4">
                {search ? "No conversations found" : "No conversations yet"}
              </p>
              {!search && (
                <Button size="sm" onClick={onNewConversation}>
                  <Plus className="size-4 mr-2" />
                  Start a conversation
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
