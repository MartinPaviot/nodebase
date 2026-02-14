"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/base.ts
var import_types, BaseConnector;
var init_base = __esm({
  "src/base.ts"() {
    "use strict";
    import_types = require("@nodebase/types");
    BaseConnector = class {
      // Actions and triggers
      actions = /* @__PURE__ */ new Map();
      triggers = /* @__PURE__ */ new Map();
      /**
       * Register an action.
       */
      registerAction(action) {
        this.actions.set(action.id, action);
      }
      /**
       * Register a trigger.
       */
      registerTrigger(trigger) {
        this.triggers.set(trigger.id, trigger);
      }
      /**
       * Get all actions.
       */
      getActions() {
        return Array.from(this.actions.values());
      }
      /**
       * Get all triggers.
       */
      getTriggers() {
        return Array.from(this.triggers.values());
      }
      /**
       * Get an action by ID.
       */
      getAction(actionId) {
        return this.actions.get(actionId);
      }
      /**
       * Get a trigger by ID.
       */
      getTrigger(triggerId) {
        return this.triggers.get(triggerId);
      }
      /**
       * Execute an action.
       */
      async executeAction(actionId, input, context) {
        const action = this.actions.get(actionId);
        if (!action) {
          return {
            success: false,
            error: `Action ${actionId} not found on connector ${this.id}`
          };
        }
        const parseResult = action.inputSchema.safeParse(input);
        if (!parseResult.success) {
          return {
            success: false,
            error: `Invalid input: ${parseResult.error.message}`
          };
        }
        try {
          const result = await action.execute(parseResult.data, context);
          return result;
        } catch (error) {
          throw new import_types.ConnectorError(
            this.id,
            actionId,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
      /**
       * Get connector config for display.
       */
      toConfig() {
        return {
          id: this.id,
          name: this.name,
          category: this.category,
          provider: this.id,
          pipedreamAppSlug: this.pipedreamAppSlug,
          requiredScopes: this.requiredScopes,
          optionalScopes: this.optionalScopes
        };
      }
    };
  }
});

// src/connectors/gmail.ts
var gmail_exports = {};
__export(gmail_exports, {
  GmailConnector: () => GmailConnector
});
var import_zod, EmailSchema, SendEmailInput, SearchEmailsInput, GetEmailInput, ReplyEmailInput, SendColdEmailInput, SendColdEmailOutput, SearchRepliesInput, ReplyMessage, SearchRepliesOutput, SearchBouncesInput, BounceTypeEnum, BounceMessage, SearchBouncesOutput, GmailConnector;
var init_gmail = __esm({
  "src/connectors/gmail.ts"() {
    "use strict";
    import_zod = require("zod");
    init_base();
    EmailSchema = import_zod.z.object({
      id: import_zod.z.string(),
      threadId: import_zod.z.string(),
      subject: import_zod.z.string().optional(),
      from: import_zod.z.string().optional(),
      to: import_zod.z.string().optional(),
      date: import_zod.z.string().optional(),
      snippet: import_zod.z.string().optional(),
      body: import_zod.z.string().optional()
    });
    SendEmailInput = import_zod.z.object({
      to: import_zod.z.string().email(),
      subject: import_zod.z.string(),
      body: import_zod.z.string(),
      html: import_zod.z.boolean().optional(),
      cc: import_zod.z.string().optional(),
      bcc: import_zod.z.string().optional()
    });
    SearchEmailsInput = import_zod.z.object({
      query: import_zod.z.string().optional(),
      from: import_zod.z.string().optional(),
      subject: import_zod.z.string().optional(),
      after: import_zod.z.string().optional(),
      before: import_zod.z.string().optional(),
      limit: import_zod.z.number().optional()
    });
    GetEmailInput = import_zod.z.object({
      emailId: import_zod.z.string()
    });
    ReplyEmailInput = import_zod.z.object({
      threadId: import_zod.z.string(),
      body: import_zod.z.string(),
      html: import_zod.z.boolean().optional()
    });
    SendColdEmailInput = import_zod.z.object({
      to: import_zod.z.string().email(),
      subject: import_zod.z.string(),
      body: import_zod.z.string(),
      unsubscribeUrl: import_zod.z.string().url(),
      replyToMessageId: import_zod.z.string().optional()
    });
    SendColdEmailOutput = import_zod.z.object({
      id: import_zod.z.string(),
      threadId: import_zod.z.string()
    });
    SearchRepliesInput = import_zod.z.object({
      threadId: import_zod.z.string(),
      afterDate: import_zod.z.string().optional()
    });
    ReplyMessage = import_zod.z.object({
      messageId: import_zod.z.string(),
      from: import_zod.z.string(),
      date: import_zod.z.string(),
      subject: import_zod.z.string(),
      body: import_zod.z.string(),
      snippet: import_zod.z.string()
    });
    SearchRepliesOutput = import_zod.z.array(ReplyMessage);
    SearchBouncesInput = import_zod.z.object({
      afterDate: import_zod.z.string()
    });
    BounceTypeEnum = import_zod.z.enum([
      "hard_bounce",
      "soft_bounce",
      "mailbox_full",
      "unknown"
    ]);
    BounceMessage = import_zod.z.object({
      messageId: import_zod.z.string(),
      date: import_zod.z.string(),
      bounceType: BounceTypeEnum,
      originalTo: import_zod.z.string(),
      originalSubject: import_zod.z.string(),
      snippet: import_zod.z.string()
    });
    SearchBouncesOutput = import_zod.z.array(BounceMessage);
    GmailConnector = class extends BaseConnector {
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
          outputSchema: import_zod.z.object({ id: import_zod.z.string(), threadId: import_zod.z.string() }),
          execute: async (input, context) => {
            return this.sendEmail(input, context);
          }
        });
        this.registerAction({
          id: "search-emails",
          name: "Search Emails",
          description: "Search for emails",
          inputSchema: SearchEmailsInput,
          outputSchema: import_zod.z.array(EmailSchema),
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
          outputSchema: import_zod.z.object({ id: import_zod.z.string(), threadId: import_zod.z.string() }),
          execute: async (input, context) => {
            return this.replyEmail(input, context);
          }
        });
        this.registerAction({
          id: "send-cold-email",
          name: "Send Cold Email",
          description: "Send a cold outreach email with RFC 8058 one-click unsubscribe headers. Supports follow-ups in the same thread via replyToMessageId.",
          inputSchema: SendColdEmailInput,
          outputSchema: SendColdEmailOutput,
          execute: async (input, context) => {
            return this.sendColdEmail(input, context);
          }
        });
        this.registerAction({
          id: "search-replies",
          name: "Search Replies",
          description: "Search for replies from leads in a specific Gmail thread. Returns only messages NOT sent by the authenticated user.",
          inputSchema: SearchRepliesInput,
          outputSchema: SearchRepliesOutput,
          execute: async (input, context) => {
            return this.searchReplies(input, context);
          }
        });
        this.registerAction({
          id: "search-bounces",
          name: "Search Bounces",
          description: "Detect bounced emails by searching for mailer-daemon and postmaster messages. Classifies bounces as hard, soft, mailbox full, or unknown.",
          inputSchema: SearchBouncesInput,
          outputSchema: SearchBouncesOutput,
          execute: async (input, context) => {
            return this.searchBounces(input, context);
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
      async sendColdEmail(input, context) {
        const unsubscribeDomain = new URL(input.unsubscribeUrl).hostname;
        const mimeOptions = {
          to: input.to,
          subject: input.subject,
          body: input.body,
          html: true,
          listUnsubscribe: `<mailto:unsubscribe@${unsubscribeDomain}>, <${input.unsubscribeUrl}>`,
          listUnsubscribePost: "List-Unsubscribe=One-Click"
        };
        if (input.replyToMessageId) {
          mimeOptions.inReplyTo = input.replyToMessageId;
          mimeOptions.references = input.replyToMessageId;
        }
        const email = this.createMimeMessage(mimeOptions);
        const response = await this.apiRequest(
          context,
          "POST",
          "/gmail/v1/users/me/messages/send",
          { raw: email }
        );
        return response;
      }
      async searchReplies(input, context) {
        const profileResponse = await this.apiRequest(
          context,
          "GET",
          "/gmail/v1/users/me/profile"
        );
        if (!profileResponse.success || !profileResponse.data) {
          return { success: false, error: "Failed to retrieve user profile" };
        }
        const userEmail = profileResponse.data.emailAddress.toLowerCase();
        const threadResponse = await this.apiRequest(context, "GET", `/gmail/v1/users/me/threads/${input.threadId}?format=full`);
        if (!threadResponse.success || !threadResponse.data?.messages) {
          return { success: false, error: "Thread not found" };
        }
        const afterTimestamp = input.afterDate ? new Date(input.afterDate).getTime() : 0;
        const replies = [];
        for (const msg of threadResponse.data.messages) {
          const getHeader = (name) => msg.payload.headers.find(
            (h) => h.name.toLowerCase() === name.toLowerCase()
          )?.value ?? "";
          const fromHeader = getHeader("From").toLowerCase();
          if (fromHeader.includes(userEmail)) {
            continue;
          }
          const messageTimestamp = parseInt(msg.internalDate, 10);
          if (messageTimestamp < afterTimestamp) {
            continue;
          }
          let body = "";
          if (msg.payload.body?.data) {
            body = Buffer.from(msg.payload.body.data, "base64").toString("utf-8");
          } else if (msg.payload.parts) {
            const textPart = msg.payload.parts.find((p) => p.body?.data);
            if (textPart?.body?.data) {
              body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
            }
          }
          replies.push({
            messageId: msg.id,
            from: getHeader("From"),
            date: getHeader("Date"),
            subject: getHeader("Subject"),
            body,
            snippet: msg.snippet
          });
        }
        return { success: true, data: replies };
      }
      async searchBounces(input, context) {
        const query = `from:mailer-daemon OR from:postmaster after:${input.afterDate}`;
        const url = `/gmail/v1/users/me/messages?maxResults=50&q=${encodeURIComponent(query)}`;
        const listResponse = await this.apiRequest(context, "GET", url);
        if (!listResponse.success || !listResponse.data?.messages) {
          return { success: true, data: [] };
        }
        const bounces = [];
        for (const msg of listResponse.data.messages) {
          const detail = await this.apiRequest(context, "GET", `/gmail/v1/users/me/messages/${msg.id}?format=full`);
          if (!detail.success || !detail.data) {
            continue;
          }
          const message = detail.data;
          const getHeader = (name) => message.payload.headers.find(
            (h) => h.name.toLowerCase() === name.toLowerCase()
          )?.value ?? "";
          let body = "";
          if (message.payload.body?.data) {
            body = Buffer.from(message.payload.body.data, "base64").toString("utf-8");
          } else if (message.payload.parts) {
            const textPart = message.payload.parts.find((p) => p.body?.data);
            if (textPart?.body?.data) {
              body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
            }
          }
          const subject = getHeader("Subject");
          const bounceType = this.detectBounceType(subject, body);
          const originalTo = this.extractOriginalRecipient(body, getHeader("To"));
          const originalSubject = this.extractOriginalSubject(subject, body);
          bounces.push({
            messageId: message.id,
            date: getHeader("Date"),
            bounceType,
            originalTo,
            originalSubject,
            snippet: message.snippet
          });
        }
        return { success: true, data: bounces };
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
        if (options.listUnsubscribe) lines.push(`List-Unsubscribe: ${options.listUnsubscribe}`);
        if (options.listUnsubscribePost) lines.push(`List-Unsubscribe-Post: ${options.listUnsubscribePost}`);
        lines.push("", options.body);
        const message = lines.join("\r\n");
        return Buffer.from(message).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      }
      detectBounceType(subject, body) {
        const combined = `${subject} ${body}`.toLowerCase();
        const hardBouncePatterns = [
          "user unknown",
          "no such user",
          "does not exist",
          "address rejected",
          "invalid recipient",
          "recipient rejected",
          "unknown user",
          "account disabled",
          "account has been disabled",
          "undeliverable",
          "550 5.1.1",
          "550-5.1.1",
          "delivery status notification (failure)"
        ];
        const softBouncePatterns = [
          "temporarily rejected",
          "try again later",
          "temporary failure",
          "service unavailable",
          "connection timed out",
          "too many connections",
          "rate limit",
          "450 4.2.1",
          "421 4.7.0",
          "delivery status notification (delay)"
        ];
        const mailboxFullPatterns = [
          "mailbox full",
          "mailbox is full",
          "over quota",
          "quota exceeded",
          "storage limit",
          "insufficient storage",
          "552 5.2.2"
        ];
        for (const pattern of mailboxFullPatterns) {
          if (combined.includes(pattern)) {
            return "mailbox_full";
          }
        }
        for (const pattern of hardBouncePatterns) {
          if (combined.includes(pattern)) {
            return "hard_bounce";
          }
        }
        for (const pattern of softBouncePatterns) {
          if (combined.includes(pattern)) {
            return "soft_bounce";
          }
        }
        return "unknown";
      }
      extractOriginalRecipient(body, toHeader) {
        const originalRecipientMatch = body.match(
          /Original-Recipient:\s*rfc822;\s*([^\s<>\r\n]+)/i
        );
        if (originalRecipientMatch) {
          return originalRecipientMatch[1];
        }
        const finalRecipientMatch = body.match(
          /Final-Recipient:\s*rfc822;\s*([^\s<>\r\n]+)/i
        );
        if (finalRecipientMatch) {
          return finalRecipientMatch[1];
        }
        const deliveredToMatch = body.match(
          /(?:not delivered to|could not be delivered to|delivery to)\s+([^\s<>\r\n]+@[^\s<>\r\n]+)/i
        );
        if (deliveredToMatch) {
          return deliveredToMatch[1];
        }
        const angleBracketMatch = body.match(
          /(?:address|recipient)[:\s]*<([^>]+@[^>]+)>/i
        );
        if (angleBracketMatch) {
          return angleBracketMatch[1];
        }
        return toHeader;
      }
      extractOriginalSubject(bounceSubject, body) {
        const subjectMatch = body.match(
          /(?:^|\n)Subject:\s*(.+?)(?:\r?\n(?!\s))/im
        );
        if (subjectMatch) {
          return subjectMatch[1].trim();
        }
        const prefixes = [
          "Delivery Status Notification (Failure)",
          "Delivery Status Notification (Delay)",
          "Delivery Status Notification",
          "Undeliverable:",
          "Undelivered Mail Returned to Sender",
          "Mail delivery failed:",
          "Returned mail:",
          "Failure Notice:"
        ];
        for (const prefix of prefixes) {
          if (bounceSubject.toLowerCase().startsWith(prefix.toLowerCase())) {
            const remainder = bounceSubject.slice(prefix.length).trim();
            if (remainder.length > 0) {
              return remainder;
            }
          }
        }
        return bounceSubject;
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
  }
});

// src/connectors/hubspot.ts
var hubspot_exports = {};
__export(hubspot_exports, {
  HubSpotConnector: () => HubSpotConnector
});
var import_zod2, ContactSchema, DealSchema, SearchContactsInput, GetDealInput, SearchDealsInput, CreateContactInput, UpdateDealInput, HubSpotConnector;
var init_hubspot = __esm({
  "src/connectors/hubspot.ts"() {
    "use strict";
    import_zod2 = require("zod");
    init_base();
    ContactSchema = import_zod2.z.object({
      id: import_zod2.z.string(),
      email: import_zod2.z.string().optional(),
      firstname: import_zod2.z.string().optional(),
      lastname: import_zod2.z.string().optional(),
      phone: import_zod2.z.string().optional(),
      company: import_zod2.z.string().optional(),
      properties: import_zod2.z.record(import_zod2.z.unknown()).optional()
    });
    DealSchema = import_zod2.z.object({
      id: import_zod2.z.string(),
      dealname: import_zod2.z.string().optional(),
      amount: import_zod2.z.number().optional(),
      dealstage: import_zod2.z.string().optional(),
      closedate: import_zod2.z.string().optional(),
      properties: import_zod2.z.record(import_zod2.z.unknown()).optional()
    });
    SearchContactsInput = import_zod2.z.object({
      query: import_zod2.z.string().optional(),
      email: import_zod2.z.string().optional(),
      limit: import_zod2.z.number().optional()
    });
    GetDealInput = import_zod2.z.object({
      dealId: import_zod2.z.string()
    });
    SearchDealsInput = import_zod2.z.object({
      stage: import_zod2.z.string().optional(),
      ownerId: import_zod2.z.string().optional(),
      limit: import_zod2.z.number().optional()
    });
    CreateContactInput = import_zod2.z.object({
      email: import_zod2.z.string().email(),
      firstname: import_zod2.z.string().optional(),
      lastname: import_zod2.z.string().optional(),
      phone: import_zod2.z.string().optional(),
      company: import_zod2.z.string().optional()
    });
    UpdateDealInput = import_zod2.z.object({
      dealId: import_zod2.z.string(),
      properties: import_zod2.z.record(import_zod2.z.string())
    });
    HubSpotConnector = class extends BaseConnector {
      id = "hubspot";
      name = "HubSpot";
      description = "CRM, marketing, and sales platform";
      category = "CRM";
      icon = "logos:hubspot";
      pipedreamAppSlug = "hubspot";
      requiredScopes = [
        "crm.objects.contacts.read",
        "crm.objects.contacts.write",
        "crm.objects.deals.read",
        "crm.objects.deals.write"
      ];
      optionalScopes = [
        "crm.objects.companies.read",
        "crm.objects.companies.write",
        "sales-email-read"
      ];
      constructor() {
        super();
        this.registerActions();
      }
      registerActions() {
        this.registerAction({
          id: "search-contacts",
          name: "Search Contacts",
          description: "Search for contacts in HubSpot",
          inputSchema: SearchContactsInput,
          outputSchema: import_zod2.z.array(ContactSchema),
          execute: async (input, context) => {
            return this.searchContacts(input, context);
          }
        });
        this.registerAction({
          id: "get-deal",
          name: "Get Deal",
          description: "Get a deal by ID",
          inputSchema: GetDealInput,
          outputSchema: DealSchema,
          execute: async (input, context) => {
            return this.getDeal(input, context);
          }
        });
        this.registerAction({
          id: "search-deals",
          name: "Search Deals",
          description: "Search for deals in HubSpot",
          inputSchema: SearchDealsInput,
          outputSchema: import_zod2.z.array(DealSchema),
          execute: async (input, context) => {
            return this.searchDeals(input, context);
          }
        });
        this.registerAction({
          id: "create-contact",
          name: "Create Contact",
          description: "Create a new contact in HubSpot",
          inputSchema: CreateContactInput,
          outputSchema: ContactSchema,
          execute: async (input, context) => {
            return this.createContact(input, context);
          }
        });
        this.registerAction({
          id: "update-deal",
          name: "Update Deal",
          description: "Update a deal in HubSpot",
          inputSchema: UpdateDealInput,
          outputSchema: DealSchema,
          execute: async (input, context) => {
            return this.updateDeal(input, context);
          }
        });
      }
      // ============================================
      // Action Implementations
      // ============================================
      async searchContacts(input, context) {
        const response = await this.apiRequest(
          context,
          "POST",
          "/crm/v3/objects/contacts/search",
          {
            filterGroups: input.email ? [
              {
                filters: [
                  { propertyName: "email", operator: "EQ", value: input.email }
                ]
              }
            ] : [],
            query: input.query,
            limit: input.limit ?? 10
          }
        );
        if (!response.success) return response;
        const contacts = response.data.results.map(
          (c) => {
            const contact = c;
            return {
              id: contact.id,
              ...contact.properties
            };
          }
        );
        return { success: true, data: contacts };
      }
      async getDeal(input, context) {
        return this.apiRequest(
          context,
          "GET",
          `/crm/v3/objects/deals/${input.dealId}`
        );
      }
      async searchDeals(input, context) {
        const filters = [];
        if (input.stage) {
          filters.push({
            propertyName: "dealstage",
            operator: "EQ",
            value: input.stage
          });
        }
        if (input.ownerId) {
          filters.push({
            propertyName: "hubspot_owner_id",
            operator: "EQ",
            value: input.ownerId
          });
        }
        const response = await this.apiRequest(
          context,
          "POST",
          "/crm/v3/objects/deals/search",
          {
            filterGroups: filters.length > 0 ? [{ filters }] : [],
            limit: input.limit ?? 10
          }
        );
        if (!response.success) return response;
        const deals = response.data.results.map(
          (d) => {
            const deal = d;
            return {
              id: deal.id,
              ...deal.properties
            };
          }
        );
        return { success: true, data: deals };
      }
      async createContact(input, context) {
        return this.apiRequest(context, "POST", "/crm/v3/objects/contacts", {
          properties: input
        });
      }
      async updateDeal(input, context) {
        return this.apiRequest(
          context,
          "PATCH",
          `/crm/v3/objects/deals/${input.dealId}`,
          { properties: input.properties }
        );
      }
      // ============================================
      // OAuth Methods
      // ============================================
      async testConnection(context) {
        const result = await this.apiRequest(context, "GET", "/crm/v3/objects/contacts?limit=1");
        return { success: result.success, data: result.success };
      }
      getOAuthUrl(state, redirectUri) {
        const params = new URLSearchParams({
          client_id: process.env.HUBSPOT_CLIENT_ID ?? "",
          redirect_uri: redirectUri,
          scope: this.requiredScopes.join(" "),
          state
        });
        return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
      }
      async exchangeOAuthCode(code, redirectUri) {
        const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: process.env.HUBSPOT_CLIENT_ID ?? "",
            client_secret: process.env.HUBSPOT_CLIENT_SECRET ?? "",
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
        const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: process.env.HUBSPOT_CLIENT_ID ?? "",
            client_secret: process.env.HUBSPOT_CLIENT_SECRET ?? "",
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
            refreshToken: data.refresh_token,
            expiresAt: new Date(Date.now() + data.expires_in * 1e3)
          }
        };
      }
      // ============================================
      // API Helper
      // ============================================
      async apiRequest(context, method, path, body) {
        const url = `https://api.hubapi.com${path}`;
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
  }
});

// src/connectors/slack.ts
var slack_exports = {};
__export(slack_exports, {
  SlackConnector: () => SlackConnector
});
var import_zod3, ChannelSchema, MessageSchema, SendMessageInput, ListChannelsInput, GetChannelHistoryInput, SlackConnector;
var init_slack = __esm({
  "src/connectors/slack.ts"() {
    "use strict";
    import_zod3 = require("zod");
    init_base();
    ChannelSchema = import_zod3.z.object({
      id: import_zod3.z.string(),
      name: import_zod3.z.string(),
      is_private: import_zod3.z.boolean(),
      is_member: import_zod3.z.boolean()
    });
    MessageSchema = import_zod3.z.object({
      ts: import_zod3.z.string(),
      text: import_zod3.z.string(),
      user: import_zod3.z.string().optional(),
      channel: import_zod3.z.string()
    });
    SendMessageInput = import_zod3.z.object({
      channel: import_zod3.z.string(),
      text: import_zod3.z.string(),
      thread_ts: import_zod3.z.string().optional()
    });
    ListChannelsInput = import_zod3.z.object({
      types: import_zod3.z.enum(["public", "private", "all"]).optional(),
      limit: import_zod3.z.number().optional()
    });
    GetChannelHistoryInput = import_zod3.z.object({
      channel: import_zod3.z.string(),
      limit: import_zod3.z.number().optional()
    });
    SlackConnector = class extends BaseConnector {
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
          outputSchema: import_zod3.z.array(ChannelSchema),
          execute: async (input, context) => {
            return this.listChannels(input, context);
          }
        });
        this.registerAction({
          id: "get-channel-history",
          name: "Get Channel History",
          description: "Get recent messages from a channel",
          inputSchema: GetChannelHistoryInput,
          outputSchema: import_zod3.z.array(MessageSchema),
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
        const inputTypes = input.types ?? "public";
        const types = inputTypes === "all" ? "public_channel,private_channel" : inputTypes === "private" ? "private_channel" : "public_channel";
        const response = await this.apiRequest(
          context,
          "GET",
          `/conversations.list?types=${types}&limit=${input.limit ?? 100}&exclude_archived=true`
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
          `/conversations.history?channel=${input.channel}&limit=${input.limit ?? 100}`
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
  }
});

// src/connectors/calendar.ts
var calendar_exports = {};
__export(calendar_exports, {
  CalendarConnector: () => CalendarConnector
});
var import_zod4, EventSchema, CreateEventInput, ListEventsInput, GetFreeBusyInput, UpdateEventInput, DeleteEventInput, CalendarConnector;
var init_calendar = __esm({
  "src/connectors/calendar.ts"() {
    "use strict";
    import_zod4 = require("zod");
    init_base();
    EventSchema = import_zod4.z.object({
      id: import_zod4.z.string(),
      summary: import_zod4.z.string().optional(),
      description: import_zod4.z.string().optional(),
      start: import_zod4.z.object({
        dateTime: import_zod4.z.string().optional(),
        date: import_zod4.z.string().optional(),
        timeZone: import_zod4.z.string().optional()
      }),
      end: import_zod4.z.object({
        dateTime: import_zod4.z.string().optional(),
        date: import_zod4.z.string().optional(),
        timeZone: import_zod4.z.string().optional()
      }),
      attendees: import_zod4.z.array(
        import_zod4.z.object({
          email: import_zod4.z.string(),
          responseStatus: import_zod4.z.string().optional()
        })
      ).optional(),
      htmlLink: import_zod4.z.string().optional()
    });
    CreateEventInput = import_zod4.z.object({
      calendarId: import_zod4.z.string().optional(),
      summary: import_zod4.z.string(),
      description: import_zod4.z.string().optional(),
      startDateTime: import_zod4.z.string(),
      endDateTime: import_zod4.z.string(),
      timeZone: import_zod4.z.string().optional(),
      attendees: import_zod4.z.array(import_zod4.z.string().email()).optional(),
      sendUpdates: import_zod4.z.enum(["all", "externalOnly", "none"]).optional()
    });
    ListEventsInput = import_zod4.z.object({
      calendarId: import_zod4.z.string().optional(),
      timeMin: import_zod4.z.string().optional(),
      timeMax: import_zod4.z.string().optional(),
      maxResults: import_zod4.z.number().optional(),
      singleEvents: import_zod4.z.boolean().optional(),
      orderBy: import_zod4.z.enum(["startTime", "updated"]).optional()
    });
    GetFreeBusyInput = import_zod4.z.object({
      calendarIds: import_zod4.z.array(import_zod4.z.string()),
      timeMin: import_zod4.z.string(),
      timeMax: import_zod4.z.string()
    });
    UpdateEventInput = import_zod4.z.object({
      calendarId: import_zod4.z.string().optional(),
      eventId: import_zod4.z.string(),
      summary: import_zod4.z.string().optional(),
      description: import_zod4.z.string().optional(),
      startDateTime: import_zod4.z.string().optional(),
      endDateTime: import_zod4.z.string().optional()
    });
    DeleteEventInput = import_zod4.z.object({
      calendarId: import_zod4.z.string().optional(),
      eventId: import_zod4.z.string(),
      sendUpdates: import_zod4.z.enum(["all", "externalOnly", "none"]).optional()
    });
    CalendarConnector = class extends BaseConnector {
      id = "google-calendar";
      name = "Google Calendar";
      description = "Google calendar and scheduling";
      category = "CALENDAR";
      icon = "logos:google-calendar";
      pipedreamAppSlug = "google_calendar";
      requiredScopes = [
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events"
      ];
      optionalScopes = [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.freebusy"
      ];
      constructor() {
        super();
        this.registerActions();
      }
      registerActions() {
        this.registerAction({
          id: "create-event",
          name: "Create Event",
          description: "Create a calendar event",
          inputSchema: CreateEventInput,
          outputSchema: EventSchema,
          execute: async (input, context) => {
            return this.createEvent(input, context);
          }
        });
        this.registerAction({
          id: "list-events",
          name: "List Events",
          description: "List calendar events",
          inputSchema: ListEventsInput,
          outputSchema: import_zod4.z.array(EventSchema),
          execute: async (input, context) => {
            return this.listEvents(input, context);
          }
        });
        this.registerAction({
          id: "get-freebusy",
          name: "Get Free/Busy",
          description: "Check availability for calendars",
          inputSchema: GetFreeBusyInput,
          outputSchema: import_zod4.z.record(
            import_zod4.z.array(import_zod4.z.object({ start: import_zod4.z.string(), end: import_zod4.z.string() }))
          ),
          execute: async (input, context) => {
            return this.getFreeBusy(input, context);
          }
        });
        this.registerAction({
          id: "update-event",
          name: "Update Event",
          description: "Update a calendar event",
          inputSchema: UpdateEventInput,
          outputSchema: EventSchema,
          execute: async (input, context) => {
            return this.updateEvent(input, context);
          }
        });
        this.registerAction({
          id: "delete-event",
          name: "Delete Event",
          description: "Delete a calendar event",
          inputSchema: DeleteEventInput,
          outputSchema: import_zod4.z.object({ success: import_zod4.z.boolean() }),
          execute: async (input, context) => {
            return this.deleteEvent(input, context);
          }
        });
      }
      // ============================================
      // Action Implementations
      // ============================================
      async createEvent(input, context) {
        const event = {
          summary: input.summary,
          description: input.description,
          start: {
            dateTime: input.startDateTime,
            timeZone: input.timeZone ?? "UTC"
          },
          end: {
            dateTime: input.endDateTime,
            timeZone: input.timeZone ?? "UTC"
          },
          attendees: input.attendees?.map((email) => ({ email }))
        };
        const response = await this.apiRequest(
          context,
          "POST",
          `/calendar/v3/calendars/${encodeURIComponent(input.calendarId ?? "primary")}/events?sendUpdates=${input.sendUpdates ?? "all"}`,
          event
        );
        return response;
      }
      async listEvents(input, context) {
        const params = new URLSearchParams({
          maxResults: String(input.maxResults ?? 10),
          singleEvents: String(input.singleEvents ?? true),
          orderBy: input.orderBy ?? "startTime"
        });
        if (input.timeMin) params.set("timeMin", input.timeMin);
        if (input.timeMax) params.set("timeMax", input.timeMax);
        const response = await this.apiRequest(
          context,
          "GET",
          `/calendar/v3/calendars/${encodeURIComponent(input.calendarId ?? "primary")}/events?${params.toString()}`
        );
        if (!response.success) {
          return response;
        }
        return { success: true, data: response.data?.items ?? [] };
      }
      async getFreeBusy(input, context) {
        const response = await this.apiRequest(context, "POST", "/calendar/v3/freeBusy", {
          timeMin: input.timeMin,
          timeMax: input.timeMax,
          items: input.calendarIds.map((id) => ({ id }))
        });
        if (!response.success || !response.data?.calendars) {
          return response;
        }
        const result = {};
        for (const [calId, data] of Object.entries(response.data.calendars)) {
          result[calId] = data.busy;
        }
        return { success: true, data: result };
      }
      async updateEvent(input, context) {
        const updates = {};
        if (input.summary) updates.summary = input.summary;
        if (input.description) updates.description = input.description;
        if (input.startDateTime) updates.start = { dateTime: input.startDateTime };
        if (input.endDateTime) updates.end = { dateTime: input.endDateTime };
        const response = await this.apiRequest(
          context,
          "PATCH",
          `/calendar/v3/calendars/${encodeURIComponent(input.calendarId ?? "primary")}/events/${input.eventId}`,
          updates
        );
        return response;
      }
      async deleteEvent(input, context) {
        const response = await this.apiRequest(
          context,
          "DELETE",
          `/calendar/v3/calendars/${encodeURIComponent(input.calendarId ?? "primary")}/events/${input.eventId}?sendUpdates=${input.sendUpdates ?? "all"}`
        );
        return { success: response.success, data: { success: response.success } };
      }
      // ============================================
      // OAuth Methods
      // ============================================
      async testConnection(context) {
        const result = await this.apiRequest(
          context,
          "GET",
          "/calendar/v3/users/me/calendarList?maxResults=1"
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
      // API Helper
      // ============================================
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
        if (method === "DELETE") {
          return { success: true, data: void 0 };
        }
        const data = await response.json();
        return { success: true, data };
      }
    };
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  BaseConnector: () => BaseConnector,
  CalendarConnector: () => CalendarConnector,
  ComposioClient: () => ComposioClient,
  ConnectorRegistry: () => ConnectorRegistry,
  GmailConnector: () => GmailConnector,
  HubSpotConnector: () => HubSpotConnector,
  PipedreamClient: () => PipedreamClient,
  SlackConnector: () => SlackConnector,
  getComposio: () => getComposio,
  getConnectorRegistry: () => getConnectorRegistry,
  initComposio: () => initComposio,
  initConnectorRegistry: () => initConnectorRegistry
});
module.exports = __toCommonJS(index_exports);
init_base();

// src/composio.ts
var import_composio_core = require("composio-core");
var import_types2 = require("@nodebase/types");
var ComposioClient = class {
  client;
  config;
  constructor(config) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl ?? "https://backend.composio.dev"
    };
    this.client = new import_composio_core.Composio({ apiKey: this.config.apiKey });
  }
  /**
   * Get all available apps.
   */
  async getApps() {
    try {
      const apps = await this.client.apps.list();
      return apps.items || apps || [];
    } catch (error) {
      throw new import_types2.ConnectorError(
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
      throw new import_types2.ConnectorError(
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
      throw new import_types2.ConnectorError(
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
      throw new import_types2.ConnectorError(
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
      throw new import_types2.ConnectorError(
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
      throw new import_types2.ConnectorError(
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
  async executeAction(userId, toolCall) {
    try {
      const actionsApi = this.client.actions || this.client.tools;
      if (!actionsApi?.execute) {
        throw new Error("Execute API not available in this version of Composio SDK");
      }
      const result = await actionsApi.execute({
        entityId: userId,
        actionName: toolCall.name,
        input: toolCall.input
      });
      return result;
    } catch (error) {
      throw new import_types2.ConnectorError(
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
      throw new import_types2.ConnectorError(
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
    throw new import_types2.ConnectorError(
      "composio",
      "init",
      "Composio client not initialized. Call initComposio() first."
    );
  }
  return _composioClient;
}

// src/pipedream.ts
var import_types3 = require("@nodebase/types");
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
      throw new import_types3.ConnectorError(
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
  Promise.resolve().then(() => (init_gmail(), gmail_exports)).then(({ GmailConnector: GmailConnector2 }) => {
    registry.register(new GmailConnector2());
  });
  Promise.resolve().then(() => (init_hubspot(), hubspot_exports)).then(({ HubSpotConnector: HubSpotConnector2 }) => {
    registry.register(new HubSpotConnector2());
  });
  Promise.resolve().then(() => (init_slack(), slack_exports)).then(({ SlackConnector: SlackConnector2 }) => {
    registry.register(new SlackConnector2());
  });
  Promise.resolve().then(() => (init_calendar(), calendar_exports)).then(({ CalendarConnector: CalendarConnector2 }) => {
    registry.register(new CalendarConnector2());
  });
  return registry;
}

// src/index.ts
init_hubspot();
init_gmail();
init_slack();
init_calendar();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
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
});
