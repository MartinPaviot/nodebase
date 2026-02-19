/**
 * Flow Executor Types
 *
 * Typed state schema inspired by LangGraph.
 * Every node output is discriminated by `kind` for type safety.
 */

import type { ClaudeClient } from "@/lib/ai/claude-client";

// ============================================
// GRAPH TYPES
// ============================================

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data?: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface AdjacencyEdge {
  target: string;
  sourceHandle: string | null;
  edgeId: string;
}

// ============================================
// TYPED NODE OUTPUTS (discriminated union)
// ============================================

export type NodeOutput =
  | { kind: "trigger"; message: string }
  | { kind: "ai-response"; content: string; tokensIn: number; tokensOut: number; model: string }
  | { kind: "condition"; selectedBranch: string; branchIndex: number; method: "deterministic" | "llm"; reasoning?: string }
  | { kind: "loop"; loopNumber: number; currentIndex: number; collectionSize: number; completed: boolean }
  | { kind: "integration"; service: string; action: string; success: boolean; data?: unknown; evalPassed?: boolean }
  | { kind: "knowledge-search"; resultCount: number; context: string }
  | { kind: "passthrough"; nodeType: string }
  | { kind: "error"; error: string; nodeType: string };

// ============================================
// CONVERSATION CONTEXT (for memory persistence)
// ============================================

export interface ConversationContextMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
}

export interface ConversationContext {
  recentMessages: ConversationContextMessage[];
  summary?: string;
}

export interface AgentMemoryEntry {
  key: string;
  value: string;
  category: string;
}

// ============================================
// FLOW STATE
// ============================================

export interface FlowState {
  userMessage: string;
  nodeOutputs: Map<string, NodeOutput>;
  loopStack: LoopState[];
  currentLoopItem?: unknown;
  errors: NodeError[];
  /** Conversation context from the chat that triggered this flow */
  conversationContext?: ConversationContext;
  /** Agent's persistent memories */
  agentMemories?: AgentMemoryEntry[];
}

export interface LoopState {
  loopNumber: number;
  collection: unknown[];
  currentIndex: number;
  maxIterations: number;
  enterNodeId: string;
  exitNodeId: string;
  nodesInLoop: string[];
}

export interface NodeError {
  nodeId: string;
  nodeType: string;
  error: string;
  timestamp: Date;
}

// ============================================
// SSE EVENTS
// ============================================

export type FlowSSEEvent =
  | { type: "node-start"; nodeId: string; label: string }
  | { type: "node-complete"; nodeId: string; output: NodeOutput }
  | { type: "node-reused"; nodeId: string; output: NodeOutput }
  | { type: "node-error"; nodeId: string; error: string; fatal: boolean }
  | { type: "node-skipped"; nodeId: string; reason: string }
  | { type: "text-delta"; delta: string; nodeId: string }
  | { type: "eval-result"; nodeId: string; passed: boolean; l2Score: number }
  | { type: "flow-complete"; output: Record<string, unknown> }
  | { type: "flow-error"; error: string };

// ============================================
// NODE EXECUTOR INTERFACE
// ============================================

export interface NodeExecContext {
  state: FlowState;
  node: FlowNode;
  adjacency: Map<string, AdjacencyEdge[]>;
  nodeMap: Map<string, FlowNode>;
  claudeClient: ClaudeClient;
  systemPrompt: string;
  userId: string;
  agentId: string;
  agentEvalRules: unknown;
  conversationId: string | null;
  emit: (event: FlowSSEEvent) => void;
}

export interface NodeExecResult {
  output: NodeOutput;
  /** For condition nodes: which sourceHandle to follow (e.g. "branch-0") */
  selectedBranch?: string;
  /** If true, text was already streamed via text-delta SSE events */
  streamed?: boolean;
}

export type NodeExecutorFn = (ctx: NodeExecContext) => Promise<NodeExecResult>;

// ============================================
// GRAPH VALIDATION
// ============================================

export interface GraphValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  startNodeIds: string[];
}

// ============================================
// EXECUTOR CONFIG
// ============================================

export interface FlowExecutorConfig {
  agent: {
    id: string;
    systemPrompt: string;
    temperature: number;
    evalRules: unknown;
    userId: string;
    workspaceId: string | null;
  };
  userMessage: string;
  conversationId: string | null;
  userId: string;
  /** If present, retry from a specific failed node using cached outputs. */
  retryConfig?: {
    retryFromNodeId: string;
    previousNodeOutputs: Record<string, NodeOutput>;
  };
  /** Conversation context from the chat session that triggered this flow */
  conversationContext?: ConversationContext;
  /** Agent's persistent memories to inject into flow node context */
  agentMemories?: AgentMemoryEntry[];
}
