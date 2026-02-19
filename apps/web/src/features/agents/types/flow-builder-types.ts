// ============================================
// FLOW COMMAND TYPES (server → client via SSE)
// ============================================

export type FlowCommand =
  | { type: "add_node"; nodeType: string; label: string; afterNodeId?: string; data?: Record<string, unknown> }
  | { type: "delete_node"; nodeId: string }
  | { type: "update_node"; nodeId: string; updates: Record<string, unknown> }
  | { type: "connect_nodes"; sourceId: string; targetId: string; sourceHandle?: string }
  | { type: "replace_node"; nodeId: string; newType: string; newData: Record<string, unknown> }
  | { type: "add_condition"; afterNodeId?: string; branches: Array<{ text: string }> };

// ============================================
// FLOW STATE SNAPSHOT (client → server)
// ============================================

export interface FlowStateSnapshot {
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    position: { x: number; y: number };
    data?: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
  }>;
  summary: string; // Human-readable flow description for LLM context
}

// ============================================
// VALID NODE TYPES for add_node / replace_node
// ============================================

export const VALID_NODE_TYPES = [
  "agentStep",
  "condition",
  "chatAgent",
  "searchKnowledgeBase",
  "loop",
  "action",
  "composioAction",
  "gmail",
  "googleSheets",
  "googleDrive",
  "googleDocs",
  "googleCalendar",
  "slack",
  "notion",
  "outlook",
  "outlookCalendar",
  "microsoftTeams",
  "peopleDataLabs",
  "sendEmail",
] as const;

export type ValidNodeType = (typeof VALID_NODE_TYPES)[number];

// Map from nodeType back to actionId (reverse of getNodeTypeForAction in canvas)
export const NODE_TYPE_TO_ACTION_ID: Record<string, string> = {
  agentStep: "agent-step",
  condition: "condition",
  chatAgent: "observe-messages",
  searchKnowledgeBase: "knowledge-base",
  loop: "loop",
  action: "action",
  composioAction: "action",
  gmail: "gmail",
  googleSheets: "google-sheets",
  googleDrive: "google-drive",
  googleDocs: "google-docs",
  googleCalendar: "google-calendar",
  slack: "slack",
  notion: "notion",
  outlook: "outlook",
  outlookCalendar: "outlook-calendar",
  microsoftTeams: "teams",
  peopleDataLabs: "people-data",
  sendEmail: "send-email",
};
