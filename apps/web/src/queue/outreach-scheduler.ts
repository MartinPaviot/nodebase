/**
 * Outreach Scheduler — Registers repeatable BullMQ jobs for cold email
 *
 * 4 schedules:
 * 1. mailbox:sync       — every 6h
 * 2. campaign:send      — every 5min Mon-Fri 8-18
 * 3. campaign:check-replies — every 10min 24/7
 * 4. campaign:stats     — daily 1am
 */

import { Queue } from "bullmq";
import { getRedisConnection } from "./bullmq";

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

// Lazy-initialized queues
let _queues: Queue[] | null = null;

function getOutreachQueues(): Queue[] {
  if (_queues) return _queues;

  const conn = getRedisConnection();

  _queues = [
    new Queue("mailbox:sync", { connection: conn, defaultJobOptions }),
    new Queue("campaign:send", {
      connection: conn,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    }),
    new Queue("campaign:check-replies", { connection: conn, defaultJobOptions }),
    new Queue("campaign:stats", { connection: conn, defaultJobOptions }),
  ];

  return _queues;
}

export async function scheduleOutreachJobs(): Promise<void> {
  const [mailboxSync, campaignSend, checkReplies, stats] = getOutreachQueues();

  await mailboxSync.add("sync-mailboxes", {}, {
    repeat: { pattern: "0 */6 * * *" },
    priority: 2,
  });

  await campaignSend.add("process-campaign-sends", {}, {
    repeat: { pattern: "*/5 8-18 * * 1-5" },
    priority: 1,
  });

  await checkReplies.add("check-replies", {}, {
    repeat: { pattern: "*/10 * * * *" },
    priority: 2,
  });

  await stats.add("aggregate-stats", {}, {
    repeat: { pattern: "0 1 * * *" },
    priority: 3,
  });
}

export async function removeOutreachSchedules(): Promise<void> {
  for (const queue of getOutreachQueues()) {
    const jobs = await queue.getRepeatableJobs();
    for (const job of jobs) {
      await queue.removeRepeatableByKey(job.key);
    }
  }
}

export async function closeOutreachQueues(): Promise<void> {
  for (const queue of getOutreachQueues()) {
    await queue.close();
  }
  _queues = null;
}
