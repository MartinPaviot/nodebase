/**
 * Connectors - Unified integration layer
 *
 * Central exports for all connector functionality
 */

// Base connector
export { BaseConnector } from "./base-connector";
export type {
  ConnectorTool,
  ToolExecutionResult,
  AuthenticationStatus,
} from "./base-connector";

// Composio connector
export {
  ComposioConnector,
  createComposioConnector,
  createComposioApp,
  COMPOSIO_APPS,
} from "./composio-connector";

// Registry
export {
  getConnector,
  hasConnector,
  listConnectors,
  listConnectorsByProvider,
  searchConnectors,
  registerConnector,
  getConnectorInfo,
  listConnectorInfos,
} from "./registry";
export type { ConnectorInfo } from "./registry";
