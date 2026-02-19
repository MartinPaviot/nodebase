/**
 * Executor Engine
 *
 * Main BFS execution loop with fail-fast error handling.
 * Inspired by LangGraph: typed state, conditional edges, fail-fast.
 */

import { ClaudeClient, type ModelTier } from "@/lib/ai/claude-client";
import { AgentTracer } from "@elevay/core";
import prisma from "@/lib/db";
import { calculateCost, getPlatformApiKey } from "@/lib/config";
import { validateFlowGraph } from "./graph-validator";
import { buildAdjacencyList, findStartNodes, buildLoopMap, findLoopBody } from "./graph-builder";
import { getFlowNodeExecutor } from "./executors";
import type {
  FlowData,
  FlowSSEEvent,
  FlowState,
  FlowExecutorConfig,
  FlowNode,
  AdjacencyEdge,
  NodeExecContext,
  NodeOutput,
} from "./types";

const TRIGGER_TYPES = new Set(["messageReceived", "trigger", "webhookTrigger"]);
const SKIP_TYPES = new Set(["addNode", "loopContainer"]);
// Structural passthrough nodes that should NOT be marked "completed" if they have no outgoing edges
const LEAF_AWARE_STRUCTURAL = new Set(["chatOutcome", "conditionBranch"]);

export async function executeFlow(
  flowData: FlowData,
  config: FlowExecutorConfig,
  emit: (event: FlowSSEEvent) => void,
): Promise<void> {
  const { agent, userMessage, conversationId, userId } = config;

  // 1. Validate graph
  const validation = validateFlowGraph(flowData.nodes, flowData.edges);
  if (!validation.valid) {
    emit({ type: "flow-error", error: `Invalid flow graph: ${validation.errors.join("; ")}` });
    return;
  }

  // 2. Get platform API key
  const apiKey = getPlatformApiKey();
  const claudeClient = new ClaudeClient(apiKey);

  // 3. Build graph structures
  const nodeMap = new Map(flowData.nodes.map((n) => [n.id, n]));
  const adj = buildAdjacencyList(flowData.edges);
  const startNodeIds = validation.startNodeIds;
  const loopMap = buildLoopMap(flowData.nodes);

  // 4. Initialize typed state (with conversation context if available)
  const state: FlowState = {
    userMessage,
    nodeOutputs: new Map(),
    loopStack: [],
    errors: [],
    conversationContext: config.conversationContext,
    agentMemories: config.agentMemories,
  };

  // 4b. Retry support: pre-populate cached outputs from previous run
  const reusableNodeIds = new Set<string>();
  if (config.retryConfig) {
    const { retryFromNodeId, previousNodeOutputs } = config.retryConfig;
    for (const [nid, output] of Object.entries(previousNodeOutputs)) {
      // Don't reuse the failed node or anything that wasn't successfully completed
      if (nid === retryFromNodeId) continue;
      if (output.kind === "error") continue;
      state.nodeOutputs.set(nid, output);
      reusableNodeIds.add(nid);
    }
  }

  // 5. Initialize tracer
  const tracer = new AgentTracer(
    {
      agentId: agent.id,
      conversationId: conversationId || undefined,
      userId,
      workspaceId: agent.workspaceId || userId,
      triggeredBy: "flow",
      userMessage,
    },
    async (trace) => {
      try {
        await prisma.agentTrace.create({
          data: {
            id: trace.id,
            agentId: trace.agentId,
            conversationId: trace.conversationId || conversationId || "",
            userId: trace.userId,
            workspaceId: trace.workspaceId,
            status: trace.status === "failed" ? "FAILED" : "COMPLETED",
            steps: JSON.parse(JSON.stringify(trace.steps)),
            totalSteps: trace.metrics.stepsCount,
            maxSteps: 50,
            totalTokensIn: trace.metrics.totalTokensIn,
            totalTokensOut: trace.metrics.totalTokensOut,
            totalCost: trace.metrics.totalCost,
            toolCalls: [],
            toolSuccesses: trace.metrics.toolCalls,
            toolFailures: state.errors.length,
            latencyMs: trace.durationMs,
            completedAt: trace.completedAt,
          },
        });
      } catch (saveError) {
        console.warn("Failed to persist flow trace:", saveError);
      }
    },
  );

  // 6. BFS traversal
  const executedNodes = new Set<string>();
  const skippedNodes = new Set<string>();
  const queue: string[] = [];

  // Start from triggers' children
  for (const startId of startNodeIds) {
    const startNode = nodeMap.get(startId);
    if (!startNode) continue;

    if (TRIGGER_TYPES.has(startNode.type)) {
      executedNodes.add(startId);

      if (reusableNodeIds.has(startId)) {
        // Retry: reuse cached trigger output
        const cachedOutput = state.nodeOutputs.get(startId)!;
        emit({ type: "node-reused", nodeId: startId, output: cachedOutput });
      } else {
        emit({ type: "node-start", nodeId: startId, label: (startNode.data?.label as string) || startNode.type });
        const triggerOutput = { kind: "trigger" as const, message: userMessage };
        state.nodeOutputs.set(startId, triggerOutput);
        emit({ type: "node-complete", nodeId: startId, output: triggerOutput });
      }

      const edges = adj.get(startId) || [];
      for (const edge of edges) queue.push(edge.target);
    } else {
      queue.push(startId);
    }
  }

  // Main execution loop
  let isFirstNode = true;

  while (queue.length > 0) {
    const nodeId = queue.shift()!;

    if (executedNodes.has(nodeId) || skippedNodes.has(nodeId)) continue;

    const node = nodeMap.get(nodeId);
    if (!node) continue;
    if (SKIP_TYPES.has(node.type)) continue;

    // Skip structural passthrough nodes that have no downstream connections
    // (e.g. chatOutcome "After message sent" not connected to anything)
    if (LEAF_AWARE_STRUCTURAL.has(node.type) && (adj.get(nodeId) || []).length === 0) {
      executedNodes.add(nodeId); // prevent re-processing
      continue;
    }

    // Retry: reuse cached output instead of re-executing
    if (reusableNodeIds.has(nodeId)) {
      const cachedOutput = state.nodeOutputs.get(nodeId)!;
      executedNodes.add(nodeId);
      emit({ type: "node-reused", nodeId, output: cachedOutput });

      // Follow edges (respect condition branches)
      const edges = adj.get(nodeId) || [];
      if (node.type === "condition" && cachedOutput.kind === "condition" && typeof cachedOutput.branchIndex === "number") {
        // Use branchIndex to build the sourceHandle (e.g. "branch-0"), not the branch ID
        const branchHandle = `branch-${cachedOutput.branchIndex}`;
        const branchEdges = edges.filter((e) => e.sourceHandle === branchHandle);
        const edgesToFollow = branchEdges.length > 0 ? branchEdges : edges;
        for (const edge of edgesToFollow) queue.push(edge.target);
      } else {
        for (const edge of edges) queue.push(edge.target);
      }
      continue;
    }

    const label = (node.data?.label as string) || node.type;
    emit({ type: "node-start", nodeId, label });

    // Brief pause after trigger so the blue dot animation is visible on the edge
    if (isFirstNode) {
      isFirstNode = false;
      await new Promise((r) => setTimeout(r, 1000));
    }

    try {
      // Build executor context
      const ctx: NodeExecContext = {
        state,
        node,
        adjacency: adj,
        nodeMap,
        claudeClient,
        systemPrompt: agent.systemPrompt,
        userId,
        agentId: agent.id,
        agentEvalRules: agent.evalRules,
        conversationId,
        emit,
      };

      // Execute node
      const startTime = Date.now();
      const executor = getFlowNodeExecutor(node.type);
      const result = await executor(ctx);
      const durationMs = Date.now() - startTime;

      // Handle exitLoop re-iteration (also handle "loop" type from AI builder)
      if ((node.type === "exitLoop" || node.type === "loop") && result.output.kind === "loop" && !result.output.completed) {
        const loopOutput = result.output;
        // More iterations — re-queue loop body
        const activeLoop = state.loopStack.find(
          (l) => l.loopNumber === loopOutput.loopNumber,
        );
        if (activeLoop) {
          for (const bodyNodeId of activeLoop.nodesInLoop) {
            executedNodes.delete(bodyNodeId);
          }
          const enterEdges = adj.get(activeLoop.enterNodeId) || [];
          for (const edge of enterEdges) {
            queue.unshift(edge.target);
          }
        }
        emit({ type: "node-complete", nodeId, output: loopOutput });
        continue; // Don't mark exitLoop as executed, don't follow outgoing edges
      }

      // Store output in state
      state.nodeOutputs.set(nodeId, result.output);
      executedNodes.add(nodeId);

      // Log to tracer (non-critical — never crash the flow for tracing)
      try {
        if (result.output.kind === "ai-response") {
          tracer.logLLMCall({
            model: result.output.model,
            input: userMessage,
            output: result.output.content,
            tokensIn: result.output.tokensIn,
            tokensOut: result.output.tokensOut,
            cost: calculateCost(result.output.tokensIn, result.output.tokensOut, toModelTier(node.data?.model)),
            durationMs,
          });
        } else if (result.output.kind !== "passthrough" && result.output.kind !== "trigger") {
          tracer.logToolCall({
            toolName: `${node.type}:${label}`,
            input: node.data || {},
            output: result.output as unknown as Record<string, unknown>,
            success: result.output.kind !== "error",
            durationMs,
          });
        }
      } catch (tracerError) {
        console.warn("Flow tracer logging failed (non-fatal):", tracerError);
      }

      // FAIL-FAST on graceful error outputs (e.g. Composio failures)
      if (result.output.kind === "error") {
        const errMsg = result.output.error || "Unknown error";
        emit({ type: "node-error", nodeId, error: errMsg, fatal: true });
        markDownstreamSkipped(nodeId, adj, nodeMap, executedNodes, skippedNodes, emit);
        emit({ type: "flow-error", error: `Flow stopped: node "${label}" failed — ${errMsg}` });
        try { await tracer.complete({ status: "failed" }); } catch { /* ignore */ }
        return;
      }

      // Emit node complete (only for successful outputs)
      emit({ type: "node-complete", nodeId, output: result.output });

      // Follow edges
      const edges = adj.get(nodeId) || [];

      if (node.type === "condition" && result.selectedBranch) {
        // Condition: follow only the selected branch
        const branchEdges = edges.filter((e) => e.sourceHandle === result.selectedBranch);
        const edgesToFollow = branchEdges.length > 0 ? branchEdges : edges;
        for (const edge of edgesToFollow) queue.push(edge.target);
      } else {
        for (const edge of edges) queue.push(edge.target);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error(`Flow executor: node ${nodeId} (${node.type}) failed:`, error);
      if (errorStack) console.error("Stack trace:", errorStack);

      tracer.logError(error instanceof Error ? error : new Error(errorMsg));

      state.errors.push({
        nodeId,
        nodeType: node.type,
        error: errorMsg,
        timestamp: new Date(),
      });

      // FAIL-FAST: emit error, skip all downstream nodes
      emit({ type: "node-error", nodeId, error: errorMsg, fatal: true });
      executedNodes.add(nodeId);

      // Mark all reachable downstream nodes as skipped
      markDownstreamSkipped(nodeId, adj, nodeMap, executedNodes, skippedNodes, emit);

      // Emit flow error and stop
      emit({ type: "flow-error", error: `Flow stopped: node "${label}" failed — ${errorMsg}` });

      try {
        await tracer.complete({ status: "failed" });
      } catch {
        // Ignore tracer errors
      }
      return;
    }
  }

  // Flow complete
  const outputRecord: Record<string, unknown> = {};
  for (const [id, output] of state.nodeOutputs.entries()) {
    outputRecord[id] = output;
  }
  emit({ type: "flow-complete", output: outputRecord });

  try {
    await tracer.complete({ status: "completed" });
  } catch {
    // Ignore tracer errors
  }
}

const VALID_TIERS = new Set<string>(["fast", "smart", "deep"]);

function toModelTier(value: unknown): "fast" | "smart" | "deep" {
  if (typeof value === "string" && VALID_TIERS.has(value)) return value as ModelTier;
  return "smart";
}

/** BFS to find and skip all downstream nodes from a failed node */
function markDownstreamSkipped(
  failedNodeId: string,
  adj: Map<string, AdjacencyEdge[]>,
  nodeMap: Map<string, FlowNode>,
  executedNodes: Set<string>,
  skippedNodes: Set<string>,
  emit: (event: FlowSSEEvent) => void,
): void {
  const queue = [...(adj.get(failedNodeId) || []).map((e) => e.target)];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId) || executedNodes.has(nodeId)) continue;
    visited.add(nodeId);
    skippedNodes.add(nodeId);

    const node = nodeMap.get(nodeId);
    const label = (node?.data?.label as string) || node?.type || nodeId;
    emit({ type: "node-skipped", nodeId, reason: `Skipped due to upstream failure` });

    const edges = adj.get(nodeId) || [];
    for (const edge of edges) queue.push(edge.target);
  }
}
