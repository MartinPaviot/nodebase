/**
 * Knowledge Base utility for RAG (Retrieval Augmented Generation)
 * Handles text chunking, embedding generation, and semantic search
 */

import prisma from "./db";
import {
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
} from "./embeddings";

// Chunking configuration
const CHUNK_SIZE = 500; // characters per chunk
const CHUNK_OVERLAP = 100; // overlap between chunks for context continuity

/**
 * Split text into overlapping chunks for better retrieval
 */
export function chunkText(text: string): string[] {
  const chunks: string[] = [];

  // Clean up the text
  const cleanedText = text.trim();

  if (cleanedText.length === 0) {
    return [];
  }

  if (cleanedText.length <= CHUNK_SIZE) {
    return [cleanedText];
  }

  let start = 0;

  while (start < cleanedText.length) {
    const end = Math.min(start + CHUNK_SIZE, cleanedText.length);

    // Try to find a natural break point (sentence end, paragraph, etc.)
    let chunkEnd = end;
    if (end < cleanedText.length) {
      // Look for sentence boundaries within the last 50 characters
      const lastPart = cleanedText.slice(end - 50, end);
      const sentenceBreak = lastPart.lastIndexOf(". ");

      if (sentenceBreak !== -1) {
        chunkEnd = end - 50 + sentenceBreak + 2; // Include the period and space
      }
    }

    const chunk = cleanedText.slice(start, chunkEnd).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Move start forward with overlap
    start = Math.max(chunkEnd - CHUNK_OVERLAP, start + 1);

    // Prevent infinite loops
    if (chunkEnd >= cleanedText.length) {
      break;
    }
  }

  return chunks;
}

/**
 * Index a document: chunk it and generate embeddings for each chunk
 */
export async function indexDocument(documentId: string): Promise<void> {
  const doc = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
  });

  if (!doc) {
    throw new Error("Document not found");
  }

  // Delete existing chunks (for re-indexing)
  await prisma.knowledgeChunk.deleteMany({
    where: { documentId },
  });

  // Chunk the document content
  const textChunks = chunkText(doc.content);

  if (textChunks.length === 0) {
    return;
  }

  // Generate embeddings for all chunks in a single API call
  const embeddings = await generateEmbeddings(textChunks);

  // Create chunks with embeddings
  await prisma.knowledgeChunk.createMany({
    data: textChunks.map((content, i) => ({
      documentId,
      content,
      embedding: embeddings[i],
      position: i,
    })),
  });
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  documentId: string;
  documentTitle: string;
  position: number;
}

/**
 * Search knowledge base using semantic similarity
 */
export async function searchKnowledge(
  agentId: string,
  query: string,
  topK = 5,
  minScore = 0.7
): Promise<SearchResult[]> {
  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  // Get all chunks for this agent's documents
  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      document: { agentId },
    },
    include: {
      document: {
        select: { id: true, title: true },
      },
    },
  });

  if (chunks.length === 0) {
    return [];
  }

  // Calculate similarity scores
  const scored = chunks
    .map((chunk) => {
      // Only calculate similarity if chunk has embedding
      if (!chunk.embedding || chunk.embedding.length === 0) {
        return null;
      }

      return {
        id: chunk.id,
        content: chunk.content,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
        documentId: chunk.document.id,
        documentTitle: chunk.document.title,
        position: chunk.position,
      };
    })
    .filter((result): result is SearchResult => result !== null);

  // Sort by score (descending) and filter by minimum score
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((c) => c.score >= minScore);
}

/**
 * Format search results for context injection into agent system prompt
 */
export function formatSearchResultsForContext(
  results: SearchResult[]
): string {
  if (results.length === 0) {
    return "";
  }

  const contextParts = results.map((result, index) => {
    return `[Source ${index + 1}: ${result.documentTitle}]\n${result.content}`;
  });

  return `## Relevant Knowledge Base Context:\n\n${contextParts.join("\n\n---\n\n")}`;
}
