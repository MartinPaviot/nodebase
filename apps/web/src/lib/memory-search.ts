/**
 * Semantic Memory Retrieval
 *
 * When an agent has many memories (30+), loading all of them into the
 * system prompt wastes tokens and dilutes relevance. This module provides
 * hybrid retrieval:
 *
 * - Core memories (INSTRUCTION, PREFERENCE) are ALWAYS included
 * - Contextual memories (GENERAL, CONTEXT, HISTORY) are retrieved by
 *   semantic similarity to the current user message
 *
 * Uses the existing embedding infrastructure (OpenAI text-embedding-3-small)
 * with in-memory cosine similarity. Scales to ~10K memories per agent
 * without needing pgvector.
 *
 * Scoring formula inspired by CrewAI:
 *   composite = semantic_weight * similarity + recency_weight * decay + importance_weight * importance
 */

import { MemoryCategory } from "@prisma/client";
import prisma from "@/lib/db";
import { generateEmbedding, cosineSimilarity } from "@/lib/embeddings";

/** Categories that are always included in the prompt (core memory) */
const CORE_CATEGORIES: MemoryCategory[] = [
  MemoryCategory.INSTRUCTION,
  MemoryCategory.PREFERENCE,
  MemoryCategory.STYLE_CORRECTION,
];

/** Categories that are retrieved by semantic relevance */
const CONTEXTUAL_CATEGORIES: MemoryCategory[] = [
  MemoryCategory.GENERAL,
  MemoryCategory.CONTEXT,
  MemoryCategory.HISTORY,
];

/** Threshold: below this count, just load all memories (cheaper than embedding search) */
const SEMANTIC_SEARCH_THRESHOLD = 30;

/** Max contextual memories to retrieve via semantic search */
const MAX_CONTEXTUAL_RESULTS = 10;

/** Minimum similarity score to include a memory */
const MIN_SIMILARITY_SCORE = 0.3;

/** Scoring weights */
const SEMANTIC_WEIGHT = 0.6;
const RECENCY_WEIGHT = 0.3;
const IMPORTANCE_WEIGHT = 0.1;

/** Half-life for recency decay (in days) */
const RECENCY_HALF_LIFE_DAYS = 30;

interface ScoredMemory {
  key: string;
  value: string;
  category: string;
  score: number;
}

/**
 * Retrieve agent memories using hybrid strategy:
 * - Core memories (INSTRUCTION, PREFERENCE, STYLE_CORRECTION): always loaded
 * - Contextual memories (GENERAL, CONTEXT, HISTORY): semantic search if count > threshold
 *
 * Returns formatted memories ready for system prompt injection.
 */
export async function getRelevantMemories(
  agentId: string,
  userMessage: string,
): Promise<Array<{ key: string; value: string; category: string }>> {
  // Count total memories to decide strategy
  const totalCount = await prisma.agentMemory.count({
    where: {
      agentId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  // Below threshold: just load all (cheaper than embedding API call)
  if (totalCount <= SEMANTIC_SEARCH_THRESHOLD) {
    const all = await prisma.agentMemory.findMany({
      where: {
        agentId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: { key: true, value: true, category: true },
    });
    return all;
  }

  // Above threshold: hybrid retrieval
  const [coreMemories, contextualMemories] = await Promise.all([
    // Always load core memories
    prisma.agentMemory.findMany({
      where: {
        agentId,
        category: { in: CORE_CATEGORIES },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: { key: true, value: true, category: true },
    }),
    // Load contextual memories with embeddings for scoring
    prisma.agentMemory.findMany({
      where: {
        agentId,
        category: { in: CONTEXTUAL_CATEGORIES },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: { key: true, value: true, category: true, embedding: true, updatedAt: true },
    }),
  ]);

  // If no contextual memories, just return core
  if (contextualMemories.length === 0) {
    return coreMemories;
  }

  // Semantic search on contextual memories
  const queryEmbedding = await generateEmbedding(userMessage);
  const now = new Date();

  const scored: ScoredMemory[] = contextualMemories.map(m => {
    // Semantic score (0-1)
    const semanticScore = m.embedding.length > 0
      ? cosineSimilarity(queryEmbedding, m.embedding)
      : 0.5; // Default for memories without embeddings

    // Recency score (exponential decay)
    const ageMs = now.getTime() - m.updatedAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const recencyScore = Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);

    // Importance (currently static, can be enhanced later)
    const importanceScore = 0.5;

    // Composite score
    const composite =
      SEMANTIC_WEIGHT * semanticScore +
      RECENCY_WEIGHT * recencyScore +
      IMPORTANCE_WEIGHT * importanceScore;

    return {
      key: m.key,
      value: m.value,
      category: m.category,
      score: composite,
    };
  });

  // Filter and sort by composite score
  const topContextual = scored
    .filter(m => m.score >= MIN_SIMILARITY_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CONTEXTUAL_RESULTS);

  // Merge core + top contextual, deduplicate by key
  const seen = new Set<string>();
  const result: Array<{ key: string; value: string; category: string }> = [];

  for (const m of coreMemories) {
    if (!seen.has(m.key)) {
      seen.add(m.key);
      result.push(m);
    }
  }

  for (const m of topContextual) {
    if (!seen.has(m.key)) {
      seen.add(m.key);
      result.push({ key: m.key, value: m.value, category: m.category });
    }
  }

  return result;
}
