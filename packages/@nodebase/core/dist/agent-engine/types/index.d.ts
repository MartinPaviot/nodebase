/**
 * Core types for Agent Engine
 * Inspired by LangGraph's graph-based execution model
 */
export interface Message {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    name?: string;
}
export interface ToolResult {
    toolName: string;
    input: Record<string, any>;
    output: any;
    success: boolean;
    error?: string;
    latencyMs?: number;
}
export interface AgentState {
    conversationId: string;
    agentId: string;
    userId: string;
    workspaceId: string;
    messages: Message[];
    toolResults: ToolResult[];
    memories: Record<string, any>;
    ragContext: string[];
    currentStep: number;
    maxSteps: number;
    currentNodeId: string;
    metadata: Record<string, any>;
}
export interface ExecutionContext {
    agentId: string;
    userId: string;
    workspaceId: string;
    traceId?: string;
    model: string;
    temperature: number;
    safeMode: boolean;
    tools: Tool[];
}
export interface Tool {
    name: string;
    description: string;
    parameters: Record<string, any>;
    execute: (input: Record<string, any>, context: ExecutionContext) => Promise<any>;
}
export interface AgentNode {
    id: string;
    type: 'reasoning' | 'action' | 'observation' | 'decision' | 'start' | 'end';
    execute: (state: AgentState, context: ExecutionContext) => Promise<AgentState>;
}
export interface AgentEdge {
    from: string;
    to: string;
    condition?: (state: AgentState) => boolean;
}
export interface AgentConfig {
    agentId: string;
    userId: string;
    workspaceId: string;
    model: string;
    temperature: number;
    maxSteps: number;
    safeMode: boolean;
    systemPrompt: string;
    context?: string;
    tools: Tool[];
    middleware: Middleware[];
}
export interface ExecutionResult {
    status: 'completed' | 'failed' | 'timeout' | 'cancelled';
    finalState: AgentState;
    totalSteps: number;
    latencyMs: number;
    totalTokensIn: number;
    totalTokensOut: number;
    totalCost: number;
    toolCallsCount: number;
    toolSuccesses: number;
    toolFailures: number;
    evalResult?: EvalResult;
    error?: Error;
}
export interface EvalResult {
    l1Passed: boolean;
    l1Failures?: string[];
    l2Score?: number;
    l2Breakdown?: Record<string, number>;
    l3Triggered: boolean;
    l3Blocked?: boolean;
    l3Reason?: string;
}
export type MiddlewareHook = 'before_step' | 'after_step' | 'before_tool' | 'after_tool' | 'before_llm' | 'after_llm' | 'on_error' | 'on_completion';
export interface Middleware {
    id: string;
    hook: MiddlewareHook;
    handler: (data: any, context: ExecutionContext) => Promise<any>;
    order: number;
}
export interface TraceStep {
    stepNumber: number;
    nodeId: string;
    nodeType: string;
    action: string;
    input?: any;
    output?: any;
    error?: string;
    latencyMs: number;
    timestamp: Date;
}
export interface LlmCallData {
    agentId: string;
    userId: string;
    workspaceId: string;
    traceId?: string;
    model: string;
    tokensIn: number;
    tokensOut: number;
    cost: number;
    latencyMs: number;
    stepNumber: number;
    action: string;
    toolName?: string;
    toolInput?: Record<string, any>;
    toolOutput?: any;
}
//# sourceMappingURL=index.d.ts.map