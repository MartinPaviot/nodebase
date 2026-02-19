/**
 * Integration Executors
 *
 * Wires flow graph nodes to REAL integration functions.
 * Each executor checks if the integration is connected, then dispatches
 * to the actual function from lib/integrations/.
 *
 * Side-effect actions are wrapped with EvalEngine via withEvaluation().
 */

import {
  sendEmail,
  listEmails,
  searchEmails,
  createGmailDraft,
  listEvents,
  createEvent,
  readSheet,
  appendToSheet,
  updateSheet,
  createSpreadsheet,
  listDriveFiles,
  getDriveFile,
  uploadDriveFile,
  deleteDriveFile,
  createDoc,
  getDoc,
  appendToDoc,
  hasIntegration,
} from "@/lib/integrations/google";
import {
  sendSlackMessage,
  listSlackChannels,
  getSlackChannelHistory,
} from "@/lib/integrations/slack";
import {
  searchNotionPages,
  getNotionPage,
  createNotionPage,
  appendToNotionPage,
  listNotionDatabases,
  queryNotionDatabase,
} from "@/lib/integrations/notion";
import {
  sendOutlookEmail,
  getOutlookEmails,
  getOutlookCalendarEvents,
  createOutlookCalendarEvent,
  sendTeamsMessage,
} from "@/lib/integrations/microsoft";
import { withRetry } from "../retry";
import { withEvaluation } from "../eval-wrapper";
import type { NodeExecContext, NodeExecResult, NodeOutput } from "../types";
import { resolveVariables } from "../variable-resolver";

// ============================================
// HELPERS
// ============================================

function integrationOutput(
  service: string,
  action: string,
  success: boolean,
  data?: unknown,
): NodeOutput {
  return { kind: "integration", service, action, success, data };
}

function integrationError(service: string, message: string): NodeOutput {
  return { kind: "error", error: message, nodeType: service };
}

async function checkIntegration(
  userId: string,
  type: "GMAIL" | "GOOGLE_CALENDAR" | "GOOGLE_SHEETS" | "GOOGLE_DRIVE" | "GOOGLE_DOCS" | "SLACK" | "NOTION" | "OUTLOOK" | "OUTLOOK_CALENDAR" | "MICROSOFT_TEAMS",
  label: string,
): Promise<string | null> {
  const connected = await hasIntegration(userId, type);
  if (!connected) return `${label} integration not connected. Please connect it in Settings → Integrations.`;
  return null;
}

// ============================================
// FIELD MODE RESOLVER
// ============================================

/**
 * Resolve a field value based on its mode setting.
 * - "manual" (default): return the raw value as-is
 * - "auto": AI extracts the value from previous node outputs
 * - "prompt": AI generates the value using the user's prompt + context
 */
async function resolveFieldValue(
  fieldName: string,
  nodeData: Record<string, unknown> | undefined,
  ctx: NodeExecContext,
): Promise<string> {
  const raw = (nodeData?.[fieldName] as string) || "";
  const mode = (nodeData?.[`${fieldName}Mode`] as string) || "manual";

  // Resolve {{nodeId.field}} tokens in the raw value (works for all modes)
  const resolved = resolveVariables(raw, ctx.state.nodeOutputs);

  if (mode === "manual") return resolved;

  // Build context from previous node outputs
  const previousOutputs: Record<string, unknown> = {};
  for (const [id, output] of ctx.state.nodeOutputs.entries()) {
    previousOutputs[id] = output;
  }
  const contextStr = JSON.stringify(previousOutputs, null, 2);

  let prompt: string;
  if (mode === "auto") {
    prompt = `Based on the following workflow context, extract the most appropriate value for the email field "${fieldName}".

Context from previous steps:
${contextStr}

${ctx.state.userMessage ? `User message: ${ctx.state.userMessage}` : ""}

Return ONLY the value, nothing else. If no appropriate value can be found, return an empty string.`;
  } else {
    // "prompt" mode — user provided instructions in `resolved`
    prompt = `Based on the following workflow context, generate the email "${fieldName}" field.

User instructions: ${resolved || `Generate the ${fieldName} field`}

Context from previous steps:
${contextStr}

${ctx.state.userMessage ? `User message: ${ctx.state.userMessage}` : ""}

Return ONLY the generated value, nothing else.`;
  }

  const result = await ctx.claudeClient.chat({
    model: "fast",
    messages: [{ role: "user", content: prompt }],
    systemPrompt: "You are a helpful assistant that generates email content. Return ONLY the requested value with no explanation or formatting.",
    temperature: 0.3,
    maxSteps: 1,
    userId: ctx.userId,
  });

  return result.content.trim();
}

// ============================================
// GMAIL / SEND EMAIL
// ============================================

export async function executeGmailNode(ctx: NodeExecContext): Promise<NodeExecResult> {
  const { node, userId } = ctx;
  const action = (node.data?.action as string) || (node.data?.actionType as string) || (node.data?.actionId as string) || "send";

  const err = await checkIntegration(userId, "GMAIL", "Gmail");
  if (err) return { output: integrationError("gmail", err) };

  switch (action) {
    case "send":
    case "send_email": {
      const to = await resolveFieldValue("to", node.data, ctx);
      const subject = await resolveFieldValue("subject", node.data, ctx);
      const rawBody = await resolveFieldValue("body", node.data, ctx);
      const cc = await resolveFieldValue("cc", node.data, ctx);
      const bcc = await resolveFieldValue("bcc", node.data, ctx);
      const signature = (node.data?.signature as string) || "";
      const fromName = await resolveFieldValue("fromName", node.data, ctx);
      const body = signature ? `${rawBody}\n\n${signature}` : rawBody;
      if (!to || !subject) {
        return { output: integrationError("gmail", "Missing required email fields (to, subject)") };
      }
      return withEvaluation(
        "send_email",
        `To: ${to}\nSubject: ${subject}\n\n${body}`,
        ctx,
        async () => {
          const result = await withRetry(() =>
            sendEmail(userId, to, subject, body, {
              cc: cc || undefined,
              bcc: bcc || undefined,
              fromName: fromName || undefined,
            }),
          );
          return integrationOutput("gmail", "send_email", true, {
            messageId: result.data?.id,
            message: `Email sent to ${to}`,
          });
        },
        undefined,
        { to, subject, body, cc, bcc, fromName },
      );
    }
    case "list":
    case "list_emails": {
      const maxResults = (node.data?.maxResults as number) || 10;
      const query = node.data?.query as string;
      const result = await withRetry(() => listEmails(userId, maxResults, query));
      return { output: integrationOutput("gmail", "list_emails", true, result) };
    }
    case "search":
    case "search_emails": {
      const query = (node.data?.query as string) || "";
      const maxResults = (node.data?.maxResults as number) || 10;
      const result = await withRetry(() => searchEmails(userId, query, maxResults));
      return { output: integrationOutput("gmail", "search_emails", true, result) };
    }
    case "draft":
    case "draft_email":
    case "create_draft": {
      const to = await resolveFieldValue("to", node.data, ctx);
      const subject = await resolveFieldValue("subject", node.data, ctx);
      const rawBody = await resolveFieldValue("body", node.data, ctx);
      const cc = await resolveFieldValue("cc", node.data, ctx);
      const bcc = await resolveFieldValue("bcc", node.data, ctx);
      const signature = (node.data?.signature as string) || "";
      const fromName = await resolveFieldValue("fromName", node.data, ctx);
      const body = signature ? `${rawBody}\n\n${signature}` : rawBody;
      const result = await withRetry(() =>
        createGmailDraft(userId, to, subject, body, {
          cc: cc || undefined,
          bcc: bcc || undefined,
          fromName: fromName || undefined,
        }),
      );
      return { output: integrationOutput("gmail", "create_draft", true, result) };
    }
    default:
      return { output: integrationOutput("gmail", action, true, { note: "Unknown action, treated as passthrough" }) };
  }
}

// ============================================
// GOOGLE CALENDAR
// ============================================

export async function executeGoogleCalendarNode(ctx: NodeExecContext): Promise<NodeExecResult> {
  const { node, userId } = ctx;
  const action = (node.data?.action as string) || "list";

  const err = await checkIntegration(userId, "GOOGLE_CALENDAR", "Google Calendar");
  if (err) return { output: integrationError("googleCalendar", err) };

  switch (action) {
    case "list":
    case "list_events": {
      const timeMin = node.data?.timeMin ? new Date(node.data.timeMin as string) : undefined;
      const timeMax = node.data?.timeMax ? new Date(node.data.timeMax as string) : undefined;
      const result = await withRetry(() => listEvents(userId, timeMin, timeMax));
      return { output: integrationOutput("googleCalendar", "list_events", true, result) };
    }
    case "create":
    case "create_event": {
      const event = {
        summary: (node.data?.summary as string) || "",
        description: (node.data?.description as string) || "",
        start: new Date(node.data?.start as string),
        end: new Date(node.data?.end as string),
        attendees: (node.data?.attendees as string[]) || [],
      };
      return withEvaluation(
        "create_calendar_event",
        `Event: ${event.summary} (${event.start} - ${event.end})`,
        ctx,
        async () => {
          const result = await withRetry(() => createEvent(userId, event));
          return integrationOutput("googleCalendar", "create_event", true, result);
        },
        undefined,
        { summary: event.summary, start: event.start.toISOString(), end: event.end.toISOString(), attendees: event.attendees },
      );
    }
    default:
      return { output: integrationOutput("googleCalendar", action, true) };
  }
}

// ============================================
// GOOGLE SHEETS
// ============================================

export async function executeGoogleSheetsNode(ctx: NodeExecContext): Promise<NodeExecResult> {
  const { node, userId } = ctx;
  const action = (node.data?.action as string) || "read";

  const err = await checkIntegration(userId, "GOOGLE_SHEETS", "Google Sheets");
  if (err) return { output: integrationError("googleSheets", err) };

  const spreadsheetId = (node.data?.spreadsheetId as string) || "";
  const range = (node.data?.range as string) || "Sheet1";

  switch (action) {
    case "read":
    case "read_sheet": {
      const result = await withRetry(() => readSheet(userId, spreadsheetId, range));
      return { output: integrationOutput("googleSheets", "read", true, result) };
    }
    case "append":
    case "append_to_sheet": {
      const values = (node.data?.values as string[][]) || [];
      return withEvaluation(
        "append_to_sheet",
        `Append ${values.length} rows to ${spreadsheetId}`,
        ctx,
        async () => {
          const result = await withRetry(() => appendToSheet(userId, spreadsheetId, range, values));
          return integrationOutput("googleSheets", "append", true, result);
        },
        undefined,
        { spreadsheetId, range, values },
      );
    }
    case "update":
    case "update_sheet": {
      const values = (node.data?.values as string[][]) || [];
      return withEvaluation(
        "update_sheet",
        `Update ${range} in ${spreadsheetId}`,
        ctx,
        async () => {
          const result = await withRetry(() => updateSheet(userId, spreadsheetId, range, values));
          return integrationOutput("googleSheets", "update", true, result);
        },
        undefined,
        { spreadsheetId, range, values },
      );
    }
    case "create":
    case "create_spreadsheet": {
      const title = (node.data?.title as string) || "New Spreadsheet";
      return withEvaluation(
        "create_spreadsheet",
        `Create spreadsheet: ${title}`,
        ctx,
        async () => {
          const result = await withRetry(() => createSpreadsheet(userId, title));
          return integrationOutput("googleSheets", "create", true, result);
        },
        undefined,
        { title },
      );
    }
    default:
      return { output: integrationOutput("googleSheets", action, true) };
  }
}

// ============================================
// GOOGLE DRIVE
// ============================================

export async function executeGoogleDriveNode(ctx: NodeExecContext): Promise<NodeExecResult> {
  const { node, userId } = ctx;
  const action = (node.data?.action as string) || "list";

  const err = await checkIntegration(userId, "GOOGLE_DRIVE", "Google Drive");
  if (err) return { output: integrationError("googleDrive", err) };

  switch (action) {
    case "list":
    case "list_files": {
      const result = await withRetry(() => listDriveFiles(userId));
      return { output: integrationOutput("googleDrive", "list", true, result) };
    }
    case "get":
    case "get_file": {
      const fileId = (node.data?.fileId as string) || "";
      const result = await withRetry(() => getDriveFile(userId, fileId));
      return { output: integrationOutput("googleDrive", "get", true, result) };
    }
    case "upload":
    case "upload_file": {
      const name = (node.data?.fileName as string) || "file";
      const mimeType = (node.data?.mimeType as string) || "text/plain";
      const content = (node.data?.content as string) || "";
      return withEvaluation(
        "upload_drive_file",
        `Upload file: ${name}`,
        ctx,
        async () => {
          const result = await withRetry(() => uploadDriveFile(userId, name, mimeType, content));
          return integrationOutput("googleDrive", "upload", true, result);
        },
        undefined,
        { name, mimeType, content },
      );
    }
    case "delete":
    case "delete_file": {
      const fileId = (node.data?.fileId as string) || "";
      return withEvaluation(
        "delete_drive_file",
        `Delete file: ${fileId}`,
        ctx,
        async () => {
          await withRetry(() => deleteDriveFile(userId, fileId));
          return integrationOutput("googleDrive", "delete", true, { fileId });
        },
        undefined,
        { fileId },
      );
    }
    default:
      return { output: integrationOutput("googleDrive", action, true) };
  }
}

// ============================================
// GOOGLE DOCS
// ============================================

export async function executeGoogleDocsNode(ctx: NodeExecContext): Promise<NodeExecResult> {
  const { node, userId } = ctx;
  const action = (node.data?.action as string) || "get";

  const err = await checkIntegration(userId, "GOOGLE_DOCS", "Google Docs");
  if (err) return { output: integrationError("googleDocs", err) };

  switch (action) {
    case "create":
    case "create_doc": {
      const title = (node.data?.title as string) || "Untitled";
      return withEvaluation(
        "create_doc",
        `Create doc: ${title}`,
        ctx,
        async () => {
          const result = await withRetry(() => createDoc(userId, title));
          return integrationOutput("googleDocs", "create", true, result);
        },
        undefined,
        { title },
      );
    }
    case "get":
    case "get_doc": {
      const documentId = (node.data?.documentId as string) || "";
      const result = await withRetry(() => getDoc(userId, documentId));
      return { output: integrationOutput("googleDocs", "get", true, result) };
    }
    case "append":
    case "append_to_doc": {
      const documentId = (node.data?.documentId as string) || "";
      const text = (node.data?.text as string) || "";
      return withEvaluation(
        "append_to_doc",
        `Append to doc ${documentId}: ${text.slice(0, 100)}`,
        ctx,
        async () => {
          await withRetry(() => appendToDoc(userId, documentId, text));
          return integrationOutput("googleDocs", "append", true, { documentId });
        },
        undefined,
        { documentId, text },
      );
    }
    default:
      return { output: integrationOutput("googleDocs", action, true) };
  }
}

// ============================================
// SLACK
// ============================================

export async function executeSlackNode(ctx: NodeExecContext): Promise<NodeExecResult> {
  const { node, userId } = ctx;
  const action = (node.data?.action as string) || "send";

  const err = await checkIntegration(userId, "SLACK", "Slack");
  if (err) return { output: integrationError("slack", err) };

  switch (action) {
    case "send":
    case "send_message": {
      const channel = (node.data?.channel as string) || "";
      const text = (node.data?.text as string) || (node.data?.message as string) || "";
      return withEvaluation(
        "send_slack_message",
        `Slack to #${channel}: ${text.slice(0, 200)}`,
        ctx,
        async () => {
          const result = await withRetry(() => sendSlackMessage(userId, channel, text));
          return integrationOutput("slack", "send_message", true, result);
        },
        undefined,
        { channel, text },
      );
    }
    case "list_channels": {
      const result = await withRetry(() => listSlackChannels(userId));
      return { output: integrationOutput("slack", "list_channels", true, result) };
    }
    case "history":
    case "get_history": {
      const channel = (node.data?.channel as string) || "";
      const limit = (node.data?.limit as number) || 20;
      const result = await withRetry(() => getSlackChannelHistory(userId, channel, limit));
      return { output: integrationOutput("slack", "get_history", true, result) };
    }
    default:
      return { output: integrationOutput("slack", action, true) };
  }
}

// ============================================
// NOTION
// ============================================

export async function executeNotionNode(ctx: NodeExecContext): Promise<NodeExecResult> {
  const { node, userId } = ctx;
  const action = (node.data?.action as string) || "search";

  const err = await checkIntegration(userId, "NOTION", "Notion");
  if (err) return { output: integrationError("notion", err) };

  switch (action) {
    case "search":
    case "search_pages": {
      const query = (node.data?.query as string) || "";
      const result = await withRetry(() => searchNotionPages(userId, query));
      return { output: integrationOutput("notion", "search", true, result) };
    }
    case "get":
    case "get_page": {
      const pageId = (node.data?.pageId as string) || "";
      const result = await withRetry(() => getNotionPage(userId, pageId));
      return { output: integrationOutput("notion", "get_page", true, result) };
    }
    case "create":
    case "create_page": {
      const title = (node.data?.title as string) || "";
      const content = (node.data?.content as string) || "";
      const parentId = (node.data?.parentId as string) || "";
      return withEvaluation(
        "create_notion_page",
        `Create Notion page: ${title}`,
        ctx,
        async () => {
          const result = await withRetry(() =>
            createNotionPage(userId, { title, content, databaseId: parentId || undefined }),
          );
          return integrationOutput("notion", "create_page", true, result);
        },
        undefined,
        { title, content, parentId },
      );
    }
    case "append":
    case "append_to_page": {
      const pageId = (node.data?.pageId as string) || "";
      const content = (node.data?.content as string) || "";
      return withEvaluation(
        "append_to_notion",
        `Append to Notion page ${pageId}: ${content.slice(0, 100)}`,
        ctx,
        async () => {
          await withRetry(() => appendToNotionPage(userId, pageId, content));
          return integrationOutput("notion", "append", true, { pageId });
        },
        undefined,
        { pageId, content },
      );
    }
    case "list_databases": {
      const result = await withRetry(() => listNotionDatabases(userId));
      return { output: integrationOutput("notion", "list_databases", true, result) };
    }
    case "query_database": {
      const databaseId = (node.data?.databaseId as string) || "";
      const filter = node.data?.filter as Record<string, unknown> | undefined;
      const result = await withRetry(() => queryNotionDatabase(userId, databaseId, filter));
      return { output: integrationOutput("notion", "query_database", true, result) };
    }
    default:
      return { output: integrationOutput("notion", action, true) };
  }
}

// ============================================
// MICROSOFT OUTLOOK
// ============================================

export async function executeMicrosoftOutlookNode(ctx: NodeExecContext): Promise<NodeExecResult> {
  const { node, userId } = ctx;
  const action = (node.data?.action as string) || "send";

  const err = await checkIntegration(userId, "OUTLOOK", "Outlook");
  if (err) return { output: integrationError("outlook", err) };

  switch (action) {
    case "send":
    case "send_email": {
      const rawTo = node.data?.to;
      const to = Array.isArray(rawTo) ? rawTo.filter((t): t is string => typeof t === "string") : [typeof rawTo === "string" ? rawTo : ""];
      const subject = (node.data?.subject as string) || "";
      const body = (node.data?.body as string) || "";
      return withEvaluation(
        "send_outlook_email",
        `Outlook email to ${to.join(", ")}: ${subject}`,
        ctx,
        async () => {
          const result = await withRetry(() => sendOutlookEmail(userId, to, subject, body));
          return integrationOutput("outlook", "send_email", true, result);
        },
        undefined,
        { to, subject, body },
      );
    }
    case "list":
    case "list_emails": {
      const result = await withRetry(() => getOutlookEmails(userId));
      return { output: integrationOutput("outlook", "list_emails", true, result) };
    }
    default:
      return { output: integrationOutput("outlook", action, true) };
  }
}

// ============================================
// MICROSOFT CALENDAR
// ============================================

export async function executeMicrosoftCalendarNode(ctx: NodeExecContext): Promise<NodeExecResult> {
  const { node, userId } = ctx;
  const action = (node.data?.action as string) || "list";

  const err = await checkIntegration(userId, "OUTLOOK_CALENDAR", "Outlook Calendar");
  if (err) return { output: integrationError("outlookCalendar", err) };

  switch (action) {
    case "list":
    case "list_events": {
      const result = await withRetry(() => getOutlookCalendarEvents(userId));
      return { output: integrationOutput("outlookCalendar", "list_events", true, result) };
    }
    case "create":
    case "create_event": {
      const timeZone = (node.data?.timeZone as string) || "UTC";
      const event = {
        subject: (node.data?.subject as string) || "",
        body: node.data?.body ? { contentType: "Text", content: node.data.body as string } : undefined,
        start: { dateTime: (node.data?.start as string) || "", timeZone },
        end: { dateTime: (node.data?.end as string) || "", timeZone },
        attendees: ((node.data?.attendees as string[]) || []).map((email) => ({
          emailAddress: { address: email },
        })),
      };
      return withEvaluation(
        "create_calendar_event",
        `Outlook event: ${event.subject}`,
        ctx,
        async () => {
          const result = await withRetry(() => createOutlookCalendarEvent(userId, event));
          return integrationOutput("outlookCalendar", "create_event", true, result);
        },
        undefined,
        { subject: event.subject, start: event.start, end: event.end },
      );
    }
    default:
      return { output: integrationOutput("outlookCalendar", action, true) };
  }
}

// ============================================
// MICROSOFT TEAMS
// ============================================

export async function executeMicrosoftTeamsNode(ctx: NodeExecContext): Promise<NodeExecResult> {
  const { node, userId } = ctx;
  const action = (node.data?.action as string) || "send";

  const err = await checkIntegration(userId, "MICROSOFT_TEAMS", "Microsoft Teams");
  if (err) return { output: integrationError("microsoftTeams", err) };

  switch (action) {
    case "send":
    case "send_message": {
      const chatId = (node.data?.chatId as string) || "";
      const message = (node.data?.message as string) || (node.data?.text as string) || "";
      return withEvaluation(
        "send_teams_message",
        `Teams message to ${chatId}: ${message.slice(0, 200)}`,
        ctx,
        async () => {
          const result = await withRetry(() => sendTeamsMessage(userId, chatId, message));
          return integrationOutput("microsoftTeams", "send_message", true, result);
        },
        undefined,
        { chatId, message },
      );
    }
    default:
      return { output: integrationOutput("microsoftTeams", action, true) };
  }
}
