/**
 * Memory Extractor — Post-Turn Proactive Memory Extraction
 *
 * After each chat turn, extracts important facts worth remembering
 * using a lightweight Haiku call. Saves them as AgentMemory entries
 * with embeddings for future semantic retrieval.
 *
 * Inspired by Mem0's two-phase extraction pipeline:
 * Phase 1: Extract facts from the conversation turn
 * Phase 2: Compare against existing memories, ADD/UPDATE/NOOP
 */

import Anthropic from "@anthropic-ai/sdk";
import { MemoryCategory } from "@prisma/client";
import prisma from "@/lib/db";
import { getPlatformApiKey, getModelForTier } from "@/lib/config";
import { generateEmbedding } from "@/lib/embeddings";

interface ToolResult {
  toolName: string;
  input: unknown;
  output: unknown;
}

interface ExistingMemory {
  key: string;
  value: string;
  category: string;
}

interface ExtractedMemory {
  key: string;
  value: string;
  category: "GENERAL" | "PREFERENCE" | "CONTEXT" | "HISTORY" | "INSTRUCTION";
}

const EXTRACTION_PROMPT = `You are a memory extraction system. Given a conversation turn between a user and an AI assistant, extract important facts that should be remembered for future conversations.

Focus on:
- User preferences (timezone, language, tone, format)
- Standing instructions ("always do X", "never do Y")
- Task parameters (target companies, search criteria, roles, filters)
- Key findings from tool results that the user might reference later
- Corrections the user made to the assistant's behavior

Do NOT extract:
- Transient chat details (greetings, acknowledgments)
- Information already captured in existing memories (unless it's an update)
- The assistant's reasoning or internal thoughts

For each fact, provide:
- key: a short, descriptive snake_case identifier (e.g., "target_companies", "preferred_language")
- value: the fact to remember (concise but complete)
- category: one of PREFERENCE, INSTRUCTION, CONTEXT, HISTORY, GENERAL

If a fact updates an existing memory, use the SAME key to overwrite it.

Respond with a JSON array. If nothing worth remembering, respond with an empty array [].`;

/**
 * Extract and save memories from a conversation turn.
 * Uses Haiku (fast tier) for cheap, low-latency extraction.
 * Fire-and-forget — errors are logged but don't block the chat response.
 */
export async function extractAndSaveMemories(
  agentId: string,
  userMessage: string,
  assistantResponse: string,
  toolResults: ToolResult[],
  existingMemories: ExistingMemory[],
): Promise<void> {
  // Skip extraction if the turn is trivial (short messages, no tool calls)
  if (userMessage.length < 20 && toolResults.length === 0) {
    return;
  }

  try {
    const extracted = await extractMemoriesFromTurn(
      userMessage,
      assistantResponse,
      toolResults,
      existingMemories,
    );

    if (extracted.length === 0) return;

    // Save each extracted memory with embedding
    await Promise.all(
      extracted.map(async (memory) => {
        try {
          const embedding = await generateEmbedding(`${memory.key}: ${memory.value}`);

          await prisma.agentMemory.upsert({
            where: { agentId_key: { agentId, key: memory.key } },
            create: {
              agentId,
              key: memory.key,
              value: memory.value,
              category: memory.category as MemoryCategory,
              embedding,
            },
            update: {
              value: memory.value,
              category: memory.category as MemoryCategory,
              embedding,
            },
          });
        } catch (err) {
          console.warn(`Failed to save extracted memory "${memory.key}":`, err);
        }
      }),
    );
  } catch (err) {
    console.warn("Memory extraction failed:", err);
  }
}

async function extractMemoriesFromTurn(
  userMessage: string,
  assistantResponse: string,
  toolResults: ToolResult[],
  existingMemories: ExistingMemory[],
): Promise<ExtractedMemory[]> {
  const apiKey = getPlatformApiKey();
  const client = new Anthropic({ apiKey });

  // Build context for extraction
  const toolResultsSummary = toolResults.length > 0
    ? `\n\nTool results from this turn:\n${toolResults
        .map(t => `- ${t.toolName}: ${JSON.stringify(t.output).slice(0, 500)}`)
        .join("\n")}`
    : "";

  const existingMemoriesSummary = existingMemories.length > 0
    ? `\n\nExisting memories (use same key to update):\n${existingMemories
        .map(m => `- ${m.key}: ${m.value}`)
        .join("\n")}`
    : "";

  const response = await client.messages.create({
    model: getModelForTier("fast"),
    max_tokens: 1024,
    temperature: 0,
    system: EXTRACTION_PROMPT,
    messages: [
      {
        role: "user",
        content: `User message: ${userMessage}\n\nAssistant response: ${assistantResponse.slice(0, 1000)}${toolResultsSummary}${existingMemoriesSummary}\n\nExtract memories as JSON array:`,
      },
    ],
  });

  // Parse the response
  const textBlock = response.content.find(b => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  try {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    // Validate and filter extracted memories
    return parsed.filter(
      (m: unknown): m is ExtractedMemory =>
        typeof m === "object" &&
        m !== null &&
        "key" in m &&
        "value" in m &&
        "category" in m &&
        typeof (m as ExtractedMemory).key === "string" &&
        typeof (m as ExtractedMemory).value === "string" &&
        ["GENERAL", "PREFERENCE", "CONTEXT", "HISTORY", "INSTRUCTION"].includes(
          (m as ExtractedMemory).category,
        ),
    );
  } catch {
    return [];
  }
}
