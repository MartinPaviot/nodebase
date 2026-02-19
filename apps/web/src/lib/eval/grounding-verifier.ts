/**
 * Grounding Verifier — Verifies extracted claims against source data.
 *
 * Uses Claude Sonnet to cross-reference each claim with the provided sources.
 * This is the second half of the neuro-symbolic verification pipeline:
 * 1. Extract claims (claim-extractor.ts)
 * 2. Verify claims against sources (this file)
 *
 * A claim is "grounded" if it can be confirmed by the source data.
 * Ungrounded claims may indicate hallucination.
 */

import { ClaudeClient } from "../ai/claude-client";
import { config } from "../config";
import type { Claim } from "./claim-extractor";

// ============================================
// TYPES
// ============================================

export interface GroundingSource {
  /** Where this source came from */
  type: "action_args" | "conversation_history" | "tool_result";
  /** Human-readable label, e.g. "CRM data", "Email thread" */
  label: string;
  /** The actual source text to verify against */
  content: string;
}

export interface GroundingResult {
  /** Claims with grounded/evidence fields populated */
  claims: Claim[];
  /** Number of claims confirmed by sources */
  groundedCount: number;
  /** Number of claims NOT found in sources */
  ungroundedCount: number;
  /** Number of claims that can't be verified (opinions, etc.) */
  unknownCount: number;
  /** 0-100: (grounded / verifiable) * 100. Unknowns excluded. */
  groundingScore: number;
  tokensUsed: { input: number; output: number };
}

// ============================================
// PROMPTS
// ============================================

const SYSTEM_PROMPT = `You are a fact-checking engine. You verify claims against provided source data.

For each claim, determine:
- "grounded": true if the claim is supported by the source data
- "grounded": false if the claim contradicts the source data or cannot be found
- "unknown": true if the claim is subjective, an opinion, or not verifiable from the sources

When a claim is grounded, provide the evidence (quote or paraphrase from sources).
When a claim is ungrounded, explain what the sources actually say (if anything).
When unknown, briefly explain why it can't be verified.

Output ONLY valid JSON — no markdown, no explanation:
{
  "results": [
    { "index": 0, "grounded": true, "evidence": "CRM shows deal value of $50,000" },
    { "index": 1, "grounded": false, "evidence": "Source shows meeting was on Monday, not Tuesday" },
    { "index": 2, "unknown": true, "evidence": "Subjective assessment, not verifiable" }
  ]
}`;

// ============================================
// VERIFIER
// ============================================

/** Max characters per source to control cost */
const MAX_SOURCE_LENGTH = 4000;

export async function verifyClaims(
  claims: Claim[],
  sources: GroundingSource[],
  actionType: string,
): Promise<GroundingResult> {
  // Nothing to verify
  if (claims.length === 0 || sources.length === 0) {
    return {
      claims,
      groundedCount: 0,
      ungroundedCount: 0,
      unknownCount: claims.length,
      groundingScore: 100, // No claims = nothing to fail
      tokensUsed: { input: 0, output: 0 },
    };
  }

  // Build the verification prompt
  const claimsList = claims
    .map((c, i) => `[${i}] "${c.text}" (${c.type})`)
    .join("\n");

  const sourcesList = sources
    .map((s) => {
      const truncated =
        s.content.length > MAX_SOURCE_LENGTH
          ? s.content.slice(0, MAX_SOURCE_LENGTH) + "\n... [truncated]"
          : s.content;
      return `--- ${s.label} (${s.type}) ---\n${truncated}`;
    })
    .join("\n\n");

  const client = new ClaudeClient(config.llm.anthropicApiKey);

  const response = await client.chat({
    model: "smart",
    messages: [
      {
        role: "user",
        content: `Verify these claims against the source data below.

Action type: ${actionType}

CLAIMS:
${claimsList}

SOURCE DATA:
${sourcesList}

For each claim, check if it's supported by the sources.`,
      },
    ],
    systemPrompt: SYSTEM_PROMPT,
    temperature: 0.1,
    maxSteps: 1,
    maxTokens: 1024,
    userId: "system-eval",
  });

  const verifiedClaims = parseVerificationResponse(
    response.content,
    claims,
  );

  // Calculate scores
  let groundedCount = 0;
  let ungroundedCount = 0;
  let unknownCount = 0;

  for (const claim of verifiedClaims) {
    if (claim.grounded) {
      groundedCount++;
    } else if (claim.evidence?.startsWith("Subjective") || claim.evidence?.startsWith("Cannot verify")) {
      unknownCount++;
    } else {
      ungroundedCount++;
    }
  }

  const verifiable = groundedCount + ungroundedCount;
  const groundingScore =
    verifiable > 0 ? Math.round((groundedCount / verifiable) * 100) : 100;

  return {
    claims: verifiedClaims,
    groundedCount,
    ungroundedCount,
    unknownCount,
    groundingScore,
    tokensUsed: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
  };
}

// ============================================
// RESPONSE PARSING
// ============================================

interface VerificationEntry {
  index?: number;
  grounded?: boolean;
  unknown?: boolean;
  evidence?: string;
}

function parseVerificationResponse(
  responseText: string,
  originalClaims: Claim[],
): Claim[] {
  const updated = originalClaims.map((c) => ({ ...c }));

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return updated;

    const parsed = JSON.parse(jsonMatch[0]) as {
      results?: VerificationEntry[];
    };

    if (!parsed.results || !Array.isArray(parsed.results)) return updated;

    for (const entry of parsed.results) {
      const idx = entry.index;
      if (idx === undefined || idx < 0 || idx >= updated.length) continue;

      if (entry.unknown) {
        // Unknown = treat as grounded (not a hallucination, just unverifiable)
        updated[idx].grounded = true;
        updated[idx].evidence = entry.evidence || "Not verifiable from sources";
      } else {
        updated[idx].grounded = entry.grounded === true;
        updated[idx].evidence = entry.evidence;
      }
    }
  } catch {
    // Parse failure = leave all claims as ungrounded (conservative)
  }

  return updated;
}
