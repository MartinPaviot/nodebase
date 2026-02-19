/**
 * Graph Validator
 *
 * Validates the flow graph BEFORE execution.
 * Catches cycles, malformed loops, orphan edges, and missing start nodes.
 * Uses the `toposort` package (already installed) for cycle detection.
 */

import toposort from "toposort";
import type { FlowNode, FlowEdge, GraphValidationResult } from "./types";
import { findStartNodes, buildLoopMap } from "./graph-builder";
import { NODE_TYPE_SPECS, validateNodeData } from "@/features/agents/lib/node-type-specs";

export function validateFlowGraph(
  nodes: FlowNode[],
  edges: FlowEdge[],
  connectedIntegrations?: string[],
): GraphValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  // 1. Check for empty graph
  if (nodes.length === 0) {
    return { valid: false, errors: ["Flow has no nodes"], warnings: [], startNodeIds: [] };
  }

  // 2. Orphan edges — source or target doesn't exist
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge "${edge.id}" references non-existent source node "${edge.source}"`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge "${edge.id}" references non-existent target node "${edge.target}"`);
    }
  }

  // 3. Start nodes
  const startNodeIds = findStartNodes(nodes, edges);
  if (startNodeIds.length === 0) {
    errors.push("No start node found (need a trigger or root node)");
  }

  // 4. Loop integrity — every enterLoop has a matching exitLoop
  const loopMap = buildLoopMap(nodes);
  for (const [loopNum, { enter, exit }] of loopMap.entries()) {
    if (!enter) {
      errors.push(`Loop ${loopNum}: missing enterLoop node`);
    }
    if (!exit) {
      errors.push(`Loop ${loopNum}: missing exitLoop node`);
    }
  }

  // 5. Cycle detection — exclude loop-back edges and collapse structural nodes
  const loopBackEdgeTargets = new Set<string>();
  for (const { enter } of loopMap.values()) {
    if (enter) loopBackEdgeTargets.add(enter);
  }

  // Node types that are structural/UI-only passthroughs — they relay execution
  // without doing real work and create false cycles in the toposort graph.
  // We collapse them: A → passthrough → B becomes A → B.
  const STRUCTURAL_TYPES = new Set([
    "conditionBranch", "chatOutcome", "addNode", "selectAction", "loopContainer",
  ]);
  const structuralIds = new Set(
    nodes.filter((n) => STRUCTURAL_TYPES.has(n.type)).map((n) => n.id),
  );

  // Build edges for toposort, excluding edges whose source is an exitLoop or loop node.
  // "exitLoop" = standard loop exit nodes; "loop" = AI-builder-created loop nodes.
  const loopNodeIds = new Set(
    nodes
      .filter((n) => n.type === "exitLoop" || n.type === "loop")
      .map((n) => n.id),
  );

  // First pass: build incoming/outgoing maps for structural node collapsing
  const incomingToStructural = new Map<string, string[]>(); // structural → sources
  const outgoingFromStructural = new Map<string, string[]>(); // structural → targets

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    if (structuralIds.has(edge.target)) {
      const list = incomingToStructural.get(edge.target) || [];
      list.push(edge.source);
      incomingToStructural.set(edge.target, list);
    }
    if (structuralIds.has(edge.source)) {
      const list = outgoingFromStructural.get(edge.source) || [];
      list.push(edge.target);
      outgoingFromStructural.set(edge.source, list);
    }
  }

  const graphEdges: [string, string][] = [];
  for (const edge of edges) {
    // Skip edges from loop-back nodes (these create the loop iteration)
    if (loopNodeIds.has(edge.source)) continue;
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;

    // Skip edges involving structural nodes — they'll be replaced by collapsed edges
    if (structuralIds.has(edge.source) || structuralIds.has(edge.target)) continue;

    graphEdges.push([edge.source, edge.target]);
  }

  // Add collapsed edges: for each structural node, connect its sources directly to its targets
  for (const structId of structuralIds) {
    const sources = incomingToStructural.get(structId) || [];
    const targets = outgoingFromStructural.get(structId) || [];
    for (const src of sources) {
      // Don't create edges from other structural nodes or loop nodes
      if (structuralIds.has(src) || loopNodeIds.has(src)) continue;
      for (const tgt of targets) {
        if (structuralIds.has(tgt)) continue;
        graphEdges.push([src, tgt]);
      }
    }
  }

  // Add disconnected nodes as self-edges for toposort inclusion
  const connectedNodes = new Set<string>();
  for (const edge of edges) {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  }
  for (const node of nodes) {
    if (!connectedNodes.has(node.id)) {
      warnings.push(`Node "${node.id}" (${node.type}) is disconnected from the graph`);
    }
  }

  // Build a label lookup for readable error messages
  const labelOf = (id: string) => {
    const n = nodes.find((nd) => nd.id === id);
    const label = n?.data?.label as string | undefined;
    return label ? `"${label}" (${id})` : `"${id}"`;
  };

  try {
    toposort(graphEdges);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Cyclic")) {
      // toposort error format: 'Cyclic dependency, node was:"<id>"'
      const nodeMatch = error.message.match(/node was:\s*"?([^"]+)"?/);
      const cycleNodeId = nodeMatch?.[1];
      if (cycleNodeId) {
        errors.push(
          `Flow contains a cycle involving node ${labelOf(cycleNodeId)}. ` +
          `Check edges around this node for circular references.`,
        );
      } else {
        errors.push(
          "Flow contains a cycle (outside of loops). Check your edges for circular references.",
        );
      }
    }
  }

  // 6. Node field validation — check required fields per node type
  for (const node of nodes) {
    const fieldWarnings = validateNodeData(node.type, node.data);
    for (const w of fieldWarnings) {
      const label = (node.data?.label as string) || node.id;
      warnings.push(`Node "${label}" (${node.type}): ${w}`);
    }
  }

  // 7. Integration credential check — warn if node requires an unconnected integration
  if (connectedIntegrations) {
    for (const node of nodes) {
      const spec = NODE_TYPE_SPECS[node.type];
      if (spec?.requiredIntegration && !connectedIntegrations.includes(spec.requiredIntegration)) {
        const label = (node.data?.label as string) || node.id;
        warnings.push(
          `Node "${label}" uses ${spec.label} but ${spec.requiredIntegration} is not connected.`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    startNodeIds,
  };
}
