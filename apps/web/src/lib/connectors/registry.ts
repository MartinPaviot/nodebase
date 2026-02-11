/**
 * Connector Registry
 *
 * Central registry for all connectors
 * Factory pattern to get connectors by ID
 *
 * Usage:
 * ```typescript
 * import { getConnector, listConnectors } from "@/lib/connectors/registry";
 *
 * // Get specific connector
 * const gmail = getConnector("gmail");
 * await gmail.executeTool("send_email", { ... }, userId);
 *
 * // List all available connectors
 * const all = listConnectors();
 * console.log(all.map(c => c.name));
 * ```
 */

import { BaseConnector } from "./base-connector";
import { createComposioApp, COMPOSIO_APPS } from "./composio-connector";
import { NotFoundError } from "../errors";

// ============================================
// REGISTRY
// ============================================

class ConnectorRegistry {
  private connectors: Map<string, BaseConnector> = new Map();

  constructor() {
    this.registerComposioApps();
  }

  /**
   * Register all Composio apps
   */
  private registerComposioApps(): void {
    for (const [key, app] of Object.entries(COMPOSIO_APPS)) {
      const connector = createComposioApp(key as keyof typeof COMPOSIO_APPS);
      this.connectors.set(key, connector);
      // Also register by app key (e.g., "GMAIL")
      this.connectors.set(app.key.toLowerCase(), connector);
    }
  }

  /**
   * Register custom connector
   */
  register(connector: BaseConnector): void {
    this.connectors.set(connector.id, connector);
  }

  /**
   * Get connector by ID
   * Throws if not found
   */
  get(id: string): BaseConnector {
    const connector = this.connectors.get(id.toLowerCase());
    if (!connector) {
      throw new NotFoundError("Connector", id);
    }
    return connector;
  }

  /**
   * Check if connector exists
   */
  has(id: string): boolean {
    return this.connectors.has(id.toLowerCase());
  }

  /**
   * List all registered connectors
   */
  list(): BaseConnector[] {
    return Array.from(this.connectors.values());
  }

  /**
   * List connectors by provider
   */
  listByProvider(provider: "composio" | "pipedream" | "custom"): BaseConnector[] {
    return this.list().filter((c) => c.provider === provider);
  }

  /**
   * Search connectors by name
   */
  search(query: string): BaseConnector[] {
    const lowerQuery = query.toLowerCase();
    return this.list().filter(
      (c) =>
        c.name.toLowerCase().includes(lowerQuery) ||
        c.id.toLowerCase().includes(lowerQuery)
    );
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

const registry = new ConnectorRegistry();

// ============================================
// EXPORTED FUNCTIONS
// ============================================

/**
 * Get connector by ID
 */
export function getConnector(id: string): BaseConnector {
  return registry.get(id);
}

/**
 * Check if connector exists
 */
export function hasConnector(id: string): boolean {
  return registry.has(id);
}

/**
 * List all connectors
 */
export function listConnectors(): BaseConnector[] {
  return registry.list();
}

/**
 * List connectors by provider
 */
export function listConnectorsByProvider(
  provider: "composio" | "pipedream" | "custom"
): BaseConnector[] {
  return registry.listByProvider(provider);
}

/**
 * Search connectors
 */
export function searchConnectors(query: string): BaseConnector[] {
  return registry.search(query);
}

/**
 * Register custom connector
 */
export function registerConnector(connector: BaseConnector): void {
  registry.register(connector);
}

// ============================================
// HELPERS
// ============================================

/**
 * Get connector info (metadata only)
 */
export interface ConnectorInfo {
  id: string;
  name: string;
  provider: string;
}

export function getConnectorInfo(id: string): ConnectorInfo {
  const connector = getConnector(id);
  return {
    id: connector.id,
    name: connector.name,
    provider: connector.provider,
  };
}

/**
 * List all connector infos
 */
export function listConnectorInfos(): ConnectorInfo[] {
  return listConnectors().map((c) => ({
    id: c.id,
    name: c.name,
    provider: c.provider,
  }));
}
