/**
 * AI Action Executor
 *
 * Uses ClaudeClient.chatStream() for real-time token streaming.
 * Emits text-delta SSE events as tokens arrive.
 */

import type { ModelTier } from "@/lib/ai/claude-client";

import type { NodeExecContext, NodeExecResult } from "../types";
import { TONE_SUFFIX } from "../prompt-utils";
import { resolveVariables } from "../variable-resolver";

/** Map UI model strings (e.g. "claude-haiku", "claude-sonnet") to ModelTier */
function resolveModelTier(raw: unknown): ModelTier {
  if (raw === "fast" || raw === "smart" || raw === "deep") return raw;
  if (typeof raw === "string") {
    if (raw.includes("haiku")) return "fast";
    if (raw.includes("sonnet")) return "smart";
    if (raw.includes("opus")) return "deep";
  }
  return "smart";
}

/** JSON.stringify wrapper that catches errors from Composio SDK response objects with getters */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    try {
      return JSON.stringify(value, (_key, val) => {
        if (typeof val === "function" || typeof val === "symbol") return undefined;
        return val;
      }, 2);
    } catch {
      return String(value);
    }
  }
}

export async function executeAIAction(ctx: NodeExecContext): Promise<NodeExecResult> {
  const { node, state, claudeClient, systemPrompt, emit, userId } = ctx;

  let fullContent = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let modelName = "";

  try {
    const rawPrompt =
      (node.data?.prompt as string) ||
      (node.data?.label as string) ||
      "Process the input";
    // Resolve {{nodeId.field}} tokens from previous step outputs
    const nodePrompt = resolveVariables(rawPrompt, state.nodeOutputs);
    const temperature = (node.data?.temperature as number) ?? 0.3;
    const model: ModelTier = resolveModelTier(node.data?.model);

    // Build context from previous outputs — use safeStringify to handle Composio SDK objects
    const previousOutputsSummary: Record<string, unknown> = {};
    for (const [id, output] of state.nodeOutputs.entries()) {
      previousOutputsSummary[id] = output;
    }

    const messageContent = [
      state.userMessage ? `User message: ${state.userMessage}` : "",
      // Inject conversation context from the chat session that triggered this flow
      state.conversationContext?.summary
        ? `Conversation summary:\n${state.conversationContext.summary}`
        : "",
      state.conversationContext?.recentMessages?.length
        ? `Recent conversation:\n${state.conversationContext.recentMessages
            .slice(-5)
            .map(m => `${m.role}: ${m.content.slice(0, 300)}${m.content.length > 300 ? "..." : ""}`)
            .join("\n")}`
        : "",
      // Inject agent memories for persistent context
      state.agentMemories?.length
        ? `Agent memories:\n${state.agentMemories.map(m => `- ${m.key}: ${m.value}`).join("\n")}`
        : "",
      state.currentLoopItem ? `Current item: ${safeStringify(state.currentLoopItem)}` : "",
      Object.keys(previousOutputsSummary).length > 0
        ? `Previous step outputs:\n${safeStringify(previousOutputsSummary)}`
        : "",
      `Task: ${nodePrompt}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const messages = [{ role: "user" as const, content: messageContent }];

    // Don't wrap streaming in withRetry — retrying after partial SSE emission
    // would duplicate text-delta events on the client side
    const stream = claudeClient.chatStream({
      model,
      messages,
      systemPrompt: (systemPrompt || "") + TONE_SUFFIX,
      temperature,
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      output: {
        kind: "error",
        error: `AI action failed: ${message}`,
        nodeType: "action",
      },
    };
  }
}
