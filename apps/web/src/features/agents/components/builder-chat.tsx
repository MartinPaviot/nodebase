"use client";

import { useRef, useEffect, useState, useCallback, type ChangeEvent } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Paperclip,
  PaperPlaneTilt,
  CircleNotch,
  Robot,
  X,
} from "@phosphor-icons/react";
import { VoiceInputButton } from "@/components/ui/voice-input-button";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { toast } from "sonner";
import type { ProcessedFile } from "@/lib/file-processor";
import { BuilderSteps, type BuilderStep } from "./builder-steps";
import { AgentCard } from "./agent-card";
import { SuggestionsList } from "./suggestions-list";
import { format } from "date-fns";

interface BuilderChatProps {
  initialPrompt?: string;
  onAgentCreated?: (agentId: string, agentName: string) => void;
}

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

export function BuilderChat({ initialPrompt, onAgentCreated }: BuilderChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [hasSubmittedInitial, setHasSubmittedInitial] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agentContext, setAgentContext] = useState<{ id: string; name: string } | null>(null);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [initialFiles, setInitialFiles] = useState<ProcessedFile[] | null>(null);

  // Read processed files from sessionStorage (passed from home page)
  useEffect(() => {
    const stored = sessionStorage.getItem("builder-files");
    if (stored) {
      try {
        setInitialFiles(JSON.parse(stored));
      } catch { /* ignore */ }
      sessionStorage.removeItem("builder-files");
    }
  }, []);

  const baseTextRef = useRef("");
  const { isListening, isTranscribing, startListening } = useVoiceInput({
    onTranscriptChange: (text) => setInput(text),
    onListeningEnd: () => { baseTextRef.current = input; },
    baseText: baseTextRef.current,
  });
  const handleMicClick = () => { baseTextRef.current = input; startListening(); };

  const handleFileClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = Array.from(files);
    if (attachedFiles.length + newFiles.length > 5) {
      toast.error("Maximum 5 files allowed");
      return;
    }
    setAttachedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

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

  // Build history for API from messages
  const buildHistory = useCallback(() => {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      toolCalls: msg.toolCalls,
    }));
  }, [messages]);

  const handleSend = useCallback(
    async (messageContent: string, filesToSend?: ProcessedFile[]) => {
      if (!messageContent.trim() || isLoading) return;

      // Process any attached files from the Paperclip button
      let processedFiles = filesToSend;
      if (!processedFiles && attachedFiles.length > 0) {
        try {
          const formData = new FormData();
          attachedFiles.forEach((f) => formData.append("files", f));
          const res = await fetch("/api/files/process", { method: "POST", body: formData });
          if (res.ok) {
            const { files } = await res.json();
            processedFiles = files;
          }
        } catch { /* ignore file processing errors */ }
        setAttachedFiles([]);
      }

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: messageContent.trim() + (processedFiles?.length ? ` [${processedFiles.length} file(s) attached]` : ""),
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
            files: processedFiles,
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
                      };
                      setAgentContext(newAgentContext);
                      onAgentCreated?.(newAgentContext.id, newAgentContext.name);
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
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, an error occurred while building your agent. Please try again.",
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, buildHistory, agentContext, onAgentCreated]
  );

  // Auto-submit initial prompt - only once (with files from home page if available)
  useEffect(() => {
    if (initialPrompt && !hasSubmittedInitial && messages.length === 0 && !isLoading) {
      setHasSubmittedInitial(true);
      setTimeout(() => {
        handleSend(initialPrompt, initialFiles || undefined);
        setInitialFiles(null);
      }, 0);
    }
  }, [initialPrompt, hasSubmittedInitial, messages.length, isLoading, handleSend, initialFiles]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  // Convert current tool calls to steps for display
  const currentSteps: BuilderStep[] = currentToolCalls.map((tool) => ({
    id: tool.id,
    label: TOOL_LABELS[tool.name] || tool.name,
    status: tool.result ? "completed" : "running",
    expandable: true,
    hasUndo: tool.name === "create_agent",
  }));

  // Parse suggestions from current content
  const suggestions = parseSuggestionsFromContent(currentContent);
  const contentWithoutSuggestions = removeNumberedListFromContent(currentContent);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="max-w-3xl mx-auto py-6 space-y-6">
          {/* Timestamp */}
          {messages.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              {format(new Date(), "'Today' HH:mm")}
            </p>
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
                {currentSteps.length > 0 && <BuilderSteps steps={currentSteps} />}

                {/* Agent card if created */}
                {agentContext && currentToolCalls.some(tc => tc.result?.success) && (
                  <AgentCard
                    agentId={agentContext.id}
                    agentName={agentContext.name}
                    iconColor="#6366F1"
                  />
                )}

                {/* Text content */}
                {contentWithoutSuggestions && (
                  <MarkdownRenderer content={contentWithoutSuggestions} />
                )}

                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <SuggestionsList
                    suggestions={suggestions}
                    onSelect={(s) => {
                      setInput(s.label);
                      inputRef.current?.focus();
                    }}
                  />
                )}

                {/* Loading indicator */}
                {!currentContent && currentSteps.length === 0 && (
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
      <div className="border-t p-4">
        <form onSubmit={handleFormSubmit} className="max-w-3xl mx-auto">
          {/* File badges */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2 px-1">
              {attachedFiles.map((file, i) => (
                <Badge key={i} variant="secondary" className="gap-1 text-xs">
                  <Paperclip className="size-3" />
                  {file.name.length > 20 ? file.name.slice(0, 17) + "..." : file.name}
                  <button type="button" onClick={() => removeFile(i)} className="ml-0.5 hover:text-destructive">
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,.pdf,.txt,.csv,.json,.xml"
            onChange={handleFileChange}
          />
          <div className="flex items-end gap-2 bg-card rounded-xl border p-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={handleFileClick}
            >
              <Paperclip className="size-4" />
            </Button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter message"
              rows={1}
              className="flex-1 bg-transparent resize-none overflow-hidden outline-none text-sm min-h-[24px] max-h-32"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleFormSubmit(e);
                }
              }}
            />
            <VoiceInputButton
              isListening={isListening}
              isTranscribing={isTranscribing}
              onClick={handleMicClick}
              disabled={isLoading}
              className="size-8"
            />
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

// Component to render a single message
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
          <AvatarFallback className="bg-indigo-500 text-white text-xs">
            M
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 text-right">
          <p className="text-sm">{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant message
  const steps: BuilderStep[] = (message.toolCalls || []).map((tool) => ({
    id: tool.id,
    label: TOOL_LABELS[tool.name] || tool.name,
    status: tool.result ? "completed" : "running",
    expandable: true,
    hasUndo: tool.name === "create_agent",
  }));

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
        {steps.length > 0 && <BuilderSteps steps={steps} />}

        {/* Agent card if created */}
        {hasCreatedAgent && agentContext && (
          <AgentCard
            agentId={agentContext.id}
            agentName={agentContext.name}
            iconColor="#6366F1"
          />
        )}

        {/* Text content */}
        {contentWithoutSuggestions && (
          <MarkdownRenderer content={contentWithoutSuggestions} />
        )}

        {/* Suggestions - only show for the last message */}
        {suggestions.length > 0 && (
          <SuggestionsList
            suggestions={suggestions}
            onSelect={() => {
              // Handled by parent for input focus
            }}
          />
        )}
      </div>
    </div>
  );
}

// Helper to parse numbered suggestions from content
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

// Helper to remove numbered list from content
function removeNumberedListFromContent(content: string) {
  const lines = content.split("\n");
  const filtered = lines.filter(
    (line: string) => !line.match(/^(\d+)[.)\s]+(.+)$/)
  );
  return filtered.join("\n").trim();
}
