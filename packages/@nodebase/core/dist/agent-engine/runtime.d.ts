/**
 * Agent Runtime - Graph-based execution engine
 * Inspired by LangGraph's ReAct pattern with composable middleware
 */
import type { AgentState, AgentConfig, ExecutionResult } from './types';
export declare class AgentRuntime {
    private nodes;
    private edges;
    private middleware;
    private context;
    private startTime;
    private totalTokensIn;
    private totalTokensOut;
    private totalCost;
    private toolCallsCount;
    private toolSuccesses;
    private toolFailures;
    constructor(config: AgentConfig);
    /**
     * Build the execution graph with nodes and edges
     */
    private buildGraph;
    /**
     * Execute the agent with given initial state
     */
    execute(initialState: AgentState): Promise<ExecutionResult>;
    /**
     * Run middleware hooks for a given hook type
     */
    private runMiddleware;
    /**
     * Get the next node ID based on current node and state
     */
    private getNextNode;
    /**
     * Build the execution result
     */
    private buildResult;
    /**
     * Update token usage stats (called by middleware or nodes)
     */
    updateTokenUsage(tokensIn: number, tokensOut: number, cost: number): void;
    /**
     * Update tool usage stats (called by middleware or nodes)
     */
    updateToolUsage(success: boolean): void;
}
//# sourceMappingURL=runtime.d.ts.map