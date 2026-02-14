"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  PaperPlaneTilt,
  CircleNotch,
  Robot,
  User,
  Wrench,
  ShieldWarning,
  Pulse,
  ThumbsUp,
  ThumbsDown,
  PencilSimple,
  Stop,
} from "@phosphor-icons/react";
import { useRef, useEffect, useState, useCallback, useMemo, Suspense, type FormEvent } from "react";
import type { Message } from "@prisma/client";
import { ConfirmationDialog } from "./confirmation-dialog";
import { toast } from "sonner";
import type { FlowExecutionState } from "./flow-editor-canvas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ActivityLog } from "./activity-log";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
}

interface PendingConfirmation {
  activityId: string;
  actionType: string;
  actionLabel: string;
  details: Record<string, unknown>;
}

interface FlowNode {
  id: string;
  type: string;
  data?: {
    label?: string;
    composioActionName?: string;
    actionId?: string;
    [key: string]: unknown;
  };
}

interface ChatInterfaceProps {
  conversationId: string;
  agentName: string;
  agentAvatar?: string | null;
  initialMessages?: Message[];
  flowNodes?: FlowNode[];
  onExecutionStateChange?: (state: FlowExecutionState | null) => void;
}

/**
 * Component to display a confirmation request message (Safe Mode)
 */
function ConfirmationRequestMessage({
  actionLabel,
  details,
  onRequestConfirmation,
}: {
  actionLabel: string;
  details: Record<string, unknown>;
  onRequestConfirmation: () => void;
}) {
  return (
    <div className="flex gap-3">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-orange-100">
          <ShieldWarning className="size-4 text-orange-600" />
        </AvatarFallback>
      </Avatar>

      <div className="rounded-lg bg-orange-50 border border-orange-200 px-4 py-2.5 max-w-[80%]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-orange-800">
            Confirmation Required: {actionLabel}
          </span>
        </div>
        <p className="text-sm text-orange-700 mb-2">
          The agent wants to perform this action. Please review and confirm.
        </p>
        <details className="text-xs text-orange-700 mb-3">
          <summary className="cursor-pointer hover:text-orange-900">
            View Details
          </summary>
          <pre className="mt-1 bg-orange-100 p-2 rounded overflow-x-auto max-h-32">
            {JSON.stringify(details, null, 2)}
          </pre>
        </details>
        <Button
          size="sm"
          variant="outline"
          onClick={onRequestConfirmation}
          className="border-orange-300 text-orange-700 hover:bg-orange-100"
        >
          Review & Confirm
        </Button>
      </div>
    </div>
  );
}

/**
 * Component to display a tool call message
 */
function ToolCallMessage({
  toolName,
  toolInput,
  toolOutput,
  isLoading,
}: {
  toolName: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
  isLoading?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-amber-100">
          <Wrench className="size-4 text-amber-600" />
        </AvatarFallback>
      </Avatar>

      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 max-w-[80%]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-amber-800">{toolName}</span>
          {isLoading && (
            <CircleNotch className="size-3 animate-spin text-amber-600" />
          )}
        </div>

        {toolInput && Object.keys(toolInput).length > 0 && (
          <details className="text-xs text-amber-700">
            <summary className="cursor-pointer hover:text-amber-900">
              Input
            </summary>
            <pre className="mt-1 bg-amber-100 p-2 rounded overflow-x-auto max-h-32">
              {JSON.stringify(toolInput, null, 2)}
            </pre>
          </details>
        )}

        {toolOutput && (
          <details className="text-xs text-amber-700 mt-1" open>
            <summary className="cursor-pointer hover:text-amber-900">
              Result
            </summary>
            <pre
              className={cn(
                "mt-1 p-2 rounded overflow-x-auto max-h-48",
                (toolOutput as { error?: boolean })?.error
                  ? "bg-red-100 text-red-800"
                  : "bg-amber-100"
              )}
            >
              {JSON.stringify(toolOutput, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * Component to display an assistant message with feedback buttons (Phase 3.1)
 */
function AssistantMessage({
  messageId,
  content,
  agentName,
  agentAvatar,
  onFeedback,
  onEdit,
}: {
  messageId: string;
  content: string;
  agentName: string;
  agentAvatar?: string | null;
  onFeedback: (messageId: string, type: "thumbs_up" | "thumbs_down") => void;
  onEdit: (messageId: string, content: string) => void;
}) {
  const [feedbackGiven, setFeedbackGiven] = useState<"thumbs_up" | "thumbs_down" | null>(null);

  const handleFeedback = (type: "thumbs_up" | "thumbs_down") => {
    setFeedbackGiven(type);
    onFeedback(messageId, type);
  };

  return (
    <div className="flex gap-4 group">
      <Avatar className="size-10 shrink-0 shadow-sm ring-2 ring-primary/20">
        {agentAvatar ? (
          <AvatarImage src={agentAvatar} alt={agentName} />
        ) : null}
        <AvatarFallback className="bg-primary/10">
          <Robot className="size-5 text-primary" />
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-2">
        <div className="rounded-2xl bg-card border px-5 py-3 max-w-[85%] shadow-sm">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>

        {/* Feedback buttons - Phase 3.1 */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs",
              feedbackGiven === "thumbs_up" && "text-green-600 bg-green-50 hover:bg-green-100"
            )}
            onClick={() => handleFeedback("thumbs_up")}
            title="Good response"
          >
            <ThumbsUp className={cn("size-3.5", feedbackGiven === "thumbs_up" && "fill-green-600")} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs",
              feedbackGiven === "thumbs_down" && "text-red-600 bg-red-50 hover:bg-red-100"
            )}
            onClick={() => handleFeedback("thumbs_down")}
            title="Poor response"
          >
            <ThumbsDown className={cn("size-3.5", feedbackGiven === "thumbs_down" && "fill-red-600")} />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onEdit(messageId, content)}
            title="Edit & improve"
          >
            <PencilSimple className="size-3.5 mr-1" />
            Edit
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ChatInterface({
  conversationId,
  agentName,
  agentAvatar,
  initialMessages = [],
  flowNodes,
  onExecutionStateChange,
}: ChatInterfaceProps) {
  const trpc = useTRPC();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages.map((msg) => ({
      id: msg.id,
      role: msg.role.toLowerCase() as "user" | "assistant" | "tool",
      content: msg.content,
      toolName: msg.toolName ?? undefined,
      toolInput: (msg.toolInput as Record<string, unknown>) ?? undefined,
      toolOutput: (msg.toolOutput as Record<string, unknown>) ?? undefined,
    }))
  );
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Safe Mode confirmation state
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Feedback state - Phase 3.1
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);

  // tRPC mutations - Phase 3.2
  const submitFeedbackMutation = useMutation(trpc.agents.submitFeedback.mutationOptions());

  // Refs for batched streaming updates
  const pendingContentRef = useRef("");
  const updateScheduledRef = useRef(false);
  const assistantMessageIdRef = useRef<string | null>(null);

  // AbortController for stopping execution
  const abortControllerRef = useRef<AbortController | null>(null);

  // Flow execution state tracking
  const flowExecutionStateRef = useRef<FlowExecutionState>({
    isRunning: false,
    currentNodeId: null,
    completedNodeIds: [],
    errorNodeIds: [],
    skippedNodeIds: [],
  });

  // Build tool → nodeId mapping from flowNodes
  const toolNodeMap = useMemo(() => {
    if (!flowNodes) return {};
    const map: Record<string, string> = {};
    for (const node of flowNodes) {
      if (node.data?.composioActionName) map[node.data.composioActionName] = node.id;
      if (node.data?.actionId) map[node.data.actionId] = node.id;
      // Map by label keywords (lowercase)
      if (node.data?.label) {
        const label = node.data.label.toLowerCase().replace(/\s+/g, "_");
        map[label] = node.id;
      }
    }
    return map;
  }, [flowNodes]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: input.trim(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);
      setError(null);

      try {
        // Create AbortController for this request
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Reset execution state
        flowExecutionStateRef.current = {
          isRunning: true,
          currentNodeId: null,
          completedNodeIds: [],
          errorNodeIds: [],
          skippedNodeIds: [],
        };
        onExecutionStateChange?.(flowExecutionStateRef.current);

        const response = await fetch("/api/agents/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            messages: [{ role: "user", content: userMessage.content }],
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        const assistantMessageId = crypto.randomUUID();
        assistantMessageIdRef.current = assistantMessageId;
        pendingContentRef.current = "";

        setMessages((prev) => [
          ...prev,
          { id: assistantMessageId, role: "assistant", content: "" },
        ]);

        // Track in-progress tool calls for this stream
        const pendingToolCalls = new Map<string, { id: string; toolName: string; toolInput: Record<string, unknown> }>();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          // Parse SSE data - UI Message Stream format
          // Events: data: {"type":"text-delta",...}, data: {"type":"tool-input-available",...}, etc.
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;

            try {
              const data = JSON.parse(line.slice(5).trim());

              switch (data.type) {
                case "text-delta":
                  if (data.delta) {
                    pendingContentRef.current += data.delta;

                    // Batch updates using requestAnimationFrame
                    if (!updateScheduledRef.current) {
                      updateScheduledRef.current = true;
                      requestAnimationFrame(() => {
                        const content = pendingContentRef.current;
                        const msgId = assistantMessageIdRef.current;
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === msgId ? { ...msg, content } : msg
                          )
                        );
                        updateScheduledRef.current = false;
                      });
                    }
                  }
                  break;

                case "tool-input-start":
                  // Tool call starting - add placeholder message
                  {
                    const toolMessageId = `tool-${data.toolCallId}`;
                    pendingToolCalls.set(data.toolCallId, {
                      id: toolMessageId,
                      toolName: data.toolName,
                      toolInput: {},
                    });
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: toolMessageId,
                        role: "tool",
                        content: `Calling ${data.toolName}...`,
                        toolName: data.toolName,
                      },
                    ]);

                    // Update flow execution state
                    const nodeId = toolNodeMap[data.toolName];
                    if (nodeId && onExecutionStateChange) {
                      const prev = flowExecutionStateRef.current;
                      const newState: FlowExecutionState = {
                        isRunning: true,
                        currentNodeId: nodeId,
                        completedNodeIds: prev.currentNodeId
                          ? [...prev.completedNodeIds, prev.currentNodeId]
                          : prev.completedNodeIds,
                        errorNodeIds: prev.errorNodeIds,
                        skippedNodeIds: prev.skippedNodeIds,
                      };
                      flowExecutionStateRef.current = newState;
                      onExecutionStateChange(newState);
                    }
                  }
                  break;

                case "tool-input-available":
                  // Tool input is complete
                  {
                    const pending = pendingToolCalls.get(data.toolCallId);
                    if (pending) {
                      pending.toolInput = data.input || {};
                      setMessages((prev) =>
                        prev.map((msg) =>
                          msg.id === pending.id
                            ? { ...msg, toolInput: data.input || {} }
                            : msg
                        )
                      );
                    }
                  }
                  break;

                case "tool-output-available":
                  // Tool result arrived
                  {
                    const pending = pendingToolCalls.get(data.toolCallId);
                    if (pending) {
                      setMessages((prev) =>
                        prev.map((msg) =>
                          msg.id === pending.id
                            ? {
                                ...msg,
                                content: `Called ${pending.toolName}`,
                                toolOutput: data.output,
                              }
                            : msg
                        )
                      );
                      pendingToolCalls.delete(data.toolCallId);

                      // Mark current node as completed
                      if (onExecutionStateChange) {
                        const prev = flowExecutionStateRef.current;
                        const newState: FlowExecutionState = {
                          ...prev,
                          completedNodeIds: prev.currentNodeId
                            ? [...prev.completedNodeIds, prev.currentNodeId]
                            : prev.completedNodeIds,
                          currentNodeId: null,
                        };
                        flowExecutionStateRef.current = newState;
                        onExecutionStateChange(newState);
                      }
                    }
                  }
                  break;

                case "error":
                  console.error("Stream error:", data);
                  break;
              }
            } catch {
              // Ignore parse errors for non-JSON lines
            }
          }
        }

        // Final update to ensure all content is rendered
        const finalContent = pendingContentRef.current;
        const finalMsgId = assistantMessageIdRef.current;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === finalMsgId ? { ...msg, content: finalContent } : msg
          )
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User stopped the execution
          const prev = flowExecutionStateRef.current;
          flowExecutionStateRef.current = { ...prev, isRunning: false };
          onExecutionStateChange?.(flowExecutionStateRef.current);
        } else {
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        setIsLoading(false);
        assistantMessageIdRef.current = null;
        abortControllerRef.current = null;
        // Mark execution as complete
        const prev = flowExecutionStateRef.current;
        flowExecutionStateRef.current = { ...prev, isRunning: false };
        onExecutionStateChange?.(flowExecutionStateRef.current);
      }
    },
    [conversationId, input, isLoading, toolNodeMap, onExecutionStateChange]
  );

  // Handle confirmation action (Safe Mode)
  const handleConfirmAction = useCallback(async () => {
    if (!pendingConfirmation) return;

    setIsConfirming(true);
    try {
      const response = await fetch("/api/agents/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: pendingConfirmation.activityId,
          confirmed: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to confirm action");
      }

      if (data.executed) {
        toast.success(`${pendingConfirmation.actionLabel} executed successfully`);
        // Add a message indicating the action was executed
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Action confirmed and executed: ${pendingConfirmation.actionLabel}`,
          },
        ]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to confirm action");
    } finally {
      setIsConfirming(false);
      setPendingConfirmation(null);
    }
  }, [pendingConfirmation]);

  // Handle rejection action (Safe Mode)
  const handleRejectAction = useCallback(async () => {
    if (!pendingConfirmation) return;

    setIsConfirming(true);
    try {
      const response = await fetch("/api/agents/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: pendingConfirmation.activityId,
          confirmed: false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reject action");
      }

      toast.info(`${pendingConfirmation.actionLabel} rejected`);
      // Add a message indicating the action was rejected
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Action rejected: ${pendingConfirmation.actionLabel}. Let me know if you'd like me to try something different.`,
        },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject action");
    } finally {
      setIsConfirming(false);
      setPendingConfirmation(null);
    }
  }, [pendingConfirmation]);

  // Handle feedback - Phase 3.2
  const handleFeedback = useCallback(async (messageId: string, type: "thumbs_up" | "thumbs_down") => {
    try {
      // Find the message to get its content
      const message = messages.find((m) => m.id === messageId);
      const originalOutput = message?.content || "";

      await submitFeedbackMutation.mutateAsync({
        conversationId,
        messageId,
        type: type === "thumbs_up" ? "THUMBS_UP" : "THUMBS_DOWN",
        originalOutput,
      });

      toast.success(type === "thumbs_up" ? "Thanks for the feedback!" : "Feedback noted, I'll try to improve");
    } catch (err) {
      toast.error("Failed to submit feedback");
    }
  }, [conversationId, messages, submitFeedbackMutation]);

  // Handle edit - Phase 3.1
  const handleEdit = useCallback((messageId: string, content: string) => {
    setEditingMessage({ id: messageId, content });
  }, []);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Messages area */}
      <ScrollArea ref={scrollRef} className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Robot className="size-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Chat with {agentName}</h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                Ask me anything or give me a task. I'm here to help.
              </p>
            </div>
          )}

          {messages.map((message) => {
            // Tool message
            if (message.role === "tool" && message.toolName) {
              // Check if this is a Safe Mode confirmation request
              const output = message.toolOutput as {
                requiresConfirmation?: boolean;
                activityId?: string;
                actionType?: string;
                actionLabel?: string;
                details?: Record<string, unknown>;
              } | undefined;

              if (output?.requiresConfirmation && output.activityId) {
                return (
                  <ConfirmationRequestMessage
                    key={message.id}
                    actionLabel={output.actionLabel || message.toolName}
                    details={output.details || message.toolInput || {}}
                    onRequestConfirmation={() => {
                      setPendingConfirmation({
                        activityId: output.activityId!,
                        actionType: output.actionType || message.toolName || "unknown",
                        actionLabel: output.actionLabel || message.toolName || "Unknown Action",
                        details: output.details || message.toolInput || {},
                      });
                    }}
                  />
                );
              }

              return (
                <ToolCallMessage
                  key={message.id}
                  toolName={message.toolName}
                  toolInput={message.toolInput}
                  toolOutput={message.toolOutput}
                />
              );
            }

            // Assistant message with feedback - Phase 3.1
            if (message.role === "assistant") {
              return (
                <AssistantMessage
                  key={message.id}
                  messageId={message.id}
                  content={message.content}
                  agentName={agentName}
                  agentAvatar={agentAvatar}
                  onFeedback={handleFeedback}
                  onEdit={handleEdit}
                />
              );
            }

            // User message
            return (
              <div key={message.id} className="flex gap-4 flex-row-reverse">
                <Avatar className="size-10 shrink-0 shadow-sm">
                  <AvatarFallback className="bg-muted">
                    <User className="size-5 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>

                <div className="rounded-2xl px-5 py-3 max-w-[85%] shadow-sm bg-primary text-primary-foreground">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            );
          })}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-4">
              <Avatar className="size-10 shrink-0 shadow-sm ring-2 ring-primary/20">
                {agentAvatar ? (
                  <AvatarImage src={agentAvatar} alt={agentName} />
                ) : null}
                <AvatarFallback className="bg-primary/10">
                  <Robot className="size-5 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div className="rounded-2xl bg-card border px-5 py-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <CircleNotch className="size-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl bg-destructive/10 border border-destructive/20 px-5 py-4 text-sm text-destructive">
              Error: {error.message}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Execution Progress Indicator */}
      {isLoading && flowNodes && flowNodes.length > 0 && flowExecutionStateRef.current.isRunning && (
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-t border-blue-200 dark:border-blue-800">
          <div className="size-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-sm text-blue-700 dark:text-blue-300 flex-1">
            {flowExecutionStateRef.current.currentNodeId
              ? `Running: ${flowNodes.find(n => n.id === flowExecutionStateRef.current.currentNodeId)?.data?.label || "Processing..."}`
              : "Processing..."
            }
            {" "}
            ({flowExecutionStateRef.current.completedNodeIds.length}/{flowNodes.filter(n => !["messageReceived", "chatOutcome", "conditionBranch"].includes(n.type)).length})
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
            onClick={() => {
              abortControllerRef.current?.abort();
              flowExecutionStateRef.current = {
                isRunning: false,
                currentNodeId: null,
                completedNodeIds: flowExecutionStateRef.current.completedNodeIds,
                errorNodeIds: flowExecutionStateRef.current.errorNodeIds,
                skippedNodeIds: flowExecutionStateRef.current.skippedNodeIds,
              };
              onExecutionStateChange?.(null);
            }}
          >
            <Stop className="size-4 mr-1" /> Stop
          </Button>
        </div>
      )}

      {/* Input area - Modern floating design */}
      <div className="border-t bg-background/80 backdrop-blur-sm p-4 md:p-6">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl">
          <div className="flex items-center gap-3 rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/30 transition-shadow">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Message ${agentName}...`}
              disabled={isLoading}
              className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            <div className="flex items-center gap-1">
              <Sheet>
                <SheetTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="size-9 rounded-xl" title="View Pulse Log">
                    <Pulse className="size-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Pulse Log</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
                    <Suspense fallback={<div className="text-sm text-muted-foreground text-center py-4">Loading activities...</div>}>
                      <ActivityLog conversationId={conversationId} />
                    </Suspense>
                  </div>
                </SheetContent>
              </Sheet>
              <Button
                type="submit"
                size="icon"
                className="size-9 rounded-xl"
                disabled={isLoading || !input.trim()}
              >
                {isLoading ? (
                  <CircleNotch className="size-4 animate-spin" />
                ) : (
                  <PaperPlaneTilt className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Safe Mode Confirmation Dialog */}
      <ConfirmationDialog
        open={pendingConfirmation !== null}
        onConfirm={handleConfirmAction}
        onReject={handleRejectAction}
        actionType={pendingConfirmation?.actionType || ""}
        actionDetails={pendingConfirmation?.details || {}}
        isLoading={isConfirming}
      />

      {/* Edit Message Dialog - Phase 3.1 */}
      <Dialog open={!!editingMessage} onOpenChange={(open) => !open && setEditingMessage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit & Improve Response</DialogTitle>
            <DialogDescription>
              Make corrections to help the agent learn your preferred style and tone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Original Response</label>
              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground max-h-32 overflow-y-auto">
                {editingMessage?.content}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Your Improved Version</label>
              <Textarea
                placeholder="Edit the response to your liking..."
                className="min-h-[200px] font-sans"
                defaultValue={editingMessage?.content || ""}
                id="edited-content"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMessage(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const textarea = document.getElementById("edited-content") as HTMLTextAreaElement;
                const editedContent = textarea?.value || "";

                if (editingMessage && editedContent !== editingMessage.content) {
                  try {
                    await submitFeedbackMutation.mutateAsync({
                      conversationId,
                      messageId: editingMessage.id,
                      type: "USER_EDIT",
                      originalOutput: editingMessage.content,
                      editedOutput: editedContent,
                    });
                    toast.success("Thanks! I'll learn from your edits.");
                  } catch (err) {
                    toast.error("Failed to save edit");
                  }
                }

                setEditingMessage(null);
              }}
            >
              <PencilSimple className="size-4 mr-2" />
              Save Edits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
