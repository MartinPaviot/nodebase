import {
  BaseConnector
} from "./chunk-WX3K3UJC.mjs";

// src/connectors/slack.ts
import { z } from "zod";
var ChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  is_private: z.boolean(),
  is_member: z.boolean()
});
var MessageSchema = z.object({
  ts: z.string(),
  text: z.string(),
  user: z.string().optional(),
  channel: z.string()
});
var SendMessageInput = z.object({
  channel: z.string(),
  text: z.string(),
  thread_ts: z.string().optional()
});
var ListChannelsInput = z.object({
  types: z.enum(["public", "private", "all"]).default("public"),
  limit: z.number().default(100)
});
var GetChannelHistoryInput = z.object({
  channel: z.string(),
  limit: z.number().default(10)
});
var SlackConnector = class extends BaseConnector {
  id = "slack";
  name = "Slack";
  description = "Team communication platform";
  category = "MESSAGING";
  icon = "logos:slack-icon";
  pipedreamAppSlug = "slack";
  requiredScopes = [
    "channels:read",
    "chat:write",
    "users:read"
  ];
  optionalScopes = [
    "channels:history",
    "groups:read",
    "groups:history",
    "im:read",
    "im:history",
    "files:read",
    "files:write"
  ];
  constructor() {
    super();
    this.registerActions();
  }
  registerActions() {
    this.registerAction({
      id: "send-message",
      name: "Send Message",
      description: "Send a message to a Slack channel",
      inputSchema: SendMessageInput,
      outputSchema: MessageSchema,
      execute: async (input, context) => {
        return this.sendMessage(input, context);
      }
    });
    this.registerAction({
      id: "list-channels",
      name: "List Channels",
      description: "List available Slack channels",
      inputSchema: ListChannelsInput,
      outputSchema: z.array(ChannelSchema),
      execute: async (input, context) => {
        return this.listChannels(input, context);
      }
    });
    this.registerAction({
      id: "get-channel-history",
      name: "Get Channel History",
      description: "Get recent messages from a channel",
      inputSchema: GetChannelHistoryInput,
      outputSchema: z.array(MessageSchema),
      execute: async (input, context) => {
        return this.getChannelHistory(input, context);
      }
    });
  }
  // ============================================
  // Action Implementations
  // ============================================
  async sendMessage(input, context) {
    const response = await this.apiRequest(context, "POST", "/chat.postMessage", {
      channel: input.channel,
      text: input.text,
      thread_ts: input.thread_ts
    });
    if (!response.success || !response.data?.ok) {
      return {
        success: false,
        error: response.data?.error ?? response.error ?? "Failed to send message"
      };
    }
    return {
      success: true,
      data: {
        ts: response.data.ts,
        text: response.data.message.text,
        user: response.data.message.user,
        channel: response.data.channel
      }
    };
  }
  async listChannels(input, context) {
    const types = input.types === "all" ? "public_channel,private_channel" : input.types === "private" ? "private_channel" : "public_channel";
    const response = await this.apiRequest(
      context,
      "GET",
      `/conversations.list?types=${types}&limit=${input.limit}&exclude_archived=true`
    );
    if (!response.success || !response.data?.ok) {
      return {
        success: false,
        error: response.data?.error ?? response.error ?? "Failed to list channels"
      };
    }
    return { success: true, data: response.data.channels };
  }
  async getChannelHistory(input, context) {
    const response = await this.apiRequest(
      context,
      "GET",
      `/conversations.history?channel=${input.channel}&limit=${input.limit}`
    );
    if (!response.success || !response.data?.ok) {
      return {
        success: false,
        error: response.data?.error ?? response.error ?? "Failed to get history"
      };
    }
    return {
      success: true,
      data: response.data.messages.map((m) => ({
        ts: m.ts,
        text: m.text,
        user: m.user,
        channel: input.channel
      }))
    };
  }
  // ============================================
  // OAuth Methods
  // ============================================
  async testConnection(context) {
    const result = await this.apiRequest(
      context,
      "GET",
      "/auth.test"
    );
    return { success: result.success && result.data?.ok === true, data: result.data?.ok ?? false };
  }
  getOAuthUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID ?? "",
      redirect_uri: redirectUri,
      scope: this.requiredScopes.join(","),
      state
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }
  async exchangeOAuthCode(code, redirectUri) {
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID ?? "",
        client_secret: process.env.SLACK_CLIENT_SECRET ?? "",
        redirect_uri: redirectUri,
        code
      })
    });
    if (!response.ok) {
      return { success: false, error: "Failed to exchange OAuth code" };
    }
    const data = await response.json();
    if (!data.ok) {
      return { success: false, error: data.error ?? "OAuth failed" };
    }
    return {
      success: true,
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1e3) : void 0
      }
    };
  }
  async refreshAccessToken(refreshToken) {
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID ?? "",
        client_secret: process.env.SLACK_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: refreshToken
      })
    });
    if (!response.ok) {
      return { success: false, error: "Failed to refresh token" };
    }
    const data = await response.json();
    if (!data.ok) {
      return { success: false, error: data.error ?? "Refresh failed" };
    }
    return {
      success: true,
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1e3) : void 0
      }
    };
  }
  // ============================================
  // API Helper
  // ============================================
  async apiRequest(context, method, path, body) {
    const url = `https://slack.com/api${path}`;
    const options = {
      method,
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        "Content-Type": "application/json"
      }
    };
    if (body && method === "POST") {
      options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }
    const data = await response.json();
    return { success: true, data };
  }
};

export {
  SlackConnector
};
