/**
 * Passthrough Executor
 *
 * For trigger/structural nodes that don't perform any action.
 */

import type { NodeExecContext, NodeExecResult } from "../types";

export async function executePassthrough(ctx: NodeExecContext): Promise<NodeExecResult> {
  return {
    output: { kind: "passthrough", nodeType: ctx.node.type },
  };
}
