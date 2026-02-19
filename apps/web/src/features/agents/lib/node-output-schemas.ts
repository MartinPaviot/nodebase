/**
 * Node Output Schema Registry
 *
 * Defines what fields each node type outputs, used by the inject sidebar
 * to show available fields from upstream nodes BEFORE the flow runs.
 *
 * Derived from the NodeOutput union in flow-executor/types.ts
 * and Composio API response shapes.
 */

export interface OutputField {
  id: string;
  label: string;
  type: "string" | "object" | "array" | "number" | "boolean";
}

export interface NodeOutputSchema {
  fields: OutputField[];
}

// ── Per-node-type schemas ──────────────────────────────────

const TRIGGER_SCHEMA: NodeOutputSchema = {
  fields: [
    { id: "message", label: "message", type: "string" },
  ],
};

const AI_RESPONSE_SCHEMA: NodeOutputSchema = {
  fields: [
    { id: "content", label: "content", type: "string" },
  ],
};

const PERPLEXITY_SCHEMA: NodeOutputSchema = {
  fields: [
    { id: "response", label: "response", type: "string" },
    { id: "citations", label: "citations", type: "array" },
    { id: "search_results", label: "search_results", type: "array" },
    { id: "related_questions", label: "related_questions", type: "array" },
    { id: "videos", label: "videos", type: "array" },
  ],
};

const GOOGLE_SEARCH_SCHEMA: NodeOutputSchema = {
  fields: [
    { id: "results", label: "results", type: "array" },
    { id: "query", label: "query", type: "string" },
  ],
};

const YOUTUBE_SCHEMA: NodeOutputSchema = {
  fields: [
    { id: "transcript", label: "transcript", type: "string" },
  ],
};

const LINKEDIN_SCHEMA: NodeOutputSchema = {
  fields: [
    { id: "profile_data", label: "profile_data", type: "object" },
  ],
};

const KNOWLEDGE_SEARCH_SCHEMA: NodeOutputSchema = {
  fields: [
    { id: "context", label: "context", type: "string" },
    { id: "resultCount", label: "resultCount", type: "number" },
  ],
};

const CONDITION_SCHEMA: NodeOutputSchema = {
  fields: [
    { id: "selectedBranch", label: "selectedBranch", type: "string" },
    { id: "reasoning", label: "reasoning", type: "string" },
  ],
};

const LOOP_SCHEMA: NodeOutputSchema = {
  fields: [
    { id: "item", label: "item", type: "object" },
  ],
};

const INTEGRATION_SCHEMA: NodeOutputSchema = {
  fields: [
    { id: "data", label: "data", type: "object" },
  ],
};

const EMPTY_SCHEMA: NodeOutputSchema = { fields: [] };

// ── Icon → Schema mapping for action nodes ─────────────────

const ACTION_ICON_SCHEMAS: Record<string, NodeOutputSchema> = {
  perplexity: PERPLEXITY_SCHEMA,
  google: GOOGLE_SEARCH_SCHEMA,
  youtube: YOUTUBE_SCHEMA,
  linkedin: LINKEDIN_SCHEMA,
  ai: AI_RESPONSE_SCHEMA,
};

// ── Public API ─────────────────────────────────────────────

/**
 * Get the output schema for a given node type and optional data (icon, subtitle).
 * Used by the inject sidebar to list available fields from upstream nodes.
 */
export function getNodeOutputSchema(
  nodeType: string,
  nodeData?: Record<string, unknown>,
): NodeOutputSchema {
  // Trigger nodes
  if (nodeType === "messageReceived" || nodeType === "trigger" || nodeType === "webhookTrigger") {
    return TRIGGER_SCHEMA;
  }

  // AI agent step
  if (nodeType === "agentStep") {
    return AI_RESPONSE_SCHEMA;
  }

  // Action nodes — dispatch based on icon
  if (nodeType === "action") {
    const icon = nodeData?.icon as string | undefined;
    if (icon && ACTION_ICON_SCHEMAS[icon]) {
      return ACTION_ICON_SCHEMAS[icon];
    }
    // Default: AI action (no icon or icon="ai")
    return AI_RESPONSE_SCHEMA;
  }

  // Knowledge base search
  if (nodeType === "searchKnowledgeBase") {
    return KNOWLEDGE_SEARCH_SCHEMA;
  }

  // Condition
  if (nodeType === "condition") {
    return CONDITION_SCHEMA;
  }

  // Loop enter
  if (nodeType === "enterLoop") {
    return LOOP_SCHEMA;
  }

  // Chat agent
  if (nodeType === "chatAgent") {
    return AI_RESPONSE_SCHEMA;
  }

  // Composio action (generic integration)
  if (nodeType === "composioAction") {
    return INTEGRATION_SCHEMA;
  }

  // Integration nodes (gmail, slack, notion, etc.)
  if ([
    "sendEmail", "gmail", "googleCalendar", "googleSheets", "googleDrive", "googleDocs",
    "slack", "notion", "outlook", "outlookCalendar", "microsoftTeams",
    "peopleDataLabs",
  ].includes(nodeType)) {
    return INTEGRATION_SCHEMA;
  }

  // Passthrough/structural nodes — no useful output
  return EMPTY_SCHEMA;
}
