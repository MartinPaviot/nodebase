"use client";

import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
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
  Code,
  Copy,
  Check,
  CheckCircle,
  XCircle,
  Chats,
  GitBranch,
  MagnifyingGlass,
  ArrowsClockwise,
  ChatCircle,
  Envelope,
  Sparkle,
  Paperclip,
  X,
} from "@phosphor-icons/react";
import { VoiceInputButton } from "@/components/ui/voice-input-button";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { useRef, useEffect, useState, useCallback, useMemo, Suspense, type FormEvent, type ChangeEvent } from "react";
import { Badge } from "@/components/ui/badge";
import type { ProcessedFile } from "@/lib/file-processor";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import type { FlowCommand, FlowStateSnapshot } from "@/features/agents/types/flow-builder-types";
import { getAgentConfig } from "./flow-editor-header";
import { Icon } from "@iconify/react";
import { getNodeIconConfig } from "@/features/agents/lib/node-icons";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
  /** Icon key for this tool message (e.g. "perplexity", "google"), resolved from flow node data */
  nodeIcon?: string;
  /** Node type for icon resolution (e.g. "action", "composioAction", "enterLoop") */
  nodeType?: string;
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

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface FlowDataResult {
  nodes?: Array<{ id: string; type: string; position: { x: number; y: number }; data?: Record<string, unknown> }>;
  edges?: Array<{ id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }>;
}

interface ConversationStarter {
  id: string;
  text: string;
  enabled: boolean;
}

interface ChatInterfaceProps {
  conversationId: string;
  agentId: string;
  agentName: string;
  agentAvatar?: string | null;
  initialMessages?: Message[];
  flowNodes?: FlowNode[];
  flowEdges?: FlowEdge[];
  onExecutionStateChange?: (state: FlowExecutionState | null) => void;
  onRetryFromFailed?: (fn: (() => void) | null) => void;
  mode?: "chat" | "flow-builder";
  onFlowCommand?: (command: FlowCommand) => void;
  getFlowState?: () => FlowStateSnapshot;
  getFlowData?: () => FlowDataResult | undefined;
  /** Greeting message from the Message Received node (shown on chat open) */
  initialGreeting?: string;
  /** Conversation starters from the Message Received node */
  conversationStarters?: ConversationStarter[];
}

/**
 * Agent avatar with gradient background and Phosphor icon, matching the header bar style.
 * Uses getAgentConfig to derive icon + gradient from agent name.
 */
function AgentIconAvatar({ agentName, size = "md" }: { agentName: string; size?: "sm" | "md" | "lg" }) {
  const config = getAgentConfig(agentName);
  const IconComponent = config.icon;
  const sizeClasses = size === "lg" ? "size-16 rounded-2xl" : size === "md" ? "size-7 rounded-lg" : "size-5 rounded-md";
  const iconSizeClass = size === "lg" ? "size-8" : size === "md" ? "size-3.5" : "size-2.5";
  return (
    <div className={`${sizeClasses} bg-gradient-to-br ${config.gradient} flex items-center justify-center shrink-0 shadow-sm`}>
      <IconComponent className={`${iconSizeClass} text-white`} weight="fill" />
    </div>
  );
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
/** Map Phosphor icon name strings to components for dynamic rendering */
const PHOSPHOR_ICON_MAP: Record<string, typeof Wrench> = {
  Chats, Robot, GitBranch, MagnifyingGlass, ArrowsClockwise,
  Sparkle, ChatCircle, Envelope, Wrench,
};

/** Format a NodeOutput into a human-readable summary */
function formatToolSummary(output: Record<string, unknown>): string {
  const kind = output.kind as string;
  switch (kind) {
    case "trigger":
      return `${output.message || "Message received"}`;
    case "ai-response":
      return `${output.content || "Response generated"}`;
    case "condition":
      return output.method === "deterministic"
        ? `Condition evaluated${output.reasoning ? `: ${output.reasoning}` : ""}`
        : `AI evaluated condition`;
    case "loop": {
      const idx = (output.currentIndex as number) + 1;
      const total = output.collectionSize as number;
      return output.completed
        ? `Loop completed (${total} item${total !== 1 ? "s" : ""} processed)`
        : `Processing item ${idx} of ${total}`;
    }
    case "integration": {
      const service = (output.service as string) || "Service";
      // Show a friendly message from data if available
      const data = output.data as Record<string, unknown> | undefined;
      const innerData = data?.data as Record<string, unknown> | undefined;
      const response = innerData?.response as Record<string, unknown> | undefined;
      const choices = response?.choices as Array<{ message?: { content?: string } }> | undefined;
      const content = choices?.[0]?.message?.content;
      if (content) {
        return content;
      }
      const dataMessage = data?.message as string | undefined;
      if (dataMessage) return dataMessage;
      return output.success
        ? `${service} action completed`
        : `${service} action failed`;
    }
    case "knowledge-search": {
      const count = output.resultCount as number;
      return `Found ${count} result${count !== 1 ? "s" : ""} in knowledge base`;
    }
    case "error":
      return `${output.error || "An error occurred"}`;
    case "passthrough":
      return "Step completed";
    default:
      return "Step completed";
  }
}

/** Max characters to show before collapsing a long summary */
const SUMMARY_COLLAPSE_THRESHOLD = 300;

function ToolCallMessage({
  toolName,
  toolInput,
  toolOutput,
  isLoading,
  nodeIcon,
  nodeType,
}: {
  toolName: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
  isLoading?: boolean;
  nodeIcon?: string;
  nodeType?: string;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Resolve icon config dynamically from node type + icon key
  const iconConfig = getNodeIconConfig(nodeType || "action", nodeIcon ? { icon: nodeIcon } : undefined);

  const kind = toolOutput?.kind as string | undefined;
  const isError = kind === "error";
  const isSuccess = toolOutput && !isError;
  const summary = toolOutput ? formatToolSummary(toolOutput) : null;
  const isLongSummary = summary ? summary.length > SUMMARY_COLLAPSE_THRESHOLD : false;
  const displaySummary = summary && isLongSummary && !expanded
    ? summary.slice(0, SUMMARY_COLLAPSE_THRESHOLD).replace(/\n.*$/, "") + "…"
    : summary;

  return (
    <div className="flex gap-3">
      <div className={cn("size-8 shrink-0 rounded-full flex items-center justify-center", iconConfig.bgColor || "bg-gray-200")}>
        {iconConfig.type === "iconify" ? (
          <Icon
            icon={iconConfig.icon}
            className={cn("size-4", iconConfig.icon.startsWith("logos:") ? "" : "text-white")}
          />
        ) : (() => {
          const PhIcon = PHOSPHOR_ICON_MAP[iconConfig.phosphorIcon] || Wrench;
          return <PhIcon className="size-4 text-white" weight="fill" />;
        })()}
      </div>

      <div className={cn(
        "rounded-lg px-4 py-2.5 max-w-[80%]",
        isError
          ? "bg-destructive/10 border border-destructive/20"
          : "bg-muted/50 border border-border",
      )}>
        {/* Header: node name + status */}
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-medium", isError ? "text-destructive" : "text-foreground")}>
            {toolName}
          </span>
          {isLoading && (
            <CircleNotch className="size-3 animate-spin text-muted-foreground" />
          )}
          {isSuccess && !isLoading && (
            <CheckCircle className="size-3.5 text-emerald-500" weight="fill" />
          )}
          {isError && !isLoading && (
            <XCircle className="size-3.5 text-destructive" weight="fill" />
          )}
        </div>

        {/* Human-readable summary (collapsible if long) */}
        {displaySummary && (
          <div className={cn(
            "text-xs mt-1",
            isError ? "text-destructive" : "text-muted-foreground",
          )}>
            <MarkdownRenderer content={displaySummary} className="text-xs" />
            {isLongSummary && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-primary hover:underline mt-1"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}

        {/* Inspect button for raw data */}
        {toolOutput && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className={cn(
                "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-colors",
                isError
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Code className="size-3" />
              {showDetails ? "Hide details" : "Inspect"}
            </button>
            {showDetails && (
              <pre className={cn(
                "mt-1.5 p-2 rounded text-xs overflow-x-auto max-h-48",
                isError ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
              )}>
                {JSON.stringify(toolOutput, null, 2)}
              </pre>
            )}
          </div>
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
  const [copied, setCopied] = useState(false);

  const handleFeedback = (type: "thumbs_up" | "thumbs_down") => {
    setFeedbackGiven(type);
    onFeedback(messageId, type);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex gap-4 group">
      <AgentIconAvatar agentName={agentName} size="md" />

      <div className="flex-1 space-y-2">
        <div className="rounded-2xl bg-card border px-5 py-3 max-w-[85%] shadow-sm">
          <MarkdownRenderer content={content} />
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
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 px-2 text-xs", copied && "text-green-600")}
            onClick={handleCopy}
            title={copied ? "Copied!" : "Copy to clipboard"}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
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
  agentId,
  agentName,
  agentAvatar,
  initialMessages = [],
  flowNodes,
  flowEdges,
  onExecutionStateChange,
  onRetryFromFailed,
  mode = "chat",
  onFlowCommand,
  getFlowState,
  getFlowData,
  initialGreeting,
  conversationStarters,
}: ChatInterfaceProps) {
  const trpc = useTRPC();
  const scrollRef = useRef<HTMLDivElement>(null);
  const greetingShownRef = useRef(false);

  // Recovery: fetch messages from DB when remounting with no initialMessages
  const shouldRecoverMessages = initialMessages.length === 0;
  const recoveredMessagesQuery = useQuery({
    ...trpc.agents.getConversation.queryOptions({ id: conversationId }),
    enabled: shouldRecoverMessages,
    select: (data) => data.messages,
    staleTime: 0,
  });

  // Build initial messages: include greeting from Message Received node if available
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const msgs = initialMessages.map((msg) => ({
      id: msg.id,
      role: msg.role.toLowerCase() as "user" | "assistant" | "tool",
      content: msg.content,
      toolName: msg.toolName ?? undefined,
      toolInput: (msg.toolInput as Record<string, unknown>) ?? undefined,
      toolOutput: (msg.toolOutput as Record<string, unknown>) ?? undefined,
    }));
    // If there's a greeting and no existing messages, show it as first assistant message
    if (initialGreeting && msgs.length === 0) {
      greetingShownRef.current = true;
      msgs.push({
        id: "greeting-message",
        role: "assistant",
        content: initialGreeting,
        toolName: undefined,
        toolInput: undefined as unknown as Record<string, unknown>,
        toolOutput: undefined as unknown as Record<string, unknown>,
      });
    }
    return msgs;
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [flowProgressCount, setFlowProgressCount] = useState(0);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const baseTextRef = useRef("");
  const { isListening, isTranscribing, startListening } = useVoiceInput({
    onTranscriptChange: (text) => setInput(text),
    onListeningEnd: () => { baseTextRef.current = input; },
    baseText: baseTextRef.current,
  });
  const handleMicClick = () => { baseTextRef.current = input; startListening(); };

  // File upload handlers
  const handleFileClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const MAX_FILES = 5;
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
    const MAX_TEXT_SIZE = 5 * 1024 * 1024;
    const totalFiles = attachedFiles.length + files.length;

    if (totalFiles > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files allowed`);
      e.target.value = "";
      return;
    }

    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      if (isImage && file.size > MAX_IMAGE_SIZE) {
        toast.error(`${file.name}: Image too large (max 10MB)`);
        e.target.value = "";
        return;
      }
      if (!isImage && file.size > MAX_TEXT_SIZE) {
        toast.error(`${file.name}: File too large (max 5MB)`);
        e.target.value = "";
        return;
      }
      if (file.type.includes("word") || file.name.endsWith(".docx") || file.name.endsWith(".doc")) {
        toast.warning(`${file.name}: DOCX/DOC not supported. Convert to PDF or paste the text.`);
        e.target.value = "";
        return;
      }
    }

    setAttachedFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Auto-resize textarea when input changes (covers programmatic updates like conversation starters)
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Recovery: hydrate messages from DB when remounting after tab switch
  const hasRecoveredRef = useRef(false);
  useEffect(() => {
    if (
      !hasRecoveredRef.current &&
      recoveredMessagesQuery.data &&
      recoveredMessagesQuery.data.length > 0 &&
      messages.length <= 1 // empty or greeting-only
    ) {
      hasRecoveredRef.current = true;
      const recovered: ChatMessage[] = recoveredMessagesQuery.data.map((msg) => ({
        id: msg.id,
        role: msg.role.toLowerCase() as "user" | "assistant" | "tool",
        content: msg.content,
        toolName: msg.toolName ?? undefined,
        toolInput: (msg.toolInput as Record<string, unknown>) ?? undefined,
        toolOutput: (msg.toolOutput as Record<string, unknown>) ?? undefined,
      }));

      // Prepend greeting before recovered messages if applicable
      if (initialGreeting && recovered[0]?.role === "user") {
        recovered.unshift({
          id: "greeting-message",
          role: "assistant",
          content: initialGreeting,
          toolName: undefined,
          toolInput: undefined as unknown as Record<string, unknown>,
          toolOutput: undefined as unknown as Record<string, unknown>,
        });
      }

      setMessages(recovered);
    }
  }, [recoveredMessagesQuery.data, messages.length, initialGreeting]);

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

  // Map nodeId → current message ID (for loop-safe unique keys)
  const nodeMessageIdRef = useRef<Map<string, string>>(new Map());

  // AbortController for stopping execution
  const abortControllerRef = useRef<AbortController | null>(null);

  // Flow execution state tracking
  const flowExecutionStateRef = useRef<FlowExecutionState>({
    isRunning: false,
    currentNodeId: null,
    completedNodeIds: [],
    errorNodeIds: [],
    skippedNodeIds: [],
    reusedNodeIds: [],
  });

  // Cache node outputs for retry-from-failed
  const nodeOutputCacheRef = useRef<Record<string, unknown>>({});
  const lastUserMessageRef = useRef<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Determine if we have a full flow to execute (nodes + edges)
  const hasFlow = Boolean(flowNodes && flowNodes.length > 0 && flowEdges && flowEdges.length > 0);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ============================================
  // FLOW EXECUTION MODE
  // ============================================

  /** Execute the agent's flow graph (edge-driven, sequential) */
  const executeFlowMode = useCallback(
    async (userMessage: string, controller: AbortController, retryConfig?: { retryFromNodeId: string; previousNodeOutputs: Record<string, unknown> }) => {
      // Pre-populate reused nodes from retry cache so counter doesn't flash to 0
      const preReusedIds = retryConfig ? Object.keys(retryConfig.previousNodeOutputs) : [];
      flowExecutionStateRef.current = {
        isRunning: true,
        currentNodeId: null,
        completedNodeIds: [],
        errorNodeIds: [],
        skippedNodeIds: [],
        reusedNodeIds: preReusedIds,
      };
      nodeMessageIdRef.current = new Map();
      nodeOutputCacheRef.current = {};
      lastUserMessageRef.current = userMessage;
      setFlowProgressCount(preReusedIds.length);
      onExecutionStateChange?.(flowExecutionStateRef.current);

      // Prefer live canvas data over static props
      const liveFlowData = getFlowData?.();
      const flowDataPayload = liveFlowData?.nodes && liveFlowData?.edges
        ? { nodes: liveFlowData.nodes, edges: liveFlowData.edges }
        : {
            nodes: flowNodes!.map((n) => ({
              id: n.id,
              type: n.type,
              position: { x: 0, y: 0 },
              data: n.data,
            })),
            edges: flowEdges!,
          };

      const response = await fetch("/api/agents/flow/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          flowData: flowDataPayload,
          userMessage,
          conversationId,
          ...(retryConfig ? {
            retryFromNodeId: retryConfig.retryFromNodeId,
            previousNodeOutputs: retryConfig.previousNodeOutputs,
          } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;

          try {
            const data = JSON.parse(line.slice(5).trim());

            switch (data.type) {
              case "node-start": {
                // Update flow execution state — do NOT mark previous node as completed here
                // (wait for node-complete event to avoid premature completion)
                const prevState = flowExecutionStateRef.current;
                const newState: FlowExecutionState = {
                  isRunning: true,
                  currentNodeId: data.nodeId,
                  completedNodeIds: prevState.completedNodeIds,
                  errorNodeIds: prevState.errorNodeIds,
                  skippedNodeIds: prevState.skippedNodeIds,
                  reusedNodeIds: prevState.reusedNodeIds,
                };
                flowExecutionStateRef.current = newState;
                onExecutionStateChange?.(newState);

                // Reset assistant message ref so each AI node gets its own bubble
                assistantMessageIdRef.current = null;
                pendingContentRef.current = "";

                // Add tool message for this node (unique ID for loop safety)
                const msgId = `flow-${data.nodeId}-${Date.now()}`;
                nodeMessageIdRef.current.set(data.nodeId, msgId);

                // Look up the node's icon from live canvas data (has latest icons),
                // falling back to static flowNodes prop
                const liveNodes = getFlowData?.()?.nodes;
                const liveNode = liveNodes?.find((n) => n.id === data.nodeId);
                const sourceNode = liveNode || flowNodes?.find((n) => n.id === data.nodeId);
                const nodeIconKey = (sourceNode?.data?.icon as string | undefined);
                const nodeTypeKey = (liveNode?.type || (sourceNode as { type?: string })?.type);

                setMessages((prev) => [
                  ...prev,
                  {
                    id: msgId,
                    role: "tool",
                    content: `Running: ${data.label}...`,
                    toolName: data.label,
                    nodeIcon: nodeIconKey,
                    nodeType: nodeTypeKey,
                  },
                ]);
                break;
              }

              case "node-complete": {
                // Cache output for retry-from-failed
                if (data.output) {
                  nodeOutputCacheRef.current[data.nodeId] = data.output;
                }

                const prevState = flowExecutionStateRef.current;
                const newState: FlowExecutionState = {
                  isRunning: true,
                  currentNodeId: null,
                  completedNodeIds: prevState.completedNodeIds.includes(data.nodeId)
                    ? prevState.completedNodeIds
                    : [...prevState.completedNodeIds, data.nodeId],
                  errorNodeIds: prevState.errorNodeIds,
                  skippedNodeIds: prevState.skippedNodeIds,
                  reusedNodeIds: prevState.reusedNodeIds,
                };
                flowExecutionStateRef.current = newState;
                onExecutionStateChange?.(newState);

                // Update the tool message with output
                const completeMsgId = nodeMessageIdRef.current.get(data.nodeId);
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === completeMsgId
                      ? {
                          ...msg,
                          content: `Completed: ${msg.toolName || data.nodeId}`,
                          toolOutput: data.output as Record<string, unknown>,
                        }
                      : msg
                  )
                );
                break;
              }

              case "node-reused": {
                // Reused from cache during retry — cache it too
                if (data.output) {
                  nodeOutputCacheRef.current[data.nodeId] = data.output;
                }

                const prevStateR = flowExecutionStateRef.current;
                const alreadyReused = prevStateR.reusedNodeIds.includes(data.nodeId);
                const newStateR: FlowExecutionState = {
                  isRunning: true,
                  currentNodeId: null,
                  completedNodeIds: prevStateR.completedNodeIds,
                  errorNodeIds: prevStateR.errorNodeIds,
                  skippedNodeIds: prevStateR.skippedNodeIds,
                  reusedNodeIds: alreadyReused
                    ? prevStateR.reusedNodeIds
                    : [...prevStateR.reusedNodeIds, data.nodeId],
                };
                flowExecutionStateRef.current = newStateR;
                onExecutionStateChange?.(newStateR);
                // Trigger re-render so progress bar updates
                if (!alreadyReused) {
                  setFlowProgressCount((c) => c + 1);
                }
                break;
              }

              case "node-error": {
                const prevState = flowExecutionStateRef.current;
                const newState: FlowExecutionState = {
                  isRunning: true,
                  currentNodeId: null,
                  completedNodeIds: prevState.completedNodeIds,
                  errorNodeIds: [...prevState.errorNodeIds, data.nodeId],
                  skippedNodeIds: prevState.skippedNodeIds,
                  reusedNodeIds: prevState.reusedNodeIds,
                };
                flowExecutionStateRef.current = newState;
                onExecutionStateChange?.(newState);

                // Update tool message with error
                const errorMsgId = nodeMessageIdRef.current.get(data.nodeId);
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === errorMsgId
                      ? {
                          ...msg,
                          content: `Failed: ${msg.toolName || data.nodeId}`,
                          toolOutput: {
                            error: true,
                            message: data.error,
                          },
                        }
                      : msg
                  )
                );
                break;
              }

              case "node-skipped": {
                const prevState4 = flowExecutionStateRef.current;
                const newState4: FlowExecutionState = {
                  isRunning: true,
                  currentNodeId: prevState4.currentNodeId,
                  completedNodeIds: prevState4.completedNodeIds,
                  errorNodeIds: prevState4.errorNodeIds,
                  skippedNodeIds: prevState4.skippedNodeIds.includes(data.nodeId)
                    ? prevState4.skippedNodeIds
                    : [...prevState4.skippedNodeIds, data.nodeId],
                  reusedNodeIds: prevState4.reusedNodeIds,
                };
                flowExecutionStateRef.current = newState4;
                onExecutionStateChange?.(newState4);
                break;
              }

              case "eval-result": {
                // Update tool message with eval feedback
                const evalMsgId = nodeMessageIdRef.current.get(data.nodeId);
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === evalMsgId
                      ? {
                          ...msg,
                          toolOutput: {
                            ...(msg.toolOutput || {}),
                            evalPassed: data.passed,
                            l2Score: data.l2Score,
                          },
                        }
                      : msg
                  )
                );
                break;
              }

              case "text-delta": {
                // AI node streaming text
                if (data.delta) {
                  // Create assistant message on first delta if none exists
                  if (!assistantMessageIdRef.current) {
                    const newMsgId = `flow-ai-${data.nodeId}-${Date.now()}`;
                    assistantMessageIdRef.current = newMsgId;
                    pendingContentRef.current = "";
                    setMessages((prev) => [
                      ...prev,
                      { id: newMsgId, role: "assistant", content: "" },
                    ]);
                  }
                  pendingContentRef.current += data.delta;
                  if (!updateScheduledRef.current) {
                    updateScheduledRef.current = true;
                    requestAnimationFrame(() => {
                      const content = pendingContentRef.current;
                      const msgId = assistantMessageIdRef.current;
                      if (msgId) {
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === msgId ? { ...msg, content } : msg
                          )
                        );
                      }
                      updateScheduledRef.current = false;
                    });
                  }
                }
                break;
              }

              case "flow-complete": {
                // Add summary message
                const completedCount =
                  flowExecutionStateRef.current.completedNodeIds.length;
                setMessages((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: `Flow completed successfully. ${completedCount} steps executed.`,
                  },
                ]);
                break;
              }

              case "flow-error": {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: `Flow execution error: ${data.error}`,
                  },
                ]);
                break;
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    },
    [agentId, conversationId, flowNodes, flowEdges, onExecutionStateChange, getFlowData]
  );

  // ============================================
  // CHAT MODE (existing LLM-driven execution)
  // ============================================

  /** Execute via traditional LLM-driven chat */
  const executeChatMode = useCallback(
    async (userMessage: string, controller: AbortController, files?: ProcessedFile[]) => {
      // Reset execution state
      flowExecutionStateRef.current = {
        isRunning: true,
        currentNodeId: null,
        completedNodeIds: [],
        errorNodeIds: [],
        skippedNodeIds: [],
        reusedNodeIds: [],
      };
      onExecutionStateChange?.(flowExecutionStateRef.current);

      const response = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          messages: [{ role: "user", content: userMessage }],
          ...(files && files.length > 0 ? { files } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let chatBuffer = "";
      const assistantMessageId = crypto.randomUUID();
      assistantMessageIdRef.current = assistantMessageId;
      pendingContentRef.current = "";

      setMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: "assistant", content: "" },
      ]);

      // Track in-progress tool calls for this stream
      const pendingToolCalls = new Map<
        string,
        { id: string; toolName: string; toolInput: Record<string, unknown> }
      >();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chatBuffer += decoder.decode(value, { stream: true });

        const lines = chatBuffer.split("\n");
        chatBuffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;

          try {
            const data = JSON.parse(line.slice(5).trim());

            switch (data.type) {
              case "text-delta":
                if (data.delta) {
                  pendingContentRef.current += data.delta;

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

              case "tool-input-start": {
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
                  const prevState = flowExecutionStateRef.current;
                  const newState: FlowExecutionState = {
                    isRunning: true,
                    currentNodeId: nodeId,
                    completedNodeIds: prevState.currentNodeId
                      ? [...prevState.completedNodeIds, prevState.currentNodeId]
                      : prevState.completedNodeIds,
                    errorNodeIds: prevState.errorNodeIds,
                    skippedNodeIds: prevState.skippedNodeIds,
                    reusedNodeIds: prevState.reusedNodeIds,
                  };
                  flowExecutionStateRef.current = newState;
                  onExecutionStateChange(newState);
                }
                break;
              }

              case "tool-input-available": {
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
                break;
              }

              case "tool-output-available": {
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

                  if (onExecutionStateChange) {
                    const prevState = flowExecutionStateRef.current;
                    const newState: FlowExecutionState = {
                      ...prevState,
                      completedNodeIds: prevState.currentNodeId
                        ? [
                            ...prevState.completedNodeIds,
                            prevState.currentNodeId,
                          ]
                        : prevState.completedNodeIds,
                      currentNodeId: null,
                    };
                    flowExecutionStateRef.current = newState;
                    onExecutionStateChange(newState);
                  }
                }
                break;
              }

              case "error":
                console.error("Stream error:", data);
                break;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      // Final content update
      const finalContent = pendingContentRef.current;
      const finalMsgId = assistantMessageIdRef.current;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === finalMsgId ? { ...msg, content: finalContent } : msg
        )
      );
    },
    [conversationId, toolNodeMap, onExecutionStateChange]
  );

  // ============================================
  // FLOW BUILDER MODE (Smart Builder Chat)
  // ============================================

  const executeFlowBuilderMode = useCallback(
    async (userMessage: string, controller: AbortController) => {
      const flowState = getFlowState?.() ?? { nodes: [], edges: [], summary: "Empty flow" };

      const response = await fetch("/api/agents/flow-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          messages: [{ role: "user", content: userMessage }],
          agentId,
          flowState,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      const assistantMessageId = crypto.randomUUID();
      assistantMessageIdRef.current = assistantMessageId;
      pendingContentRef.current = "";

      setMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: "assistant", content: "" },
      ]);

      const pendingToolCalls = new Map<
        string,
        { id: string; toolName: string; toolInput: Record<string, unknown> }
      >();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;

          try {
            const data = JSON.parse(line.slice(5).trim());

            switch (data.type) {
              case "text-delta":
                if (data.delta) {
                  pendingContentRef.current += data.delta;
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

              case "tool-input-start": {
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
                break;
              }

              case "tool-input-available": {
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
                break;
              }

              case "tool-output-available": {
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
                }
                break;
              }

              case "flow-command": {
                // Apply the flow command to the canvas
                if (data.command && onFlowCommand) {
                  onFlowCommand(data.command);
                }
                break;
              }

              case "error":
                console.error("Flow builder stream error:", data);
                break;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      // Final content update
      const finalContent = pendingContentRef.current;
      const finalMsgId = assistantMessageIdRef.current;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === finalMsgId ? { ...msg, content: finalContent } : msg
        )
      );
    },
    [conversationId, agentId, getFlowState, onFlowCommand]
  );

  // ============================================
  // UNIFIED SUBMIT HANDLER
  // ============================================

  const sendMessage = useCallback(
    async (messageText: string) => {
      const trimmed = messageText.trim();
      if (!trimmed || isLoading) return;

      // Process attached files before sending
      let processedFiles: ProcessedFile[] | undefined;
      const filesToUpload = [...attachedFiles];
      if (filesToUpload.length > 0) {
        setIsUploading(true);
        try {
          const formData = new FormData();
          for (const file of filesToUpload) {
            formData.append("files", file);
          }
          const uploadRes = await fetch("/api/files/process", {
            method: "POST",
            body: formData,
          });
          if (!uploadRes.ok) {
            const err = await uploadRes.json();
            toast.error(err.errors?.[0] || err.error || "File upload failed");
            setIsUploading(false);
            return;
          }
          const uploadData = await uploadRes.json();
          processedFiles = uploadData.files;
        } catch {
          toast.error("Failed to process files");
          setIsUploading(false);
          return;
        }
        setIsUploading(false);
        setAttachedFiles([]);
      }

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);
      setError(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        if (mode === "flow-builder") {
          // Flow builder mode: Smart Builder Chat
          await executeFlowBuilderMode(userMessage.content, controller);
        } else if (hasFlow) {
          // Flow mode: execute the graph edge-by-edge
          await executeFlowMode(userMessage.content, controller);
        } else {
          // Chat mode: traditional LLM-driven execution
          await executeChatMode(userMessage.content, controller, processedFiles);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          const prevState = flowExecutionStateRef.current;
          flowExecutionStateRef.current = { ...prevState, isRunning: false };
          onExecutionStateChange?.(flowExecutionStateRef.current);
        } else {
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        setIsLoading(false);
        assistantMessageIdRef.current = null;
        abortControllerRef.current = null;
        // Mark execution as complete
        const prevState = flowExecutionStateRef.current;
        flowExecutionStateRef.current = { ...prevState, isRunning: false };
        onExecutionStateChange?.(flowExecutionStateRef.current);
      }
    },
    [isLoading, hasFlow, mode, attachedFiles, executeFlowBuilderMode, executeFlowMode, executeChatMode, onExecutionStateChange]
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      await sendMessage(input);
    },
    [input, sendMessage]
  );

  // Retry from failed node — reuses cached outputs for upstream nodes
  const retryFromFailed = useCallback(async () => {
    const state = flowExecutionStateRef.current;
    if (state.errorNodeIds.length === 0 || !hasFlow) return;

    const retryFromNodeId = state.errorNodeIds[0];
    const previousNodeOutputs = { ...nodeOutputCacheRef.current };
    // Remove failed and skipped nodes from cache
    for (const nid of state.errorNodeIds) delete previousNodeOutputs[nid];
    for (const nid of state.skippedNodeIds) delete previousNodeOutputs[nid];

    const userMessage = lastUserMessageRef.current;
    if (!userMessage) return;

    // Add retry system message
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Retrying from failed node...",
      },
    ]);

    setIsLoading(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await executeFlowMode(userMessage, controller, {
        retryFromNodeId,
        previousNodeOutputs,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        const prevState = flowExecutionStateRef.current;
        flowExecutionStateRef.current = { ...prevState, isRunning: false };
        onExecutionStateChange?.(flowExecutionStateRef.current);
      } else {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      }
    } finally {
      setIsLoading(false);
      assistantMessageIdRef.current = null;
      abortControllerRef.current = null;
      const prevState = flowExecutionStateRef.current;
      flowExecutionStateRef.current = { ...prevState, isRunning: false };
      onExecutionStateChange?.(flowExecutionStateRef.current);
    }
  }, [hasFlow, executeFlowMode, onExecutionStateChange]);

  // Expose retryFromFailed to parent on mount
  useEffect(() => {
    onRetryFromFailed?.(retryFromFailed);
    return () => onRetryFromFailed?.(null);
  }, [retryFromFailed, onRetryFromFailed]);

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
    <div className="flex h-full flex-col bg-background overflow-hidden">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {messages.length === 0 && recoveredMessagesQuery.isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CircleNotch className="size-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-sm">Loading messages...</p>
            </div>
          )}
          {messages.length === 0 && !recoveredMessagesQuery.isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-6">
                <AgentIconAvatar agentName={agentName} size="lg" />
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
                  nodeIcon={message.nodeIcon}
                  nodeType={message.nodeType}
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
              <div key={message.id} className="flex gap-4 justify-end">
                <div className="rounded-2xl px-5 py-3 max-w-[85%] shadow-sm bg-primary text-primary-foreground">
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            );
          })}

          {/* Conversation starters — shown after greeting, before user has typed */}
          {conversationStarters && conversationStarters.length > 0 && !isLoading && messages.every((m) => m.id === "greeting-message") && (
            <div className="flex flex-wrap gap-2 justify-end">
              {conversationStarters.map((starter) => (
                <button
                  key={starter.id}
                  onClick={() => sendMessage(starter.text)}
                  className="px-3 py-1.5 rounded-full border border-[#E5E7EB] bg-white text-sm text-[#374151] hover:bg-[#F3F4F6] transition-colors text-left"
                >
                  {starter.text}
                </button>
              ))}
            </div>
          )}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-4">
              <AgentIconAvatar agentName={agentName} size="md" />
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
      </div>

      {/* Execution Progress Indicator */}
      {isLoading && flowNodes && flowNodes.length > 0 && flowExecutionStateRef.current.isRunning && (
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-t border-blue-200 dark:border-blue-800 flex-shrink-0">
          <div className="size-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-sm text-blue-700 dark:text-blue-300 flex-1">
            {flowExecutionStateRef.current.currentNodeId
              ? `Running: ${flowNodes.find(n => n.id === flowExecutionStateRef.current.currentNodeId)?.data?.label || "Processing..."}`
              : "Processing..."
            }
            {" "}
            ({flowExecutionStateRef.current.completedNodeIds.length + flowExecutionStateRef.current.reusedNodeIds.length}/{flowNodes.filter(n => !["messageReceived", "chatOutcome", "conditionBranch"].includes(n.type)).length})
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
            onClick={() => {
              abortControllerRef.current?.abort();
            }}
          >
            <Stop className="size-4 mr-1" /> Stop
          </Button>
        </div>
      )}

      {/* Input area - Compact floating design */}
      <div className="border-t bg-background/80 backdrop-blur-sm px-3 py-2 flex-shrink-0">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl">
          {/* File badges */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2 px-1">
              {attachedFiles.map((file, i) => (
                <Badge key={`${file.name}-${i}`} variant="secondary" className="gap-1 pr-1">
                  <span className="text-xs truncate max-w-[150px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border bg-card px-3 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-primary/30 transition-shadow">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() && !isLoading) {
                    handleSubmit(e as unknown as FormEvent);
                  }
                }
              }}
              placeholder="Enter message"
              disabled={isLoading}
              rows={1}
              className="flex-1 bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50 resize-none overflow-hidden"
            />
            <div className="flex items-center gap-1 pb-0.5">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/csv,application/json,text/xml,application/xml"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-lg"
                onClick={handleFileClick}
                disabled={isLoading || isUploading}
                title="Attach files"
              >
                <Paperclip className="size-3.5" />
              </Button>
              <VoiceInputButton
                isListening={isListening}
                isTranscribing={isTranscribing}
                onClick={handleMicClick}
                disabled={isLoading}
              />
              <Sheet>
                <SheetTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="size-7 rounded-lg" title="View Pulse Log">
                    <Pulse className="size-3.5" />
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
                className="size-7 rounded-lg"
                disabled={isLoading || isUploading || !input.trim()}
              >
                {isLoading || isUploading ? (
                  <CircleNotch className="size-3.5 animate-spin" />
                ) : (
                  <PaperPlaneTilt className="size-3.5" />
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
