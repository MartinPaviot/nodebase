/**
 * Outreach BullMQ Queue definitions
 *
 * Four queues for the cold email outreach system:
 * 1. mailbox:sync       - Sync Instantly stats, DNS checks, health score recalculation
 * 2. campaign:send      - Process active campaigns, generate & send emails
 * 3. campaign:check-replies - Detect replies and bounces via Gmail API
 * 4. campaign:stats     - Aggregate daily stats
 */

import { Queue } from 'bullmq';
import redisConnection from './client';

// Queue options (same defaults as core queues)
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  removeOnComplete: {
    count: 100, // Keep last 100 completed jobs
  },
  removeOnFail: {
    count: 500, // Keep last 500 failed jobs
  },
};

// ============================================
// 1. MAILBOX SYNC — every 6 hours
// ============================================

export const mailboxSyncQueue = new Queue('mailbox:sync', {
  connection: redisConnection,
  defaultJobOptions,
});

// ============================================
// 2. CAMPAIGN SEND — every 5 min during business hours (Mon-Fri 8-18)
// ============================================

export const campaignSendQueue = new Queue('campaign:send', {
  connection: redisConnection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 1, // Do not retry sends — failures are handled per-email inside the worker
  },
});

// ============================================
// 3. CAMPAIGN CHECK REPLIES — every 10 min 24/7
// ============================================

export const campaignCheckRepliesQueue = new Queue('campaign:check-replies', {
  connection: redisConnection,
  defaultJobOptions,
});

// ============================================
// 4. CAMPAIGN STATS — daily at 1am
// ============================================

export const campaignStatsQueue = new Queue('campaign:stats', {
  connection: redisConnection,
  defaultJobOptions,
});

// ============================================
// Export all outreach queues
// ============================================

export const outreachQueues = {
  mailboxSync: mailboxSyncQueue,
  campaignSend: campaignSendQueue,
  campaignCheckReplies: campaignCheckRepliesQueue,
  campaignStats: campaignStatsQueue,
};

// ============================================
// Helper: schedule repeatable jobs
// ============================================

/**
 * Register all outreach repeatable schedules.
 * Call this once at app startup.
 */
export async function scheduleOutreachJobs(): Promise<void> {
  // 1. Mailbox sync — every 6 hours
  await mailboxSyncQueue.add(
    'sync-mailboxes',
    {},
    {
      repeat: { pattern: '0 */6 * * *' },
      priority: 2,
    }
  );

  // 2. Campaign send — every 5 min during business hours (Mon-Fri 8-18)
  await campaignSendQueue.add(
    'process-campaign-sends',
    {},
    {
      repeat: { pattern: '*/5 8-18 * * 1-5' },
      priority: 1,
    }
  );

  // 3. Campaign check replies — every 10 min 24/7
  await campaignCheckRepliesQueue.add(
    'check-replies',
    {},
    {
      repeat: { pattern: '*/10 * * * *' },
      priority: 2,
    }
  );

  // 4. Campaign stats — daily at 1am
  await campaignStatsQueue.add(
    'aggregate-stats',
    {},
    {
      repeat: { pattern: '0 1 * * *' },
      priority: 3,
    }
  );
}

/**
 * Remove all outreach repeatable schedules.
 * Call this during graceful shutdown.
 */
export async function removeOutreachSchedules(): Promise<void> {
  const allQueues = [
    mailboxSyncQueue,
    campaignSendQueue,
    campaignCheckRepliesQueue,
    campaignStatsQueue,
  ];

  for (const queue of allQueues) {
    const repeatableJobs = await queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await queue.removeRepeatableByKey(job.key);
    }
  }
}

// ============================================
// Graceful shutdown
// ============================================

export async function closeOutreachQueues(): Promise<void> {
  await Promise.all([
    mailboxSyncQueue.close(),
    campaignSendQueue.close(),
    campaignCheckRepliesQueue.close(),
    campaignStatsQueue.close(),
  ]);
}
