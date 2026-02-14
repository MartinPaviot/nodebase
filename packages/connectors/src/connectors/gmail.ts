/**
 * Gmail Connector
 *
 * Email connector for Gmail API.
 */

import { z } from "zod";
import { BaseConnector, type ConnectorContext, type ActionResult } from "../base";

// ============================================
// Schemas
// ============================================

const EmailSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  subject: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  date: z.string().optional(),
  snippet: z.string().optional(),
  body: z.string().optional(),
});

const SendEmailInput = z.object({
  to: z.string().email(),
  subject: z.string(),
  body: z.string(),
  html: z.boolean().optional(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
});

const SearchEmailsInput = z.object({
  query: z.string().optional(),
  from: z.string().optional(),
  subject: z.string().optional(),
  after: z.string().optional(),
  before: z.string().optional(),
  limit: z.number().optional(),
});

const GetEmailInput = z.object({
  emailId: z.string(),
});

const ReplyEmailInput = z.object({
  threadId: z.string(),
  body: z.string(),
  html: z.boolean().optional(),
});

// Cold Email Outreach Schemas

const SendColdEmailInput = z.object({
  to: z.string().email(),
  subject: z.string(),
  body: z.string(),
  unsubscribeUrl: z.string().url(),
  replyToMessageId: z.string().optional(),
});

const SendColdEmailOutput = z.object({
  id: z.string(),
  threadId: z.string(),
});

const SearchRepliesInput = z.object({
  threadId: z.string(),
  afterDate: z.string().optional(),
});

const ReplyMessage = z.object({
  messageId: z.string(),
  from: z.string(),
  date: z.string(),
  subject: z.string(),
  body: z.string(),
  snippet: z.string(),
});

const SearchRepliesOutput = z.array(ReplyMessage);

const SearchBouncesInput = z.object({
  afterDate: z.string(),
});

const BounceTypeEnum = z.enum([
  "hard_bounce",
  "soft_bounce",
  "mailbox_full",
  "unknown",
]);

const BounceMessage = z.object({
  messageId: z.string(),
  date: z.string(),
  bounceType: BounceTypeEnum,
  originalTo: z.string(),
  originalSubject: z.string(),
  snippet: z.string(),
});

const SearchBouncesOutput = z.array(BounceMessage);

// ============================================
// Connector Implementation
// ============================================

export class GmailConnector extends BaseConnector {
  readonly id = "gmail";
  readonly name = "Gmail";
  readonly description = "Google email service";
  readonly category = "EMAIL" as const;
  readonly icon = "logos:google-gmail";
  readonly pipedreamAppSlug = "gmail";

  readonly requiredScopes = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
  ];

  readonly optionalScopes = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.labels",
  ];

  constructor() {
    super();
    this.registerActions();
  }

  private registerActions(): void {
    // Send Email
    this.registerAction({
      id: "send-email",
      name: "Send Email",
      description: "Send an email",
      inputSchema: SendEmailInput,
      outputSchema: z.object({ id: z.string(), threadId: z.string() }),
      execute: async (input, context) => {
        return this.sendEmail(input, context);
      },
    });

    // Search Emails
    this.registerAction({
      id: "search-emails",
      name: "Search Emails",
      description: "Search for emails",
      inputSchema: SearchEmailsInput,
      outputSchema: z.array(EmailSchema),
      execute: async (input, context) => {
        return this.searchEmails(input, context);
      },
    });

    // Get Email
    this.registerAction({
      id: "get-email",
      name: "Get Email",
      description: "Get an email by ID",
      inputSchema: GetEmailInput,
      outputSchema: EmailSchema,
      execute: async (input, context) => {
        return this.getEmail(input, context);
      },
    });

    // Reply to Email
    this.registerAction({
      id: "reply-email",
      name: "Reply to Email",
      description: "Reply to an email thread",
      inputSchema: ReplyEmailInput,
      outputSchema: z.object({ id: z.string(), threadId: z.string() }),
      execute: async (input, context) => {
        return this.replyEmail(input, context);
      },
    });

    // Send Cold Email (with RFC 8058 unsubscribe headers)
    this.registerAction({
      id: "send-cold-email",
      name: "Send Cold Email",
      description:
        "Send a cold outreach email with RFC 8058 one-click unsubscribe headers. Supports follow-ups in the same thread via replyToMessageId.",
      inputSchema: SendColdEmailInput,
      outputSchema: SendColdEmailOutput,
      execute: async (input, context) => {
        return this.sendColdEmail(input, context);
      },
    });

    // Search Replies (find lead replies in a thread)
    this.registerAction({
      id: "search-replies",
      name: "Search Replies",
      description:
        "Search for replies from leads in a specific Gmail thread. Returns only messages NOT sent by the authenticated user.",
      inputSchema: SearchRepliesInput,
      outputSchema: SearchRepliesOutput,
      execute: async (input, context) => {
        return this.searchReplies(input, context);
      },
    });

    // Search Bounces (detect bounced emails)
    this.registerAction({
      id: "search-bounces",
      name: "Search Bounces",
      description:
        "Detect bounced emails by searching for mailer-daemon and postmaster messages. Classifies bounces as hard, soft, mailbox full, or unknown.",
      inputSchema: SearchBouncesInput,
      outputSchema: SearchBouncesOutput,
      execute: async (input, context) => {
        return this.searchBounces(input, context);
      },
    });
  }

  // ============================================
  // Action Implementations
  // ============================================

  private async sendEmail(
    input: z.infer<typeof SendEmailInput>,
    context: ConnectorContext
  ): Promise<ActionResult<{ id: string; threadId: string }>> {
    const email = this.createMimeMessage({
      to: input.to,
      subject: input.subject,
      body: input.body,
      html: input.html ?? false,
      cc: input.cc,
      bcc: input.bcc,
    });

    const response = await this.apiRequest<{ id: string; threadId: string }>(
      context,
      "POST",
      "/gmail/v1/users/me/messages/send",
      { raw: email }
    );

    return response;
  }

  private async searchEmails(
    input: z.infer<typeof SearchEmailsInput>,
    context: ConnectorContext
  ): Promise<ActionResult<z.infer<typeof EmailSchema>[]>> {
    const queryParts: string[] = [];
    if (input.query) queryParts.push(input.query);
    if (input.from) queryParts.push(`from:${input.from}`);
    if (input.subject) queryParts.push(`subject:${input.subject}`);
    if (input.after) queryParts.push(`after:${input.after}`);
    if (input.before) queryParts.push(`before:${input.before}`);

    const query = queryParts.join(" ");
    const url = `/gmail/v1/users/me/messages?maxResults=${input.limit ?? 10}${query ? `&q=${encodeURIComponent(query)}` : ""}`;

    const listResponse = await this.apiRequest<{
      messages?: { id: string; threadId: string }[];
    }>(context, "GET", url);

    if (!listResponse.success || !listResponse.data?.messages) {
      return { success: true, data: [] };
    }

    // Fetch full message details
    const emails = await Promise.all(
      listResponse.data.messages.slice(0, input.limit).map(async (msg) => {
        const detail = await this.getEmail({ emailId: msg.id }, context);
        return detail.success ? detail.data : null;
      })
    );

    return {
      success: true,
      data: emails.filter((e): e is z.infer<typeof EmailSchema> => e !== null),
    };
  }

  private async getEmail(
    input: z.infer<typeof GetEmailInput>,
    context: ConnectorContext
  ): Promise<ActionResult<z.infer<typeof EmailSchema>>> {
    const response = await this.apiRequest<{
      id: string;
      threadId: string;
      snippet: string;
      payload: {
        headers: { name: string; value: string }[];
        body?: { data?: string };
        parts?: { body?: { data?: string } }[];
      };
    }>(context, "GET", `/gmail/v1/users/me/messages/${input.emailId}`);

    if (!response.success || !response.data) {
      return response as ActionResult<z.infer<typeof EmailSchema>>;
    }

    const msg = response.data;
    const getHeader = (name: string) =>
      msg.payload.headers.find(
        (h) => h.name.toLowerCase() === name.toLowerCase()
      )?.value;

    // Decode body
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
        body,
      },
    };
  }

  private async replyEmail(
    input: z.infer<typeof ReplyEmailInput>,
    context: ConnectorContext
  ): Promise<ActionResult<{ id: string; threadId: string }>> {
    // Get original thread to find headers
    const threadResponse = await this.apiRequest<{
      messages: { id: string; payload: { headers: { name: string; value: string }[] } }[];
    }>(context, "GET", `/gmail/v1/users/me/threads/${input.threadId}`);

    if (!threadResponse.success || !threadResponse.data?.messages?.length) {
      return { success: false, error: "Thread not found" };
    }

    const lastMessage = threadResponse.data.messages[threadResponse.data.messages.length - 1];
    const getHeader = (name: string) =>
      lastMessage.payload.headers.find(
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
      references: messageId,
    });

    const response = await this.apiRequest<{ id: string; threadId: string }>(
      context,
      "POST",
      "/gmail/v1/users/me/messages/send",
      { raw: email, threadId: input.threadId }
    );

    return response;
  }

  private async sendColdEmail(
    input: z.infer<typeof SendColdEmailInput>,
    context: ConnectorContext
  ): Promise<ActionResult<z.infer<typeof SendColdEmailOutput>>> {
    // Extract domain from the unsubscribe URL for the mailto fallback
    const unsubscribeDomain = new URL(input.unsubscribeUrl).hostname;

    const mimeOptions: Parameters<GmailConnector["createMimeMessage"]>[0] = {
      to: input.to,
      subject: input.subject,
      body: input.body,
      html: true,
      listUnsubscribe: `<mailto:unsubscribe@${unsubscribeDomain}>, <${input.unsubscribeUrl}>`,
      listUnsubscribePost: "List-Unsubscribe=One-Click",
    };

    // If this is a follow-up in an existing thread, add threading headers
    if (input.replyToMessageId) {
      mimeOptions.inReplyTo = input.replyToMessageId;
      mimeOptions.references = input.replyToMessageId;
    }

    const email = this.createMimeMessage(mimeOptions);

    const response = await this.apiRequest<{ id: string; threadId: string }>(
      context,
      "POST",
      "/gmail/v1/users/me/messages/send",
      { raw: email }
    );

    return response;
  }

  private async searchReplies(
    input: z.infer<typeof SearchRepliesInput>,
    context: ConnectorContext
  ): Promise<ActionResult<z.infer<typeof SearchRepliesOutput>>> {
    // First, get the authenticated user's email address
    const profileResponse = await this.apiRequest<{ emailAddress: string }>(
      context,
      "GET",
      "/gmail/v1/users/me/profile"
    );

    if (!profileResponse.success || !profileResponse.data) {
      return { success: false, error: "Failed to retrieve user profile" };
    }

    const userEmail = profileResponse.data.emailAddress.toLowerCase();

    // Get all messages in the thread
    const threadResponse = await this.apiRequest<{
      messages: {
        id: string;
        internalDate: string;
        snippet: string;
        payload: {
          headers: { name: string; value: string }[];
          body?: { data?: string };
          parts?: { body?: { data?: string } }[];
        };
      }[];
    }>(context, "GET", `/gmail/v1/users/me/threads/${input.threadId}?format=full`);

    if (!threadResponse.success || !threadResponse.data?.messages) {
      return { success: false, error: "Thread not found" };
    }

    const afterTimestamp = input.afterDate
      ? new Date(input.afterDate).getTime()
      : 0;

    const replies: z.infer<typeof ReplyMessage>[] = [];

    for (const msg of threadResponse.data.messages) {
      const getHeader = (name: string) =>
        msg.payload.headers.find(
          (h) => h.name.toLowerCase() === name.toLowerCase()
        )?.value ?? "";

      const fromHeader = getHeader("From").toLowerCase();

      // Skip messages from the authenticated user
      if (fromHeader.includes(userEmail)) {
        continue;
      }

      // Filter by afterDate if provided
      const messageTimestamp = parseInt(msg.internalDate, 10);
      if (messageTimestamp < afterTimestamp) {
        continue;
      }

      // Decode body
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
        snippet: msg.snippet,
      });
    }

    return { success: true, data: replies };
  }

  private async searchBounces(
    input: z.infer<typeof SearchBouncesInput>,
    context: ConnectorContext
  ): Promise<ActionResult<z.infer<typeof SearchBouncesOutput>>> {
    const query = `from:mailer-daemon OR from:postmaster after:${input.afterDate}`;
    const url = `/gmail/v1/users/me/messages?maxResults=50&q=${encodeURIComponent(query)}`;

    const listResponse = await this.apiRequest<{
      messages?: { id: string; threadId: string }[];
    }>(context, "GET", url);

    if (!listResponse.success || !listResponse.data?.messages) {
      return { success: true, data: [] };
    }

    const bounces: z.infer<typeof BounceMessage>[] = [];

    for (const msg of listResponse.data.messages) {
      const detail = await this.apiRequest<{
        id: string;
        snippet: string;
        payload: {
          headers: { name: string; value: string }[];
          body?: { data?: string };
          parts?: { body?: { data?: string } }[];
        };
      }>(context, "GET", `/gmail/v1/users/me/messages/${msg.id}?format=full`);

      if (!detail.success || !detail.data) {
        continue;
      }

      const message = detail.data;
      const getHeader = (name: string) =>
        message.payload.headers.find(
          (h) => h.name.toLowerCase() === name.toLowerCase()
        )?.value ?? "";

      // Decode body for bounce type detection
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

      // Try to extract original recipient from the bounce body/headers
      const originalTo = this.extractOriginalRecipient(body, getHeader("To"));
      const originalSubject = this.extractOriginalSubject(subject, body);

      bounces.push({
        messageId: message.id,
        date: getHeader("Date"),
        bounceType,
        originalTo,
        originalSubject,
        snippet: message.snippet,
      });
    }

    return { success: true, data: bounces };
  }

  // ============================================
  // OAuth Methods
  // ============================================

  async testConnection(context: ConnectorContext): Promise<ActionResult<boolean>> {
    const result = await this.apiRequest(
      context,
      "GET",
      "/gmail/v1/users/me/profile"
    );
    return { success: result.success, data: result.success };
  }

  getOAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: this.requiredScopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeOAuthCode(
    code: string,
    redirectUri: string
  ): Promise<ActionResult<{ accessToken: string; refreshToken?: string; expiresAt?: Date }>> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!response.ok) {
      return { success: false, error: "Failed to exchange OAuth code" };
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    return {
      success: true,
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      },
    };
  }

  async refreshAccessToken(
    refreshToken: string
  ): Promise<ActionResult<{ accessToken: string; refreshToken?: string; expiresAt?: Date }>> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      return { success: false, error: "Failed to refresh token" };
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    return {
      success: true,
      data: {
        accessToken: data.access_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      },
    };
  }

  // ============================================
  // Helpers
  // ============================================

  private createMimeMessage(options: {
    to: string;
    subject: string;
    body: string;
    html?: boolean;
    cc?: string;
    bcc?: string;
    inReplyTo?: string;
    references?: string;
    listUnsubscribe?: string;
    listUnsubscribePost?: string;
  }): string {
    const lines = [
      `To: ${options.to}`,
      `Subject: ${options.subject}`,
      `Content-Type: ${options.html ? "text/html" : "text/plain"}; charset=utf-8`,
    ];

    if (options.cc) lines.push(`Cc: ${options.cc}`);
    if (options.bcc) lines.push(`Bcc: ${options.bcc}`);
    if (options.inReplyTo) lines.push(`In-Reply-To: ${options.inReplyTo}`);
    if (options.references) lines.push(`References: ${options.references}`);
    if (options.listUnsubscribe) lines.push(`List-Unsubscribe: ${options.listUnsubscribe}`);
    if (options.listUnsubscribePost) lines.push(`List-Unsubscribe-Post: ${options.listUnsubscribePost}`);

    lines.push("", options.body);

    const message = lines.join("\r\n");
    return Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  private detectBounceType(
    subject: string,
    body: string
  ): z.infer<typeof BounceTypeEnum> {
    const combined = `${subject} ${body}`.toLowerCase();

    // Hard bounce patterns — permanent delivery failures
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
      "delivery status notification (failure)",
    ];

    // Soft bounce patterns — temporary delivery failures
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
      "delivery status notification (delay)",
    ];

    // Mailbox full patterns
    const mailboxFullPatterns = [
      "mailbox full",
      "mailbox is full",
      "over quota",
      "quota exceeded",
      "storage limit",
      "insufficient storage",
      "552 5.2.2",
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

  private extractOriginalRecipient(body: string, toHeader: string): string {
    // Try to find the original recipient from common bounce body patterns
    // Pattern: "Original-Recipient: rfc822;user@example.com"
    const originalRecipientMatch = body.match(
      /Original-Recipient:\s*rfc822;\s*([^\s<>\r\n]+)/i
    );
    if (originalRecipientMatch) {
      return originalRecipientMatch[1];
    }

    // Pattern: "Final-Recipient: rfc822;user@example.com"
    const finalRecipientMatch = body.match(
      /Final-Recipient:\s*rfc822;\s*([^\s<>\r\n]+)/i
    );
    if (finalRecipientMatch) {
      return finalRecipientMatch[1];
    }

    // Pattern: plain email in "was not delivered to" or "could not be delivered to"
    const deliveredToMatch = body.match(
      /(?:not delivered to|could not be delivered to|delivery to)\s+([^\s<>\r\n]+@[^\s<>\r\n]+)/i
    );
    if (deliveredToMatch) {
      return deliveredToMatch[1];
    }

    // Pattern: email in angle brackets "<user@example.com>"
    const angleBracketMatch = body.match(
      /(?:address|recipient)[:\s]*<([^>]+@[^>]+)>/i
    );
    if (angleBracketMatch) {
      return angleBracketMatch[1];
    }

    // Fallback to the To header of the bounce notification
    return toHeader;
  }

  private extractOriginalSubject(bounceSubject: string, body: string): string {
    // Try to extract the original subject from common bounce patterns
    // Pattern: "Subject: Original Subject Line" inside the bounce body
    const subjectMatch = body.match(
      /(?:^|\n)Subject:\s*(.+?)(?:\r?\n(?!\s))/im
    );
    if (subjectMatch) {
      return subjectMatch[1].trim();
    }

    // Strip common bounce prefixes to recover the original subject
    const prefixes = [
      "Delivery Status Notification (Failure)",
      "Delivery Status Notification (Delay)",
      "Delivery Status Notification",
      "Undeliverable:",
      "Undelivered Mail Returned to Sender",
      "Mail delivery failed:",
      "Returned mail:",
      "Failure Notice:",
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

  private async apiRequest<T>(
    context: ConnectorContext,
    method: string,
    path: string,
    body?: unknown
  ): Promise<ActionResult<T>> {
    const url = `https://www.googleapis.com${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    const data = (await response.json()) as T;
    return { success: true, data };
  }
}
