/**
 * Factory Functions
 *
 * Initialize engines with proper dependency injection.
 * This wires together all the packages:
 * - @elevay/connectors (Composio, ConnectorRegistry)
 * - @elevay/ai (AIClient)
 * - @elevay/core (ScanEngine, AgentEngine)
 */

import { ScanEngine, type ScanEngineConfig } from "./scan-engine";
import { AgentEngine } from "./agent-engine";

// ============================================
// Types for Dependencies
// ============================================

export interface CoreDependencies {
  composioClient?: any; // ComposioClient from @elevay/connectors
  connectorRegistry?: any; // ConnectorRegistry from @elevay/connectors
  aiClient?: any; // AIClient from @elevay/ai
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a ScanEngine with dependencies injected.
 *
 * @example
 * ```typescript
 * import { initComposio, getConnectorRegistry } from "@elevay/connectors";
 * import { createScanEngine } from "@elevay/core";
 *
 * const composio = initComposio({ apiKey: process.env.COMPOSIO_API_KEY });
 * const registry = getConnectorRegistry();
 *
 * const scanEngine = createScanEngine({
 *   composioClient: composio,
 *   connectorRegistry: registry
 * });
 * ```
 */
export function createScanEngine(
  dependencies: CoreDependencies,
  config?: ScanEngineConfig
): ScanEngine {
  return new ScanEngine(config, {
    composioClient: dependencies.composioClient,
    connectorRegistry: dependencies.connectorRegistry,
  });
}

/**
 * Create an AgentEngine with dependencies injected.
 *
 * @example
 * ```typescript
 * import { initComposio, getConnectorRegistry } from "@elevay/connectors";
 * import { AIClient } from "@elevay/ai";
 * import { createAgentEngine } from "@elevay/core";
 *
 * const composio = initComposio({ apiKey: process.env.COMPOSIO_API_KEY });
 * const registry = getConnectorRegistry();
 * const aiClient = new AIClient({ apiKey: process.env.ANTHROPIC_API_KEY });
 *
 * const agentEngine = createAgentEngine({
 *   composioClient: composio,
 *   connectorRegistry: registry,
 *   aiClient: aiClient
 * });
 * ```
 */
export function createAgentEngine(dependencies: CoreDependencies): AgentEngine {
  return new AgentEngine({
    composioClient: dependencies.composioClient,
    connectorRegistry: dependencies.connectorRegistry,
    aiClient: dependencies.aiClient,
  });
}

/**
 * Initialize the entire Elevay core system.
 * This is a convenience function that sets up everything with proper dependencies.
 *
 * @example
 * ```typescript
 * import { initElevayCore } from "@elevay/core";
 *
 * const { scanEngine, agentEngine } = await initElevayCore({
 *   composioApiKey: process.env.COMPOSIO_API_KEY,
 *   anthropicApiKey: process.env.ANTHROPIC_API_KEY
 * });
 * ```
 */
export async function initElevayCore(config: {
  composioApiKey?: string;
  anthropicApiKey?: string;
  scanEngineConfig?: ScanEngineConfig;
}): Promise<{
  scanEngine: ScanEngine;
  agentEngine: AgentEngine;
  dependencies: CoreDependencies;
}> {
  const dependencies: CoreDependencies = {};

  // Initialize Composio if API key provided
  if (config.composioApiKey) {
    try {
      // Dynamically import to avoid circular dependencies
      const { initComposio, initConnectorRegistry } = await import(
        "@elevay/connectors"
      );

      dependencies.composioClient = initComposio({
        apiKey: config.composioApiKey,
      });
      dependencies.connectorRegistry = initConnectorRegistry();

      console.log("✓ Composio initialized");
    } catch (error) {
      console.warn(
        "⚠ Failed to initialize Composio:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Initialize AIClient if API key provided
  if (config.anthropicApiKey) {
    try {
      // Dynamically import to avoid circular dependencies
      const { AIClient } = await import("@elevay/ai");

      dependencies.aiClient = new AIClient({
        apiKey: config.anthropicApiKey,
      });

      console.log("✓ AIClient initialized");
    } catch (error) {
      console.warn(
        "⚠ Failed to initialize AIClient:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  // Create engines with injected dependencies
  const scanEngine = createScanEngine(dependencies, config.scanEngineConfig);
  const agentEngine = createAgentEngine(dependencies);

  return {
    scanEngine,
    agentEngine,
    dependencies,
  };
}

/**
 * Get default lifecycle hooks for the AgentEngine.
 * These hooks provide logging, cost tracking, and error handling out of the box.
 */
export function getDefaultAgentHooks() {
  return {
    /**
     * Logging hook - logs when an agent starts execution.
     */
    loggingHook: async (context: any) => {
      console.log(
        `[Agent ${context.agentId}] Starting execution for user ${context.userId}`
      );
    },

    /**
     * Cost tracking hook - logs the cost and token usage after execution.
     */
    costTrackingHook: async (context: any, result: any) => {
      console.log(
        `[Agent ${context.agentId}] Execution completed:`,
        `\n  Model: ${result.llmUsage.model}`,
        `\n  Tokens: ${result.llmUsage.tokensIn} in / ${result.llmUsage.tokensOut} out`,
        `\n  Cost: $${result.llmUsage.cost.toFixed(4)}`,
        `\n  Latency: ${result.llmUsage.latencyMs}ms`,
        `\n  Status: ${result.status}`
      );
    },

    /**
     * Error logging hook - logs errors that occur during execution.
     */
    errorLoggingHook: async (context: any, error: Error) => {
      console.error(
        `[Agent ${context.agentId}] Execution failed:`,
        error.message
      );
    },
  };
}
