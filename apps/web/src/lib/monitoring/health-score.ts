/**
 * Health Score Calculator for Mailbox Accounts
 *
 * Calculates a composite health score (0-100) from multiple signals
 * and auto-pilots the cold email ratio based on the score.
 */

interface HealthScoreParams {
  /** Instantly warmup score (0-100) — Weight: 30% */
  instantlyWarmupScore: number;
  /** Delivery rate (0-1) — Weight: 25% */
  deliveryRate: number;
  /** Spam rate (0-1, inverted: lower is better) — Weight: 20% */
  spamRate: number;
  /** DNS overall score (0-100) — Weight: 15% */
  dnsScore: number;
  /** Whether domain is on any blacklist — Weight: 10% */
  blacklisted: boolean;
}

interface HealthScoreResult {
  score: number;
  coldEmailRatio: number;
  coldSlotsPerDay: number;
  tier: 'excellent' | 'good' | 'moderate' | 'poor' | 'critical';
  breakdown: {
    warmup: number;
    delivery: number;
    spam: number;
    dns: number;
    blacklist: number;
  };
}

const WEIGHTS = {
  warmup: 0.3,
  delivery: 0.25,
  spam: 0.2,
  dns: 0.15,
  blacklist: 0.1,
} as const;

const DAILY_SEND_LIMIT = 40;

/**
 * Health tiers with their cold email ratio and daily cold slots.
 *
 * | Health Score | coldEmailRatio | Cold/day |
 * |-------------|----------------|----------|
 * | 90-100      | 0.60           | 24       |
 * | 70-89       | 0.50           | 20       |
 * | 50-69       | 0.30           | 12       |
 * | 30-49       | 0.10           | 4        |
 * | 0-29        | 0              | 0        |
 */
function getTier(score: number): {
  tier: HealthScoreResult['tier'];
  coldEmailRatio: number;
} {
  if (score >= 90) return { tier: 'excellent', coldEmailRatio: 0.6 };
  if (score >= 70) return { tier: 'good', coldEmailRatio: 0.5 };
  if (score >= 50) return { tier: 'moderate', coldEmailRatio: 0.3 };
  if (score >= 30) return { tier: 'poor', coldEmailRatio: 0.1 };
  return { tier: 'critical', coldEmailRatio: 0 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateHealthScore(params: HealthScoreParams): HealthScoreResult {
  const {
    instantlyWarmupScore,
    deliveryRate,
    spamRate,
    dnsScore,
    blacklisted,
  } = params;

  // Normalize each component to 0-100
  const warmupComponent = clamp(instantlyWarmupScore, 0, 100);
  const deliveryComponent = clamp(deliveryRate * 100, 0, 100);
  // Spam rate is inverted: 0% spam = 100 score, 10%+ spam = 0 score
  const spamComponent = clamp((1 - spamRate / 0.1) * 100, 0, 100);
  const dnsComponent = clamp(dnsScore, 0, 100);
  const blacklistComponent = blacklisted ? 0 : 100;

  // Weighted composite score
  const score = Math.round(
    warmupComponent * WEIGHTS.warmup +
    deliveryComponent * WEIGHTS.delivery +
    spamComponent * WEIGHTS.spam +
    dnsComponent * WEIGHTS.dns +
    blacklistComponent * WEIGHTS.blacklist
  );

  const clampedScore = clamp(score, 0, 100);
  const { tier, coldEmailRatio } = getTier(clampedScore);
  const coldSlotsPerDay = Math.floor(DAILY_SEND_LIMIT * coldEmailRatio);

  return {
    score: clampedScore,
    coldEmailRatio,
    coldSlotsPerDay,
    tier,
    breakdown: {
      warmup: Math.round(warmupComponent),
      delivery: Math.round(deliveryComponent),
      spam: Math.round(spamComponent),
      dns: Math.round(dnsComponent),
      blacklist: Math.round(blacklistComponent),
    },
  };
}

/**
 * Determines if a mailbox should be paused based on critical health signals.
 * Auto-pause protects domain reputation.
 */
export function shouldPauseMailbox(params: {
  healthScore: number;
  spamRate: number;
  bounceRate: number;
  blacklisted: boolean;
  consecutiveErrors: number;
}): { shouldPause: boolean; reason: string | null } {
  if (params.blacklisted) {
    return { shouldPause: true, reason: 'Domain is blacklisted' };
  }
  if (params.spamRate > 0.05) {
    return { shouldPause: true, reason: `Spam rate ${(params.spamRate * 100).toFixed(1)}% exceeds 5% threshold` };
  }
  if (params.bounceRate > 0.08) {
    return { shouldPause: true, reason: `Bounce rate ${(params.bounceRate * 100).toFixed(1)}% exceeds 8% threshold` };
  }
  if (params.consecutiveErrors >= 5) {
    return { shouldPause: true, reason: `${params.consecutiveErrors} consecutive send errors` };
  }
  if (params.healthScore < 20) {
    return { shouldPause: true, reason: `Health score ${params.healthScore} is critically low` };
  }
  return { shouldPause: false, reason: null };
}
