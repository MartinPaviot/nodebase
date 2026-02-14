/**
 * Style Learner — Capture and retrieve style corrections for few-shot prompting.
 *
 * When a user edits a generated email before sending, the diff is stored as
 * an AgentMemory entry with category STYLE_CORRECTION. These corrections are
 * later retrieved and injected into the email generation prompt so that the
 * LLM progressively adapts to the user's writing style.
 */

import prisma from "@/lib/db";
import { nanoid } from "nanoid";

// ============================================
// TYPES
// ============================================

interface EmailContent {
  subject: string;
  body: string;
}

interface StyleCorrectionData {
  original: EmailContent;
  corrected: EmailContent;
  diffSummary: string;
}

// ============================================
// CAPTURE STYLE CORRECTION
// ============================================

/**
 * Store the difference between an AI-generated email and the user's
 * corrected version as an AgentMemory entry.
 *
 * Only stores the correction if there is a meaningful difference
 * (subject or body actually changed).
 */
export async function captureStyleCorrection(params: {
  agentId: string;
  originalEmail: EmailContent;
  correctedEmail: EmailContent;
}): Promise<void> {
  const { agentId, originalEmail, correctedEmail } = params;

  // Skip if nothing changed
  if (
    originalEmail.subject === correctedEmail.subject &&
    originalEmail.body === correctedEmail.body
  ) {
    return;
  }

  const diffSummary = buildDiffSummary(originalEmail, correctedEmail);

  const correctionData: StyleCorrectionData = {
    original: originalEmail,
    corrected: correctedEmail,
    diffSummary,
  };

  await prisma.agentMemory.create({
    data: {
      id: nanoid(),
      agentId,
      key: `style_correction_${Date.now()}`,
      value: JSON.stringify(correctionData),
      category: "STYLE_CORRECTION",
      source: "campaign_editor",
    },
  });
}

// ============================================
// GET STYLE SAMPLES
// ============================================

/**
 * Retrieve the most recent style corrections for an agent, formatted
 * as strings suitable for few-shot injection into the email prompt.
 *
 * @param agentId  - The agent whose style corrections to fetch
 * @param limit    - Maximum number of samples (default 5)
 * @returns Formatted correction strings
 */
export async function getStyleSamples(
  agentId: string,
  limit: number = 5
): Promise<string[]> {
  const memories = await prisma.agentMemory.findMany({
    where: {
      agentId,
      category: "STYLE_CORRECTION",
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return memories
    .map((memory) => {
      try {
        const data = JSON.parse(memory.value) as StyleCorrectionData;
        return formatSample(data);
      } catch {
        // Skip corrupted entries
        return null;
      }
    })
    .filter((sample): sample is string => sample !== null);
}

// ============================================
// HELPERS
// ============================================

/**
 * Build a human-readable summary of what changed between the original
 * and corrected email.
 */
function buildDiffSummary(
  original: EmailContent,
  corrected: EmailContent
): string {
  const changes: string[] = [];

  if (original.subject !== corrected.subject) {
    changes.push("Subject was rewritten");
  }

  if (original.body !== corrected.body) {
    const origWords = original.body.split(/\s+/).length;
    const corrWords = corrected.body.split(/\s+/).length;

    if (corrWords < origWords * 0.7) {
      changes.push("Body was significantly shortened");
    } else if (corrWords > origWords * 1.3) {
      changes.push("Body was significantly expanded");
    } else {
      changes.push("Body was revised");
    }
  }

  return changes.length > 0 ? changes.join("; ") : "Minor edits";
}

/**
 * Format a single style correction as a before/after example.
 */
function formatSample(data: StyleCorrectionData): string {
  const lines: string[] = [];

  lines.push(`Original: ${data.original.subject}`);
  lines.push(data.original.body);
  lines.push(`-> Corrected: ${data.corrected.subject}`);
  lines.push(data.corrected.body);

  return lines.join("\n");
}
