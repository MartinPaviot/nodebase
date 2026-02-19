/**
 * Flow Executor — Public API
 *
 * Usage:
 * ```typescript
 * import { executeFlow, validateFlowGraph } from "@/lib/flow-executor";
 * ```
 */

export { executeFlow } from "./executor-engine";
export { validateFlowGraph } from "./graph-validator";
export type {
  FlowData,
  FlowNode,
  FlowEdge,
  FlowSSEEvent,
  FlowState,
  FlowExecutorConfig,
  NodeOutput,
  GraphValidationResult,
} from "./types";
