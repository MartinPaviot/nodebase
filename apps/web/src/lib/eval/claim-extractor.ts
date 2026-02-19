/**
 * Claim Extractor — Extracts factual claims from AI-generated content.
 *
 * Uses Claude Sonnet to identify every verifiable assertion in the text.
 * Each claim can then be verified against source data by the grounding verifier.
 *
 * This is the first half of the Rippletide-inspired neuro-symbolic verification:
 * 1. Extract claims (this file)
 * 2. Verify claims against sources (grounding-verifier.ts)
 */

import { ClaudeClient } from "../ai/claude-client";
import { config } from "../config";

// ============================================
// TYPES
// ============================================

export interface Claim {
  /** The factual assertion, e.g. "deal value is $50K" */
  text: string;
  /** Classification of the claim */
  type: "factual" | "temporal" | "quantitative" | "relational";
  /** Whether the claim is verified against sources (set by grounding-verifier) */
  grounded: boolean;
  /** Source text that confirms or refutes (set by grounding-verifier) */
  evidence?: string;
}

export interface ClaimExtractionResult {
  claims: Claim[];
  tokensUsed: { input: number; output: number };
}

// ============================================
// PROMPTS
// ============================================

const SYSTEM_PROMPT = `You are a claim extraction engine. Your job is to identify every verifiable factual assertion in AI-generated content.

Extract ONLY verifiable claims — statements that can be checked against data. Skip:
- Greetings and sign-offs ("Hi Bob", "Best regards")
- Opinions and subjective statements ("I think this is great")
- Generic phrases ("I hope this helps")
- Formatting and structure

For each claim, classify it:
- "factual": A statement about a fact (names, companies, roles, statuses)
- "temporal": A statement about time (dates, deadlines, durations)
- "quantitative": A statement about numbers (amounts, percentages, counts)
- "relational": A statement about relationships between entities (A owns B, A works at B)

Output ONLY valid JSON — no markdown, no explanation:
{
  "claims": [
    { "text": "deal value is $50,000", "type": "quantitative" },
    { "text": "last meeting was on Tuesday", "type": "temporal" },
    { "text": "Bob is the account manager", "type": "relational" }
  ]
}

If there are no verifiable claims, return: { "claims": [] }`;

function buildActionPrompt(actionType: string): string {
  switch (actionType) {
    case "send_email":
    case "send_outlook_email":
      return `Extract claims from this email draft. Pay special attention to:
- Recipient identity and role
- Deal values, contract terms, pricing
- Dates, deadlines, meeting times
- Commitments and promises made
- References to past conversations or events
- Company names, product names, project names`;

    case "send_slack_message":
    case "send_teams_message":
      return `Extract claims from this message. Pay special attention to:
- Status updates and progress reports
- Numbers, metrics, KPIs mentioned
- Deadlines and dates
- Assignments and responsibilities
- References to projects, tickets, or tasks`;

    case "create_notion_page":
    case "append_to_notion":
    case "create_doc":
    case "append_to_doc":
      return `Extract claims from this document content. Pay special attention to:
- Facts, statistics, and data points
- Summaries of meetings or conversations
- Action items and their assignees
- Dates and deadlines
- References to external sources or data`;

    default:
      return `Extract all verifiable factual claims from this content.`;
  }
}

// ============================================
// EXTRACTOR
// ============================================

export async function extractClaims(
  content: string,
  actionType: string,
): Promise<ClaimExtractionResult> {
  // Skip extraction for very short content (< 20 chars = likely just a title or ID)
  if (content.length < 20) {
    return { claims: [], tokensUsed: { input: 0, output: 0 } };
  }

  const client = new ClaudeClient(config.llm.anthropicApiKey);
  const actionPrompt = buildActionPrompt(actionType);

  const response = await client.chat({
    model: "smart", // Sonnet — claim extraction needs reasoning
    messages: [
      {
        role: "user",
        content: `${actionPrompt}\n\nContent to analyze:\n\n${content}`,
      },
    ],
    systemPrompt: SYSTEM_PROMPT,
    temperature: 0.1,
    maxSteps: 1,
    maxTokens: 1024,
    userId: "system-eval",
  });

  const claims = parseClaimsResponse(response.content);

  return {
    claims,
    tokensUsed: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
  };
}

// ============================================
// RESPONSE PARSING
// ============================================

function parseClaimsResponse(responseText: string): Claim[] {
  try {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as {
      claims?: Array<{ text?: string; type?: string }>;
    };

    if (!parsed.claims || !Array.isArray(parsed.claims)) return [];

    return parsed.claims
      .filter((c) => c.text && typeof c.text === "string" && c.text.length > 0)
      .map((c) => ({
        text: c.text!,
        type: (["factual", "temporal", "quantitative", "relational"].includes(
          c.type || "",
        )
          ? c.type
          : "factual") as Claim["type"],
        grounded: false, // Will be set by grounding-verifier
      }));
  } catch {
    return [];
  }
}
