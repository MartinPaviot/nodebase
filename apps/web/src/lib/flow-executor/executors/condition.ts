/**
 * Condition Node Executor
 *
 * Delegates to the condition evaluator (deterministic first, LLM fallback).
 */

import { evaluateCondition } from "../condition-evaluator";
import type { NodeExecContext, NodeExecResult } from "../types";

export async function executeConditionNode(ctx: NodeExecContext): Promise<NodeExecResult> {
  const { node, state, claudeClient } = ctx;

  const rawConditions = Array.isArray(node.data?.conditions) ? node.data.conditions : [];
  const conditions = rawConditions
    .filter((c): c is { id: string; text: string } =>
      typeof c === "object" && c !== null && typeof c.id === "string" && typeof c.text === "string"
    );

  if (conditions.length === 0) {
    return {
      output: {
        kind: "condition",
        selectedBranch: "default",
        branchIndex: 0,
        method: "deterministic",
      },
    };
  }

  const result = await evaluateCondition(conditions, state, claudeClient);

  return {
    output: {
      kind: "condition",
      selectedBranch: result.branchId,
      branchIndex: result.branchIndex,
      method: result.method,
      reasoning: result.reasoning,
    },
    selectedBranch: result.branchIndex >= 0 ? `branch-${result.branchIndex}` : undefined,
  };
}
