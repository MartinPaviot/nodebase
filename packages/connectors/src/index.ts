/**
 * @elevay/connectors
 *
 * BaseConnector interface + Composio wrapper for 800+ APIs (free tier).
 * All integrations go through this layer.
 *
 * Architecture:
 * - Layer 1: Composio (mainstream international tools) - Free tier, agent-native
 * - Layer 2: Chift (French financial/accounting tools) - To be added
 * - Layer 3: Custom + Nango (niche French tools) - To be added
 */

export { BaseConnector, type ConnectorContext, type ActionResult } from "./base";
export { ComposioClient, type ComposioConfig, initComposio, getComposio } from "./composio";
export { PipedreamClient, type PipedreamConfig } from "./pipedream"; // Legacy, to be removed
export { ConnectorRegistry, getConnectorRegistry, initConnectorRegistry } from "./registry";

// Connector implementations
export { HubSpotConnector } from "./connectors/hubspot";
export { GmailConnector } from "./connectors/gmail";
export { SlackConnector } from "./connectors/slack";
export { CalendarConnector } from "./connectors/calendar";
