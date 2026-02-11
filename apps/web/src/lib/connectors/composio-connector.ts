// @ts-nocheck
// TODO: Update to match current Composio SDK API
/**
 * ComposioConnector - Wrapper for Composio SDK
 *
 * Benefits:
 * - 800+ apps with OAuth managed
 * - Automatic token refresh
 * - Rate limiting & retries
 * - No custom OAuth code needed
 *
 * Supported apps:
 * - Gmail, Slack, Notion, GitHub, Linear, Asana, Trello
 * - HubSpot, Salesforce, Pipedrive (CRM)
 * - Zendesk, Freshdesk, Intercom (Support)
 * - And 790+ more...
 */

import { Composio } from "composio-core";
import {
  BaseConnector,
  type ConnectorTool,
  type ToolExecutionResult,
  type AuthenticationStatus,
} from "./base-connector";
import { ConnectorError } from "../errors";
import { config } from "../config";

// ============================================
// COMPOSIO CONNECTOR
// ============================================

export class ComposioConnector extends BaseConnector {
  private client: Composio;

  constructor(appName: string, appKey: string) {
    super(
      `composio_${appKey.toLowerCase()}`,
      appName,
      "composio"
    );

    this.client = new Composio({
      apiKey: config.composio.apiKey,
    });
  }

  // ============================================
  // AUTHENTICATION METHODS
  // ============================================

  async getAuthUrl(userId: string, redirectUrl: string): Promise<string> {
    try {
      const entity = await this.client.getEntity(userId);
      const connection = await entity.initiateConnection({
        appName: this.name,
        redirectUri: redirectUrl,
      });

      return connection.redirectUrl;
    } catch (error) {
      throw new ConnectorError(
        this.id,
        "authenticate",
        `Failed to get auth URL: ${error instanceof Error ? error.message : String(error)}`,
        false
      );
    }
  }

  async handleCallback(
    userId: string,
    code: string,
    _state?: string
  ): Promise<void> {
    try {
      const entity = await this.client.getEntity(userId);
      await entity.completeConnection({
        appName: this.name,
        code,
      });
    } catch (error) {
      throw new ConnectorError(
        this.id,
        "authenticate",
        `Failed to complete OAuth: ${error instanceof Error ? error.message : String(error)}`,
        false
      );
    }
  }

  async isAuthenticated(userId: string): Promise<boolean> {
    try {
      const entity = await this.client.getEntity(userId);
      const connections = await entity.getConnections({
        appNames: [this.name],
      });

      return connections.length > 0 && connections[0].status === "ACTIVE";
    } catch (error) {
      // If error fetching connections, assume not authenticated
      return false;
    }
  }

  async getAuthStatus(userId: string): Promise<AuthenticationStatus> {
    try {
      const entity = await this.client.getEntity(userId);
      const connections = await entity.getConnections({
        appNames: [this.name],
      });

      if (connections.length === 0) {
        return {
          isAuthenticated: false,
          userId,
        };
      }

      const connection = connections[0];

      return {
        isAuthenticated: connection.status === "ACTIVE",
        userId,
        connectedAt: connection.createdAt ? new Date(connection.createdAt) : undefined,
      };
    } catch (error) {
      return {
        isAuthenticated: false,
        userId,
      };
    }
  }

  async disconnect(userId: string): Promise<void> {
    try {
      const entity = await this.client.getEntity(userId);
      const connections = await entity.getConnections({
        appNames: [this.name],
      });

      for (const connection of connections) {
        await connection.delete();
      }
    } catch (error) {
      throw new ConnectorError(
        this.id,
        "disconnect",
        `Failed to disconnect: ${error instanceof Error ? error.message : String(error)}`,
        false
      );
    }
  }

  // ============================================
  // TOOL METHODS
  // ============================================

  async listAvailableTools(): Promise<ConnectorTool[]> {
    try {
      const actions = await this.client.actions.list({
        apps: [this.name],
      });

      return actions.items.map((action) => ({
        name: action.name,
        description: action.description || `Execute ${action.name}`,
        inputSchema: {
          type: "object" as const,
          properties: action.parameters?.properties || {},
          required: action.parameters?.required || [],
        },
      }));
    } catch (error) {
      throw new ConnectorError(
        this.id,
        "list_tools",
        `Failed to list tools: ${error instanceof Error ? error.message : String(error)}`,
        true
      );
    }
  }

  async executeTool(
    toolName: string,
    input: Record<string, unknown>,
    userId: string
  ): Promise<ToolExecutionResult> {
    // Assert authenticated
    await this.assertAuthenticated(userId);

    try {
      const entity = await this.client.getEntity(userId);

      // Execute action via Composio
      const result = await entity.execute({
        actionName: toolName,
        params: input,
        appName: this.name,
      });

      // Composio returns { data, error, successful }
      if (result.successful === false) {
        return {
          success: false,
          error: result.error || "Unknown error",
        };
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      // Handle specific Composio errors
      if (error instanceof Error) {
        // Rate limiting
        if (error.message.includes("rate limit")) {
          throw ConnectorError.rateLimited(this.id, toolName);
        }

        // Timeout
        if (error.message.includes("timeout")) {
          throw ConnectorError.timeout(this.id, toolName, 30000);
        }
      }

      throw new ConnectorError(
        this.id,
        toolName,
        `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
        true // Most errors are retryable
      );
    }
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

/**
 * Create Composio connector for specific app
 */
export function createComposioConnector(
  appName: string,
  appKey: string
): ComposioConnector {
  return new ComposioConnector(appName, appKey);
}

// ============================================
// COMMON COMPOSIO CONNECTORS
// ============================================

export const COMPOSIO_APPS = {
  // Email & Calendar
  gmail: { name: "Gmail", key: "GMAIL" },
  outlook: { name: "Outlook", key: "OUTLOOK" },
  googleCalendar: { name: "Google Calendar", key: "GOOGLECALENDAR" },

  // Communication
  slack: { name: "Slack", key: "SLACK" },
  discord: { name: "Discord", key: "DISCORD" },
  teams: { name: "Microsoft Teams", key: "MSTEAMS" },

  // Project Management
  notion: { name: "Notion", key: "NOTION" },
  asana: { name: "Asana", key: "ASANA" },
  trello: { name: "Trello", key: "TRELLO" },
  linear: { name: "Linear", key: "LINEAR" },

  // Dev Tools
  github: { name: "GitHub", key: "GITHUB" },
  gitlab: { name: "GitLab", key: "GITLAB" },
  jira: { name: "Jira", key: "JIRA" },

  // CRM
  hubspot: { name: "HubSpot", key: "HUBSPOT" },
  salesforce: { name: "Salesforce", key: "SALESFORCE" },
  pipedrive: { name: "Pipedrive", key: "PIPEDRIVE" },

  // Support
  zendesk: { name: "Zendesk", key: "ZENDESK" },
  freshdesk: { name: "Freshdesk", key: "FRESHDESK" },
  intercom: { name: "Intercom", key: "INTERCOM" },

  // Storage
  googleDrive: { name: "Google Drive", key: "GOOGLEDRIVE" },
  dropbox: { name: "Dropbox", key: "DROPBOX" },
  onedrive: { name: "OneDrive", key: "ONEDRIVE" },
} as const;

/**
 * Create connector by app key
 */
export function createComposioApp(appKey: keyof typeof COMPOSIO_APPS): ComposioConnector {
  const app = COMPOSIO_APPS[appKey];
  return createComposioConnector(app.name, app.key);
}
