import {
  BaseConnector
} from "./chunk-WX3K3UJC.mjs";

// src/connectors/gmail.ts
import { z } from "zod";
var EmailSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  subject: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  date: z.string().optional(),
  snippet: z.string().optional(),
  body: z.string().optional()
});
var SendEmailInput = z.object({
  to: z.string().email(),
  subject: z.string(),
  body: z.string(),
  html: z.boolean().optional(),
  cc: z.string().optional(),
  bcc: z.string().optional()
});
var SearchEmailsInput = z.object({
  query: z.string().optional(),
  from: z.string().optional(),
  subject: z.string().optional(),
  after: z.string().optional(),
  before: z.string().optional(),
  limit: z.number().optional()
});
var GetEmailInput = z.object({
  emailId: z.string()
});
var ReplyEmailInput = z.object({
  threadId: z.string(),
  body: z.string(),
  html: z.boolean().optional()
});
var GmailConnector = class extends BaseConnector {
  id = "gmail";
  name = "Gmail";
  description = "Google email service";
  category = "EMAIL";
  icon = "logos:google-gmail";
  pipedreamAppSlug = "gmail";
  requiredScopes = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send"
  ];
  optionalScopes = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.labels"
  ];
  constructor() {
    super();
    this.registerActions();
  }
  registerActions() {
    this.registerAction({
      id: "send-email",
      name: "Send Email",
      description: "Send an email",
      inputSchema: SendEmailInput,
      outputSchema: z.object({ id: z.string(), threadId: z.string() }),
      execute: async (input, context) => {
        return this.sendEmail(input, context);
      }
    });
    this.registerAction({
      id: "search-emails",
      name: "Search Emails",
      description: "Search for emails",
      inputSchema: SearchEmailsInput,
      outputSchema: z.array(EmailSchema),
      execute: async (input, context) => {
        return this.searchEmails(input, context);
      }
    });
    this.registerAction({
      id: "get-email",
      name: "Get Email",
      description: "Get an email by ID",
      inputSchema: GetEmailInput,
      outputSchema: EmailSchema,
      execute: async (input, context) => {
        return this.getEmail(input, context);
      }
    });
    this.registerAction({
      id: "reply-email",
      name: "Reply to Email",
      description: "Reply to an email thread",
      inputSchema: ReplyEmailInput,
      outputSchema: z.object({ id: z.string(), threadId: z.string() }),
      execute: async (input, context) => {
        return this.replyEmail(input, context);
      }
    });
  }
  // ============================================
  // Action Implementations
  // ============================================
  async sendEmail(input, context) {
    const email = this.createMimeMessage({
      to: input.to,
      subject: input.subject,
      body: input.body,
      html: input.html ?? false,
      cc: input.cc,
      bcc: input.bcc
    });
    const response = await this.apiRequest(
      context,
      "POST",
      "/gmail/v1/users/me/messages/send",
      { raw: email }
    );
    return response;
  }
  async searchEmails(input, context) {
    const queryParts = [];
    if (input.query) queryParts.push(input.query);
    if (input.from) queryParts.push(`from:${input.from}`);
    if (input.subject) queryParts.push(`subject:${input.subject}`);
    if (input.after) queryParts.push(`after:${input.after}`);
    if (input.before) queryParts.push(`before:${input.before}`);
    const query = queryParts.join(" ");
    const url = `/gmail/v1/users/me/messages?maxResults=${input.limit ?? 10}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
    const listResponse = await this.apiRequest(context, "GET", url);
    if (!listResponse.success || !listResponse.data?.messages) {
      return { success: true, data: [] };
    }
    const emails = await Promise.all(
      listResponse.data.messages.slice(0, input.limit).map(async (msg) => {
        const detail = await this.getEmail({ emailId: msg.id }, context);
        return detail.success ? detail.data : null;
      })
    );
    return {
      success: true,
      data: emails.filter((e) => e !== null)
    };
  }
  async getEmail(input, context) {
    const response = await this.apiRequest(context, "GET", `/gmail/v1/users/me/messages/${input.emailId}`);
    if (!response.success || !response.data) {
      return response;
    }
    const msg = response.data;
    const getHeader = (name) => msg.payload.headers.find(
      (h) => h.name.toLowerCase() === name.toLowerCase()
    )?.value;
    let body = "";
    if (msg.payload.body?.data) {
      body = Buffer.from(msg.payload.body.data, "base64").toString("utf-8");
    } else if (msg.payload.parts) {
      const textPart = msg.payload.parts.find(
        (p) => p.body?.data
      );
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
      }
    }
    return {
      success: true,
      data: {
        id: msg.id,
        threadId: msg.threadId,
        subject: getHeader("Subject"),
        from: getHeader("From"),
        to: getHeader("To"),
        date: getHeader("Date"),
        snippet: msg.snippet,
        body
      }
    };
  }
  async replyEmail(input, context) {
    const threadResponse = await this.apiRequest(context, "GET", `/gmail/v1/users/me/threads/${input.threadId}`);
    if (!threadResponse.success || !threadResponse.data?.messages?.length) {
      return { success: false, error: "Thread not found" };
    }
    const lastMessage = threadResponse.data.messages[threadResponse.data.messages.length - 1];
    const getHeader = (name) => lastMessage.payload.headers.find(
      (h) => h.name.toLowerCase() === name.toLowerCase()
    )?.value;
    const subject = getHeader("Subject") ?? "";
    const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
    const to = getHeader("From") ?? "";
    const messageId = getHeader("Message-ID") ?? "";
    const email = this.createMimeMessage({
      to,
      subject: replySubject,
      body: input.body,
      html: input.html ?? false,
      inReplyTo: messageId,
      references: messageId
    });
    const response = await this.apiRequest(
      context,
      "POST",
      "/gmail/v1/users/me/messages/send",
      { raw: email, threadId: input.threadId }
    );
    return response;
  }
  // ============================================
  // OAuth Methods
  // ============================================
  async testConnection(context) {
    const result = await this.apiRequest(
      context,
      "GET",
      "/gmail/v1/users/me/profile"
    );
    return { success: result.success, data: result.success };
  }
  getOAuthUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: this.requiredScopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      state
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
  async exchangeOAuthCode(code, redirectUri) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: redirectUri,
        code
      })
    });
    if (!response.ok) {
      return { success: false, error: "Failed to exchange OAuth code" };
    }
    const data = await response.json();
    return {
      success: true,
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1e3)
      }
    };
  }
  async refreshAccessToken(refreshToken) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        refresh_token: refreshToken
      })
    });
    if (!response.ok) {
      return { success: false, error: "Failed to refresh token" };
    }
    const data = await response.json();
    return {
      success: true,
      data: {
        accessToken: data.access_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1e3)
      }
    };
  }
  // ============================================
  // Helpers
  // ============================================
  createMimeMessage(options) {
    const lines = [
      `To: ${options.to}`,
      `Subject: ${options.subject}`,
      `Content-Type: ${options.html ? "text/html" : "text/plain"}; charset=utf-8`
    ];
    if (options.cc) lines.push(`Cc: ${options.cc}`);
    if (options.bcc) lines.push(`Bcc: ${options.bcc}`);
    if (options.inReplyTo) lines.push(`In-Reply-To: ${options.inReplyTo}`);
    if (options.references) lines.push(`References: ${options.references}`);
    lines.push("", options.body);
    const message = lines.join("\r\n");
    return Buffer.from(message).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  async apiRequest(context, method, path, body) {
    const url = `https://www.googleapis.com${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : void 0
    });
    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }
    const data = await response.json();
    return { success: true, data };
  }
};

export {
  GmailConnector
};
