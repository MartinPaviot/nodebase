/**
 * Elevay Core Initialization
 *
 * Singleton instance of the Elevay core system.
 * Provides access to ScanEngine and AgentEngine with proper dependency injection.
 */

import { initElevayCore, getDefaultAgentHooks } from "@elevay/core";
import type { ScanEngine, AgentEngine } from "@elevay/core";

// ============================================
// Types
// ============================================

interface ElevayInstance {
  scanEngine: ScanEngine;
  agentEngine: AgentEngine;
  initialized: boolean;
}

// ============================================
// Singleton Instance
// ============================================

let instance: ElevayInstance | null = null;
let initPromise: Promise<ElevayInstance> | null = null;

/**
 * Get or initialize the Elevay core system.
 * Uses environment variables for API keys.
 */
export async function getElevayCore(): Promise<ElevayInstance> {
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
      console.log("[Elevay] Initializing core system...");

      const { scanEngine, agentEngine, dependencies } =
        await initElevayCore({
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

      console.log("[Elevay] Core initialized:");
      console.log(`  - Composio: ${hasComposio ? "✓" : "✗ (using mocks)"}`);
      console.log(`  - AI Client: ${hasAI ? "✓" : "✗ (using mocks)"}`);

      if (!hasComposio) {
        console.warn(
          "[Elevay] ⚠ COMPOSIO_API_KEY not set. Scan engine will use mock data."
        );
      }
      if (!hasAI) {
        console.warn(
          "[Elevay] ⚠ ANTHROPIC_API_KEY not set. Agent engine will use mock responses."
        );
      }

      instance = {
        scanEngine,
        agentEngine,
        initialized: true,
      };

      return instance;
    } catch (error) {
      console.error("[Elevay] Failed to initialize:", error);
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
  const core = await getElevayCore();
  return core.scanEngine;
}

/**
 * Get the AgentEngine instance.
 */
export async function getAgentEngine(): Promise<AgentEngine> {
  const core = await getElevayCore();
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
export function resetElevayCore(): void {
  instance = null;
  initPromise = null;
}
