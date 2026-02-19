/**
 * One-shot migration: Reduce vertical spacing between flow nodes.
 *
 * NODE_Y_GAP was reduced from 65→45 (−20 px per gap).
 * For every Agent and AgentTemplate that stores flowData with positioned nodes,
 * this script shifts each node's Y coordinate up by 20 px for every distinct
 * Y-level that sits above it.
 *
 * Usage:  npx tsx prisma/migrate-node-spacing.ts
 *         (optionally add --dry-run to preview without writing)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const GAP_REDUCTION = 20; // px removed per Y-level

interface FlowNode {
  id: string;
  position: { x: number; y: number };
  [key: string]: unknown;
}

interface FlowData {
  nodes?: FlowNode[];
  edges?: unknown[];
  [key: string]: unknown;
}

function recomputePositions(flowData: FlowData): { updated: FlowData; changed: boolean } {
  const nodes = flowData.nodes;
  if (!nodes || nodes.length === 0) return { updated: flowData, changed: false };

  // Collect all distinct Y levels (tolerance ±2 px)
  const yValues = nodes.map((n) => n.position.y);
  const sorted = [...new Set(yValues)].sort((a, b) => a - b);

  // Group Y values that are within 2px of each other into the same level
  const levels: number[][] = [];
  for (const y of sorted) {
    const last = levels[levels.length - 1];
    if (last && Math.abs(y - last[0]) <= 2) {
      last.push(y);
    } else {
      levels.push([y]);
    }
  }

  // Build mapping: for each original Y → number of levels strictly above it
  const yToLevelIndex = new Map<number, number>();
  for (const y of sorted) {
    const idx = levels.findIndex((lvl) => lvl.includes(y));
    yToLevelIndex.set(y, idx);
  }

  let changed = false;
  const updatedNodes = nodes.map((node) => {
    const levelIdx = yToLevelIndex.get(node.position.y) ?? 0;
    const shift = levelIdx * GAP_REDUCTION;
    if (shift === 0) return node;
    changed = true;
    return {
      ...node,
      position: { x: node.position.x, y: node.position.y - shift },
    };
  });

  return {
    updated: { ...flowData, nodes: updatedNodes },
    changed,
  };
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== MIGRATING ===");

  // 1. Migrate Agents
  const agents = await prisma.agent.findMany({
    where: { flowData: { not: undefined } },
    select: { id: true, name: true, flowData: true },
  });

  let agentCount = 0;
  for (const agent of agents) {
    if (!agent.flowData || typeof agent.flowData !== "object") continue;
    const fd = agent.flowData as unknown as FlowData;
    if (!fd.nodes || fd.nodes.length === 0) continue;

    const { updated, changed } = recomputePositions(fd);
    if (!changed) continue;

    agentCount++;
    console.log(`  Agent "${agent.name}" (${agent.id}) — ${fd.nodes.length} nodes`);

    if (!DRY_RUN) {
      await prisma.agent.update({
        where: { id: agent.id },
        data: { flowData: updated as object },
      });
    }
  }

  // 2. Migrate AgentTemplates
  const templates = await prisma.agentTemplate.findMany({
    select: { id: true, name: true, flowData: true },
  });

  let templateCount = 0;
  for (const tpl of templates) {
    if (!tpl.flowData || typeof tpl.flowData !== "object") continue;
    const fd = tpl.flowData as unknown as FlowData;
    if (!fd.nodes || fd.nodes.length === 0) continue;

    const { updated, changed } = recomputePositions(fd);
    if (!changed) continue;

    templateCount++;
    console.log(`  Template "${tpl.name}" (${tpl.id}) — ${fd.nodes.length} nodes`);

    if (!DRY_RUN) {
      await prisma.agentTemplate.update({
        where: { id: tpl.id },
        data: { flowData: updated as object },
      });
    }
  }

  console.log(`\nDone. Updated ${agentCount} agents, ${templateCount} templates.`);
  if (DRY_RUN) console.log("(No changes written — remove --dry-run to apply)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
