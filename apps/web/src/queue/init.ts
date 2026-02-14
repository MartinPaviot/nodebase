/**
 * Queue Initialization
 *
 * Starts all BullMQ workers when the app boots.
 * Ensures graceful shutdown on termination signals.
 */

import { workflowWorker } from "./workflow-worker";
import { insightsWorker, optimizationWorker, proposalsWorker } from "./langchain-workers";
import { initializeLangChainScheduler, removeLangChainScheduler } from "./langchain-scheduler";
import {
  scheduleOutreachJobs,
  removeOutreachSchedules,
  closeOutreachQueues,
} from "./outreach-scheduler";
import {
  scheduleCalendarTrigger,
  removeCalendarTrigger,
  calendarTriggerWorker,
} from "./calendar-trigger-worker";
import {
  scheduleScheduleTrigger,
  removeScheduleTrigger,
  scheduleTriggerWorker,
} from "./schedule-trigger-worker";

let isShuttingDown = false;

/**
 * Initialize all queue workers.
 * Call this once at app startup.
 */
export async function initializeQueues(): Promise<void> {
  console.log("[QueueInit] Starting BullMQ workers...");

  // Workers are already started when imported (including outreach workers)
  // Now schedule repeatable jobs
  try {
    await initializeLangChainScheduler();
  } catch (error) {
    console.error("[QueueInit] Failed to initialize LangChain scheduler:", error);
  }

  try {
    await scheduleOutreachJobs();
    console.log("[QueueInit] Outreach schedules registered");
  } catch (error) {
    console.error("[QueueInit] Failed to schedule outreach jobs:", error);
  }

  try {
    await scheduleCalendarTrigger();
    console.log("[QueueInit] Calendar trigger scheduled");
  } catch (error) {
    console.error("[QueueInit] Failed to schedule calendar trigger:", error);
  }

  try {
    await scheduleScheduleTrigger();
    console.log("[QueueInit] Schedule trigger scheduled");
  } catch (error) {
    console.error("[QueueInit] Failed to schedule schedule trigger:", error);
  }

  // Setup graceful shutdown
  setupGracefulShutdown();

  console.log("[QueueInit] All workers started successfully");
}

/**
 * Graceful shutdown handler.
 * Waits for jobs to complete before closing workers.
 */
function setupGracefulShutdown(): void {
  const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];

  for (const signal of signals) {
    process.on(signal, async () => {
      if (isShuttingDown) {
        console.log("[QueueInit] Already shutting down, forcing exit...");
        process.exit(1);
      }

      isShuttingDown = true;
      console.log(`[QueueInit] Received ${signal}, starting graceful shutdown...`);

      try {
        // Remove scheduled jobs
        await removeLangChainScheduler();
        await removeOutreachSchedules();
        await removeCalendarTrigger();
        await removeScheduleTrigger();

        // Close all workers gracefully (30s timeout from @nodebase/queue config)
        await Promise.all([
          workflowWorker.close(),
          insightsWorker.close(),
          optimizationWorker.close(),
          proposalsWorker.close(),
          calendarTriggerWorker.close(),
          scheduleTriggerWorker.close(),
        ]);

        // Close outreach queues (workers will stop receiving jobs)
        await closeOutreachQueues();

        console.log("[QueueInit] All workers closed successfully");
        process.exit(0);
      } catch (error) {
        console.error("[QueueInit] Error during shutdown:", error);
        process.exit(1);
      }
    });
  }
}
