"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  PushPin,
  Robot,
  PaperPlaneTilt,
  CircleNotch,
  Paperclip,
  Microphone,
  Sparkle,
  Check,
  ArrowRight,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isToday, isYesterday, format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";

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

// Lindy-style color palette
const AGENT_COLORS = [
  "#E6C147",
  "#7C3AED",
  "#059669",
  "#DC2626",
  "#2563EB",
  "#D97706",
  "#DB2777",
  "#0891B2",
];

function getAgentColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

// ===============================
// Types for the builder chat
// ===============================
interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: Record<string, unknown>;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
}

// Map tool names to display labels
const TOOL_LABELS: Record<string, string> = {
  create_agent: "Creating Agent",
  update_agent: "Updating Agent",
};

// ===============================
// Main GlobalChat Component
// ===============================
export function GlobalChat() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pinned">("all");
  const [showNewChat, setShowNewChat] = useState(false);

  const conversationsQuery = trpc.agents.getAllConversations.queryOptions({ page: 1, pageSize: 50 });
  const conversations = useSuspenseQuery(conversationsQuery);

  // Refresh conversations list
  const refreshConversations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: conversationsQuery.queryKey });
  }, [queryClient, conversationsQuery.queryKey]);

  // Group conversations by date
  const groupedConversations = useMemo(() => {
    let filtered = conversations.data.items;

    // Apply search filter
    if (search) {
      filtered = filtered.filter(
        (c) =>
          c.title?.toLowerCase().includes(search.toLowerCase()) ||
          c.agent.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply status filter
    if (filter === "pinned") {
      filtered = filtered.filter((c) => c.isPinned);
    }

    // Group by date
    const groups: Record<string, typeof filtered> = {};

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
  }, [conversations.data.items, search, filter]);

  const hasConversations = Object.keys(groupedConversations).length > 0;

  // If no conversations or user clicks new chat, show the integrated chat
  const shouldShowNewChat = showNewChat || !hasConversations;

  return (
    <div className="flex h-full">
      {/* Conversations Sidebar */}
      <div className="w-72 border-r flex flex-col bg-card/50">
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
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => setShowNewChat(true)}
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
                    const color = getAgentColor(conversation.agent.id);

                    return (
                      <Link
                        key={conversation.id}
                        href={`/agents/${conversation.agentId}/chat/${conversation.id}`}
                        onClick={() => setShowNewChat(false)}
                        className={cn(
                          "flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors hover:bg-muted/50"
                        )}
                      >
                        <Avatar className="size-6 shrink-0">
                          {conversation.agent.avatar ? (
                            <AvatarImage
                              src={conversation.agent.avatar}
                              alt={conversation.agent.name}
                            />
                          ) : null}
                          <AvatarFallback
                            className="text-[10px] text-white"
                            style={{ backgroundColor: color }}
                          >
                            {conversation.agent.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <span className="truncate block">
                            {conversation.title || "New Task"}
                          </span>
                          <span className="text-xs text-muted-foreground truncate block">
                            {conversation.agent.name}
                          </span>
                        </div>
                        {conversation.isPinned && (
                          <PushPin className="size-3 text-primary shrink-0" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {!hasConversations && (
              <div className="text-center py-8 px-4">
                <p className="text-xs text-muted-foreground">
                  No conversations yet
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-background">
        {shouldShowNewChat ? (
          <IntegratedBuilderChat
            onAgentCreated={(agentId, conversationId) => {
              // Refresh conversations list and navigate to the agent's chat
              refreshConversations();
              router.push(`/agents/${agentId}/chat/${conversationId}`);
            }}
            onCancel={() => setShowNewChat(false)}
          />
        ) : (
          <EmptyChatState onNewChat={() => setShowNewChat(true)} />
        )}
      </div>
    </div>
  );
}

// ===============================
// Empty Chat State with Chat Input
// ===============================
function EmptyChatState({ onNewChat }: { onNewChat: () => void }) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onNewChat();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Spacer */}
      <div className="flex-1" />

      {/* Chat Input at bottom */}
      <div className="p-4">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <div className="flex items-center gap-1.5 bg-card rounded-xl border border-border shadow-sm transition-all hover:border-muted-foreground/30 hover:shadow-md focus-within:border-primary/50 focus-within:shadow-md px-3 py-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            >
              <Paperclip className="size-4" />
            </Button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter message"
              className="flex-1 bg-transparent outline-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            >
              <Microphone className="size-4" />
            </Button>
            <Button
              type="submit"
              size="icon"
              className="size-8 shrink-0 rounded-full"
              disabled={!input.trim()}
            >
              <PaperPlaneTilt className="size-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===============================
// Integrated Builder Chat
// ===============================
interface IntegratedBuilderChatProps {
  onAgentCreated?: (agentId: string, conversationId: string) => void;
  onCancel?: () => void;
}

function IntegratedBuilderChat({ onAgentCreated, onCancel }: IntegratedBuilderChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agentContext, setAgentContext] = useState<{ id: string; name: string; conversationId?: string } | null>(null);

  // Current response state
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCall[]>([]);
  const [currentContent, setCurrentContent] = useState("");

  // Refs for streaming
  const pendingContentRef = useRef("");
  const updateScheduledRef = useRef(false);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentContent, currentToolCalls]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Build history for API from messages
  const buildHistory = useCallback(() => {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      toolCalls: msg.toolCalls,
    }));
  }, [messages]);

  const handleSend = useCallback(
    async (messageContent: string) => {
      if (!messageContent.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: messageContent.trim(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);
      setCurrentContent("");
      setCurrentToolCalls([]);
      pendingContentRef.current = "";

      try {
        const history = buildHistory();

        const response = await fetch("/api/agents/build", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageContent,
            history,
            agentContext,
          }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        const toolCallsInProgress = new Map<string, ToolCall>();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.trim()) continue;

            // Handle AI SDK data stream format
            if (line.startsWith("0:")) {
              // Text content
              try {
                const text = JSON.parse(line.slice(2));
                pendingContentRef.current += text;
                if (!updateScheduledRef.current) {
                  updateScheduledRef.current = true;
                  requestAnimationFrame(() => {
                    setCurrentContent(pendingContentRef.current);
                    updateScheduledRef.current = false;
                  });
                }
              } catch {
                // Not JSON
              }
            } else if (line.startsWith("9:")) {
              // Tool call start
              try {
                const data = JSON.parse(line.slice(2));
                if (data.toolCallId && data.toolName) {
                  const toolCall: ToolCall = {
                    id: data.toolCallId,
                    name: data.toolName,
                    input: data.args || {},
                  };
                  toolCallsInProgress.set(data.toolCallId, toolCall);
                  setCurrentToolCalls(Array.from(toolCallsInProgress.values()));
                }
              } catch {
                // Not JSON
              }
            } else if (line.startsWith("a:")) {
              // Tool result
              try {
                const data = JSON.parse(line.slice(2));
                if (data.toolCallId && data.result !== undefined) {
                  const toolCall = toolCallsInProgress.get(data.toolCallId);
                  if (toolCall) {
                    toolCall.result = data.result;
                    toolCallsInProgress.set(data.toolCallId, toolCall);
                    setCurrentToolCalls(Array.from(toolCallsInProgress.values()));

                    // Check if agent was created or updated
                    if (data.result?.success && data.result?.agentId) {
                      const newAgentContext = {
                        id: data.result.agentId as string,
                        name: (data.result.agentName as string) || "New Agent",
                        conversationId: data.result.conversationId as string | undefined,
                      };
                      setAgentContext(newAgentContext);
                      if (newAgentContext.conversationId) {
                        onAgentCreated?.(newAgentContext.id, newAgentContext.conversationId);
                      }
                    }
                  }
                }
              } catch {
                // Not JSON
              }
            } else if (line.startsWith("d:")) {
              // Done event
              try {
                const data = JSON.parse(line.slice(2));
                if (data.agentContext) {
                  setAgentContext(data.agentContext);
                }
              } catch {
                // Not JSON
              }
            } else if (line.startsWith("3:")) {
              // Error
              try {
                const error = JSON.parse(line.slice(2));
                console.error("Stream error:", error);
              } catch {
                // Not JSON
              }
            }
          }
        }

        // Finalize the assistant message
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: pendingContentRef.current,
          toolCalls: Array.from(toolCallsInProgress.values()),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setCurrentContent("");
        setCurrentToolCalls([]);
      } catch (error) {
        console.error("Error:", error);
        const errorContent = error instanceof Error ? error.message : "An error occurred";
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Sorry, an error occurred: ${errorContent}. Please check your API key configuration in Settings > Credentials.`,
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, buildHistory, agentContext, onAgentCreated]
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  // Parse suggestions from content
  const suggestions = parseSuggestionsFromContent(currentContent);
  const contentWithoutSuggestions = removeNumberedListFromContent(currentContent);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 border-b flex items-center justify-between px-4 bg-card/50">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-indigo-500 flex items-center justify-center">
            <Sparkle className="size-4 text-white" />
          </div>
          <div>
            <h2 className="font-medium text-sm">New Task</h2>
            <p className="text-xs text-muted-foreground">
              {agentContext ? `Working with ${agentContext.name}` : "Describe what you want to build"}
            </p>
          </div>
        </div>
        {onCancel && messages.length === 0 && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="max-w-3xl mx-auto py-6 space-y-6">
          {/* Welcome message if no messages */}
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <div className="size-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
                <Sparkle className="size-8 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">What would you like to build?</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
                Describe the AI agent you want to create and I'll help you build it.
              </p>

              {/* Quick suggestions */}
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "Customer support agent",
                  "Meeting scheduler",
                  "Lead generator",
                  "Email responder",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(`Create a ${suggestion.toLowerCase()}`);
                      inputRef.current?.focus();
                    }}
                    className="px-3 py-1.5 rounded-full border bg-card hover:bg-muted/50 transition-colors text-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Render all messages */}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              agentContext={agentContext}
            />
          ))}

          {/* Current response being streamed */}
          {isLoading && (
            <div className="flex gap-3">
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="bg-indigo-500 text-white">
                  <Robot className="size-4" />
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-3">
                {/* Steps */}
                {currentToolCalls.length > 0 && (
                  <div className="space-y-2">
                    {currentToolCalls.map((tool) => (
                      <div
                        key={tool.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        {tool.result ? (
                          <Check className="size-4 text-green-600" />
                        ) : (
                          <CircleNotch className="size-4 animate-spin text-indigo-500" />
                        )}
                        <span className={tool.result ? "text-green-700" : ""}>
                          {TOOL_LABELS[tool.name] || tool.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Agent card if created */}
                {agentContext && currentToolCalls.some((tc) => tc.result?.success) && (
                  <AgentCreatedCard
                    agentId={agentContext.id}
                    agentName={agentContext.name}
                  />
                )}

                {/* Text content */}
                {contentWithoutSuggestions && (
                  <div className="text-sm prose prose-sm max-w-none">
                    {contentWithoutSuggestions
                      .split("\n")
                      .map(
                        (paragraph: string, i: number) =>
                          paragraph.trim() && <p key={i}>{paragraph}</p>
                      )}
                  </div>
                )}

                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setInput(s.label);
                          inputRef.current?.focus();
                        }}
                        className="px-3 py-1.5 rounded-full border bg-card hover:bg-muted/50 transition-colors text-sm text-left"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Loading indicator */}
                {!currentContent && currentToolCalls.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CircleNotch className="size-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4 bg-card/50">
        <form onSubmit={handleFormSubmit} className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 bg-background rounded-xl border p-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
            >
              <Paperclip className="size-4" />
            </Button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what you want to build..."
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-sm min-h-[24px] max-h-32"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleFormSubmit(e);
                }
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
            >
              <Microphone className="size-4" />
            </Button>
            <Button
              type="submit"
              size="icon"
              className="size-8 shrink-0"
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? (
                <CircleNotch className="size-4 animate-spin" />
              ) : (
                <PaperPlaneTilt className="size-4" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===============================
// Message Bubble Component
// ===============================
function MessageBubble({
  message,
  agentContext,
}: {
  message: ChatMessage;
  agentContext: { id: string; name: string } | null;
}) {
  if (message.role === "user") {
    return (
      <div className="flex gap-3 flex-row-reverse">
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            You
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 text-right">
          <div className="inline-block bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2 text-sm">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  const hasCreatedAgent = message.toolCalls?.some(
    (tc) => tc.name === "create_agent" && tc.result?.success
  );

  const suggestions = parseSuggestionsFromContent(message.content);
  const contentWithoutSuggestions = removeNumberedListFromContent(message.content);

  return (
    <div className="flex gap-3">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-indigo-500 text-white">
          <Robot className="size-4" />
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-3">
        {/* Steps */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-2">
            {message.toolCalls.map((tool) => (
              <div key={tool.id} className="flex items-center gap-2 text-sm">
                <Check className="size-4 text-green-600" />
                <span className="text-green-700">
                  {TOOL_LABELS[tool.name] || tool.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Agent card if created */}
        {hasCreatedAgent && agentContext && (
          <AgentCreatedCard
            agentId={agentContext.id}
            agentName={agentContext.name}
          />
        )}

        {/* Text content */}
        {contentWithoutSuggestions && (
          <div className="text-sm prose prose-sm max-w-none">
            {contentWithoutSuggestions
              .split("\n")
              .map(
                (paragraph: string, i: number) =>
                  paragraph.trim() && <p key={i}>{paragraph}</p>
              )}
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {suggestions.map((s) => (
              <button
                key={s.id}
                className="px-3 py-1.5 rounded-full border bg-card hover:bg-muted/50 transition-colors text-sm text-left"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===============================
// Agent Created Card
// ===============================
function AgentCreatedCard({
  agentId,
  agentName,
}: {
  agentId: string;
  agentName: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 max-w-sm">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
          <Robot className="size-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{agentName}</h4>
          <p className="text-xs text-muted-foreground">Agent created successfully</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t">
        <Link
          href={`/agents/${agentId}`}
          className="flex items-center justify-between text-sm text-primary hover:underline"
        >
          <span>Go to Agent</span>
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

// ===============================
// Helper Functions
// ===============================
function parseSuggestionsFromContent(content: string) {
  const lines = content.split("\n");
  const suggestions: { id: string; label: string }[] = [];

  for (const line of lines) {
    const match = line.match(/^(\d+)[.)\s]+(.+)$/);
    if (match) {
      suggestions.push({
        id: match[1],
        label: match[2].trim(),
      });
    }
  }

  return suggestions;
}

function removeNumberedListFromContent(content: string) {
  const lines = content.split("\n");
  const filtered = lines.filter(
    (line: string) => !line.match(/^(\d+)[.)\s]+(.+)$/)
  );
  return filtered.join("\n").trim();
}
