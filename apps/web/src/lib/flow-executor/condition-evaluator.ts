/**
 * Condition Evaluator
 *
 * Evaluates conditions deterministically first, falls back to LLM only when needed.
 * Inspired by LangGraph conditional_edges pattern.
 */

import type { ClaudeClient } from "@/lib/ai/claude-client";
import type { FlowState } from "./types";
import { resolveVariables } from "./variable-resolver";

export interface ConditionResult {
  branchId: string;
  branchIndex: number;
  method: "deterministic" | "llm";
  reasoning?: string;
}

/**
 * Evaluate which condition branch to follow.
 *
 * Strategy:
 * 1. Try deterministic patterns first (default/else, contains, comparison)
 * 2. Fall back to LLM (Claude Haiku, temperature 0) if no pattern matches
 */
export async function evaluateCondition(
  conditions: Array<{ id: string; text: string }>,
  state: FlowState,
  claudeClient: ClaudeClient,
): Promise<ConditionResult> {
  // Resolve {{nodeId.field}} tokens in condition texts
  const resolvedConditions = conditions.map((c) => ({
    ...c,
    text: resolveVariables(c.text, state.nodeOutputs),
  }));

  // Build context string from the last node output
  const contextText = getLastOutputText(state);

  // 1. Try deterministic evaluation
  for (let i = 0; i < resolvedConditions.length; i++) {
    const condition = resolvedConditions[i];
    const text = condition.text.toLowerCase().trim();

    // Catch-all patterns
    if (matchesCatchAll(text)) {
      return { branchId: condition.id, branchIndex: i, method: "deterministic" };
    }

    // Contains check
    const containsMatch = text.match(/^contains?\s+["']?(.+?)["']?\s*$/i);
    if (containsMatch && contextText.toLowerCase().includes(containsMatch[1].toLowerCase())) {
      return { branchId: condition.id, branchIndex: i, method: "deterministic" };
    }

    // Empty/not-empty checks
    if ((text === "is_empty" || text === "is empty") && !contextText.trim()) {
      return { branchId: condition.id, branchIndex: i, method: "deterministic" };
    }
    if ((text === "is_not_empty" || text === "is not empty") && contextText.trim()) {
      return { branchId: condition.id, branchIndex: i, method: "deterministic" };
    }

    // Boolean literals
    if (text === "true" || text === "yes" || text === "always") {
      return { branchId: condition.id, branchIndex: i, method: "deterministic" };
    }
  }

  // 2. Fall back to LLM evaluation (use resolved conditions)
  return evaluateWithLLM(resolvedConditions, state, claudeClient);
}

/** Check if condition text is a catch-all */
function matchesCatchAll(text: string): boolean {
  const catchAllPatterns = [
    "default", "else", "other", "otherwise", "fallback",
    "catch all", "catch-all", "catchall", "no match", "none of the above",
  ];
  return catchAllPatterns.includes(text);
}

/** Extract text from the last node output for condition evaluation */
function getLastOutputText(state: FlowState): string {
  let lastOutput = "";
  for (const output of state.nodeOutputs.values()) {
    switch (output.kind) {
      case "ai-response":
        lastOutput = output.content;
        break;
      case "integration":
        lastOutput = JSON.stringify(output.data || "");
        break;
      case "knowledge-search":
        lastOutput = output.context;
        break;
      case "trigger":
        lastOutput = output.message;
        break;
    }
  }
  return lastOutput || state.userMessage;
}

/** Build a labeled context summary for the LLM, using node labels instead of opaque IDs */
function buildLabeledContext(
  state: FlowState,
  nodeMap?: Map<string, { type: string; data?: Record<string, unknown> }>,
): Record<string, unknown> {
  const context: Record<string, unknown> = {};
  for (const [id, output] of state.nodeOutputs.entries()) {
    // Use the node label if available, otherwise fall back to type or ID
    const node = nodeMap?.get(id);
    const label = (node?.data?.label as string) || node?.type || id;
    const key = `${label} (${id})`;

    // Simplify the output for the LLM to focus on actual data
    switch (output.kind) {
      case "ai-response":
        context[key] = { type: "ai-response", content: output.content };
        break;
      case "integration":
        context[key] = { type: "integration", data: output.data };
        break;
      case "knowledge-search":
        context[key] = { type: "knowledge-search", context: output.context };
        break;
      case "trigger":
        context[key] = { type: "trigger", message: output.message };
        break;
      case "passthrough":
        // Skip passthrough nodes — they add noise
        break;
      default:
        context[key] = output;
        break;
    }
  }
  return context;
}

/** LLM-based condition evaluation (Claude Haiku, temperature 0) */
async function evaluateWithLLM(
  conditions: Array<{ id: string; text: string }>,
  state: FlowState,
  claudeClient: ClaudeClient,
): Promise<ConditionResult> {
  const labeledContext = buildLabeledContext(state);

  const branchDescriptions = conditions
    .map((c, i) => `${i}: "${c.text || "No description"}"`)
    .join("\n");

  const response = await claudeClient.chat({
    model: "fast",
    messages: [
      {
        role: "user",
        content: `You are a condition evaluator for a workflow. Analyze the data from previous steps and decide which branch to follow.

## Data from previous steps
${JSON.stringify(labeledContext, null, 2)}

${state.userMessage ? `## User message\n${state.userMessage}` : ""}

## Branches (pick ONE)
${branchDescriptions}

Based on the data above, which branch number (0, 1, 2...) should be followed? Analyze the data carefully — check for the presence or absence of fields, values, and patterns.

Respond with ONLY a single number (e.g. "0" or "1"). Nothing else.`,
      },
    ],
    temperature: 0,
    maxSteps: 1,
    userId: "",
  });

  const rawResponse = (response.content || "").trim();

  // Try multiple parsing strategies to extract the branch selection
  const matchIndex = parseBranchSelection(rawResponse, conditions);

  if (matchIndex < 0) {
    console.warn(
      `[condition-evaluator] Could not parse LLM response. Raw: "${rawResponse}". Conditions: ${JSON.stringify(conditions.map(c => c.text))}. Defaulting to branch 0.`,
    );
  }

  const idx = matchIndex >= 0 ? matchIndex : 0;
  return {
    branchId: conditions[idx].id,
    branchIndex: idx,
    method: "llm",
    reasoning: rawResponse,
  };
}

/**
 * Parse the LLM response to find which branch was selected.
 * Tries multiple strategies in order of reliability.
 * Returns -1 if no match found.
 */
function parseBranchSelection(
  rawResponse: string,
  conditions: Array<{ id: string; text: string }>,
): number {
  const cleaned = rawResponse
    .replace(/^["'`]+|["'`]+$/g, "") // Strip surrounding quotes
    .replace(/\.$/, "")              // Strip trailing period
    .trim();

  // Strategy 1: Direct number match (most reliable — matches our new prompt format)
  const numberMatch = cleaned.match(/^\d+$/);
  if (numberMatch) {
    const idx = parseInt(numberMatch[0], 10);
    if (idx >= 0 && idx < conditions.length) return idx;
  }

  // Strategy 2: Extract first number from response (e.g., "Branch 0", "I'd pick 1")
  const firstNumberMatch = cleaned.match(/\b(\d+)\b/);
  if (firstNumberMatch) {
    const idx = parseInt(firstNumberMatch[1], 10);
    if (idx >= 0 && idx < conditions.length) return idx;
  }

  // Strategy 3: Exact match on condition ID
  const exactIdIndex = conditions.findIndex((c) => c.id === cleaned);
  if (exactIdIndex >= 0) return exactIdIndex;

  // Strategy 4: Match on condition text (case-insensitive)
  const textMatchIndex = conditions.findIndex(
    (c) => c.text.toLowerCase().trim() === cleaned.toLowerCase(),
  );
  if (textMatchIndex >= 0) return textMatchIndex;

  // Strategy 5: Partial match — response contains a condition ID
  for (let i = 0; i < conditions.length; i++) {
    if (rawResponse.includes(conditions[i].id)) return i;
  }

  // Strategy 6: Partial match — response contains the full condition text
  for (let i = 0; i < conditions.length; i++) {
    if (conditions[i].text && rawResponse.toLowerCase().includes(conditions[i].text.toLowerCase())) {
      return i;
    }
  }

  return -1; // No match found
}
