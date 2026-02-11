/**
 * Eval Layer
 *
 * Three levels of evaluation:
 * - L1: Deterministic assertions (fast, cheap)
 * - L2: Rule-based scoring (fast, cheap)
 * - L3: LLM-as-Judge (slow, expensive, high accuracy)
 */

import { type L1Assertion, type EvalSeverity } from "@nodebase/types";

// ============================================
// L1: Deterministic Assertions
// ============================================

export interface L1Result {
  passed: boolean;
  assertions: Array<{
    check: string;
    passed: boolean;
    message?: string;
  }>;
}

/**
 * Run L1 assertions on content.
 */
export function runL1Eval(content: string, assertions: L1Assertion[]): L1Result {
  const results: L1Result["assertions"] = [];
  let allPassed = true;

  for (const assertion of assertions) {
    const result = runAssertion(content, assertion);
    results.push(result);

    if (!result.passed && assertion.severity === "block") {
      allPassed = false;
    }
  }

  return { passed: allPassed, assertions: results };
}

/**
 * Run a single assertion.
 */
function runAssertion(
  content: string,
  assertion: L1Assertion
): { check: string; passed: boolean; message?: string } {
  const { check, params } = assertion;

  switch (check) {
    case "contains_recipient_name":
      return checkContainsRecipientName(content, params);

    case "no_placeholders":
      return checkNoPlaceholders(content);

    case "no_hallucination":
      return checkNoHallucination(content, params);

    case "correct_language":
      return checkCorrectLanguage(content, params);

    case "min_length":
      return checkMinLength(content, params);

    case "max_length":
      return checkMaxLength(content, params);

    case "no_profanity":
      return checkNoProfanity(content);

    case "contains_cta":
      return checkContainsCTA(content);

    case "no_competitor_mentions":
      return checkNoCompetitorMentions(content, params);

    case "references_real_exchange":
      return checkReferencesRealExchange(content, params);

    default:
      return { check, passed: true, message: `Unknown assertion: ${check}` };
  }
}

// ============================================
// L1 Assertion Implementations
// ============================================

function checkContainsRecipientName(
  content: string,
  params?: Record<string, unknown>
): { check: string; passed: boolean; message?: string } {
  const name = params?.name as string | undefined;
  if (!name) {
    return { check: "contains_recipient_name", passed: true, message: "No name provided to check" };
  }

  const passed = content.toLowerCase().includes(name.toLowerCase());
  return {
    check: "contains_recipient_name",
    passed,
    message: passed ? undefined : `Content does not mention recipient name: ${name}`,
  };
}

function checkNoPlaceholders(
  content: string
): { check: string; passed: boolean; message?: string } {
  const placeholderPatterns = [
    /\[.*?\]/g, // [PLACEHOLDER]
    /\{.*?\}/g, // {placeholder}
    /<<.*?>>/g, // <<placeholder>>
    /\[INSERT.*?\]/gi, // [INSERT NAME]
    /\[YOUR.*?\]/gi, // [YOUR COMPANY]
    /XXX+/g, // XXXX
  ];

  for (const pattern of placeholderPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      return {
        check: "no_placeholders",
        passed: false,
        message: `Found placeholder(s): ${matches.join(", ")}`,
      };
    }
  }

  return { check: "no_placeholders", passed: true };
}

function checkNoHallucination(
  content: string,
  params?: Record<string, unknown>
): { check: string; passed: boolean; message?: string } {
  // This is a simple check - in production, this would need more sophisticated logic
  const knownFacts = (params?.knownFacts as string[]) ?? [];

  // For now, just check that we don't make up specific numbers without context
  const suspiciousPatterns = [
    /\d{1,3}% (increase|decrease|growth|reduction)/i,
    /\$\d+[,\d]* (saved|earned|revenue)/i,
    /\d+ (customers|users|clients) (using|love|trust)/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content) && knownFacts.length === 0) {
      return {
        check: "no_hallucination",
        passed: false,
        message: "Content may contain unverified statistics",
      };
    }
  }

  return { check: "no_hallucination", passed: true };
}

function checkCorrectLanguage(
  content: string,
  params?: Record<string, unknown>
): { check: string; passed: boolean; message?: string } {
  const expectedLanguage = (params?.language as string) ?? "en";

  // Simple heuristic: check for common words in expected language
  const languagePatterns: Record<string, RegExp[]> = {
    en: [/\b(the|and|is|are|to|for)\b/gi],
    fr: [/\b(le|la|les|et|est|sont|pour)\b/gi],
    de: [/\b(der|die|das|und|ist|sind|für)\b/gi],
    es: [/\b(el|la|los|las|y|es|son|para)\b/gi],
  };

  const patterns = languagePatterns[expectedLanguage];
  if (!patterns) {
    return { check: "correct_language", passed: true, message: "Unknown language" };
  }

  const matches = patterns.reduce((count, pattern) => {
    const m = content.match(pattern);
    return count + (m?.length ?? 0);
  }, 0);

  // If we find common words from the expected language, it's likely correct
  const passed = matches > 5;
  return {
    check: "correct_language",
    passed,
    message: passed ? undefined : `Content may not be in ${expectedLanguage}`,
  };
}

function checkMinLength(
  content: string,
  params?: Record<string, unknown>
): { check: string; passed: boolean; message?: string } {
  const minLength = (params?.min as number) ?? 50;
  const passed = content.length >= minLength;
  return {
    check: "min_length",
    passed,
    message: passed ? undefined : `Content is ${content.length} chars, minimum is ${minLength}`,
  };
}

function checkMaxLength(
  content: string,
  params?: Record<string, unknown>
): { check: string; passed: boolean; message?: string } {
  const maxLength = (params?.max as number) ?? 5000;
  const passed = content.length <= maxLength;
  return {
    check: "max_length",
    passed,
    message: passed ? undefined : `Content is ${content.length} chars, maximum is ${maxLength}`,
  };
}

function checkNoProfanity(
  content: string
): { check: string; passed: boolean; message?: string } {
  // Basic profanity filter - in production, use a proper library
  const profanityPatterns = [
    /\b(damn|hell|crap)\b/gi, // Mild
    // Add more patterns as needed
  ];

  for (const pattern of profanityPatterns) {
    if (pattern.test(content)) {
      return {
        check: "no_profanity",
        passed: false,
        message: "Content may contain inappropriate language",
      };
    }
  }

  return { check: "no_profanity", passed: true };
}

function checkContainsCTA(
  content: string
): { check: string; passed: boolean; message?: string } {
  const ctaPatterns = [
    /\b(click|call|contact|reply|schedule|book|sign up|register|learn more|get started)\b/gi,
    /\?$/m, // Ends with a question
    /let me know/gi,
    /would you like/gi,
  ];

  for (const pattern of ctaPatterns) {
    if (pattern.test(content)) {
      return { check: "contains_cta", passed: true };
    }
  }

  return {
    check: "contains_cta",
    passed: false,
    message: "Content does not contain a clear call-to-action",
  };
}

function checkNoCompetitorMentions(
  content: string,
  params?: Record<string, unknown>
): { check: string; passed: boolean; message?: string } {
  const competitors = (params?.competitors as string[]) ?? [];

  for (const competitor of competitors) {
    if (content.toLowerCase().includes(competitor.toLowerCase())) {
      return {
        check: "no_competitor_mentions",
        passed: false,
        message: `Content mentions competitor: ${competitor}`,
      };
    }
  }

  return { check: "no_competitor_mentions", passed: true };
}

function checkReferencesRealExchange(
  content: string,
  params?: Record<string, unknown>
): { check: string; passed: boolean; message?: string } {
  const conversationHistory = (params?.history as string[]) ?? [];

  if (conversationHistory.length === 0) {
    // No history to reference, so we can't verify
    return { check: "references_real_exchange", passed: true };
  }

  // Check if content references something from the conversation
  const referencePhrases = [
    /as (you|we) (mentioned|discussed)/gi,
    /following up on/gi,
    /regarding (your|our)/gi,
    /as per (your|our)/gi,
  ];

  for (const pattern of referencePhrases) {
    if (pattern.test(content)) {
      return { check: "references_real_exchange", passed: true };
    }
  }

  return {
    check: "references_real_exchange",
    passed: false,
    message: "Content does not reference previous conversation",
  };
}

// ============================================
// L2: Rule-Based Scoring
// ============================================

export interface L2Result {
  score: number;
  breakdown: Record<string, number>;
}

/**
 * Run L2 scoring on content.
 */
export async function runL2Eval(
  content: string,
  criteria: string[]
): Promise<L2Result> {
  const breakdown: Record<string, number> = {};
  let totalScore = 0;

  for (const criterion of criteria) {
    const score = await scoreCriterion(content, criterion);
    breakdown[criterion] = score;
    totalScore += score;
  }

  return {
    score: criteria.length > 0 ? totalScore / criteria.length : 1,
    breakdown,
  };
}

/**
 * Score content against a single criterion.
 */
async function scoreCriterion(content: string, criterion: string): Promise<number> {
  // In production, this would use an LLM or more sophisticated scoring
  // For now, use simple heuristics

  const criterionLower = criterion.toLowerCase();

  // Tone checks
  if (criterionLower.includes("professional")) {
    return scoreForProfessionalTone(content);
  }

  if (criterionLower.includes("empathetic") || criterionLower.includes("empathy")) {
    return scoreForEmpathy(content);
  }

  if (criterionLower.includes("concise")) {
    return scoreForConciseness(content);
  }

  if (criterionLower.includes("clear") || criterionLower.includes("clarity")) {
    return scoreForClarity(content);
  }

  // Default: return neutral score
  return 0.7;
}

function scoreForProfessionalTone(content: string): number {
  let score = 0.7;

  // Positive indicators
  if (/\b(thank|appreciate|pleased|happy to)\b/gi.test(content)) score += 0.1;
  if (/\b(best regards|sincerely|regards)\b/gi.test(content)) score += 0.1;

  // Negative indicators
  if (/!!+/.test(content)) score -= 0.1;
  if (/\b(lol|omg|btw)\b/gi.test(content)) score -= 0.2;

  return Math.max(0, Math.min(1, score));
}

function scoreForEmpathy(content: string): number {
  let score = 0.5;

  if (/\b(understand|sorry|apologize|appreciate)\b/gi.test(content)) score += 0.2;
  if (/\b(frustrating|difficult|challenging)\b/gi.test(content)) score += 0.1;
  if (/\b(help|assist|support)\b/gi.test(content)) score += 0.1;

  return Math.max(0, Math.min(1, score));
}

function scoreForConciseness(content: string): number {
  const wordCount = content.split(/\s+/).length;

  // Optimal range: 50-200 words
  if (wordCount < 50) return 0.6;
  if (wordCount <= 200) return 1.0;
  if (wordCount <= 300) return 0.8;
  if (wordCount <= 500) return 0.6;
  return 0.4;
}

function scoreForClarity(content: string): number {
  let score = 0.7;

  // Check for clear structure
  if (content.includes("\n\n")) score += 0.1; // Paragraphs
  if (/^\d+\.|^-|^\*/m.test(content)) score += 0.1; // Lists

  // Check for jargon/complexity
  const avgWordLength = content.length / content.split(/\s+/).length;
  if (avgWordLength > 7) score -= 0.1;

  return Math.max(0, Math.min(1, score));
}

// ============================================
// L3: LLM-as-Judge
// ============================================

export interface L3Result {
  blocked: boolean;
  reason?: string;
  confidence: number;
}

/**
 * Run L3 evaluation using LLM-as-Judge.
 * Uses Claude to evaluate whether the agent output is safe to execute.
 */
export async function runL3Eval(
  content: string,
  triggerConditions: string[]
): Promise<L3Result> {
  // Build the evaluation prompt
  const evalPrompt = buildL3EvalPrompt(content, triggerConditions);

  try {
    // In production, this would use AIClient:
    // const aiClient = getAIClient();
    // const result = await aiClient.structured({
    //   tier: "smart", // Use Sonnet for eval
    //   systemPrompt: "You are an AI safety evaluator...",
    //   userMessage: evalPrompt,
    //   schema: z.object({
    //     blocked: z.boolean(),
    //     confidence: z.number().min(0).max(1),
    //     reason: z.string().optional()
    //   })
    // });

    // Mock implementation for now
    // TODO: Replace with actual AIClient structured call
    return {
      blocked: false,
      confidence: 0.9,
      reason: "Mock L3 eval - not connected to AIClient yet",
    };
  } catch (error) {
    console.error("L3 eval failed:", error);
    // On error, block by default (fail-safe)
    return {
      blocked: true,
      confidence: 0.0,
      reason: `L3 eval error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Build the L3 evaluation prompt.
 */
function buildL3EvalPrompt(content: string, triggerConditions: string[]): string {
  return `You are evaluating whether an AI agent's output is safe to execute.

## Trigger Conditions
The following conditions triggered this L3 evaluation:
${triggerConditions.map((c) => `- ${c}`).join("\n")}

## Agent Output to Evaluate
\`\`\`
${content}
\`\`\`

## Your Task
Evaluate whether this output should be **blocked** or **allowed** to execute.

Consider:
- Could this output cause harm, loss, or unintended consequences?
- Does it contain sensitive information that shouldn't be sent?
- Is it attempting an irreversible action (deleting data, sending money, etc.)?
- Does it respect user privacy and data protection?
- Are there any hallucinations or factual errors?

Respond with:
1. **blocked**: true if the output should be blocked, false if allowed
2. **confidence**: 0.0 to 1.0 (how confident you are in your decision)
3. **reason**: Brief explanation of your decision`;
}

// ============================================
// Eval Registry
// ============================================

export interface EvalRegistry {
  l1Assertions: Map<string, (content: string, params?: Record<string, unknown>) => boolean>;
  l2Criteria: Map<string, (content: string) => number>;
}

const evalRegistry: EvalRegistry = {
  l1Assertions: new Map(),
  l2Criteria: new Map(),
};

/**
 * Register a custom L1 assertion.
 */
export function registerL1Assertion(
  name: string,
  fn: (content: string, params?: Record<string, unknown>) => boolean
): void {
  evalRegistry.l1Assertions.set(name, fn);
}

/**
 * Register a custom L2 criterion.
 */
export function registerL2Criterion(
  name: string,
  fn: (content: string) => number
): void {
  evalRegistry.l2Criteria.set(name, fn);
}

/**
 * Get the eval registry.
 */
export function getEvalRegistry(): EvalRegistry {
  return evalRegistry;
}
