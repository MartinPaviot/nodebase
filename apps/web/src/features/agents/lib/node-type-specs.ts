/**
 * Node Type Specifications
 *
 * Central registry that describes exactly what each flow node type expects:
 * fields, actions, required integrations, and usage examples.
 *
 * Used by:
 * - Flow builder system prompt (so Claude knows how to configure each node)
 * - Flow building tools (validation + feedback in add_node/validate_flow)
 * - Graph validator (pre-flight field checks)
 */

// ============================================
// TYPES
// ============================================

export interface NodeFieldSpec {
  name: string;
  type: "string" | "enum" | "number" | "boolean" | "array" | "object";
  required: boolean;
  description: string;
  enumValues?: string[];
  defaultValue?: unknown;
  example?: string;
}

export interface NodeActionSpec {
  name: string;
  description: string;
  fields: NodeFieldSpec[];
}

export interface NodeTypeSpec {
  type: string;
  label: string;
  description: string;
  requiredIntegration?: string;
  /** Fields common to all actions (or the only fields if no actions) */
  fields: NodeFieldSpec[];
  /** Action-specific fields (for integration nodes with multiple actions) */
  actions?: NodeActionSpec[];
  examples: Array<{
    description: string;
    data: Record<string, unknown>;
  }>;
}

// ============================================
// SPEC REGISTRY
// ============================================

export const NODE_TYPE_SPECS: Record<string, NodeTypeSpec> = {
  // ── Core AI Nodes ─────────────────────────

  agentStep: {
    type: "agentStep",
    label: "AI Step",
    description: "AI reasoning step — use for analysis, generation, classification, extraction, or any task that requires AI thinking.",
    fields: [
      { name: "prompt", type: "string", required: true, description: "Instructions for the AI. Can reference previous nodes with {{nodeId.output}}", example: "Analyze the sentiment of this message: {{trigger.message}}" },
      { name: "model", type: "enum", required: false, description: "AI model to use", enumValues: ["claude-haiku", "claude-sonnet", "claude-opus"], defaultValue: "claude-sonnet" },
      { name: "temperature", type: "number", required: false, description: "Creativity level (0-1)", defaultValue: 0.3 },
    ],
    examples: [
      {
        description: "Analyze email sentiment",
        data: { prompt: "Analyze the sentiment of this email: {{trigger.message}}. Respond with POSITIVE, NEGATIVE, or NEUTRAL and a brief explanation." },
      },
      {
        description: "Summarize previous step output",
        data: { prompt: "Summarize the following data in 3 bullet points:\n{{previous_step.output}}", model: "claude-haiku" },
      },
    ],
  },

  condition: {
    type: "condition",
    label: "Condition",
    description: "Branch the flow based on conditions. Each branch is evaluated against the conversation context. The AI picks the best matching branch.",
    fields: [
      { name: "conditions", type: "array", required: true, description: "Array of condition branches, each with id and text. Created automatically by the add_condition tool." },
    ],
    examples: [
      {
        description: "Route by sentiment",
        data: { conditions: [{ id: "branch-0", text: "If sentiment is positive" }, { id: "branch-1", text: "If sentiment is negative or neutral" }] },
      },
    ],
  },

  chatAgent: {
    type: "chatAgent",
    label: "Chat Agent",
    description: "Send a message to the user or observe incoming messages. 'observe' variant is a passthrough; 'send' variant generates an AI response.",
    fields: [
      { name: "variant", type: "enum", required: false, description: "observe = passthrough, send = generate + send message", enumValues: ["observe", "send"], defaultValue: "observe" },
      { name: "message", type: "string", required: false, description: "Prompt for the AI when variant is 'send'. The AI generates a response based on this prompt and previous context." },
      { name: "model", type: "enum", required: false, description: "AI model for response generation", enumValues: ["claude-haiku", "claude-sonnet"], defaultValue: "claude-sonnet" },
    ],
    examples: [
      {
        description: "Send summary to user",
        data: { variant: "send", message: "Summarize the workflow results for the user in a clear, helpful way." },
      },
      {
        description: "Observe messages (passthrough)",
        data: { variant: "observe" },
      },
    ],
  },

  searchKnowledgeBase: {
    type: "searchKnowledgeBase",
    label: "Search Knowledge Base",
    description: "Search the agent's knowledge base using RAG (Retrieval Augmented Generation). Returns relevant documents.",
    fields: [
      { name: "query", type: "string", required: false, description: "Search query. If omitted, uses the user's message.", example: "{{trigger.message}}" },
      { name: "maxResults", type: "number", required: false, description: "Maximum number of results to return", defaultValue: 5 },
    ],
    examples: [
      {
        description: "Search for relevant docs",
        data: { query: "{{trigger.message}}", maxResults: 5 },
      },
    ],
  },

  loop: {
    type: "loop",
    label: "Loop",
    description: "Loop over a collection of items. Place nodes inside the loop to process each item. The loop auto-detects the collection from the previous node's output.",
    fields: [
      { name: "collectionSource", type: "string", required: false, description: "Node ID whose output is the collection to iterate over. If omitted, uses the previous node." },
      { name: "maxIterations", type: "number", required: false, description: "Safety limit on iterations", defaultValue: 100 },
    ],
    examples: [
      {
        description: "Loop over email list",
        data: { collectionSource: "gmail-node-id", maxIterations: 50 },
      },
    ],
  },

  // ── Gmail ─────────────────────────────────

  gmail: {
    type: "gmail",
    label: "Gmail",
    description: "Gmail email actions: send, search, list, or create drafts. Each field supports 3 modes: manual (fixed value), prompt (AI generates), auto (AI extracts from context).",
    requiredIntegration: "GMAIL",
    fields: [
      { name: "action", type: "enum", required: true, description: "The Gmail action to perform", enumValues: ["send", "search", "list", "draft"] },
    ],
    actions: [
      {
        name: "send",
        description: "Send an email",
        fields: [
          { name: "to", type: "string", required: true, description: "Recipient email address", example: "{{trigger.senderEmail}}" },
          { name: "subject", type: "string", required: true, description: "Email subject line" },
          { name: "body", type: "string", required: true, description: "Email body content. Use 'prompt:' prefix for AI-generated content", example: "prompt:Write a professional follow-up email" },
          { name: "cc", type: "string", required: false, description: "CC recipients (comma-separated)" },
          { name: "bcc", type: "string", required: false, description: "BCC recipients (comma-separated)" },
          { name: "fromName", type: "string", required: false, description: "Sender display name" },
        ],
      },
      {
        name: "search",
        description: "Search emails by query",
        fields: [
          { name: "query", type: "string", required: true, description: "Gmail search query (same syntax as Gmail search bar)", example: "from:client@example.com is:unread" },
          { name: "maxResults", type: "number", required: false, description: "Max emails to return", defaultValue: 10 },
        ],
      },
      {
        name: "list",
        description: "List recent emails",
        fields: [
          { name: "maxResults", type: "number", required: false, description: "Max emails to return", defaultValue: 10 },
          { name: "query", type: "string", required: false, description: "Optional filter query" },
        ],
      },
      {
        name: "draft",
        description: "Create an email draft (saved but not sent)",
        fields: [
          { name: "to", type: "string", required: true, description: "Recipient email address" },
          { name: "subject", type: "string", required: true, description: "Email subject line" },
          { name: "body", type: "string", required: true, description: "Email body content" },
          { name: "cc", type: "string", required: false, description: "CC recipients" },
          { name: "bcc", type: "string", required: false, description: "BCC recipients" },
        ],
      },
    ],
    examples: [
      {
        description: "Send a follow-up email",
        data: {
          action: "send",
          to: "{{trigger.senderEmail}}",
          subject: "Re: {{trigger.subject}}",
          body: "prompt:Write a professional follow-up based on the conversation context",
          fieldModes: { to: "auto", subject: "auto", body: "prompt" },
        },
      },
      {
        description: "List recent unread emails",
        data: { action: "list", maxResults: 10, query: "is:unread" },
      },
    ],
  },

  // ── Google Calendar ───────────────────────

  googleCalendar: {
    type: "googleCalendar",
    label: "Google Calendar",
    description: "Google Calendar actions: create events or list upcoming events.",
    requiredIntegration: "GOOGLE_CALENDAR",
    fields: [
      { name: "action", type: "enum", required: true, description: "Calendar action", enumValues: ["create", "list"] },
    ],
    actions: [
      {
        name: "create",
        description: "Create a calendar event",
        fields: [
          { name: "summary", type: "string", required: true, description: "Event title" },
          { name: "description", type: "string", required: false, description: "Event description" },
          { name: "start", type: "string", required: true, description: "Start time (ISO 8601)", example: "2026-03-01T09:00:00Z" },
          { name: "end", type: "string", required: true, description: "End time (ISO 8601)", example: "2026-03-01T10:00:00Z" },
          { name: "attendees", type: "array", required: false, description: "List of attendee emails" },
        ],
      },
      {
        name: "list",
        description: "List upcoming events",
        fields: [
          { name: "timeMin", type: "string", required: false, description: "Start of time range (ISO 8601)" },
          { name: "timeMax", type: "string", required: false, description: "End of time range (ISO 8601)" },
        ],
      },
    ],
    examples: [
      {
        description: "Create a meeting",
        data: { action: "create", summary: "Follow-up call", start: "2026-03-01T09:00:00Z", end: "2026-03-01T09:30:00Z" },
      },
    ],
  },

  // ── Google Sheets ─────────────────────────

  googleSheets: {
    type: "googleSheets",
    label: "Google Sheets",
    description: "Google Sheets actions: read, append, update data, or create new spreadsheets.",
    requiredIntegration: "GOOGLE_SHEETS",
    fields: [
      { name: "action", type: "enum", required: true, description: "Sheets action", enumValues: ["read", "append", "update", "create"] },
      { name: "spreadsheetId", type: "string", required: false, description: "Google Sheets spreadsheet ID (from the URL). Not required for 'create'." },
      { name: "range", type: "string", required: false, description: "Cell range (e.g., 'Sheet1!A1:D10')", defaultValue: "Sheet1" },
    ],
    actions: [
      {
        name: "read",
        description: "Read data from a spreadsheet",
        fields: [],
      },
      {
        name: "append",
        description: "Append rows to the end of a sheet",
        fields: [
          { name: "values", type: "array", required: true, description: "2D array of values to append ([[row1col1, row1col2], [row2col1, row2col2]])" },
        ],
      },
      {
        name: "update",
        description: "Update cells in a specific range",
        fields: [
          { name: "values", type: "array", required: true, description: "2D array of values to write" },
        ],
      },
      {
        name: "create",
        description: "Create a new spreadsheet",
        fields: [
          { name: "title", type: "string", required: true, description: "Spreadsheet title" },
        ],
      },
    ],
    examples: [
      {
        description: "Read data from a sheet",
        data: { action: "read", spreadsheetId: "abc123", range: "Sheet1!A1:D100" },
      },
      {
        description: "Append a row",
        data: { action: "append", spreadsheetId: "abc123", range: "Sheet1", values: [["{{trigger.name}}", "{{trigger.email}}", "new"]] },
      },
    ],
  },

  // ── Google Drive ──────────────────────────

  googleDrive: {
    type: "googleDrive",
    label: "Google Drive",
    description: "Google Drive actions: list, get, upload, or delete files.",
    requiredIntegration: "GOOGLE_DRIVE",
    fields: [
      { name: "action", type: "enum", required: true, description: "Drive action", enumValues: ["list", "get", "upload", "delete"] },
    ],
    actions: [
      {
        name: "list",
        description: "List files in Drive",
        fields: [],
      },
      {
        name: "get",
        description: "Get a specific file",
        fields: [
          { name: "fileId", type: "string", required: true, description: "Google Drive file ID" },
        ],
      },
      {
        name: "upload",
        description: "Upload a file to Drive",
        fields: [
          { name: "fileName", type: "string", required: true, description: "File name" },
          { name: "mimeType", type: "string", required: false, description: "File MIME type", defaultValue: "text/plain" },
          { name: "content", type: "string", required: true, description: "File content" },
        ],
      },
      {
        name: "delete",
        description: "Delete a file from Drive",
        fields: [
          { name: "fileId", type: "string", required: true, description: "File ID to delete" },
        ],
      },
    ],
    examples: [
      {
        description: "List Drive files",
        data: { action: "list" },
      },
    ],
  },

  // ── Google Docs ───────────────────────────

  googleDocs: {
    type: "googleDocs",
    label: "Google Docs",
    description: "Google Docs actions: create, read, or append to documents.",
    requiredIntegration: "GOOGLE_DOCS",
    fields: [
      { name: "action", type: "enum", required: true, description: "Docs action", enumValues: ["create", "get", "append"] },
    ],
    actions: [
      {
        name: "create",
        description: "Create a new document",
        fields: [
          { name: "title", type: "string", required: true, description: "Document title" },
        ],
      },
      {
        name: "get",
        description: "Read a document's content",
        fields: [
          { name: "documentId", type: "string", required: true, description: "Google Docs document ID" },
        ],
      },
      {
        name: "append",
        description: "Append text to a document",
        fields: [
          { name: "documentId", type: "string", required: true, description: "Document ID" },
          { name: "text", type: "string", required: true, description: "Text to append" },
        ],
      },
    ],
    examples: [
      {
        description: "Create a report doc",
        data: { action: "create", title: "Weekly Report" },
      },
    ],
  },

  // ── Slack ─────────────────────────────────

  slack: {
    type: "slack",
    label: "Slack",
    description: "Slack actions: send messages, list channels, or get channel history.",
    requiredIntegration: "SLACK",
    fields: [
      { name: "action", type: "enum", required: true, description: "Slack action", enumValues: ["send", "list_channels", "history"] },
    ],
    actions: [
      {
        name: "send",
        description: "Send a message to a Slack channel",
        fields: [
          { name: "channel", type: "string", required: true, description: "Channel name or ID (e.g., 'general', 'C0123456789')" },
          { name: "text", type: "string", required: true, description: "Message text. Supports Slack markdown." },
        ],
      },
      {
        name: "list_channels",
        description: "List available Slack channels",
        fields: [],
      },
      {
        name: "history",
        description: "Get recent messages from a channel",
        fields: [
          { name: "channel", type: "string", required: true, description: "Channel name or ID" },
          { name: "limit", type: "number", required: false, description: "Number of messages to retrieve", defaultValue: 20 },
        ],
      },
    ],
    examples: [
      {
        description: "Send alert to Slack",
        data: { action: "send", channel: "alerts", text: "🚨 New urgent ticket: {{trigger.subject}}" },
      },
    ],
  },

  // ── Notion ────────────────────────────────

  notion: {
    type: "notion",
    label: "Notion",
    description: "Notion actions: search, read, create, or update pages and databases.",
    requiredIntegration: "NOTION",
    fields: [
      { name: "action", type: "enum", required: true, description: "Notion action", enumValues: ["search", "get_page", "create_page", "append", "list_databases", "query_database"] },
    ],
    actions: [
      {
        name: "search",
        description: "Search Notion pages by query",
        fields: [
          { name: "query", type: "string", required: true, description: "Search query" },
        ],
      },
      {
        name: "get_page",
        description: "Get a specific Notion page",
        fields: [
          { name: "pageId", type: "string", required: true, description: "Notion page ID" },
        ],
      },
      {
        name: "create_page",
        description: "Create a new Notion page",
        fields: [
          { name: "title", type: "string", required: true, description: "Page title" },
          { name: "content", type: "string", required: false, description: "Page content (plain text)" },
          { name: "parentId", type: "string", required: false, description: "Parent page or database ID" },
        ],
      },
      {
        name: "append",
        description: "Append content to an existing page",
        fields: [
          { name: "pageId", type: "string", required: true, description: "Notion page ID" },
          { name: "content", type: "string", required: true, description: "Content to append" },
        ],
      },
      {
        name: "list_databases",
        description: "List Notion databases",
        fields: [],
      },
      {
        name: "query_database",
        description: "Query a Notion database with optional filters",
        fields: [
          { name: "databaseId", type: "string", required: true, description: "Database ID" },
          { name: "filter", type: "object", required: false, description: "Notion filter object" },
        ],
      },
    ],
    examples: [
      {
        description: "Create a meeting notes page",
        data: { action: "create_page", title: "Meeting Notes - {{trigger.date}}", content: "prompt:Generate meeting notes from the conversation" },
      },
    ],
  },

  // ── Outlook ───────────────────────────────

  outlook: {
    type: "outlook",
    label: "Outlook",
    description: "Microsoft Outlook email actions: send or list emails.",
    requiredIntegration: "OUTLOOK",
    fields: [
      { name: "action", type: "enum", required: true, description: "Outlook action", enumValues: ["send", "list"] },
    ],
    actions: [
      {
        name: "send",
        description: "Send an email via Outlook",
        fields: [
          { name: "to", type: "string", required: true, description: "Recipient email(s)" },
          { name: "subject", type: "string", required: true, description: "Subject line" },
          { name: "body", type: "string", required: true, description: "Email body" },
        ],
      },
      {
        name: "list",
        description: "List recent Outlook emails",
        fields: [],
      },
    ],
    examples: [
      {
        description: "Send Outlook email",
        data: { action: "send", to: "recipient@example.com", subject: "Update", body: "prompt:Write a brief status update" },
      },
    ],
  },

  // ── Outlook Calendar ──────────────────────

  outlookCalendar: {
    type: "outlookCalendar",
    label: "Outlook Calendar",
    description: "Microsoft Outlook Calendar actions: create or list events.",
    requiredIntegration: "OUTLOOK_CALENDAR",
    fields: [
      { name: "action", type: "enum", required: true, description: "Calendar action", enumValues: ["create", "list"] },
    ],
    actions: [
      {
        name: "create",
        description: "Create a calendar event",
        fields: [
          { name: "subject", type: "string", required: true, description: "Event subject" },
          { name: "start", type: "string", required: true, description: "Start time (ISO 8601)" },
          { name: "end", type: "string", required: true, description: "End time (ISO 8601)" },
          { name: "body", type: "string", required: false, description: "Event body/description" },
          { name: "attendees", type: "array", required: false, description: "Attendee emails" },
          { name: "timeZone", type: "string", required: false, description: "Time zone", defaultValue: "UTC" },
        ],
      },
      {
        name: "list",
        description: "List upcoming events",
        fields: [],
      },
    ],
    examples: [
      {
        description: "Create a meeting",
        data: { action: "create", subject: "Team sync", start: "2026-03-01T14:00:00Z", end: "2026-03-01T14:30:00Z" },
      },
    ],
  },

  // ── Microsoft Teams ───────────────────────

  microsoftTeams: {
    type: "microsoftTeams",
    label: "Microsoft Teams",
    description: "Send messages via Microsoft Teams.",
    requiredIntegration: "MICROSOFT_TEAMS",
    fields: [
      { name: "action", type: "enum", required: true, description: "Teams action", enumValues: ["send"], defaultValue: "send" },
      { name: "chatId", type: "string", required: true, description: "Teams chat/channel ID" },
      { name: "message", type: "string", required: true, description: "Message text" },
    ],
    examples: [
      {
        description: "Send a Teams message",
        data: { action: "send", chatId: "channel-id", message: "New update: {{previous_step.output}}" },
      },
    ],
  },

  // ── People Data Labs ──────────────────────

  peopleDataLabs: {
    type: "peopleDataLabs",
    label: "People Data Labs",
    description: "Enrich leads with People Data Labs. Find person or company data by email, name, phone, or social profile.",
    fields: [
      { name: "actionType", type: "enum", required: true, description: "PDL search type", enumValues: ["pdl-find-by-email", "pdl-find-by-full-name", "pdl-find-by-partial-name", "pdl-find-by-phone", "pdl-find-by-social", "search-people", "search-companies"] },
      { name: "email", type: "string", required: false, description: "Email to search (for find-by-email)" },
      { name: "fullName", type: "string", required: false, description: "Full name (for find-by-full-name)" },
      { name: "firstName", type: "string", required: false, description: "First name (for find-by-partial-name)" },
      { name: "lastName", type: "string", required: false, description: "Last name (for find-by-partial-name)" },
      { name: "company", type: "string", required: false, description: "Company name (narrows search)" },
      { name: "location", type: "string", required: false, description: "Location (narrows search)" },
      { name: "searchQuery", type: "string", required: false, description: "Elasticsearch query (for search-people/search-companies)" },
    ],
    examples: [
      {
        description: "Find person by email",
        data: { actionType: "pdl-find-by-email", email: "{{trigger.senderEmail}}" },
      },
      {
        description: "Search for people at a company",
        data: { actionType: "search-people", searchQuery: '{"bool":{"must":[{"match":{"job_company_name":"Acme Corp"}}]}}', limit: 5 },
      },
    ],
  },

  // ── Composio ──────────────────────────────

  composioAction: {
    type: "composioAction",
    label: "Composio Action",
    description: "Execute any of 800+ integrations via Composio (HubSpot, Salesforce, Stripe, Discord, etc.). Requires the Composio app key and action name.",
    fields: [
      { name: "composioAppKey", type: "string", required: true, description: "Composio app identifier (e.g., 'hubspot', 'salesforce', 'stripe')" },
      { name: "composioActionName", type: "string", required: true, description: "Composio action name (e.g., 'HUBSPOT_CREATE_CONTACT', 'STRIPE_LIST_INVOICES')" },
    ],
    examples: [
      {
        description: "Create HubSpot contact",
        data: { composioAppKey: "hubspot", composioActionName: "HUBSPOT_CREATE_CONTACT", email: "{{trigger.email}}", firstName: "{{trigger.name}}" },
      },
    ],
  },

  // ── Send Email (platform) ─────────────────

  sendEmail: {
    type: "sendEmail",
    label: "Send Email",
    description: "Send an email via the platform's email service (no Gmail integration required).",
    fields: [
      { name: "to", type: "string", required: true, description: "Recipient email address" },
      { name: "subject", type: "string", required: true, description: "Email subject" },
      { name: "body", type: "string", required: true, description: "Email body" },
    ],
    examples: [
      {
        description: "Send notification email",
        data: { to: "team@company.com", subject: "Alert: {{trigger.type}}", body: "prompt:Write a notification email about this event" },
      },
    ],
  },

  // ── Action (generic) ──────────────────────

  action: {
    type: "action",
    label: "Action",
    description: "Generic action node with AI-powered field resolution. Used for Perplexity search, Google search, YouTube, and other Composio-backed actions routed by icon.",
    fields: [
      { name: "icon", type: "string", required: true, description: "Action icon identifier (perplexity, google, youtube, linkedin, think, write)" },
      { name: "prompt", type: "string", required: false, description: "Instructions for the AI or search query" },
    ],
    examples: [
      {
        description: "Perplexity web search",
        data: { icon: "perplexity", prompt: "Find the latest news about {{trigger.company}}", perplexityModel: "sonar" },
      },
      {
        description: "Google search",
        data: { icon: "google", prompt: "Search for {{trigger.name}} LinkedIn profile", maxResults: 5 },
      },
    ],
  },
};

// ============================================
// HELPERS
// ============================================

/**
 * Get the required fields for a node type + action combination.
 * For integration nodes with actions (gmail, slack, etc.), merges
 * the base fields with the action-specific fields.
 */
export function getRequiredFields(nodeType: string, action?: string): NodeFieldSpec[] {
  const spec = NODE_TYPE_SPECS[nodeType];
  if (!spec) return [];

  const baseRequired = spec.fields.filter((f) => f.required);

  if (action && spec.actions) {
    const actionSpec = spec.actions.find((a) => a.name === action);
    if (actionSpec) {
      return [...baseRequired, ...actionSpec.fields.filter((f) => f.required)];
    }
  }

  return baseRequired;
}

/**
 * Validate a node's data against its spec.
 * Returns warnings for missing required fields.
 */
export function validateNodeData(
  nodeType: string,
  data: Record<string, unknown> | undefined,
): string[] {
  const spec = NODE_TYPE_SPECS[nodeType];
  if (!spec) return [];

  const warnings: string[] = [];
  const action = (data?.action as string) || (data?.actionType as string);

  const required = getRequiredFields(nodeType, action);
  for (const field of required) {
    const value = data?.[field.name];
    if (value === undefined || value === null || value === "") {
      warnings.push(`Missing required field "${field.name}": ${field.description}`);
    }
  }

  // Check integration requirement
  // (caller should pass connectedIntegrations and check spec.requiredIntegration)

  return warnings;
}

/**
 * Generate a human-readable spec block for the system prompt.
 * Includes fields, actions, and one example per node type.
 */
export function generateSpecsForPrompt(): string {
  const sections: string[] = [];

  for (const spec of Object.values(NODE_TYPE_SPECS)) {
    const lines: string[] = [];
    lines.push(`### ${spec.type} — ${spec.label}`);
    lines.push(spec.description);

    if (spec.requiredIntegration) {
      lines.push(`**Requires:** ${spec.requiredIntegration} integration connected`);
    }

    // Fields
    const requiredFields = spec.fields.filter((f) => f.required);
    const optionalFields = spec.fields.filter((f) => !f.required);

    if (requiredFields.length > 0) {
      lines.push("**Required fields:**");
      for (const f of requiredFields) {
        let desc = `- \`${f.name}\``;
        if (f.enumValues) desc += ` (${f.enumValues.join(" | ")})`;
        desc += `: ${f.description}`;
        lines.push(desc);
      }
    }

    if (optionalFields.length > 0) {
      lines.push("**Optional:** " + optionalFields.map((f) => {
        let s = `\`${f.name}\``;
        if (f.defaultValue !== undefined) s += ` (default: ${f.defaultValue})`;
        return s;
      }).join(", "));
    }

    // Actions (for integration nodes)
    if (spec.actions && spec.actions.length > 0) {
      lines.push("**Actions:**");
      for (const action of spec.actions) {
        const actionFields = action.fields.filter((f) => f.required);
        if (actionFields.length > 0) {
          lines.push(`- \`${action.name}\`: ${action.description} — needs ${actionFields.map((f) => `\`${f.name}\``).join(", ")}`);
        } else {
          lines.push(`- \`${action.name}\`: ${action.description}`);
        }
      }
    }

    // First example only (keep prompt compact)
    if (spec.examples.length > 0) {
      const ex = spec.examples[0];
      lines.push(`**Example** (${ex.description}):`);
      lines.push("```json");
      lines.push(JSON.stringify(ex.data, null, 2));
      lines.push("```");
    }

    sections.push(lines.join("\n"));
  }

  return sections.join("\n\n");
}
