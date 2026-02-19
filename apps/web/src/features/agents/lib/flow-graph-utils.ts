/**
 * Flow Graph Utilities
 *
 * Utilities for analyzing the flow graph at design time (in the canvas).
 * Used by the inject sidebar to discover upstream nodes and their fields.
 */

import { getNodeOutputSchema, type OutputField } from "./node-output-schemas";

export interface UpstreamNode {
  id: string;
  label: string;
  type: string;
  icon?: string;
  stepNumber: number;
  fields: OutputField[];
}

interface GraphNode {
  id: string;
  type: string;
  data?: Record<string, unknown>;
}

interface GraphEdge {
  source: string;
  target: string;
}

/** Node types that are structural/visual and don't produce useful output */
const SKIP_TYPES = new Set([
  "conditionBranch", "addNode", "loopContainer", "chatOutcome",
  "selectAction", "exitLoop",
]);

/**
 * Find all upstream nodes that can provide data to a given target node.
 * Uses reverse BFS along edges. Returns nodes ordered by step number (flow order).
 */
export function getUpstreamNodes(
  targetNodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): UpstreamNode[] {
  // Build reverse adjacency list (target → sources)
  const reverseAdj = new Map<string, string[]>();
  for (const edge of edges) {
    const sources = reverseAdj.get(edge.target) || [];
    sources.push(edge.source);
    reverseAdj.set(edge.target, sources);
  }

  // Node map for quick lookup
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // BFS backward from target to find all ancestors
  const visited = new Set<string>();
  const queue = [targetNodeId];
  const upstreamIds: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    // Don't include the target node itself
    if (current !== targetNodeId) {
      upstreamIds.push(current);
    }

    const sources = reverseAdj.get(current) || [];
    for (const sourceId of sources) {
      if (!visited.has(sourceId)) {
        queue.push(sourceId);
      }
    }
  }

  // Build forward adjacency for topological ordering (to assign step numbers)
  const forwardAdj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const node of nodes) {
    forwardAdj.set(node.id, []);
    inDegree.set(node.id, 0);
  }
  for (const edge of edges) {
    forwardAdj.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Kahn's algorithm for topological order
  const topoOrder: string[] = [];
  const topoQueue = [...nodes.filter((n) => (inDegree.get(n.id) || 0) === 0).map((n) => n.id)];
  while (topoQueue.length > 0) {
    const nodeId = topoQueue.shift()!;
    topoOrder.push(nodeId);
    for (const neighbor of forwardAdj.get(nodeId) || []) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) topoQueue.push(neighbor);
    }
  }

  // Assign step numbers based on topological order (only for upstream nodes)
  const upstreamSet = new Set(upstreamIds);
  const stepNumberMap = new Map<string, number>();
  let stepCounter = 1;
  for (const nodeId of topoOrder) {
    if (upstreamSet.has(nodeId)) {
      stepNumberMap.set(nodeId, stepCounter++);
    }
  }

  // Build result, filtering out structural nodes
  const result: UpstreamNode[] = [];

  for (const nodeId of upstreamIds) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;
    if (SKIP_TYPES.has(node.type)) continue;

    const schema = getNodeOutputSchema(node.type, node.data);
    if (schema.fields.length === 0) continue;

    result.push({
      id: node.id,
      label: (node.data?.label as string) || node.type,
      type: node.type,
      icon: node.data?.icon as string | undefined,
      stepNumber: stepNumberMap.get(nodeId) || 0,
      fields: schema.fields,
    });
  }

  // Sort by step number (flow order)
  result.sort((a, b) => a.stepNumber - b.stepNumber);

  return result;
}
