/**
 * Connector Registry
 *
 * Central registry for all available connectors.
 */

import { type ConnectorCategory, type ConnectorConfig } from "@elevay/types";
import { BaseConnector } from "./base";

// ============================================
// Registry Class
// ============================================

export class ConnectorRegistry {
  private connectors: Map<string, BaseConnector> = new Map();

  /**
   * Register a connector.
   */
  register(connector: BaseConnector): void {
    if (this.connectors.has(connector.id)) {
      console.warn(`Connector ${connector.id} is already registered, overwriting...`);
    }
    this.connectors.set(connector.id, connector);
  }

  /**
   * Get a connector by ID.
   */
  get(connectorId: string): BaseConnector | undefined {
    return this.connectors.get(connectorId);
  }

  /**
   * Get all connectors.
   */
  getAll(): BaseConnector[] {
    return Array.from(this.connectors.values());
  }

  /**
   * Get connectors by category.
   */
  getByCategory(category: ConnectorCategory): BaseConnector[] {
    return this.getAll().filter((c) => c.category === category);
  }

  /**
   * Get all connector configs for display.
   */
  getAllConfigs(): ConnectorConfig[] {
    return this.getAll().map((c) => c.toConfig());
  }

  /**
   * Search connectors by name.
   */
  search(query: string): BaseConnector[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(
      (c) =>
        c.name.toLowerCase().includes(lowerQuery) ||
        c.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Check if a connector is registered.
   */
  has(connectorId: string): boolean {
    return this.connectors.has(connectorId);
  }

  /**
   * Get connector count.
   */
  count(): number {
    return this.connectors.size;
  }
}

// ============================================
// Singleton Instance
// ============================================

let _registry: ConnectorRegistry | null = null;

export function getConnectorRegistry(): ConnectorRegistry {
  if (!_registry) {
    _registry = new ConnectorRegistry();
  }
  return _registry;
}

/**
 * Initialize the registry with default connectors.
 */
export function initConnectorRegistry(): ConnectorRegistry {
  const registry = getConnectorRegistry();

  // Lazy import to avoid circular dependencies
  import("./connectors/gmail").then(({ GmailConnector }) => {
    registry.register(new GmailConnector());
  });
  import("./connectors/hubspot").then(({ HubSpotConnector }) => {
    registry.register(new HubSpotConnector());
  });
  import("./connectors/slack").then(({ SlackConnector }) => {
    registry.register(new SlackConnector());
  });
  import("./connectors/calendar").then(({ CalendarConnector }) => {
    registry.register(new CalendarConnector());
  });

  return registry;
}
