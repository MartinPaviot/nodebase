/**
 * Autonomy Tiers — Replace binary safeMode with 3-level autonomy
 *
 * - "auto": Execute directly if eval passes threshold
 * - "review": Always queue for human approval (default, recommended)
 * - "readonly": Can only read/analyze, never write or send
 */

export type AutonomyTier = "auto" | "review" | "readonly";

export interface AutonomyConfig {
  tier: AutonomyTier;
  autoSendThreshold: number;
}

/**
 * Derive autonomy config from an agent's fields.
 * Backward compatible: if autonomyTier is not set, falls back to safeMode boolean.
 */
export function getAutonomyConfig(agent: {
  autonomyTier?: string | null;
  safeMode?: boolean;
  evalRules?: unknown;
}): AutonomyConfig {
  const tier: AutonomyTier =
    (agent.autonomyTier as AutonomyTier) ||
    (agent.safeMode ? "review" : "auto");

  const evalRules = agent.evalRules as {
    autoSendThreshold?: number;
  } | null;
  const autoSendThreshold = evalRules?.autoSendThreshold ?? 85;

  return { tier, autoSendThreshold };
}

/**
 * Check if side-effect actions are allowed for this tier.
 */
export function isSideEffectAllowed(tier: AutonomyTier): boolean {
  return tier !== "readonly";
}
