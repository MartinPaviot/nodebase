/**
 * Chat Agent Executor
 *
 * Handles chatAgent nodes in flow workflows:
 * - "observe" variant: passthrough (structural, monitors messages)
 * - "send" variant: generates a message via Claude and streams it to the user
 *
 * Follows the same streaming pattern as ai-action.ts.
 */

import type { ModelTier } from "@/lib/ai/claude-client";

import type { NodeExecContext, NodeExecResult } from "../types";
import { TONE_SUFFIX } from "../prompt-utils";

/** Map UI model strings (e.g. "claude-haiku", "default") to ModelTier */
function resolveModelTier(raw: unknown): ModelTier {
  if (raw === "fast" || raw === "smart" || raw === "deep") return raw;
  if (typeof raw === "string") {
    if (raw.includes("haiku")) return "fast";
    if (raw.includes("sonnet")) return "smart";
    if (raw.includes("opus")) return "deep";
  }
  return "smart";
}

export async function executeChatAgentNode(
  ctx: NodeExecContext,
): Promise<NodeExecResult> {
  const { node, state, claudeClient, systemPrompt, emit, userId } = ctx;

  const variant = (node.data?.variant as string) || "observe";

  // Observe variant: structural passthrough
  if (variant === "observe") {
    return {
      output: { kind: "passthrough", nodeType: "chatAgent" },
    };
  }

  // Send variant: generate and stream a message to the user
  const messagePrompt =
    (node.data?.message as string) ||
    (node.data?.prompt as string) ||
    (node.data?.label as string) ||
    "Summarize the workflow results for the user";
  const model: ModelTier = resolveModelTier(node.data?.model);

  // Build context from previous outputs
  const previousOutputsSummary: Record<string, unknown> = {};
  for (const [id, output] of state.nodeOutputs.entries()) {
    previousOutputsSummary[id] = output;
  }

  const messageContent = [
    state.userMessage ? `User message: ${state.userMessage}` : "",
    state.currentLoopItem
      ? `Current item: ${JSON.stringify(state.currentLoopItem)}`
      : "",
    Object.keys(previousOutputsSummary).length > 0
      ? `Previous step outputs:\n${JSON.stringify(previousOutputsSummary, null, 2)}`
      : "",
    `Task: ${messagePrompt}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const messages = [{ role: "user" as const, content: messageContent }];

  // Stream the response to the user
  let fullContent = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let modelName = "";

  // Don't wrap streaming in withRetry — retrying after partial SSE emission
  // would duplicate text-delta events on the client side
  const stream = claudeClient.chatStream({
    model,
    messages,
    systemPrompt: (systemPrompt || "") + TONE_SUFFIX,
    temperature: 0.3,
    maxSteps: 1,
    userId,
  });

  for await (const event of stream) {
    switch (event.type) {
      case "text-delta":
        fullContent += event.delta;
        emit({ type: "text-delta", delta: event.delta, nodeId: node.id });
        break;
      case "step-complete":
        tokensIn += event.event.tokensIn;
        tokensOut += event.event.tokensOut;
        modelName = event.event.model;
        break;
      case "finish":
        tokensIn = event.usage.promptTokens;
        tokensOut = event.usage.completionTokens;
        break;
    }
  }

  return {
    output: {
      kind: "ai-response",
      content: fullContent,
      tokensIn,
      tokensOut,
      model: modelName || model,
    },
    streamed: true,
  };
}
