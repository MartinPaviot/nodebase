import {
  GmailConnector
} from "./chunk-Y47G26IU.mjs";
import {
  HubSpotConnector
} from "./chunk-XHKSXX34.mjs";
import {
  SlackConnector
} from "./chunk-WZ5AQKJD.mjs";
import {
  CalendarConnector
} from "./chunk-Q2GTCJNZ.mjs";
import {
  BaseConnector
} from "./chunk-QE6XZSXR.mjs";

// src/composio.ts
import { Composio, ComposioToolSet } from "composio-core";
import { ConnectorError } from "@elevay/types";
var ComposioClient = class {
  client;
  toolSet;
  entityId;
  config;
  constructor(config) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl ?? "https://backend.composio.dev",
      entityId: config.entityId ?? "default"
    };
    this.entityId = this.config.entityId;
    this.client = new Composio({ apiKey: this.config.apiKey });
    this.toolSet = new ComposioToolSet({ apiKey: this.config.apiKey });
  }
  /**
   * Get all available apps.
   */
  async getApps() {
    try {
      const apps = await this.client.apps.list();
      return apps.items || apps || [];
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
  async searchApps(query) {
    try {
      const allApps = await this.getApps();
      const lowerQuery = query.toLowerCase();
      return allApps.filter(
        (app) => app.name.toLowerCase().includes(lowerQuery) || app.key.toLowerCase().includes(lowerQuery)
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
  async getApp(appKey) {
    try {
      const app = await this.client.apps.get({ appKey });
      return app || null;
    } catch {
      return null;
    }
  }
  /**
   * Initiate connection flow for a user.
   * Returns the OAuth URL to redirect the user to.
   */
  async initiateConnection(options) {
    try {
      const connection = await this.client.connectedAccounts.initiate({
        integrationId: options.appName,
        entityId: options.userId,
        redirectUri: options.redirectUrl,
        labels: options.labels
      });
      return {
        redirectUrl: connection.redirectUrl || connection.redirectUri || "",
        connectionId: connection.connectionId || connection.id || ""
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
  async getConnections(userId) {
    try {
      const connections = await this.client.connectedAccounts.list({
        entityId: userId
      });
      return (connections.items || connections || []).map((conn) => ({
        id: conn.id || "",
        integrationId: conn.integrationId || "",
        connectionParams: conn.connectionParams || {},
        appName: conn.appName || "",
        status: conn.status || "ACTIVE",
        createdAt: conn.createdAt || (/* @__PURE__ */ new Date()).toISOString()
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
  async getConnection(connectionId) {
    try {
      const connection = await this.client.connectedAccounts.get({
        connectedAccountId: connectionId
      });
      if (!connection) return null;
      return {
        id: connection.id || "",
        integrationId: connection.integrationId || "",
        connectionParams: connection.connectionParams || {},
        appName: connection.appName || "",
        status: connection.status || "ACTIVE",
        createdAt: connection.createdAt || (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch {
      return null;
    }
  }
  /**
   * Delete a connection.
   */
  async deleteConnection(connectionId) {
    try {
      await this.client.connectedAccounts.delete({
        connectedAccountId: connectionId
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
  async getTools(userId, options) {
    try {
      const toolsApi = this.client.actions || this.client.tools;
      if (!toolsApi) {
        throw new Error("Tools API not available in this version of Composio SDK");
      }
      const tools = await toolsApi.list({
        apps: options?.apps?.join(",")
      });
      return (tools.items || tools || []).map((tool) => ({
        name: tool.name || "",
        description: tool.description || "",
        input_schema: {
          type: "object",
          properties: tool.parameters || tool.input_schema?.properties || {},
          required: tool.required || tool.input_schema?.required || []
        }
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
   * Uses the high-level ComposioToolSet.executeAction() which handles
   * entity → connected account resolution automatically.
   *
   * @param userId - The user entity ID (maps to Composio entityId)
   * @param toolCall - The tool call from the LLM (name + input)
   * @returns The result of the action
   */
  async executeAction(userId, toolCall) {
    try {
      const result = await this.toolSet.executeAction({
        action: toolCall.name,
        params: toolCall.input,
        entityId: this.entityId
      });
      return result;
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
  async getActionsForApp(appKey) {
    try {
      const actions = await this.client.actions.list({
        apps: appKey
      });
      return actions.items?.map((action) => ({
        name: action.name || "",
        description: action.description || "",
        parameters: action.parameters || {}
      })) || [];
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
  getRawClient() {
    return this.client;
  }
};
var _composioClient = null;
function initComposio(config) {
  _composioClient = new ComposioClient(config);
  return _composioClient;
}
function getComposio() {
  if (!_composioClient) {
    throw new ConnectorError(
      "composio",
      "init",
      "Composio client not initialized. Call initComposio() first."
    );
  }
  return _composioClient;
}

// src/pipedream.ts
import { ConnectorError as ConnectorError2 } from "@elevay/types";
var PipedreamClient = class {
  config;
  constructor(config) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl ?? "https://api.pipedream.com/v1"
    };
  }
  /**
   * Get all available apps.
   */
  async getApps() {
    const response = await this.request(
      "GET",
      "/apps"
    );
    return response.data;
  }
  /**
   * Search apps by name.
   */
  async searchApps(query) {
    const response = await this.request(
      "GET",
      `/apps?q=${encodeURIComponent(query)}`
    );
    return response.data;
  }
  /**
   * Get app details.
   */
  async getApp(appSlug) {
    try {
      const response = await this.request(
        "GET",
        `/apps/${appSlug}`
      );
      return response.data;
    } catch {
      return null;
    }
  }
  /**
   * Get connected accounts for the project.
   */
  async getAccounts(externalUserId) {
    const params = externalUserId ? `?external_user_id=${encodeURIComponent(externalUserId)}` : "";
    const response = await this.request(
      "GET",
      `/projects/${this.config.projectId}/accounts${params}`
    );
    return response.data;
  }
  /**
   * Get a specific account.
   */
  async getAccount(accountId) {
    try {
      const response = await this.request(
        "GET",
        `/accounts/${accountId}`
      );
      return response.data;
    } catch {
      return null;
    }
  }
  /**
   * Delete an account.
   */
  async deleteAccount(accountId) {
    await this.request("DELETE", `/accounts/${accountId}`);
  }
  /**
   * Get the OAuth connect URL for an app.
   */
  getConnectUrl(options) {
    const params = new URLSearchParams({
      app: options.app,
      external_user_id: options.externalUserId,
      redirect_uri: options.redirectUri,
      token: this.config.publicKey
    });
    if (options.state) {
      params.set("state", options.state);
    }
    return `https://pipedream.com/connect?${params.toString()}`;
  }
  /**
   * Get auth credentials for an account.
   * Returns the access token that can be used to make API calls.
   */
  async getAuthCredentials(accountId) {
    const response = await this.request("GET", `/accounts/${accountId}/credentials`);
    const creds = response.data;
    return {
      accessToken: creds.oauth_access_token ?? creds.api_key ?? "",
      refreshToken: creds.oauth_refresh_token,
      expiresAt: creds.oauth_expires_at ? new Date(creds.oauth_expires_at) : void 0
    };
  }
  /**
   * Execute a Pipedream action.
   */
  async executeAction(accountId, actionSlug, input) {
    const response = await this.request(
      "POST",
      `/accounts/${accountId}/actions/${actionSlug}`,
      input
    );
    return response.data;
  }
  /**
   * Make an authenticated API request.
   */
  async request(method, path, body) {
    const url = `${this.config.baseUrl}${path}`;
    const headers = {
      Authorization: `Bearer ${this.config.secretKey}`,
      "Content-Type": "application/json"
    };
    const options = {
      method,
      headers
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      throw new ConnectorError2(
        "pipedream",
        path,
        `Pipedream API error (${response.status}): ${errorText}`
      );
    }
    return response.json();
  }
};

// src/registry.ts
var ConnectorRegistry = class {
  connectors = /* @__PURE__ */ new Map();
  /**
   * Register a connector.
   */
  register(connector) {
    if (this.connectors.has(connector.id)) {
      console.warn(`Connector ${connector.id} is already registered, overwriting...`);
    }
    this.connectors.set(connector.id, connector);
  }
  /**
   * Get a connector by ID.
   */
  get(connectorId) {
    return this.connectors.get(connectorId);
  }
  /**
   * Get all connectors.
   */
  getAll() {
    return Array.from(this.connectors.values());
  }
  /**
   * Get connectors by category.
   */
  getByCategory(category) {
    return this.getAll().filter((c) => c.category === category);
  }
  /**
   * Get all connector configs for display.
   */
  getAllConfigs() {
    return this.getAll().map((c) => c.toConfig());
  }
  /**
   * Search connectors by name.
   */
  search(query) {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(
      (c) => c.name.toLowerCase().includes(lowerQuery) || c.description.toLowerCase().includes(lowerQuery)
    );
  }
  /**
   * Check if a connector is registered.
   */
  has(connectorId) {
    return this.connectors.has(connectorId);
  }
  /**
   * Get connector count.
   */
  count() {
    return this.connectors.size;
  }
};
var _registry = null;
function getConnectorRegistry() {
  if (!_registry) {
    _registry = new ConnectorRegistry();
  }
  return _registry;
}
function initConnectorRegistry() {
  const registry = getConnectorRegistry();
  import("./gmail-LG4TUZKC.mjs").then(({ GmailConnector: GmailConnector2 }) => {
    registry.register(new GmailConnector2());
  });
  import("./hubspot-VQU66VNE.mjs").then(({ HubSpotConnector: HubSpotConnector2 }) => {
    registry.register(new HubSpotConnector2());
  });
  import("./slack-GDFKRC47.mjs").then(({ SlackConnector: SlackConnector2 }) => {
    registry.register(new SlackConnector2());
  });
  import("./calendar-FGZ6B5JR.mjs").then(({ CalendarConnector: CalendarConnector2 }) => {
    registry.register(new CalendarConnector2());
  });
  return registry;
}
export {
  BaseConnector,
  CalendarConnector,
  ComposioClient,
  ConnectorRegistry,
  GmailConnector,
  HubSpotConnector,
  PipedreamClient,
  SlackConnector,
  getComposio,
  getConnectorRegistry,
  initComposio,
  initConnectorRegistry
};
