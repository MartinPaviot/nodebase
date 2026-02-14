/**
 * Reply Handler — Classify and extract metadata from email replies.
 *
 * Uses Claude Haiku (via ClaudeClient, "fast" tier) for sentiment
 * classification and applies deterministic heuristics for auto-reply
 * and unsubscribe detection.
 */

import { ClaudeClient } from "@/lib/ai/claude-client";
import { aiEventLogger } from "@/lib/ai/event-logger";
import { config } from "@/lib/config";
import type { ReplySentiment } from "@prisma/client";

// ============================================
// TYPES
// ============================================

export interface ReplyMetadata {
  sentiment: ReplySentiment;
  isAutoReply: boolean;
  wantsUnsubscribe: boolean;
  summary: string;
}

// ============================================
// CONSTANTS
// ============================================

const VALID_SENTIMENTS: ReplySentiment[] = [
  "POSITIVE",
  "NEUTRAL",
  "NEGATIVE",
  "OUT_OF_OFFICE",
  "BOUNCE",
];

/**
 * Regex patterns that strongly indicate an auto-reply / out-of-office.
 * Tested against the lowercased reply body.
 */
const AUTO_REPLY_PATTERNS = [
  /out of (?:the )?office/i,
  /on (?:annual |parental )?(?:leave|vacation|holiday)/i,
  /i(?:'m| am) (?:currently )?(?:away|out|unavailable|off)/i,
  /automatic(?:ally)? (?:generated|reply|response)/i,
  /auto[- ]?reply/i,
  /auto[- ]?response/i,
  /will (?:be )?(?:back|return)/i,
  /limited access to (?:email|my inbox)/i,
  /this is an automated/i,
  /do[- ]?not[- ]?reply/i,
];

/**
 * Patterns that indicate the recipient wants to unsubscribe or stop
 * receiving emails.
 */
const UNSUBSCRIBE_PATTERNS = [
  /\bunsubscribe\b/i,
  /\bremove me\b/i,
  /\bstop (?:emailing|contacting|sending)\b/i,
  /\bopt[- ]?out\b/i,
  /\btake me off\b/i,
  /\bdon'?t (?:contact|email|message) me\b/i,
  /\bno longer interested\b/i,
  /\bnot interested\b/i,
  /\bplease remove\b/i,
  /\bstop this\b/i,
];

// ============================================
// CLASSIFY REPLY (LLM)
// ============================================

/**
 * Use Claude Haiku to classify the sentiment of an email reply.
 *
 * Returns one of: POSITIVE, NEUTRAL, NEGATIVE, OUT_OF_OFFICE, BOUNCE.
 *
 * Falls back to NEUTRAL if the LLM returns an unexpected value.
 */
export async function classifyReply(
  content: string,
  options?: { userId?: string; agentId?: string }
): Promise<ReplySentiment> {
  const client = new ClaudeClient(config.llm.anthropicApiKey);

  const systemPrompt = [
    "You are an email reply classifier.",
    "Classify the email reply into exactly one of these categories:",
    "POSITIVE - interested, wants to talk, agrees to a meeting",
    "NEUTRAL - asks questions, unsure, needs more info",
    "NEGATIVE - not interested, asks to stop, declines",
    "OUT_OF_OFFICE - auto-reply, vacation, away message",
    "BOUNCE - delivery failure, invalid address, mailbox full",
    "",
    "Reply with ONLY the classification word, nothing else.",
  ].join("\n");

  try {
    const response = await client.chat({
      model: "fast",
      messages: [{ role: "user", content: `Classify this email reply:\n\n${content}` }],
      systemPrompt,
      maxSteps: 1,
      maxTokens: 16,
      temperature: 0,
      userId: options?.userId ?? "system",
      agentId: options?.agentId,
      onStepComplete: async (event) => {
        await aiEventLogger.log({
          ...event,
          agentId: options?.agentId,
        });
      },
    });

    const raw = response.content.trim().toUpperCase() as ReplySentiment;

    if (VALID_SENTIMENTS.includes(raw)) {
      return raw;
    }

    // Try to match a partial response (e.g. "POSITIVE." or "positive")
    for (const sentiment of VALID_SENTIMENTS) {
      if (response.content.toUpperCase().includes(sentiment)) {
        return sentiment;
      }
    }

    return "NEUTRAL";
  } catch (error) {
    console.error("[ReplyHandler] classifyReply failed:", error);
    // Fallback to heuristic classification
    return heuristicClassify(content);
  }
}

// ============================================
// EXTRACT REPLY METADATA
// ============================================

/**
 * Full metadata extraction from a reply.
 *
 * Combines:
 * - LLM sentiment classification (via classifyReply)
 * - Deterministic auto-reply detection
 * - Deterministic unsubscribe detection
 * - LLM-generated short summary
 */
export async function extractReplyMetadata(
  content: string,
  options?: { userId?: string; agentId?: string }
): Promise<ReplyMetadata> {
  // Run deterministic checks first (cheap)
  const isAutoReply = detectAutoReply(content);
  const wantsUnsubscribe = detectUnsubscribe(content);

  // If it's clearly an auto-reply, skip LLM classification
  if (isAutoReply) {
    return {
      sentiment: "OUT_OF_OFFICE",
      isAutoReply: true,
      wantsUnsubscribe,
      summary: "Auto-reply / out of office message",
    };
  }

  // LLM sentiment
  const sentiment = await classifyReply(content, options);

  // Override sentiment if unsubscribe intent is detected
  const finalSentiment = wantsUnsubscribe ? "NEGATIVE" : sentiment;

  // Generate a short summary via LLM
  const summary = await generateSummary(content, options);

  return {
    sentiment: finalSentiment,
    isAutoReply: false,
    wantsUnsubscribe,
    summary,
  };
}

// ============================================
// DETERMINISTIC DETECTION
// ============================================

/**
 * Check if the email body matches known auto-reply patterns.
 */
function detectAutoReply(content: string): boolean {
  return AUTO_REPLY_PATTERNS.some((pattern) => pattern.test(content));
}

/**
 * Check if the email body contains unsubscribe / removal intent.
 */
function detectUnsubscribe(content: string): boolean {
  return UNSUBSCRIBE_PATTERNS.some((pattern) => pattern.test(content));
}

/**
 * Simple heuristic fallback when the LLM is unavailable.
 */
function heuristicClassify(content: string): ReplySentiment {
  const lower = content.toLowerCase();

  if (detectAutoReply(content)) return "OUT_OF_OFFICE";
  if (detectUnsubscribe(content)) return "NEGATIVE";

  // Bounce signals
  const bounceSignals = [
    "delivery failed",
    "undeliverable",
    "mailbox not found",
    "mailbox full",
    "550 ",
    "553 ",
    "invalid recipient",
  ];
  if (bounceSignals.some((s) => lower.includes(s))) return "BOUNCE";

  // Positive signals
  const positiveSignals = [
    "interested",
    "let's talk",
    "let's chat",
    "sounds good",
    "schedule a call",
    "book a time",
    "tell me more",
    "happy to",
    "love to",
  ];
  if (positiveSignals.some((s) => lower.includes(s))) return "POSITIVE";

  return "NEUTRAL";
}

// ============================================
// SUMMARY GENERATION
// ============================================

/**
 * Generate a 1-2 sentence summary of the reply for quick review.
 */
async function generateSummary(
  content: string,
  options?: { userId?: string; agentId?: string }
): Promise<string> {
  const client = new ClaudeClient(config.llm.anthropicApiKey);

  try {
    const response = await client.chat({
      model: "fast",
      messages: [
        {
          role: "user",
          content: `Summarize this email reply in 1-2 sentences for a quick CRM note. Be concise and factual.\n\n${content}`,
        },
      ],
      systemPrompt:
        "You are a concise email summarizer. Output only the summary, no preamble.",
      maxSteps: 1,
      maxTokens: 128,
      temperature: 0,
      userId: options?.userId ?? "system",
      agentId: options?.agentId,
      onStepComplete: async (event) => {
        await aiEventLogger.log({
          ...event,
          agentId: options?.agentId,
        });
      },
    });

    return response.content.trim();
  } catch (error) {
    console.error("[ReplyHandler] generateSummary failed:", error);
    // Fallback: truncate the original content
    const truncated = content.slice(0, 200).replace(/\s+/g, " ").trim();
    return truncated.length < content.length
      ? `${truncated}...`
      : truncated;
  }
}
