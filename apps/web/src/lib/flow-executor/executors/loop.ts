/**
 * Loop Executors (enterLoop / exitLoop)
 *
 * Manages loop state with maxIterations guard.
 */

import { buildLoopMap, findLoopBody } from "../graph-builder";
import type { NodeExecContext, NodeExecResult, LoopState } from "../types";

const DEFAULT_MAX_ITERATIONS = 100;

export async function executeEnterLoop(ctx: NodeExecContext): Promise<NodeExecResult> {
  const { node, state, adjacency } = ctx;

  const loopNum = node.data?.loopNumber as number;
  const maxIterations = (node.data?.maxIterations as number) || DEFAULT_MAX_ITERATIONS;

  // Find matching exitLoop
  const exitNode = findExitLoopNode(ctx, loopNum);

  // Resolve collection from previous node output or configured source
  let collection: unknown[] = [];
  const collectionSource = node.data?.collectionSource as string;

  if (collectionSource && state.nodeOutputs.has(collectionSource)) {
    const srcOutput = state.nodeOutputs.get(collectionSource)!;
    if ("data" in srcOutput && Array.isArray(srcOutput.data)) {
      collection = srcOutput.data;
    } else if ("content" in srcOutput && typeof srcOutput.content === "string") {
      // Try to parse JSON array from AI response
      try {
        const parsed = JSON.parse(srcOutput.content);
        if (Array.isArray(parsed)) collection = parsed;
      } catch {
        // Not JSON, use as single item
      }
    }
  }

  // Fallback: single-item placeholder
  if (collection.length === 0) {
    collection = [{ index: 0, data: state.userMessage }];
  }

  // Cap collection at maxIterations
  if (collection.length > maxIterations) {
    collection = collection.slice(0, maxIterations);
  }

  // Compute loop body nodes
  const bodyNodes = exitNode
    ? findLoopBody(node.id, exitNode, adjacency)
    : [];

  // Push loop context onto stack
  const loopState: LoopState = {
    loopNumber: loopNum,
    collection,
    currentIndex: 0,
    maxIterations,
    enterNodeId: node.id,
    exitNodeId: exitNode || "",
    nodesInLoop: bodyNodes,
  };
  state.loopStack.push(loopState);

  // Set first item as current
  state.currentLoopItem = collection[0];

  return {
    output: {
      kind: "loop",
      loopNumber: loopNum,
      currentIndex: 0,
      collectionSize: collection.length,
      completed: false,
    },
  };
}

/**
 * exitLoop returns a special result that the engine interprets:
 * - If more items: engine re-queues loop body nodes
 * - If done: engine pops loop from stack and continues
 */
export async function executeExitLoop(ctx: NodeExecContext): Promise<NodeExecResult> {
  const { node, state } = ctx;
  const loopNum = node.data?.loopNumber as number;

  const activeLoop = state.loopStack.find((l) => l.loopNumber === loopNum);

  if (!activeLoop) {
    return {
      output: {
        kind: "loop",
        loopNumber: loopNum,
        currentIndex: 0,
        collectionSize: 0,
        completed: true,
      },
    };
  }

  activeLoop.currentIndex++;

  const hasMore =
    activeLoop.currentIndex < activeLoop.collection.length &&
    activeLoop.currentIndex < activeLoop.maxIterations;

  if (hasMore) {
    state.currentLoopItem = activeLoop.collection[activeLoop.currentIndex];
  } else {
    // Loop complete — pop from stack
    const idx = state.loopStack.indexOf(activeLoop);
    if (idx >= 0) state.loopStack.splice(idx, 1);
    state.currentLoopItem = undefined;
  }

  return {
    output: {
      kind: "loop",
      loopNumber: loopNum,
      currentIndex: activeLoop.currentIndex,
      collectionSize: activeLoop.collection.length,
      completed: !hasMore,
    },
  };
}

/** Find the exitLoop node ID matching this loopNumber */
function findExitLoopNode(ctx: NodeExecContext, loopNum: number): string | null {
  for (const [nodeId, node] of ctx.nodeMap.entries()) {
    if (node.type === "exitLoop" && node.data?.loopNumber === loopNum) {
      return nodeId;
    }
  }
  return null;
}
