/**
 * Composio Client
 *
 * Wrapper for Composio SDK that handles:
 * - OAuth flows for 800+ APIs (free tier: 100 users)
 * - Tool calling native support for LLMs (Claude, OpenAI, etc.)
 * - Pre-built actions for mainstream tools
 * - Token management and refresh (automatic)
 */

import { Composio } from "composio-core";
import { ConnectorError } from "@nodebase/types";

// ============================================
// Types
// ============================================

export interface ComposioConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface ComposioApp {
  key: string;
  name: string;
  description: string;
  logo: string;
  categories: string[];
  auth_schemes: Array<{
    mode: "OAUTH2" | "OAUTH1" | "API_KEY" | "BASIC";
    name: string;
  }>;
}

export interface ComposioConnection {
  id: string;
  integrationId: string;
  connectionParams: Record<string, unknown>;
  appName: string;
  status: "ACTIVE" | "EXPIRED" | "INVALID";
  createdAt: string;
}

export interface ComposioToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ============================================
// Composio Client
// ============================================

export class ComposioClient {
  private client: Composio;
  private config: Required<ComposioConfig>;

  constructor(config: ComposioConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl ?? "https://backend.composio.dev",
    };
    this.client = new Composio({ apiKey: this.config.apiKey });
  }

  /**
   * Get all available apps.
   */
  async getApps(): Promise<ComposioApp[]> {
    try {
      const apps: any = await this.client.apps.list();
      return (apps.items || apps || []) as ComposioApp[];
    } catch (error) {
      throw new ConnectorError(
        "composio",
        "getApps",
        `Failed to fetch apps: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Search apps by name.
   */
  async searchApps(query: string): Promise<ComposioApp[]> {
    try {
      const allApps = await this.getApps();
      const lowerQuery = query.toLowerCase();
      return allApps.filter(
        (app) =>
          app.name.toLowerCase().includes(lowerQuery) ||
          app.key.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      throw new ConnectorError(
        "composio",
        "searchApps",
        `Failed to search apps: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get app details by key.
   */
  async getApp(appKey: string): Promise<ComposioApp | null> {
    try {
      const app: any = await this.client.apps.get({ appKey });
      return (app || null) as ComposioApp | null;
    } catch {
      return null;
    }
  }

  /**
   * Initiate connection flow for a user.
   * Returns the OAuth URL to redirect the user to.
   */
  async initiateConnection(options: {
    userId: string;
    appName: string;
    redirectUrl?: string;
    labels?: string[];
  }): Promise<{
    redirectUrl: string;
    connectionId: string;
  }> {
    try {
      const connection: any = await this.client.connectedAccounts.initiate({
        integrationId: options.appName,
        entityId: options.userId,
        redirectUri: options.redirectUrl,
        labels: options.labels,
      });

      return {
        redirectUrl: connection.redirectUrl || connection.redirectUri || "",
        connectionId: connection.connectionId || connection.id || "",
      };
    } catch (error) {
      throw new ConnectorError(
        "composio",
        "initiateConnection",
        `Failed to initiate connection: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get all connected accounts for a user (entity).
   */
  async getConnections(userId: string): Promise<ComposioConnection[]> {
    try {
      const connections: any = await this.client.connectedAccounts.list({
        entityId: userId,
      });
      return ((connections.items || connections || []) as any[]).map((conn: any) => ({
        id: conn.id || "",
        integrationId: conn.integrationId || "",
        connectionParams: conn.connectionParams || {},
        appName: conn.appName || "",
        status: conn.status || "ACTIVE",
        createdAt: conn.createdAt || new Date().toISOString(),
      }));
    } catch (error) {
      throw new ConnectorError(
        "composio",
        "getConnections",
        `Failed to fetch connections: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get a specific connection by ID.
   */
  async getConnection(
    connectionId: string
  ): Promise<ComposioConnection | null> {
    try {
      const connection: any = await this.client.connectedAccounts.get({
        connectedAccountId: connectionId,
      });
      if (!connection) return null;
      return {
        id: connection.id || "",
        integrationId: connection.integrationId || "",
        connectionParams: connection.connectionParams || {},
        appName: connection.appName || "",
        status: connection.status || "ACTIVE",
        createdAt: connection.createdAt || new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Delete a connection.
   */
  async deleteConnection(connectionId: string): Promise<void> {
    try {
      await this.client.connectedAccounts.delete({
        connectedAccountId: connectionId,
      });
    } catch (error) {
      throw new ConnectorError(
        "composio",
        "deleteConnection",
        `Failed to delete connection: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get tools (actions) available for the user, formatted for LLM tool calling.
   * Composio natively supports Claude, OpenAI, LangChain, CrewAI, etc.
   *
   * @param userId - The user entity ID
   * @param options - Filter by apps or specific actions
   * @returns Array of tool definitions compatible with Claude/OpenAI tool calling
   */
  async getTools(
    userId: string,
    options?: {
      apps?: string[];
      actions?: string[];
      useCase?: string;
    }
  ): Promise<ComposioToolDefinition[]> {
    try {
      // Composio SDK v0.5.39 may have different API for tools
      // Using type assertion to handle API changes
      const toolsApi = (this.client as any).actions || (this.client as any).tools;
      if (!toolsApi) {
        throw new Error("Tools API not available in this version of Composio SDK");
      }

      const tools: any = await toolsApi.list({
        apps: options?.apps?.join(","),
      });

      return ((tools.items || tools || []) as any[]).map((tool: any) => ({
        name: tool.name || "",
        description: tool.description || "",
        input_schema: {
          type: "object" as const,
          properties: tool.parameters || tool.input_schema?.properties || {},
          required: tool.required || tool.input_schema?.required || [],
        },
      }));
    } catch (error) {
      throw new ConnectorError(
        "composio",
        "getTools",
        `Failed to fetch tools: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Execute a tool (action) on behalf of a user.
   * Composio handles the OAuth token, API call, rate limiting, retries, etc.
   *
   * @param userId - The user entity ID
   * @param toolCall - The tool call from the LLM (name + input)
   * @returns The result of the action
   */
  async executeAction<T = unknown>(
    userId: string,
    toolCall: {
      name: string;
      input: Record<string, unknown>;
    }
  ): Promise<T> {
    try {
      // Composio SDK v0.5.39 may have different API for execution
      const actionsApi = (this.client as any).actions || (this.client as any).tools;
      if (!actionsApi?.execute) {
        throw new Error("Execute API not available in this version of Composio SDK");
      }

      const result: any = await actionsApi.execute({
        entityId: userId,
        actionName: toolCall.name,
        input: toolCall.input,
      });

      return result as T;
    } catch (error) {
      throw new ConnectorError(
        "composio",
        "executeAction",
        `Failed to execute action ${toolCall.name}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get available actions for an app.
   * Useful for discovering what actions are available.
   */
  async getActionsForApp(appKey: string): Promise<
    Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }>
  > {
    try {
      const actions = await this.client.actions.list({
        apps: appKey,
      });

      return (
        actions.items?.map((action) => ({
          name: action.name || "",
          description: action.description || "",
          parameters: action.parameters || {},
        })) || []
      );
    } catch (error) {
      throw new ConnectorError(
        "composio",
        "getActionsForApp",
        `Failed to fetch actions for ${appKey}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get the raw Composio client for advanced usage.
   */
  getRawClient(): Composio {
    return this.client;
  }
}

// ============================================
// Singleton Instance
// ============================================

let _composioClient: ComposioClient | null = null;

export function initComposio(config: ComposioConfig): ComposioClient {
  _composioClient = new ComposioClient(config);
  return _composioClient;
}

export function getComposio(): ComposioClient {
  if (!_composioClient) {
    throw new ConnectorError(
      "composio",
      "init",
      "Composio client not initialized. Call initComposio() first."
    );
  }
  return _composioClient;
}
