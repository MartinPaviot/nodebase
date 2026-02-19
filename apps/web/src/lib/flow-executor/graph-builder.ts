/**
 * Graph Builder
 *
 * Builds adjacency lists, finds start nodes, computes loop boundaries.
 * Extracted from the original route.ts for clean separation.
 */

import type { FlowNode, FlowEdge, AdjacencyEdge } from "./types";

/** Build adjacency list from edges (source → outgoing edges) */
export function buildAdjacencyList(edges: FlowEdge[]): Map<string, AdjacencyEdge[]> {
  const adj = new Map<string, AdjacencyEdge[]>();
  for (const edge of edges) {
    const list = adj.get(edge.source) || [];
    list.push({
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      edgeId: edge.id,
    });
    adj.set(edge.source, list);
  }
  return adj;
}

const TRIGGER_TYPES = new Set(["messageReceived", "trigger", "webhookTrigger"]);

/** Find trigger/start nodes — explicit triggers first, then root nodes, then first node */
export function findStartNodes(nodes: FlowNode[], edges: FlowEdge[]): string[] {
  const nodesWithIncoming = new Set(edges.map((e) => e.target));

  // 1. Explicit trigger nodes
  const triggers = nodes.filter((n) => TRIGGER_TYPES.has(n.type));
  if (triggers.length > 0) return triggers.map((n) => n.id);

  // 2. Nodes with no incoming edges
  const roots = nodes.filter((n) => !nodesWithIncoming.has(n.id));
  if (roots.length > 0) return roots.map((n) => n.id);

  // 3. Last resort: first node
  return nodes.length > 0 ? [nodes[0].id] : [];
}

/** Find all nodes between enterLoop and exitLoop via BFS */
export function findLoopBody(
  enterNodeId: string,
  exitNodeId: string,
  adj: Map<string, AdjacencyEdge[]>,
): string[] {
  const body: string[] = [];
  const visited = new Set<string>();
  const queue = [enterNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    if (current === exitNodeId) continue; // Don't traverse past exit
    if (current !== enterNodeId) body.push(current);

    const edges = adj.get(current) || [];
    for (const edge of edges) {
      if (!visited.has(edge.target)) {
        queue.push(edge.target);
      }
    }
  }

  return body;
}

/** Pre-compute loop boundaries: match enterLoop → exitLoop by loopNumber */
export function buildLoopMap(
  nodes: FlowNode[],
): Map<number, { enter: string; exit: string }> {
  const loopMap = new Map<number, { enter: string; exit: string }>();

  for (const node of nodes) {
    if (node.type === "enterLoop" && node.data?.loopNumber != null) {
      const ln = node.data.loopNumber as number;
      const entry = loopMap.get(ln) || { enter: "", exit: "" };
      entry.enter = node.id;
      loopMap.set(ln, entry);
    }
    if (node.type === "exitLoop" && node.data?.loopNumber != null) {
      const ln = node.data.loopNumber as number;
      const entry = loopMap.get(ln) || { enter: "", exit: "" };
      entry.exit = node.id;
      loopMap.set(ln, entry);
    }
  }

  return loopMap;
}
