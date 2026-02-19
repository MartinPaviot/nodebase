/**
 * Centralized model definitions used across all node settings panels and agent UIs.
 * Update versions here when models change — all selectors pick it up automatically.
 */

export const NODE_MODELS = [
  { id: "claude-haiku", label: "Claude 4.5 Haiku", provider: "Anthropic" },
  { id: "claude-sonnet", label: "Claude 4.5 Sonnet", provider: "Anthropic" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
  { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
] as const;

/** Enum-based labels for AgentModel (ANTHROPIC / OPENAI / GEMINI) */
export const AGENT_MODEL_LABELS: Record<string, string> = {
  ANTHROPIC: "Claude 4.5 Sonnet",
  OPENAI: "GPT-4o",
  GEMINI: "Gemini 2.5 Pro",
};

/** Tier-based labels with version info */
export const TIER_MODEL_LABELS: Record<string, string> = {
  fast: "Claude 4.5 Haiku — Fast",
  smart: "Claude 4.5 Sonnet — Balanced",
  deep: "Claude 4.5 Opus — Most capable",
};
