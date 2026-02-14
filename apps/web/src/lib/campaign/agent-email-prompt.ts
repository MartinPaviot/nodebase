/**
 * Agent Email Prompt Builder
 *
 * Builds the structured prompt sent to Claude to generate each cold email.
 * The prompt includes lead context, sequence position, directives, constraints,
 * and optional few-shot style samples from the Style Learner.
 *
 * The LLM is instructed to reply with a JSON object { subject, body } only.
 */

import type { CampaignStep } from "./engine";

// ============================================
// TYPES
// ============================================

export interface LeadContext {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  company?: string | null;
  jobTitle?: string | null;
  linkedinUrl?: string | null;
  enrichmentData?: Record<string, unknown> | null;
  customVariables?: Record<string, unknown> | null;
}

export interface BuildEmailPromptParams {
  /** The agent's system prompt (persona, tone, style) */
  agentSystemPrompt: string;
  /** Current step directives */
  step: CampaignStep;
  /** Lead data */
  lead: LeadContext;
  /** Previous emails in this sequence (for continuity) */
  previousEmails?: string[];
  /** Few-shot corrections from Style Learner */
  styleSamples?: string[];
  /** Override directive/subject from A/B variant */
  variant?: { directive: string; subjectHint?: string };
}

// ============================================
// PROMPT BUILDER
// ============================================

/**
 * Build a structured prompt for Claude to generate a cold email.
 *
 * The output instructs the LLM to return ONLY a JSON object with
 * `subject` and `body` fields. No markdown, no explanation, no signature.
 */
export function buildEmailPrompt(params: BuildEmailPromptParams): string {
  const {
    agentSystemPrompt,
    step,
    lead,
    previousEmails,
    styleSamples,
    variant,
  } = params;

  const directive = variant?.directive ?? step.directive ?? "";
  const subjectHint = variant?.subjectHint ?? step.subjectHint;
  const toneHint = step.toneHint;
  const maxWords = step.maxWords;

  const sections: string[] = [];

  // --- Role ---
  sections.push(
    `You are an expert cold email writer. ${agentSystemPrompt}`.trim()
  );

  // --- Lead context ---
  sections.push(buildLeadSection(lead));

  // --- Sequence position ---
  sections.push(buildSequenceSection(step, previousEmails));

  // --- Directive ---
  sections.push(`## Directive for this email\n${directive}`);

  // --- Constraints ---
  sections.push(buildConstraintsSection(subjectHint, toneHint, maxWords));

  // --- Style samples (few-shot) ---
  if (styleSamples && styleSamples.length > 0) {
    sections.push(
      `## Style Examples (follow this tone and style)\n${styleSamples.join("\n\n")}`
    );
  }

  // --- Output format ---
  sections.push(
    [
      "## Output Format",
      'Respond with ONLY a JSON object, no markdown fences, no explanation:',
      '{"subject": "...", "body": "..."}',
    ].join("\n")
  );

  return sections.join("\n\n");
}

// ============================================
// SECTION BUILDERS
// ============================================

function buildLeadSection(lead: LeadContext): string {
  const lines: string[] = ["## Lead Context"];

  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ");
  if (fullName) lines.push(`- Name: ${fullName}`);
  lines.push(`- Email: ${lead.email}`);
  if (lead.company) lines.push(`- Company: ${lead.company}`);
  if (lead.jobTitle) lines.push(`- Job Title: ${lead.jobTitle}`);
  if (lead.linkedinUrl) lines.push(`- LinkedIn: ${lead.linkedinUrl}`);

  if (lead.enrichmentData && Object.keys(lead.enrichmentData).length > 0) {
    lines.push("- Enrichment Data:");
    for (const [key, value] of Object.entries(lead.enrichmentData)) {
      lines.push(`  - ${key}: ${formatValue(value)}`);
    }
  }

  if (lead.customVariables && Object.keys(lead.customVariables).length > 0) {
    lines.push("- Custom Variables:");
    for (const [key, value] of Object.entries(lead.customVariables)) {
      lines.push(`  - ${key}: ${formatValue(value)}`);
    }
  }

  return lines.join("\n");
}

function buildSequenceSection(
  step: CampaignStep,
  previousEmails?: string[]
): string {
  const lines: string[] = [
    `## Sequence Position`,
    `Step ${step.order} of the sequence.`,
  ];

  if (previousEmails && previousEmails.length > 0) {
    lines.push("");
    lines.push("Previous emails sent:");
    for (let i = 0; i < previousEmails.length; i++) {
      lines.push(`--- Email ${i + 1} ---`);
      lines.push(previousEmails[i]);
    }
  }

  return lines.join("\n");
}

function buildConstraintsSection(
  subjectHint?: string,
  toneHint?: string,
  maxWords?: number
): string {
  const lines: string[] = ["## Constraints"];

  if (subjectHint) lines.push(`- Subject hint: ${subjectHint}`);
  if (toneHint) lines.push(`- Tone: ${toneHint}`);
  if (maxWords) lines.push(`- Maximum ${maxWords} words`);

  lines.push("- Write in the same language as the directive");
  lines.push(
    "- Do NOT use placeholders like {{firstName}} -- use the actual lead data"
  );
  lines.push("- Do NOT include a signature");

  return lines.join("\n");
}

// ============================================
// HELPERS
// ============================================

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
}
