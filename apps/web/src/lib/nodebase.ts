/**
 * Nodebase Core Initialization
 *
 * Singleton instance of the Nodebase core system.
 * Provides access to ScanEngine and AgentEngine with proper dependency injection.
 */

import { initNodebaseCore, getDefaultAgentHooks } from "@nodebase/core";
import type { ScanEngine, AgentEngine } from "@nodebase/core";

// ============================================
// Types
// ============================================

interface NodebaseInstance {
  scanEngine: ScanEngine;
  agentEngine: AgentEngine;
  initialized: boolean;
}

// ============================================
// Singleton Instance
// ============================================

let instance: NodebaseInstance | null = null;
let initPromise: Promise<NodebaseInstance> | null = null;

/**
 * Get or initialize the Nodebase core system.
 * Uses environment variables for API keys.
 */
export async function getNodebaseCore(): Promise<NodebaseInstance> {
  // Return existing instance if available
  if (instance) {
    return instance;
  }

  // Return in-progress initialization
  if (initPromise) {
    return initPromise;
  }

  // Initialize
  initPromise = (async () => {
    try {
      console.log("[Nodebase] Initializing core system...");

      const { scanEngine, agentEngine, dependencies } =
        await initNodebaseCore({
          composioApiKey: process.env.COMPOSIO_API_KEY,
          anthropicApiKey: process.env.ANTHROPIC_API_KEY,
          scanEngineConfig: {
            maxConcurrentScans: 5,
            timeoutMs: 30000,
            retryAttempts: 2,
          },
        });

      // Register default lifecycle hooks
      const hooks = getDefaultAgentHooks();
      agentEngine.onBefore(hooks.loggingHook);
      agentEngine.onAfter(hooks.costTrackingHook);
      agentEngine.onError(hooks.errorLoggingHook);

      // Log initialization status
      const hasComposio = !!dependencies.composioClient;
      const hasAI = !!dependencies.aiClient;

      console.log("[Nodebase] Core initialized:");
      console.log(`  - Composio: ${hasComposio ? "✓" : "✗ (using mocks)"}`);
      console.log(`  - AI Client: ${hasAI ? "✓" : "✗ (using mocks)"}`);

      if (!hasComposio) {
        console.warn(
          "[Nodebase] ⚠ COMPOSIO_API_KEY not set. Scan engine will use mock data."
        );
      }
      if (!hasAI) {
        console.warn(
          "[Nodebase] ⚠ ANTHROPIC_API_KEY not set. Agent engine will use mock responses."
        );
      }

      instance = {
        scanEngine,
        agentEngine,
        initialized: true,
      };

      return instance;
    } catch (error) {
      console.error("[Nodebase] Failed to initialize:", error);
      initPromise = null; // Allow retry
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Get the ScanEngine instance.
 */
export async function getScanEngine(): Promise<ScanEngine> {
  const core = await getNodebaseCore();
  return core.scanEngine;
}

/**
 * Get the AgentEngine instance.
 */
export async function getAgentEngine(): Promise<AgentEngine> {
  const core = await getNodebaseCore();
  return core.agentEngine;
}

/**
 * Check if the core system is initialized.
 */
export function isInitialized(): boolean {
  return instance?.initialized ?? false;
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetNodebaseCore(): void {
  instance = null;
  initPromise = null;
}
