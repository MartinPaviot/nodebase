/**
 * Shared prompt utilities for flow executor and chat routes.
 */

/** Tone instruction appended to all LLM system prompts to avoid generic AI patterns */
export const TONE_SUFFIX = `

Formatting rules:
- Write naturally like a knowledgeable colleague, not like an AI assistant.
- NEVER use filler phrases like "Here's what I found", "Great question!", "I'd be happy to help", "Let me explain", "Sure!".
- Use markdown formatting sparingly: only use headers for truly structured content. For short answers, just write plain text.
- Prefer short paragraphs over bullet lists. Use bullet points only for actual lists of items.
- Keep responses direct and concise. Start with the answer, not a preamble. Only include the most important information.`;
