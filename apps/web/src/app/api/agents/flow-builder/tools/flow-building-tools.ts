import { z } from "zod";
import type { ToolDef } from "@/lib/llm-tools";
import {
  VALID_NODE_TYPES,
  type FlowCommand,
  type FlowStateSnapshot,
} from "@/features/agents/types/flow-builder-types";
import { NODE_TYPE_SPECS, validateNodeData } from "@/features/agents/lib/node-type-specs";

export function createFlowBuildingTools(
  flowState: FlowStateSnapshot,
  emitFlowCommand: (cmd: FlowCommand) => void,
  connectedIntegrations?: string[]
): Record<string, ToolDef> {
  const nodeIds = flowState.nodes.map((n) => n.id);

  function validateNodeId(nodeId: string): string | null {
    if (!nodeIds.includes(nodeId)) {
      return `Node "${nodeId}" not found. Available nodes: ${nodeIds.join(", ")}`;
    }
    return null;
  }

  return {
    get_flow_state: {
      description:
        "Get the current flow state — all nodes, edges, and a human-readable summary. Call this first to understand what exists before making changes.",
      parameters: z.object({}),
      execute: async () => ({
        nodes: flowState.nodes.map((n) => {
          const fieldWarnings = validateNodeData(n.type, n.data as Record<string, unknown> | undefined);
          return {
            id: n.id,
            type: n.type,
            label: n.label,
            data: n.data ?? {},
            ...(fieldWarnings.length > 0 ? { warnings: fieldWarnings } : {}),
          };
        }),
        edges: flowState.edges.map((e) => ({
          source: e.source,
          target: e.target,
          ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
        })),
        summary: flowState.summary,
        nodeCount: flowState.nodes.length,
        edgeCount: flowState.edges.length,
      }),
    },

    add_node: {
      description:
        "Add a new node to the flow. Specify the node type and optionally place it after an existing node. The node will appear on the canvas in real time.",
      parameters: z.object({
        nodeType: z
          .enum(VALID_NODE_TYPES)
          .describe("The type of node to add"),
        label: z
          .string()
          .describe("Display label for the node"),
        afterNodeId: z
          .string()
          .optional()
          .describe("Place the new node after this node ID. If omitted, adds at the end of the flow."),
        data: z
          .record(z.unknown())
          .optional()
          .describe("Optional configuration data for the node (e.g., prompt, model, actionId)"),
      }),
      execute: async (args: {
        nodeType: string;
        label: string;
        afterNodeId?: string;
        data?: Record<string, unknown>;
      }) => {
        if (args.afterNodeId) {
          const err = validateNodeId(args.afterNodeId);
          if (err) return { error: true, message: err };
        }

        const cmd: FlowCommand = {
          type: "add_node",
          nodeType: args.nodeType,
          label: args.label,
          afterNodeId: args.afterNodeId,
          data: args.data,
        };
        emitFlowCommand(cmd);

        // Validate required fields
        const spec = NODE_TYPE_SPECS[args.nodeType];
        const warnings: string[] = [];

        if (spec) {
          const fieldWarnings = validateNodeData(args.nodeType, args.data);
          warnings.push(...fieldWarnings);

          // Check integration requirement
          if (spec.requiredIntegration && !connectedIntegrations?.includes(spec.requiredIntegration)) {
            warnings.push(`${spec.label} requires ${spec.requiredIntegration} integration. Connect it at /integrations.`);
          }
        }

        return {
          success: true,
          action: "add_node",
          nodeType: args.nodeType,
          label: args.label,
          afterNodeId: args.afterNodeId || "end of flow",
          message: `Added "${args.label}" (${args.nodeType}) node to the flow.`,
          ...(warnings.length > 0 ? {
            warnings,
            hint: "Use update_node to add the missing fields.",
          } : {}),
        };
      },
    },

    delete_node: {
      description:
        "Delete a node from the flow. Cannot delete the trigger (messageReceived) node.",
      parameters: z.object({
        nodeId: z
          .string()
          .describe("The ID of the node to delete"),
      }),
      execute: async (args: { nodeId: string }) => {
        const err = validateNodeId(args.nodeId);
        if (err) return { error: true, message: err };

        const node = flowState.nodes.find((n) => n.id === args.nodeId);
        if (node?.type === "messageReceived") {
          return {
            error: true,
            message: "Cannot delete the trigger node (messageReceived). It is required for the flow to work.",
          };
        }

        const cmd: FlowCommand = { type: "delete_node", nodeId: args.nodeId };
        emitFlowCommand(cmd);

        return {
          success: true,
          action: "delete_node",
          deletedNodeId: args.nodeId,
          deletedLabel: node?.label || "unknown",
          message: `Deleted node "${node?.label || args.nodeId}" from the flow.`,
        };
      },
    },

    update_node: {
      description:
        "Update an existing node's label or configuration data.",
      parameters: z.object({
        nodeId: z
          .string()
          .describe("The ID of the node to update"),
        label: z
          .string()
          .optional()
          .describe("New display label for the node"),
        data: z
          .record(z.unknown())
          .optional()
          .describe("Data fields to update (e.g., prompt, model, temperature)"),
      }),
      execute: async (args: {
        nodeId: string;
        label?: string;
        data?: Record<string, unknown>;
      }) => {
        const err = validateNodeId(args.nodeId);
        if (err) return { error: true, message: err };

        const updates: Record<string, unknown> = {};
        if (args.label) updates.label = args.label;
        if (args.data) Object.assign(updates, args.data);

        if (Object.keys(updates).length === 0) {
          return { error: true, message: "No updates provided. Specify label or data to update." };
        }

        const cmd: FlowCommand = {
          type: "update_node",
          nodeId: args.nodeId,
          updates,
        };
        emitFlowCommand(cmd);

        return {
          success: true,
          action: "update_node",
          nodeId: args.nodeId,
          updatedFields: Object.keys(updates),
          message: `Updated node "${args.nodeId}" with: ${Object.keys(updates).join(", ")}.`,
        };
      },
    },

    connect_nodes: {
      description:
        "Create a connection (edge) between two nodes in the flow.",
      parameters: z.object({
        sourceId: z
          .string()
          .describe("The ID of the source node (where the connection starts)"),
        targetId: z
          .string()
          .describe("The ID of the target node (where the connection ends)"),
        sourceHandle: z
          .string()
          .optional()
          .describe("Handle ID on the source node (for condition branches)"),
      }),
      execute: async (args: {
        sourceId: string;
        targetId: string;
        sourceHandle?: string;
      }) => {
        const srcErr = validateNodeId(args.sourceId);
        if (srcErr) return { error: true, message: srcErr };
        const tgtErr = validateNodeId(args.targetId);
        if (tgtErr) return { error: true, message: tgtErr };

        if (args.sourceId === args.targetId) {
          return { error: true, message: "Cannot connect a node to itself." };
        }

        const cmd: FlowCommand = {
          type: "connect_nodes",
          sourceId: args.sourceId,
          targetId: args.targetId,
          sourceHandle: args.sourceHandle,
        };
        emitFlowCommand(cmd);

        return {
          success: true,
          action: "connect_nodes",
          sourceId: args.sourceId,
          targetId: args.targetId,
          message: `Connected "${args.sourceId}" → "${args.targetId}".`,
        };
      },
    },

    add_condition: {
      description:
        "Add a condition node with one or more branches. Each branch represents a different path the flow can take based on conditions.",
      parameters: z.object({
        afterNodeId: z
          .string()
          .optional()
          .describe("Place the condition after this node ID"),
        branches: z
          .array(
            z.object({
              text: z
                .string()
                .describe("The condition text for this branch (e.g., 'If sentiment is positive')"),
            })
          )
          .min(1)
          .describe("The branches (conditions) for this node"),
      }),
      execute: async (args: {
        afterNodeId?: string;
        branches: Array<{ text: string }>;
      }) => {
        if (args.afterNodeId) {
          const err = validateNodeId(args.afterNodeId);
          if (err) return { error: true, message: err };
        }

        const cmd: FlowCommand = {
          type: "add_condition",
          afterNodeId: args.afterNodeId,
          branches: args.branches,
        };
        emitFlowCommand(cmd);

        return {
          success: true,
          action: "add_condition",
          branchCount: args.branches.length,
          branches: args.branches.map((b) => b.text),
          message: `Added condition with ${args.branches.length} branch(es): ${args.branches.map((b) => `"${b.text}"`).join(", ")}.`,
        };
      },
    },

    replace_node: {
      description:
        "Replace an existing node with a different type, keeping its position and connections.",
      parameters: z.object({
        nodeId: z
          .string()
          .describe("The ID of the node to replace"),
        newType: z
          .enum(VALID_NODE_TYPES)
          .describe("The new node type"),
        newData: z
          .record(z.unknown())
          .describe("Configuration data for the new node"),
      }),
      execute: async (args: {
        nodeId: string;
        newType: string;
        newData: Record<string, unknown>;
      }) => {
        const err = validateNodeId(args.nodeId);
        if (err) return { error: true, message: err };

        const node = flowState.nodes.find((n) => n.id === args.nodeId);
        if (node?.type === "messageReceived") {
          return { error: true, message: "Cannot replace the trigger node." };
        }

        const cmd: FlowCommand = {
          type: "replace_node",
          nodeId: args.nodeId,
          newType: args.newType,
          newData: args.newData,
        };
        emitFlowCommand(cmd);

        return {
          success: true,
          action: "replace_node",
          oldNodeId: args.nodeId,
          oldLabel: node?.label || "unknown",
          newType: args.newType,
          message: `Replaced "${node?.label || args.nodeId}" with a ${args.newType} node.`,
        };
      },
    },

    get_node_details: {
      description:
        "Get full details of a specific node, including all its configuration data. Useful when the user wants to inspect or edit a node's settings.",
      parameters: z.object({
        nodeId: z
          .string()
          .describe("The ID of the node to inspect"),
      }),
      execute: async (args: { nodeId: string }) => {
        const err = validateNodeId(args.nodeId);
        if (err) return { error: true, message: err };

        const node = flowState.nodes.find((n) => n.id === args.nodeId);
        if (!node) return { error: true, message: "Node not found." };

        // Find connected edges
        const incomingEdges = flowState.edges.filter((e) => e.target === args.nodeId);
        const outgoingEdges = flowState.edges.filter((e) => e.source === args.nodeId);

        return {
          id: node.id,
          type: node.type,
          label: node.label,
          position: node.position,
          data: node.data ?? {},
          connections: {
            incoming: incomingEdges.map((e) => ({
              from: e.source,
              fromLabel: flowState.nodes.find((n) => n.id === e.source)?.label ?? e.source,
            })),
            outgoing: outgoingEdges.map((e) => ({
              to: e.target,
              toLabel: flowState.nodes.find((n) => n.id === e.target)?.label ?? e.target,
              ...(e.sourceHandle ? { handle: e.sourceHandle } : {}),
            })),
          },
        };
      },
    },

    check_integrations: {
      description:
        "Check which integrations are connected and which are missing. Use this before adding nodes that require external services (Gmail, Slack, etc.).",
      parameters: z.object({}),
      execute: async () => {
        const integrationMap: Record<string, { nodeType: string; label: string }> = {
          GMAIL: { nodeType: "gmail", label: "Gmail" },
          GOOGLE_CALENDAR: { nodeType: "googleCalendar", label: "Google Calendar" },
          GOOGLE_SHEETS: { nodeType: "googleSheets", label: "Google Sheets" },
          GOOGLE_DRIVE: { nodeType: "googleDrive", label: "Google Drive" },
          GOOGLE_DOCS: { nodeType: "googleDocs", label: "Google Docs" },
          OUTLOOK: { nodeType: "outlook", label: "Outlook" },
          OUTLOOK_CALENDAR: { nodeType: "outlookCalendar", label: "Outlook Calendar" },
          MICROSOFT_TEAMS: { nodeType: "microsoftTeams", label: "Microsoft Teams" },
          SLACK: { nodeType: "slack", label: "Slack" },
          NOTION: { nodeType: "notion", label: "Notion" },
        };

        const connected: Array<{ type: string; nodeType: string; label: string }> = [];
        const notConnected: Array<{ type: string; nodeType: string; label: string }> = [];

        for (const [type, info] of Object.entries(integrationMap)) {
          if (connectedIntegrations?.includes(type)) {
            connected.push({ type, ...info });
          } else {
            notConnected.push({ type, ...info });
          }
        }

        // Check which integrations are used in the current flow
        const usedNodeTypes = new Set(flowState.nodes.map((n) => n.type));
        const missingRequired = notConnected.filter((i) => usedNodeTypes.has(i.nodeType));

        return {
          connected: connected.map((i) => ({ type: i.type, label: i.label })),
          notConnected: notConnected.map((i) => ({ type: i.type, label: i.label })),
          missingForCurrentFlow: missingRequired.map((i) => ({
            label: i.label,
            message: `${i.label} is used in the flow but not connected. Connect it at /integrations.`,
          })),
          alwaysAvailable: ["agentStep", "condition", "chatAgent", "searchKnowledgeBase", "loop", "peopleDataLabs", "composioAction", "sendEmail"],
        };
      },
    },

    validate_flow: {
      description:
        "Validate the current flow for errors and warnings. Checks for missing required fields, disconnected nodes, missing integrations, and structural issues. Call this after building a workflow.",
      parameters: z.object({}),
      execute: async () => {
        const errors: string[] = [];
        const warnings: string[] = [];

        // 1. Check each node's required fields
        for (const node of flowState.nodes) {
          const fieldWarnings = validateNodeData(
            node.type,
            node.data as Record<string, unknown> | undefined,
          );
          for (const w of fieldWarnings) {
            warnings.push(`Node "${node.label}" (${node.type}): ${w}`);
          }
        }

        // 2. Check integration requirements
        for (const node of flowState.nodes) {
          const spec = NODE_TYPE_SPECS[node.type];
          if (spec?.requiredIntegration && !connectedIntegrations?.includes(spec.requiredIntegration)) {
            warnings.push(
              `Node "${node.label}" uses ${spec.label} but ${spec.requiredIntegration} is not connected. Connect it at /integrations.`,
            );
          }
        }

        // 3. Check for disconnected nodes
        const connectedNodeIds = new Set<string>();
        for (const edge of flowState.edges) {
          connectedNodeIds.add(edge.source);
          connectedNodeIds.add(edge.target);
        }
        for (const node of flowState.nodes) {
          if (node.type === "messageReceived") continue; // Trigger can be alone
          if (!connectedNodeIds.has(node.id) && flowState.nodes.length > 1) {
            errors.push(`Node "${node.label}" (${node.type}) is disconnected from the flow.`);
          }
        }

        // 4. Check for nodes with no outgoing edges (except terminal nodes)
        const nodesWithOutgoing = new Set(flowState.edges.map((e) => e.source));
        for (const node of flowState.nodes) {
          if (!nodesWithOutgoing.has(node.id) && connectedNodeIds.has(node.id)) {
            // It's connected but has no outgoing — it's a terminal node, that's OK
          }
        }

        // 5. Check trigger exists
        const hasTrigger = flowState.nodes.some((n) => n.type === "messageReceived");
        if (!hasTrigger) {
          errors.push("Flow is missing a trigger node (messageReceived).");
        }

        const isValid = errors.length === 0;
        return {
          valid: isValid,
          errors,
          warnings,
          message: isValid
            ? warnings.length > 0
              ? `Flow is valid with ${warnings.length} warning(s).`
              : "Flow is valid and ready to execute."
            : `Flow has ${errors.length} error(s) and ${warnings.length} warning(s).`,
        };
      },
    },

    configure_trigger: {
      description:
        "Configure the trigger node — set the greeting message and conversation starters shown to users.",
      parameters: z.object({
        greeting: z
          .string()
          .optional()
          .describe("The greeting message shown when a user starts a conversation"),
        conversationStarters: z
          .array(z.string())
          .max(4)
          .optional()
          .describe("Suggested conversation starters (max 4)"),
      }),
      execute: async (args: {
        greeting?: string;
        conversationStarters?: string[];
      }) => {
        const triggerNode = flowState.nodes.find((n) => n.type === "messageReceived");
        if (!triggerNode) {
          return { error: true, message: "No trigger node found in the flow." };
        }

        const updates: Record<string, unknown> = {};
        if (args.greeting) updates.greeting = args.greeting;
        if (args.conversationStarters) updates.conversationStarters = args.conversationStarters;

        if (Object.keys(updates).length === 0) {
          return { error: true, message: "Provide at least a greeting or conversationStarters." };
        }

        const cmd: FlowCommand = {
          type: "update_node",
          nodeId: triggerNode.id,
          updates,
        };
        emitFlowCommand(cmd);

        return {
          success: true,
          action: "configure_trigger",
          nodeId: triggerNode.id,
          ...(args.greeting ? { greeting: args.greeting } : {}),
          ...(args.conversationStarters ? { conversationStarters: args.conversationStarters } : {}),
          message: "Trigger configured successfully.",
        };
      },
    },
  };
}
