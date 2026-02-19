/**
 * Conversation Summarizer — Rolling Summarization for Long Conversations
 *
 * When a conversation exceeds SUMMARY_THRESHOLD messages, older messages
 * are summarized into a compact text and the full history is replaced with:
 *   [summary of older messages] + [last KEEP_RECENT messages in full]
 *
 * Summaries are cached in the ConversationSummary table to avoid
 * re-summarizing on every turn.
 *
 * Inspired by MemGPT's recursive summarization approach.
 */

import Anthropic from "@anthropic-ai/sdk";
import { MessageRole } from "@prisma/client";
import prisma from "@/lib/db";
import { getPlatformApiKey, getModelForTier } from "@/lib/config";
import { generateEmbedding } from "@/lib/embeddings";

const SUMMARY_THRESHOLD = 40; // Messages before summarization kicks in
const KEEP_RECENT = 15; // Always keep the last N messages in full

interface DbMessage {
  id: string;
  role: MessageRole;
  content: string;
  toolName: string | null;
  toolOutput: unknown;
  createdAt: Date;
}

interface SummarizedContext {
  /** Summary of older messages, to prepend to system prompt */
  summaryPrefix: string;
  /** Recent messages to send as conversation history */
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

/**
 * Build conversation context with automatic summarization for long conversations.
 *
 * For short conversations (< SUMMARY_THRESHOLD messages), returns all messages as-is.
 * For long conversations, summarizes older messages and keeps recent ones in full.
 */
export async function buildContextWithSummarization(
  conversationId: string,
  agentId: string,
  allMessages: DbMessage[],
  currentMessage: string,
): Promise<SummarizedContext> {
  // Short conversations: no summarization needed
  if (allMessages.length < SUMMARY_THRESHOLD) {
    return {
      summaryPrefix: "",
      messages: buildMessageHistory(allMessages, currentMessage),
    };
  }

  // Split into old (to summarize) and recent (to keep in full)
  const oldMessages = allMessages.slice(0, -KEEP_RECENT);
  const recentMessages = allMessages.slice(-KEEP_RECENT);

  // Check for existing summary that covers enough messages
  const existingSummary = await prisma.conversationSummary.findFirst({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
  });

  let summaryText: string;

  if (existingSummary && existingSummary.messageCount >= oldMessages.length - 5) {
    // Existing summary is fresh enough (within 5 messages of current old set)
    summaryText = existingSummary.summary;
  } else {
    // Generate new summary
    summaryText = await generateSummary(oldMessages, existingSummary?.summary);

    // Persist summary with embedding (fire-and-forget for non-blocking)
    persistSummary(conversationId, agentId, summaryText, oldMessages.length)
      .catch(err => console.warn("Failed to persist conversation summary:", err));
  }

  return {
    summaryPrefix: `## Previous Conversation Summary (${oldMessages.length} earlier messages)\n${summaryText}`,
    messages: buildMessageHistory(recentMessages, currentMessage),
  };
}

/**
 * Build message history from DB messages, merging tool outputs into assistant messages.
 * Same logic as Phase 1 in route.ts but extracted for reuse.
 */
function buildMessageHistory(
  messages: DbMessage[],
  currentMessage: string,
): Array<{ role: "user" | "assistant"; content: string }> {
  const MAX_TOOL_OUTPUT_CHARS = 2000;
  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  let pendingToolSummaries: string[] = [];

  for (const msg of messages) {
    if (msg.role === MessageRole.TOOL) {
      const outputStr = msg.toolOutput
        ? JSON.stringify(msg.toolOutput)
        : "(no output)";
      const truncated = outputStr.length > MAX_TOOL_OUTPUT_CHARS
        ? outputStr.slice(0, MAX_TOOL_OUTPUT_CHARS) + "...(truncated)"
        : outputStr;
      pendingToolSummaries.push(`[Tool: ${msg.toolName}] ${truncated}`);
    } else if (msg.role === MessageRole.ASSISTANT) {
      let content = msg.content;
      if (pendingToolSummaries.length > 0) {
        content = pendingToolSummaries.join("\n") + "\n\n" + content;
        pendingToolSummaries = [];
      }
      history.push({ role: "assistant", content });
    } else {
      if (pendingToolSummaries.length > 0) {
        history.push({ role: "assistant", content: pendingToolSummaries.join("\n") });
        pendingToolSummaries = [];
      }
      history.push({ role: "user", content: msg.content });
    }
  }

  if (pendingToolSummaries.length > 0) {
    history.push({ role: "assistant", content: pendingToolSummaries.join("\n") });
  }

  history.push({ role: "user", content: currentMessage });
  return history;
}

/**
 * Generate a summary of older messages using Haiku (fast tier).
 * If a previous summary exists, builds on top of it (recursive summarization).
 */
async function generateSummary(
  messages: DbMessage[],
  previousSummary?: string,
): Promise<string> {
  const apiKey = getPlatformApiKey();
  const client = new Anthropic({ apiKey });

  // Format messages for summarization
  const formattedMessages = messages
    .filter(m => m.role !== MessageRole.TOOL)
    .map(m => `${m.role === MessageRole.USER ? "User" : "Assistant"}: ${m.content.slice(0, 500)}`)
    .join("\n");

  const prompt = previousSummary
    ? `Previous summary:\n${previousSummary}\n\nNew messages since last summary:\n${formattedMessages}\n\nUpdate the summary to include the new messages. Keep it concise (max 500 words). Focus on: key topics discussed, decisions made, user preferences expressed, task parameters, important findings from tools, and any unresolved items.`
    : `Conversation messages:\n${formattedMessages}\n\nSummarize this conversation concisely (max 500 words). Focus on: key topics discussed, decisions made, user preferences expressed, task parameters, important findings from tools, and any unresolved items.`;

  const response = await client.messages.create({
    model: getModelForTier("fast"),
    max_tokens: 1024,
    temperature: 0,
    system: "You are a conversation summarizer. Create concise, factual summaries that preserve all important context. Include specific details like names, numbers, dates, and decisions. Do not add interpretation.",
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find(b => b.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "Summary generation failed.";
}

/**
 * Persist a conversation summary to the database with embedding.
 */
async function persistSummary(
  conversationId: string,
  agentId: string,
  summary: string,
  messageCount: number,
): Promise<void> {
  const embedding = await generateEmbedding(summary);

  // Extract key facts as bullet points
  const keyFacts = summary
    .split("\n")
    .filter(line => line.trim().startsWith("-") || line.trim().startsWith("*"))
    .map(line => line.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean);

  await prisma.conversationSummary.upsert({
    where: {
      id: await getExistingSummaryId(conversationId),
    },
    create: {
      conversationId,
      agentId,
      summary,
      keyFacts,
      embedding,
      messageCount,
    },
    update: {
      summary,
      keyFacts,
      embedding,
      messageCount,
      updatedAt: new Date(),
    },
  });
}

/**
 * Get the existing summary ID for upsert, or generate a placeholder for create.
 */
async function getExistingSummaryId(conversationId: string): Promise<string> {
  const existing = await prisma.conversationSummary.findFirst({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return existing?.id ?? "non-existent-id";
}
