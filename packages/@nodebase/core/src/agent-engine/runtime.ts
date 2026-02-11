/**
 * Agent Runtime - Graph-based execution engine
 * Inspired by LangGraph's ReAct pattern with composable middleware
 */

import type {
  AgentNode,
  AgentEdge,
  AgentState,
  AgentConfig,
  ExecutionContext,
  ExecutionResult,
  Middleware,
  MiddlewareHook,
} from './types';

export class AgentRuntime {
  private nodes: Map<string, AgentNode> = new Map();
  private edges: AgentEdge[] = [];
  private middleware: Middleware[] = [];
  private context: ExecutionContext;

  private startTime: number = 0;
  private totalTokensIn: number = 0;
  private totalTokensOut: number = 0;
  private totalCost: number = 0;
  private toolCallsCount: number = 0;
  private toolSuccesses: number = 0;
  private toolFailures: number = 0;

  constructor(config: AgentConfig) {
    this.context = {
      agentId: config.agentId,
      userId: config.userId,
      workspaceId: config.workspaceId,
      model: config.model,
      temperature: config.temperature,
      safeMode: config.safeMode,
      tools: config.tools,
    };

    this.middleware = config.middleware.sort((a, b) => a.order - b.order);

    // Build the execution graph
    this.buildGraph(config);
  }

  /**
   * Build the execution graph with nodes and edges
   */
  private buildGraph(config: AgentConfig): void {
    // TODO: Build nodes based on agent config
    // For now, create a simple start -> reasoning -> end graph

    this.nodes.set('start', {
      id: 'start',
      type: 'start',
      execute: async (state: AgentState) => {
        return state;
      },
    });

    this.nodes.set('end', {
      id: 'end',
      type: 'end',
      execute: async (state: AgentState) => {
        return state;
      },
    });

    // Edge from start to reasoning
    this.edges.push({
      from: 'start',
      to: 'reasoning',
    });

    // Edge from reasoning to end
    this.edges.push({
      from: 'reasoning',
      to: 'end',
      condition: (state) => state.currentStep >= state.maxSteps,
    });

    // Edge from reasoning back to itself (loop)
    this.edges.push({
      from: 'reasoning',
      to: 'reasoning',
      condition: (state) => state.currentStep < state.maxSteps,
    });
  }

  /**
   * Execute the agent with given initial state
   */
  async execute(initialState: AgentState): Promise<ExecutionResult> {
    this.startTime = Date.now();

    let state: AgentState = {
      ...initialState,
      currentNodeId: 'start',
      currentStep: 0,
    };

    try {
      // Run the graph
      while (state.currentNodeId !== 'end' && state.currentStep < state.maxSteps) {
        // Hook: before_step
        state = await this.runMiddleware('before_step', state);

        const node = this.nodes.get(state.currentNodeId);
        if (!node) {
          throw new Error(`Node ${state.currentNodeId} not found in graph`);
        }

        try {
          // Execute the node
          state = await node.execute(state, this.context);

          // Hook: after_step
          state = await this.runMiddleware('after_step', state);

          // Find next node
          const nextNodeId = this.getNextNode(state.currentNodeId, state);
          state.currentNodeId = nextNodeId;
          state.currentStep++;

        } catch (nodeError) {
          // Hook: on_error
          await this.runMiddleware('on_error', { state, error: nodeError });
          throw nodeError;
        }
      }

      // Hook: on_completion
      await this.runMiddleware('on_completion', state);

      // Build successful result
      return this.buildResult(state, 'completed');

    } catch (error) {
      // Build failed result
      return this.buildResult(state, 'failed', error as Error);
    }
  }

  /**
   * Run middleware hooks for a given hook type
   */
  private async runMiddleware(hook: MiddlewareHook, data: any): Promise<any> {
    let result = data;

    for (const mw of this.middleware) {
      if (mw.hook === hook) {
        try {
          result = await mw.handler(result, this.context);
        } catch (error) {
          console.error(`Middleware ${mw.id} failed on hook ${hook}:`, error);
          // Continue with other middleware
        }
      }
    }

    return result;
  }

  /**
   * Get the next node ID based on current node and state
   */
  private getNextNode(currentNodeId: string, state: AgentState): string {
    // Find all edges from current node
    const outgoingEdges = this.edges.filter(edge => edge.from === currentNodeId);

    // Find the first edge whose condition is met (or no condition)
    for (const edge of outgoingEdges) {
      if (!edge.condition || edge.condition(state)) {
        return edge.to;
      }
    }

    // Default to 'end' if no edge matches
    return 'end';
  }

  /**
   * Build the execution result
   */
  private buildResult(
    finalState: AgentState,
    status: 'completed' | 'failed' | 'timeout' | 'cancelled',
    error?: Error
  ): ExecutionResult {
    const latencyMs = Date.now() - this.startTime;

    return {
      status,
      finalState,
      totalSteps: finalState.currentStep,
      latencyMs,
      totalTokensIn: this.totalTokensIn,
      totalTokensOut: this.totalTokensOut,
      totalCost: this.totalCost,
      toolCallsCount: this.toolCallsCount,
      toolSuccesses: this.toolSuccesses,
      toolFailures: this.toolFailures,
      error,
    };
  }

  /**
   * Update token usage stats (called by middleware or nodes)
   */
  public updateTokenUsage(tokensIn: number, tokensOut: number, cost: number): void {
    this.totalTokensIn += tokensIn;
    this.totalTokensOut += tokensOut;
    this.totalCost += cost;
  }

  /**
   * Update tool usage stats (called by middleware or nodes)
   */
  public updateToolUsage(success: boolean): void {
    this.toolCallsCount++;
    if (success) {
      this.toolSuccesses++;
    } else {
      this.toolFailures++;
    }
  }
}
