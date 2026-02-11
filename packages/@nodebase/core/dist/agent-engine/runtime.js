"use strict";
/**
 * Agent Runtime - Graph-based execution engine
 * Inspired by LangGraph's ReAct pattern with composable middleware
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRuntime = void 0;
class AgentRuntime {
    nodes = new Map();
    edges = [];
    middleware = [];
    context;
    startTime = 0;
    totalTokensIn = 0;
    totalTokensOut = 0;
    totalCost = 0;
    toolCallsCount = 0;
    toolSuccesses = 0;
    toolFailures = 0;
    constructor(config) {
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
    buildGraph(config) {
        // TODO: Build nodes based on agent config
        // For now, create a simple start -> reasoning -> end graph
        this.nodes.set('start', {
            id: 'start',
            type: 'start',
            execute: async (state) => {
                return state;
            },
        });
        this.nodes.set('end', {
            id: 'end',
            type: 'end',
            execute: async (state) => {
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
    async execute(initialState) {
        this.startTime = Date.now();
        let state = {
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
                }
                catch (nodeError) {
                    // Hook: on_error
                    await this.runMiddleware('on_error', { state, error: nodeError });
                    throw nodeError;
                }
            }
            // Hook: on_completion
            await this.runMiddleware('on_completion', state);
            // Build successful result
            return this.buildResult(state, 'completed');
        }
        catch (error) {
            // Build failed result
            return this.buildResult(state, 'failed', error);
        }
    }
    /**
     * Run middleware hooks for a given hook type
     */
    async runMiddleware(hook, data) {
        let result = data;
        for (const mw of this.middleware) {
            if (mw.hook === hook) {
                try {
                    result = await mw.handler(result, this.context);
                }
                catch (error) {
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
    getNextNode(currentNodeId, state) {
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
    buildResult(finalState, status, error) {
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
    updateTokenUsage(tokensIn, tokensOut, cost) {
        this.totalTokensIn += tokensIn;
        this.totalTokensOut += tokensOut;
        this.totalCost += cost;
    }
    /**
     * Update tool usage stats (called by middleware or nodes)
     */
    updateToolUsage(success) {
        this.toolCallsCount++;
        if (success) {
            this.toolSuccesses++;
        }
        else {
            this.toolFailures++;
        }
    }
}
exports.AgentRuntime = AgentRuntime;
