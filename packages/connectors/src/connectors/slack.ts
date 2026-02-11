/**
 * Slack Connector
 *
 * Messaging connector for Slack API.
 */

import { z } from "zod";
import { BaseConnector, type ConnectorContext, type ActionResult } from "../base";

// ============================================
// Schemas
// ============================================

const ChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  is_private: z.boolean(),
  is_member: z.boolean(),
});

const MessageSchema = z.object({
  ts: z.string(),
  text: z.string(),
  user: z.string().optional(),
  channel: z.string(),
});

const SendMessageInput = z.object({
  channel: z.string(),
  text: z.string(),
  thread_ts: z.string().optional(),
});

const ListChannelsInput = z.object({
  types: z.enum(["public", "private", "all"]).optional(),
  limit: z.number().optional(),
});

const GetChannelHistoryInput = z.object({
  channel: z.string(),
  limit: z.number().optional(),
});

// ============================================
// Connector Implementation
// ============================================

export class SlackConnector extends BaseConnector {
  readonly id = "slack";
  readonly name = "Slack";
  readonly description = "Team communication platform";
  readonly category = "MESSAGING" as const;
  readonly icon = "logos:slack-icon";
  readonly pipedreamAppSlug = "slack";

  readonly requiredScopes = [
    "channels:read",
    "chat:write",
    "users:read",
  ];

  readonly optionalScopes = [
    "channels:history",
    "groups:read",
    "groups:history",
    "im:read",
    "im:history",
    "files:read",
    "files:write",
  ];

  constructor() {
    super();
    this.registerActions();
  }

  private registerActions(): void {
    // Send Message
    this.registerAction({
      id: "send-message",
      name: "Send Message",
      description: "Send a message to a Slack channel",
      inputSchema: SendMessageInput,
      outputSchema: MessageSchema,
      execute: async (input, context) => {
        return this.sendMessage(input, context);
      },
    });

    // List Channels
    this.registerAction({
      id: "list-channels",
      name: "List Channels",
      description: "List available Slack channels",
      inputSchema: ListChannelsInput,
      outputSchema: z.array(ChannelSchema),
      execute: async (input, context) => {
        return this.listChannels(input, context);
      },
    });

    // Get Channel History
    this.registerAction({
      id: "get-channel-history",
      name: "Get Channel History",
      description: "Get recent messages from a channel",
      inputSchema: GetChannelHistoryInput,
      outputSchema: z.array(MessageSchema),
      execute: async (input, context) => {
        return this.getChannelHistory(input, context);
      },
    });
  }

  // ============================================
  // Action Implementations
  // ============================================

  private async sendMessage(
    input: z.infer<typeof SendMessageInput>,
    context: ConnectorContext
  ): Promise<ActionResult<z.infer<typeof MessageSchema>>> {
    const response = await this.apiRequest<{
      ok: boolean;
      ts: string;
      channel: string;
      message: { text: string; user: string };
      error?: string;
    }>(context, "POST", "/chat.postMessage", {
      channel: input.channel,
      text: input.text,
      thread_ts: input.thread_ts,
    });

    if (!response.success || !response.data?.ok) {
      return {
        success: false,
        error: response.data?.error ?? response.error ?? "Failed to send message",
      };
    }

    return {
      success: true,
      data: {
        ts: response.data.ts,
        text: response.data.message.text,
        user: response.data.message.user,
        channel: response.data.channel,
      },
    };
  }

  private async listChannels(
    input: z.infer<typeof ListChannelsInput>,
    context: ConnectorContext
  ): Promise<ActionResult<z.infer<typeof ChannelSchema>[]>> {
    const inputTypes = input.types ?? "public";
    const types =
      inputTypes === "all"
        ? "public_channel,private_channel"
        : inputTypes === "private"
          ? "private_channel"
          : "public_channel";

    const response = await this.apiRequest<{
      ok: boolean;
      channels: {
        id: string;
        name: string;
        is_private: boolean;
        is_member: boolean;
      }[];
      error?: string;
    }>(
      context,
      "GET",
      `/conversations.list?types=${types}&limit=${input.limit ?? 100}&exclude_archived=true`
    );

    if (!response.success || !response.data?.ok) {
      return {
        success: false,
        error: response.data?.error ?? response.error ?? "Failed to list channels",
      };
    }

    return { success: true, data: response.data.channels };
  }

  private async getChannelHistory(
    input: z.infer<typeof GetChannelHistoryInput>,
    context: ConnectorContext
  ): Promise<ActionResult<z.infer<typeof MessageSchema>[]>> {
    const response = await this.apiRequest<{
      ok: boolean;
      messages: { ts: string; text: string; user?: string }[];
      error?: string;
    }>(
      context,
      "GET",
      `/conversations.history?channel=${input.channel}&limit=${input.limit ?? 100}`
    );

    if (!response.success || !response.data?.ok) {
      return {
        success: false,
        error: response.data?.error ?? response.error ?? "Failed to get history",
      };
    }

    return {
      success: true,
      data: response.data.messages.map((m) => ({
        ts: m.ts,
        text: m.text,
        user: m.user,
        channel: input.channel,
      })),
    };
  }

  // ============================================
  // OAuth Methods
  // ============================================

  async testConnection(context: ConnectorContext): Promise<ActionResult<boolean>> {
    const result = await this.apiRequest<{ ok: boolean }>(
      context,
      "GET",
      "/auth.test"
    );
    return { success: result.success && result.data?.ok === true, data: result.data?.ok ?? false };
  }

  getOAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID ?? "",
      redirect_uri: redirectUri,
      scope: this.requiredScopes.join(","),
      state,
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  async exchangeOAuthCode(
    code: string,
    redirectUri: string
  ): Promise<ActionResult<{ accessToken: string; refreshToken?: string; expiresAt?: Date }>> {
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID ?? "",
        client_secret: process.env.SLACK_CLIENT_SECRET ?? "",
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!response.ok) {
      return { success: false, error: "Failed to exchange OAuth code" };
    }

    const data = (await response.json()) as {
      ok: boolean;
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (!data.ok) {
      return { success: false, error: data.error ?? "OAuth failed" };
    }

    return {
      success: true,
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000)
          : undefined,
      },
    };
  }

  async refreshAccessToken(
    refreshToken: string
  ): Promise<ActionResult<{ accessToken: string; refreshToken?: string; expiresAt?: Date }>> {
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID ?? "",
        client_secret: process.env.SLACK_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      return { success: false, error: "Failed to refresh token" };
    }

    const data = (await response.json()) as {
      ok: boolean;
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (!data.ok) {
      return { success: false, error: data.error ?? "Refresh failed" };
    }

    return {
      success: true,
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000)
          : undefined,
      },
    };
  }

  // ============================================
  // API Helper
  // ============================================

  private async apiRequest<T>(
    context: ConnectorContext,
    method: string,
    path: string,
    body?: unknown
  ): Promise<ActionResult<T>> {
    const url = `https://slack.com/api${path}`;

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        "Content-Type": "application/json",
      },
    };

    if (body && method === "POST") {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    const data = (await response.json()) as T;
    return { success: true, data };
  }
}
