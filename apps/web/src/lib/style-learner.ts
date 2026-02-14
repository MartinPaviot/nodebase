/**
 * Style Learner - Phase 3.3
 *
 * Learns writing style from user edits to agent outputs.
 * Builds few-shot examples from AgentFeedback corrections.
 */

import prisma from "@/lib/db";
import { FeedbackType, MemoryCategory } from "@prisma/client";

export interface StyleExample {
  original: string;
  corrected: string;
  timestamp: Date;
}

export interface StyleGuide {
  examples: StyleExample[];
  summary: string;
}

/**
 * Get recent style corrections for an agent
 *
 * @param agentId - The agent to get corrections for
 * @param limit - Max number of corrections to retrieve (default 10)
 * @returns Array of style examples
 */
export async function getStyleCorrections(
  agentId: string,
  limit: number = 10
): Promise<StyleExample[]> {
  // Query AgentFeedback for USER_EDIT type
  const feedbacks = await prisma.agentFeedback.findMany({
    where: {
      agentId,
      type: FeedbackType.USER_EDIT,
      userEdit: { not: null },
    },
    orderBy: { timestamp: "desc" },
    take: limit,
    select: {
      originalOutput: true,
      userEdit: true,
      timestamp: true,
    },
  });

  return feedbacks
    .filter((f) => f.userEdit && f.userEdit !== f.originalOutput)
    .map((f) => ({
      original: f.originalOutput,
      corrected: f.userEdit!,
      timestamp: f.timestamp,
    }));
}

/**
 * Build a style guide from corrections
 *
 * @param agentId - The agent to build guide for
 * @returns Style guide with examples and summary
 */
export async function buildStyleGuide(agentId: string): Promise<StyleGuide> {
  const examples = await getStyleCorrections(agentId);

  if (examples.length === 0) {
    return {
      examples: [],
      summary: "No style corrections yet. The agent will learn from your edits.",
    };
  }

  // Build a summary of common patterns
  const summary = `Based on ${examples.length} correction${examples.length > 1 ? "s" : ""}, the user prefers:\n` +
    `- Specific tone and writing style adjustments\n` +
    `- Particular phrasing and word choices\n` +
    `- Custom formatting preferences`;

  return { examples, summary };
}

/**
 * Store style corrections as agent memory
 *
 * This allows the agent to reference corrections in future conversations.
 *
 * @param agentId - The agent to store corrections for
 */
export async function storeStyleCorrectionsAsMemory(
  agentId: string
): Promise<void> {
  const corrections = await getStyleCorrections(agentId, 10);

  if (corrections.length === 0) {
    return;
  }

  // Build memory value with few-shot examples
  const examplesText = corrections
    .map(
      (c, i) =>
        `[${i + 1}] Original: "${c.original.slice(0, 150)}..." → Corrected: "${c.corrected.slice(0, 150)}..."`
    )
    .join("\n");

  const memoryValue = `User's writing style preferences (${corrections.length} examples):\n${examplesText}`;

  // Check if style correction memory already exists
  const existingMemory = await prisma.agentMemory.findFirst({
    where: {
      agentId,
      category: MemoryCategory.STYLE_CORRECTION,
    },
  });

  if (existingMemory) {
    // Update existing
    await prisma.agentMemory.update({
      where: { id: existingMemory.id },
      data: {
        value: memoryValue,
      },
    });
  } else {
    // Create new
    await prisma.agentMemory.create({
      data: {
        agentId,
        key: "style_corrections",
        value: memoryValue,
        category: MemoryCategory.STYLE_CORRECTION,
      },
    });
  }
}

/**
 * Format style corrections as a prompt section
 *
 * @param agentId - The agent to format corrections for
 * @returns Formatted prompt section, or null if no corrections
 */
export async function formatStyleCorrectionsForPrompt(
  agentId: string
): Promise<string | null> {
  const corrections = await getStyleCorrections(agentId, 5); // Limit to 5 most recent

  if (corrections.length === 0) {
    return null;
  }

  const examplesText = corrections
    .map(
      (c, i) =>
        `Example ${i + 1}:\n` +
        `Original: ${c.original.slice(0, 200)}${c.original.length > 200 ? "..." : ""}\n` +
        `Preferred: ${c.corrected.slice(0, 200)}${c.corrected.length > 200 ? "..." : ""}`
    )
    .join("\n\n");

  return (
    `# Writing Style Guide\n\n` +
    `The user has edited your previous outputs to match their preferred style. ` +
    `Learn from these examples and apply the same style to your future responses:\n\n` +
    `${examplesText}\n\n` +
    `Key principles:\n` +
    `- Match the user's tone, formality level, and word choices\n` +
    `- Pay attention to how they structure sentences and paragraphs\n` +
    `- Adopt their preferred phrasing and expressions`
  );
}
