import type { NodeExecutor } from "@/features/executions/types";
import { Anthropic } from "@anthropic-ai/sdk";

type ConditionBranch = {
  id: string;
  label: string;
  prompt: string;
  evaluator: "domain_check" | "domain_check_inverse" | "llm_classify" | "llm_classify_inverse";
};

type ConditionData = {
  conditions: ConditionBranch[];
};

/**
 * Condition Executor
 *
 * Evaluates conditions and selects a branch.
 * Supports two evaluation strategies:
 * - domain_check: Deterministic check if attendees include external emails
 * - llm_classify: LLM-based classification (e.g., is this a sales meeting?)
 *
 * Returns __selectedBranch in context so the workflow executor
 * knows which branch edge to follow.
 */
export const conditionExecutor: NodeExecutor<ConditionData> = async ({
  data,
  context,
}) => {
  const conditions = data.conditions || [];

  if (conditions.length === 0) {
    return { ...context, __selectedBranch: "main" };
  }

  for (const condition of conditions) {
    const matched = await evaluateCondition(condition, context);
    if (matched) {
      return { ...context, __selectedBranch: condition.id };
    }
  }

  // If no condition matched, select the last one as fallback
  const fallback = conditions[conditions.length - 1];
  return { ...context, __selectedBranch: fallback.id };
};

async function evaluateCondition(
  condition: ConditionBranch,
  context: Record<string, unknown>
): Promise<boolean> {
  switch (condition.evaluator) {
    case "domain_check":
      return evaluateDomainCheck(context, false);
    case "domain_check_inverse":
      return evaluateDomainCheck(context, true);
    case "llm_classify":
      return evaluateLlmClassify(condition, context, false);
    case "llm_classify_inverse":
      return evaluateLlmClassify(condition, context, true);
    default:
      return false;
  }
}

/**
 * Deterministic domain check: does the meeting have external attendees?
 * Compares attendee email domains against the user's domain.
 */
function evaluateDomainCheck(
  context: Record<string, unknown>,
  inverse: boolean
): boolean {
  const calendarEvent = context.calendarEvent as {
    attendees?: Array<{ email: string }>;
    organizer?: { email: string };
  } | undefined;

  if (!calendarEvent?.attendees || calendarEvent.attendees.length === 0) {
    return inverse; // No attendees = internal (if inverse) or not external (if normal)
  }

  // Determine user domain from organizer or first attendee
  const organizerEmail = calendarEvent.organizer?.email || "";
  const userDomain = organizerEmail.split("@")[1] || "";

  if (!userDomain) {
    return !inverse; // Can't determine domain, assume external
  }

  const hasExternal = calendarEvent.attendees.some(
    (a) => a.email && !a.email.endsWith(`@${userDomain}`)
  );

  return inverse ? !hasExternal : hasExternal;
}

/**
 * LLM-based classification using Claude Haiku (fast + cheap).
 * Used for "Is this a sales meeting?" type conditions.
 */
async function evaluateLlmClassify(
  condition: ConditionBranch,
  context: Record<string, unknown>,
  inverse: boolean
): Promise<boolean> {
  const anthropic = new Anthropic();

  // Build context string from available data
  const calendarEvent = context.calendarEvent as { title?: string } | undefined;
  const transcript = context.transcript as string | undefined;
  const summary = context.summary as string | undefined;

  const contextInfo = [
    calendarEvent?.title ? `Meeting title: ${calendarEvent.title}` : "",
    summary ? `Summary: ${summary}` : "",
    transcript ? `Transcript excerpt: ${transcript.slice(0, 500)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 10,
    messages: [
      {
        role: "user",
        content: `Based on the following information, does this match the condition: "${condition.prompt}"?\n\n${contextInfo}\n\nRespond with only YES or NO.`,
      },
    ],
  });

  const answer =
    response.content[0].type === "text"
      ? response.content[0].text.trim().toUpperCase()
      : "NO";

  const isYes = answer.startsWith("YES");
  return inverse ? !isYes : isYes;
}
