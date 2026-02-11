/**
 * Queue Initialization
 *
 * Starts all BullMQ workers when the app boots.
 * Ensures graceful shutdown on termination signals.
 */

import { workflowWorker } from "./workflow-worker";
import { insightsWorker, optimizationWorker, proposalsWorker } from "./langchain-workers";
import { initializeLangChainScheduler, removeLangChainScheduler } from "./langchain-scheduler";

let isShuttingDown = false;

/**
 * Initialize all queue workers.
 * Call this once at app startup.
 */
export async function initializeQueues(): Promise<void> {
  console.log("[QueueInit] Starting BullMQ workers...");

  // Workers are already started when imported
  // Now schedule LangChain repeatable jobs
  try {
    await initializeLangChainScheduler();
  } catch (error) {
    console.error("[QueueInit] Failed to initialize LangChain scheduler:", error);
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

        // Close all workers gracefully (30s timeout from @nodebase/queue config)
        await Promise.all([
          workflowWorker.close(),
          insightsWorker.close(),
          optimizationWorker.close(),
          proposalsWorker.close(),
        ]);

        console.log("[QueueInit] All workers closed successfully");
        process.exit(0);
      } catch (error) {
        console.error("[QueueInit] Error during shutdown:", error);
        process.exit(1);
      }
    });
  }
}
