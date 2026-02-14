/**
 * Campaign Engine — Core orchestration logic for cold email outreach.
 *
 * Responsibilities:
 * - Batch-selecting leads ready for the next email
 * - Mailbox selection (round-robin, random, least-used, domain-match)
 * - Calculating the next send time (business days, schedule, jitter)
 * - A/B variant selection (weighted random)
 * - Post-send bookkeeping (lead status, mailbox daily count)
 *
 * All database access goes through Prisma (`@/lib/db`).
 */

import prisma from "@/lib/db";
import type {
  Campaign,
  Lead,
  MailboxAccount,
  MailboxStrategy,
} from "@prisma/client";

// ============================================
// TYPES (JSON columns stored on Campaign)
// ============================================

export interface CampaignStepVariant {
  id: string;
  directive: string;
  subjectHint?: string;
  weight: number;
}

export interface CampaignStep {
  id: string;
  order: number;
  type: "email" | "wait";
  directive?: string;
  subjectHint?: string;
  toneHint?: string;
  maxWords?: number;
  variants?: CampaignStepVariant[];
  waitDays?: number;
  businessDaysOnly?: boolean;
  stopOnReply: boolean;
}

export interface SendingSchedule {
  timezone: string;
  /** 0 = Sun, 1 = Mon, ... 6 = Sat */
  days: number[];
  /** e.g. 8 */
  startHour: number;
  /** e.g. 18 */
  endHour: number;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
}

// Helper: lead with its campaign eagerly loaded
type LeadWithCampaign = Lead & { campaign: Campaign };

// ============================================
// 1. GET NEXT LEADS TO CONTACT
// ============================================

/**
 * Find leads that are ready for the next outbound email.
 *
 * Criteria:
 *  - status is PENDING or IN_SEQUENCE
 *  - nextSendAt is null (first touch) or <= now
 *  - currentStep < campaign.totalSteps
 *  - campaign is ACTIVE
 *
 * Ordered by nextSendAt ASC so the oldest-due leads go first.
 */
export async function getNextLeadsToContact(
  campaignId: string,
  batchSize: number
): Promise<LeadWithCampaign[]> {
  const now = new Date();

  const leads = await prisma.lead.findMany({
    where: {
      campaignId,
      status: { in: ["PENDING", "IN_SEQUENCE"] },
      campaign: { status: "ACTIVE" },
      OR: [{ nextSendAt: null }, { nextSendAt: { lte: now } }],
    },
    include: { campaign: true },
    orderBy: { nextSendAt: "asc" },
    take: batchSize,
  });

  // Post-filter: currentStep must be < totalSteps
  return leads.filter((lead) => lead.currentStep < lead.campaign.totalSteps);
}

// ============================================
// 2. SELECT MAILBOX
// ============================================

/**
 * Pick the best available mailbox for sending a cold email.
 *
 * Constraints:
 *  - status = READY
 *  - healthScore > 70
 *  - dailySentCount < (dailySendLimit * coldEmailRatio)
 *
 * Strategy controls ordering / filtering:
 *  - ROUND_ROBIN / LEAST_USED : order by dailySentCount ASC
 *  - RANDOM : shuffle after filtering
 *  - DOMAIN_MATCH : prefer mailboxes whose domain matches the lead domain,
 *    fallback to ROUND_ROBIN
 *
 * Returns null when no mailbox is available.
 */
export async function selectMailbox(
  userId: string,
  strategy: MailboxStrategy,
  excludeIds?: string[]
): Promise<MailboxAccount | null> {
  // Fetch all eligible mailboxes
  const mailboxes = await prisma.mailboxAccount.findMany({
    where: {
      userId,
      status: "READY",
      healthScore: { gt: 70 },
      ...(excludeIds && excludeIds.length > 0
        ? { id: { notIn: excludeIds } }
        : {}),
    },
    orderBy: { dailySentCount: "asc" },
  });

  // Filter: dailySentCount < dailySendLimit * coldEmailRatio
  const available = mailboxes.filter(
    (mb) => mb.dailySentCount < Math.floor(mb.dailySendLimit * mb.coldEmailRatio)
  );

  if (available.length === 0) return null;

  switch (strategy) {
    case "ROUND_ROBIN":
    case "LEAST_USED":
      // Already sorted by dailySentCount ASC — pick first
      return available[0];

    case "RANDOM": {
      const idx = Math.floor(Math.random() * available.length);
      return available[idx];
    }

    case "DOMAIN_MATCH":
      // Caller should pass a lead email domain via excludeIds override
      // but we still implement the generic version: just pick the least-used.
      return available[0];

    default:
      return available[0];
  }
}

/**
 * Domain-aware mailbox selection.
 * Tries to match the mailbox domain to the lead's email domain, then falls
 * back to ROUND_ROBIN ordering.
 */
export async function selectMailboxForLead(
  userId: string,
  strategy: MailboxStrategy,
  leadEmail: string,
  excludeIds?: string[]
): Promise<MailboxAccount | null> {
  if (strategy !== "DOMAIN_MATCH") {
    return selectMailbox(userId, strategy, excludeIds);
  }

  const leadDomain = leadEmail.split("@")[1]?.toLowerCase();

  const mailboxes = await prisma.mailboxAccount.findMany({
    where: {
      userId,
      status: "READY",
      healthScore: { gt: 70 },
      ...(excludeIds && excludeIds.length > 0
        ? { id: { notIn: excludeIds } }
        : {}),
    },
    orderBy: { dailySentCount: "asc" },
  });

  const available = mailboxes.filter(
    (mb) => mb.dailySentCount < Math.floor(mb.dailySendLimit * mb.coldEmailRatio)
  );

  if (available.length === 0) return null;

  // Prefer domain match
  if (leadDomain) {
    const domainMatch = available.find(
      (mb) => mb.domain.toLowerCase() === leadDomain
    );
    if (domainMatch) return domainMatch;
  }

  // Fallback: least used
  return available[0];
}

// ============================================
// 3. CALCULATE NEXT SEND AT
// ============================================

/**
 * Determine when the lead should receive the next email in the sequence.
 *
 * - Looks at the step AFTER currentStep
 * - If no more steps, returns null (sequence complete)
 * - For "wait" steps, accumulates waitDays (skipping weekends if
 *   businessDaysOnly)
 * - Adds random jitter of +/-2 hours
 * - Clamps the result into the campaign's sendingSchedule window,
 *   rolling forward to the next eligible day/hour if needed.
 */
export function calculateNextSendAt(
  campaign: Campaign,
  currentStep: number
): Date | null {
  const steps = campaign.steps as unknown as CampaignStep[];
  if (!Array.isArray(steps)) return null;

  // Sort by order to be safe
  const sorted = [...steps].sort((a, b) => a.order - b.order);

  // Find the next step(s) after currentStep (0-indexed order match)
  const nextStepIndex = sorted.findIndex((s) => s.order > currentStep);
  if (nextStepIndex === -1) return null; // No more steps

  const schedule = campaign.sendingSchedule as unknown as SendingSchedule | null;
  let sendDate = new Date();

  // Walk through remaining steps starting from the next one.
  // If we encounter a "wait" step, we accumulate the delay.
  // We stop at the first "email" step after any waits.
  for (let i = nextStepIndex; i < sorted.length; i++) {
    const step = sorted[i];

    if (step.type === "wait") {
      const days = step.waitDays ?? 1;
      if (step.businessDaysOnly) {
        sendDate = addBusinessDays(sendDate, days);
      } else {
        sendDate = addCalendarDays(sendDate, days);
      }
    } else if (step.type === "email") {
      // Found the next email step — stop accumulating
      break;
    }
  }

  // Add jitter: +/-2 hours (random between -120 and +120 minutes)
  const jitterMinutes = Math.floor(Math.random() * 241) - 120; // -120 to +120
  sendDate = new Date(sendDate.getTime() + jitterMinutes * 60_000);

  // Clamp to sending schedule
  if (schedule) {
    sendDate = clampToSchedule(sendDate, schedule);
  }

  return sendDate;
}

// ============================================
// 4. SELECT VARIANT (A/B Testing)
// ============================================

/**
 * Select which directive/subjectHint to use for a given step.
 * If the step defines variants, pick one via weighted random.
 * Otherwise return the step's own directive.
 */
export function selectVariant(
  step: CampaignStep
): { directive: string; subjectHint?: string; variantId?: string } {
  if (!step.variants || step.variants.length === 0) {
    return {
      directive: step.directive ?? "",
      subjectHint: step.subjectHint,
    };
  }

  const totalWeight = step.variants.reduce((sum, v) => sum + v.weight, 0);
  let random = Math.random() * totalWeight;

  for (const variant of step.variants) {
    random -= variant.weight;
    if (random <= 0) {
      return {
        directive: variant.directive,
        subjectHint: variant.subjectHint,
        variantId: variant.id,
      };
    }
  }

  // Fallback (should not happen unless weights are zero)
  const last = step.variants[step.variants.length - 1];
  return {
    directive: last.directive,
    subjectHint: last.subjectHint,
    variantId: last.id,
  };
}

// ============================================
// 5. UPDATE LEAD AFTER SEND
// ============================================

/**
 * Advance the lead's sequence state after an email has been sent.
 *
 * - Increments currentStep and totalEmailsSent
 * - Records lastEmailSentAt
 * - Sets the next scheduled send or marks the lead COMPLETED
 */
export async function updateLeadAfterSend(
  leadId: string,
  step: number,
  campaignId: string,
  nextSendAt: Date | null
): Promise<void> {
  const newStatus = nextSendAt === null ? "COMPLETED" : "IN_SEQUENCE";

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      currentStep: step + 1,
      totalEmailsSent: { increment: 1 },
      lastEmailSentAt: new Date(),
      nextSendAt,
      status: newStatus,
    },
  });
}

// ============================================
// 6. INCREMENT MAILBOX DAILY COUNT
// ============================================

/**
 * Bump the mailbox's daily send counter by 1.
 * The counter is expected to be reset daily by a scheduled job.
 */
export async function incrementMailboxDailyCount(
  mailboxId: string
): Promise<void> {
  await prisma.mailboxAccount.update({
    where: { id: mailboxId },
    data: {
      dailySentCount: { increment: 1 },
    },
  });
}

// ============================================
// DATE HELPERS
// ============================================

/**
 * Add N calendar days to a date.
 */
function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add N business days (Mon-Fri) to a date.
 */
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let remaining = days;

  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remaining--;
    }
  }

  return result;
}

/**
 * Move a date forward until it falls within the campaign sending schedule.
 *
 * Rules:
 *  - The day-of-week must be in schedule.days
 *  - The hour must be between startHour and endHour
 *  - If outside the window, roll forward to the next valid slot
 */
function clampToSchedule(date: Date, schedule: SendingSchedule): Date {
  const result = new Date(date);
  const maxIterations = 14; // Safety: never loop more than 2 weeks
  let iterations = 0;

  while (iterations < maxIterations) {
    const dayOfWeek = result.getDay();
    const hour = result.getHours();

    if (schedule.days.includes(dayOfWeek)) {
      if (hour >= schedule.startHour && hour < schedule.endHour) {
        // Within the window
        return result;
      }

      if (hour < schedule.startHour) {
        // Too early today — snap to startHour
        result.setHours(schedule.startHour, 0, 0, 0);
        return result;
      }

      // Past endHour — fall through to advance to next day
    }

    // Advance to next day at startHour
    result.setDate(result.getDate() + 1);
    result.setHours(schedule.startHour, 0, 0, 0);
    iterations++;
  }

  // Safety fallback: return the date as-is
  return result;
}
