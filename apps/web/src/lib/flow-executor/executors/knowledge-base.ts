/**
 * Knowledge Base Search Executor
 */

import { searchKnowledge, formatSearchResultsForContext } from "@/lib/knowledge-base";
import type { NodeExecContext, NodeExecResult } from "../types";

export async function executeKnowledgeBaseSearch(ctx: NodeExecContext): Promise<NodeExecResult> {
  const { node, state, agentId } = ctx;

  const query =
    (node.data?.query as string) ||
    state.userMessage ||
    "search";

  const topK = (node.data?.topK as number) || 5;
  const minScore = (node.data?.minScore as number) || 0.7;

  const results = await searchKnowledge(agentId, query, topK, minScore);
  const formatted = formatSearchResultsForContext(results);

  return {
    output: {
      kind: "knowledge-search",
      resultCount: results.length,
      context: formatted,
    },
  };
}
