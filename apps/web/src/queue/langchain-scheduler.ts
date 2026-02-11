/**
 * LangChain Job Scheduler
 *
 * Schedules repeatable jobs for LangChain workers:
 * - Daily insights: 3 AM every day
 * - Weekly optimization: 4 AM every Monday
 * - Weekly proposals: 4 AM every Tuesday
 */

import { Queue } from "bullmq";

const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
};

// Create queues
const insightsQueue = new Queue("langchain:insights", { connection: redisConnection });
const optimizationQueue = new Queue("langchain:optimization", { connection: redisConnection });
const proposalsQueue = new Queue("langchain:proposals", { connection: redisConnection });

/**
 * Initialize all scheduled jobs
 */
export async function initializeLangChainScheduler() {
  console.log("[LangChain Scheduler] Initializing...");

  try {
    // Daily insights generation (3 AM every day)
    await insightsQueue.add(
      "daily-insights",
      {},
      {
        repeat: {
          pattern: "0 3 * * *", // Cron: 3 AM daily
        },
        jobId: "langchain:daily-insights",
      }
    );
    console.log("[LangChain Scheduler] ✓ Daily insights scheduled (3 AM)");

    // Weekly optimization (4 AM every Monday)
    await optimizationQueue.add(
      "weekly-optimization",
      {},
      {
        repeat: {
          pattern: "0 4 * * 1", // Cron: 4 AM Monday
        },
        jobId: "langchain:weekly-optimization",
      }
    );
    console.log("[LangChain Scheduler] ✓ Weekly optimization scheduled (4 AM Monday)");

    // Weekly proposals (4 AM every Tuesday)
    await proposalsQueue.add(
      "weekly-proposals",
      {},
      {
        repeat: {
          pattern: "0 4 * * 2", // Cron: 4 AM Tuesday
        },
        jobId: "langchain:weekly-proposals",
      }
    );
    console.log("[LangChain Scheduler] ✓ Weekly proposals scheduled (4 AM Tuesday)");

    console.log("[LangChain Scheduler] All jobs scheduled successfully");
  } catch (error) {
    console.error("[LangChain Scheduler] Error scheduling jobs:", error);
    throw error;
  }
}

/**
 * Remove all scheduled jobs (cleanup)
 */
export async function removeLangChainScheduler() {
  console.log("[LangChain Scheduler] Removing scheduled jobs...");

  try {
    await insightsQueue.removeRepeatable("daily-insights", { pattern: "0 3 * * *" });
    await optimizationQueue.removeRepeatable("weekly-optimization", { pattern: "0 4 * * 1" });
    await proposalsQueue.removeRepeatable("weekly-proposals", { pattern: "0 4 * * 2" });

    console.log("[LangChain Scheduler] All scheduled jobs removed");
  } catch (error) {
    console.error("[LangChain Scheduler] Error removing jobs:", error);
  }
}

/**
 * Trigger a job manually (for testing)
 */
export async function triggerLangChainJob(jobName: "insights" | "optimization" | "proposals") {
  console.log(`[LangChain Scheduler] Manually triggering ${jobName}...`);

  try {
    switch (jobName) {
      case "insights":
        await insightsQueue.add("manual-insights", {});
        break;
      case "optimization":
        await optimizationQueue.add("manual-optimization", {});
        break;
      case "proposals":
        await proposalsQueue.add("manual-proposals", {});
        break;
    }

    console.log(`[LangChain Scheduler] ✓ ${jobName} job triggered`);
  } catch (error) {
    console.error(`[LangChain Scheduler] Error triggering ${jobName}:`, error);
    throw error;
  }
}

// Export queues for monitoring
export { insightsQueue, optimizationQueue, proposalsQueue };
