/**
 * Pipedream Connect Client
 *
 * Wrapper for Pipedream Connect API that handles:
 * - OAuth flows for 2,800+ APIs
 * - Token management and refresh
 * - Rate limiting
 */

import { ConnectorError } from "@elevay/types";

// ============================================
// Types
// ============================================

export interface PipedreamConfig {
  publicKey: string;
  secretKey: string;
  projectId: string;
  baseUrl?: string;
}

export interface PipedreamAccount {
  id: string;
  name: string;
  app: string;
  healthy: boolean;
  dead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PipedreamApp {
  id: string;
  name_slug: string;
  name: string;
  description: string;
  img_src: string;
  categories: string[];
  auth_type: "oauth" | "keys" | "none";
}

export interface PipedreamAuthResponse {
  id: string;
  token: string;
  expires_at?: string;
}

// ============================================
// Pipedream Client
// ============================================

export class PipedreamClient {
  private config: Required<PipedreamConfig>;

  constructor(config: PipedreamConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl ?? "https://api.pipedream.com/v1",
    };
  }

  /**
   * Get all available apps.
   */
  async getApps(): Promise<PipedreamApp[]> {
    const response = await this.request<{ data: PipedreamApp[] }>(
      "GET",
      "/apps"
    );
    return response.data;
  }

  /**
   * Search apps by name.
   */
  async searchApps(query: string): Promise<PipedreamApp[]> {
    const response = await this.request<{ data: PipedreamApp[] }>(
      "GET",
      `/apps?q=${encodeURIComponent(query)}`
    );
    return response.data;
  }

  /**
   * Get app details.
   */
  async getApp(appSlug: string): Promise<PipedreamApp | null> {
    try {
      const response = await this.request<{ data: PipedreamApp }>(
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
  async getAccounts(externalUserId?: string): Promise<PipedreamAccount[]> {
    const params = externalUserId
      ? `?external_user_id=${encodeURIComponent(externalUserId)}`
      : "";
    const response = await this.request<{ data: PipedreamAccount[] }>(
      "GET",
      `/projects/${this.config.projectId}/accounts${params}`
    );
    return response.data;
  }

  /**
   * Get a specific account.
   */
  async getAccount(accountId: string): Promise<PipedreamAccount | null> {
    try {
      const response = await this.request<{ data: PipedreamAccount }>(
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
  async deleteAccount(accountId: string): Promise<void> {
    await this.request("DELETE", `/accounts/${accountId}`);
  }

  /**
   * Get the OAuth connect URL for an app.
   */
  getConnectUrl(options: {
    app: string;
    externalUserId: string;
    redirectUri: string;
    state?: string;
  }): string {
    const params = new URLSearchParams({
      app: options.app,
      external_user_id: options.externalUserId,
      redirect_uri: options.redirectUri,
      token: this.config.publicKey,
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
  async getAuthCredentials(accountId: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }> {
    const response = await this.request<{
      data: {
        oauth_access_token?: string;
        oauth_refresh_token?: string;
        oauth_expires_at?: string;
        api_key?: string;
        [key: string]: unknown;
      };
    }>("GET", `/accounts/${accountId}/credentials`);

    const creds = response.data;

    return {
      accessToken: creds.oauth_access_token ?? creds.api_key ?? "",
      refreshToken: creds.oauth_refresh_token,
      expiresAt: creds.oauth_expires_at
        ? new Date(creds.oauth_expires_at)
        : undefined,
    };
  }

  /**
   * Execute a Pipedream action.
   */
  async executeAction<T = unknown>(
    accountId: string,
    actionSlug: string,
    input: Record<string, unknown>
  ): Promise<T> {
    const response = await this.request<{ data: T }>(
      "POST",
      `/accounts/${accountId}/actions/${actionSlug}`,
      input
    );
    return response.data;
  }

  /**
   * Make an authenticated API request.
   */
  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.secretKey}`,
      "Content-Type": "application/json",
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new ConnectorError(
        "pipedream",
        path,
        `Pipedream API error (${response.status}): ${errorText}`
      );
    }

    return response.json() as Promise<T>;
  }
}

// ============================================
// Singleton Instance
// ============================================

let _pipedreamClient: PipedreamClient | null = null;

export function initPipedream(config: PipedreamConfig): PipedreamClient {
  _pipedreamClient = new PipedreamClient(config);
  return _pipedreamClient;
}

export function getPipedream(): PipedreamClient {
  if (!_pipedreamClient) {
    throw new ConnectorError(
      "pipedream",
      "init",
      "Pipedream client not initialized. Call initPipedream() first."
    );
  }
  return _pipedreamClient;
}
