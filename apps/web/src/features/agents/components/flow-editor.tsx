"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { FlowEditorHeader } from "./flow-editor-header";
import { FlowEditorCanvas, type FlowEditorCanvasRef, type FlowExecutionState } from "./flow-editor-canvas";
import { FlowEditorSidebar } from "./flow-editor-sidebar";
import { FlowEditorToolbar } from "./flow-editor-toolbar";
import { FlowEditorSettings } from "./flow-editor-settings";
// AgentPurposeCard removed — builder now modifies flow directly via FlowCommands
import { FlowNodePanel } from "./flow-node-panel";
import { SearchKnowledgeBaseSettings } from "./search-knowledge-base-settings";
import { EnterLoopSettings } from "./enter-loop-settings";
import { ExitLoopSettings } from "./exit-loop-settings";
import { ConditionSettings } from "./condition-settings";
import { PeopleDataLabsSettings } from "./people-data-labs-settings";
import { IntegrationActionPanel } from "./integration-action-panel";
import { ActionNodeSettings } from "./action-node-settings";
import { AddActionModal } from "./add-action-modal";
import { ChatInterface } from "./chat-interface";
import { AgentChatTab } from "./agent-chat-tab";
import { X, ArrowLeft, ChatCircle, Chats, Robot, GitBranch, MagnifyingGlass, ArrowsClockwise, Sparkle } from "@phosphor-icons/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useConversations, useCreateConversation, useSaveFlowData } from "../hooks/use-agents";
import type { FlowCommand } from "../types/flow-builder-types";
import { getNodeIconConfig, type NodeIconResult } from "@/features/agents/lib/node-icons";
import { getUpstreamNodes, type UpstreamNode } from "../lib/flow-graph-utils";
import { useUserIntegrations } from "@/hooks/use-integrations";

interface Agent {
  id: string;
  name: string;
  description?: string | null;
  systemPrompt: string;
  avatar?: string | null;
  isEnabled: boolean;
  context?: string | null;
  model?: string;
  temperature?: number;
  templateId?: string | null;
}

// Flow data structure from template
interface TemplateFlowData {
  nodes?: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data?: Record<string, unknown>;
  }>;
  edges?: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  }>;
}

interface FlowEditorProps {
  agent: Agent;
  onUpdate?: (data: Partial<Agent>) => void;
  templateFlowData?: TemplateFlowData;
}

export function FlowEditor({ agent, onUpdate, templateFlowData }: FlowEditorProps) {
  const router = useRouter();
  const conversations = useConversations(agent.id);
  const createConversation = useCreateConversation();
  const saveFlowData = useSaveFlowData();

  // Track if there are unsaved changes
  const [hasChanges, setHasChanges] = useState(false);
  // Track whether the flow is empty (only trigger node) for sidebar suggestions
  const [flowNodeCount, setFlowNodeCount] = useState(templateFlowData?.nodes?.length ?? 0);

  const [activeTab, setActiveTab] = useState<"settings" | "flow" | "tasks">("flow");
  const [showSidebar, setShowSidebar] = useState(true);

  // Chat split view state (Test panel)
  const [showChat, setShowChat] = useState(false);
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);

  // Agent chat tab state (independent from test panel)
  const [agentChatConversationId, setAgentChatConversationId] = useState<string | null>(null);
  const [flowExecutionState, setFlowExecutionState] = useState<FlowExecutionState | null>(null);
  const [retryFromFailedFn, setRetryFromFailedFn] = useState<(() => void) | null>(null);
  const [sidebarMessages, setSidebarMessages] = useState<
    { id: string; role: "user" | "assistant"; content: string }[]
  >([]);
  const [sidebarInput, setSidebarInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingToolName, setStreamingToolName] = useState<string | null>(null);

  // Connected integrations for sidebar suggestions
  const integrationsQuery = useUserIntegrations();
  const connectedIntegrationTypes = useMemo(
    () => (integrationsQuery.data || []).map((i) => i.type),
    [integrationsQuery.data]
  );

  // Purpose card removed — builder modifies flow directly via FlowCommands

  // Selected node state for right panel
  const [selectedNode, setSelectedNode] = useState<{
    id: string;
    type: string;
  } | null>(null);

  // Replace node modal state
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [nodeToReplace, setNodeToReplace] = useState<string | null>(null);

  // Ref to canvas for updating branch nodes
  const canvasRef = useRef<FlowEditorCanvasRef>(null);

  // Flow nodes data state - initialized from template
  const [flowNodesData, setFlowNodesData] = useState<Record<string, Record<string, unknown>>>(() => {
    if (templateFlowData?.nodes) {
      const dataMap: Record<string, Record<string, unknown>> = {};
      templateFlowData.nodes.forEach((node) => {
        if (node.data) {
          dataMap[node.id] = node.data;
        }
      });
      return dataMap;
    }
    return {};
  });

  // Get the selected node's data
  const selectedNodeData = useMemo(() => {
    if (!selectedNode) return null;
    return flowNodesData[selectedNode.id] || {};
  }, [selectedNode, flowNodesData]);

  // Update a specific node's data
  const updateNodeData = useCallback((nodeId: string, updates: Record<string, unknown>) => {
    setFlowNodesData((prev) => ({
      ...prev,
      [nodeId]: { ...prev[nodeId], ...updates },
    }));
    setHasChanges(true);
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    canvasRef.current?.deleteNode(nodeId);
    setSelectedNode(null);
    setHasChanges(true);
    // Clean up the flowNodesData for this node
    setFlowNodesData((prev) => {
      const updated = { ...prev };
      delete updated[nodeId];
      return updated;
    });
  }, []);

  const handleRenameNode = useCallback((nodeId: string, newName: string) => {
    // Update the node name in flowNodesData
    setFlowNodesData((prev) => ({
      ...prev,
      [nodeId]: { ...prev[nodeId], label: newName },
    }));
    // Also update the canvas node
    canvasRef.current?.updateNodeLabel(nodeId, newName);
    setHasChanges(true);
  }, []);

  // Open replace modal for a node
  const handleOpenReplaceModal = useCallback((nodeId: string) => {
    setNodeToReplace(nodeId);
    setShowReplaceModal(true);
  }, []);

  // Handle Composio action selection from modal
  const handleComposioActionSelection = useCallback(
    (composioAppKey: string, composioActionName: string, actionData: { name: string; description: string }) => {
      if (!nodeToReplace || !canvasRef.current) {
        setShowReplaceModal(false);
        setNodeToReplace(null);
        return;
      }

      // Create composioAction node data
      const nodeData = {
        label: actionData.name,
        description: actionData.description,
        composioAppKey,
        composioActionName,
        composioConfig: {}, // Empty config initially, user can configure later
        icon: "ph:plug", // Default icon for Composio actions
      };

      // Replace the node on canvas with composioAction type
      const newNodeId = canvasRef.current.replaceNode(nodeToReplace, "composioAction", nodeData);

      // Update flow nodes data
      setFlowNodesData((prev) => {
        const updated = { ...prev };
        delete updated[nodeToReplace];
        updated[newNodeId] = nodeData;
        return updated;
      });

      // Select the new node
      setSelectedNode({ id: newNodeId, type: "composioAction" });
      setHasChanges(true);

      // Close modal
      setShowReplaceModal(false);
      setNodeToReplace(null);
    },
    [nodeToReplace]
  );

  // Handle structural node selection from replace modal
  const handleReplaceAction = useCallback((actionId: string) => {
    if (!nodeToReplace || !canvasRef.current) {
      setShowReplaceModal(false);
      setNodeToReplace(null);
      return;
    }

    // Map action ID to node type (same logic as in flow-editor-canvas)
    const getNodeTypeForAction = (actionId: string): string => {
      if (actionId.startsWith("pdl-")) return "peopleDataLabs";

      const actionToNodeType: Record<string, string> = {
        "knowledge-base": "searchKnowledgeBase",
        "condition": "condition",
        "select-action": "selectAction",
        "agent-step": "agentStep",
        "loop": "loop",
        "observe-messages": "chatAgent",
        "send-message": "chatAgent",
        "people-data": "peopleDataLabs",
      };
      return actionToNodeType[actionId] || "action";
    };

    // Get node data based on action type
    const getNodeDataForAction = (actionId: string): Record<string, unknown> => {
      if (actionId === "observe-messages") {
        return { label: "Observe messages", variant: "observe" };
      }
      if (actionId === "send-message") {
        return { label: "Send message", variant: "send" };
      }
      if (actionId === "people-data") {
        return { label: "Search for leads" };
      }
      if (actionId.startsWith("pdl-")) {
        const pdlLabels: Record<string, string> = {
          "pdl-find-by-email": "Find person by email",
          "pdl-find-by-full-name": "Find person by full name",
          "pdl-find-by-partial-name": "Find person by partial name",
          "pdl-find-by-phone": "Find person by phone",
          "pdl-find-by-social": "Find Person by Social Network",
          "pdl-search-companies": "Search for Companies",
          "pdl-search-people": "Search for People",
        };
        return { label: pdlLabels[actionId] || "People Data Labs", actionType: actionId };
      }
      return { label: actionId };
    };

    const newType = getNodeTypeForAction(actionId);
    const newData = getNodeDataForAction(actionId);

    // Replace the node on canvas
    const newNodeId = canvasRef.current.replaceNode(nodeToReplace, newType, newData);

    // Clean up old node data and set new node data
    setFlowNodesData((prev) => {
      const updated = { ...prev };
      delete updated[nodeToReplace];
      updated[newNodeId] = newData;
      return updated;
    });

    // Select the new node
    setSelectedNode({ id: newNodeId, type: newType });
    setHasChanges(true);

    // Close modal
    setShowReplaceModal(false);
    setNodeToReplace(null);
  }, [nodeToReplace]);

  const handlePublish = () => {
    if (!canvasRef.current) return;

    const flowData = canvasRef.current.getFlowData();
    // Ensure flowData has non-optional arrays for the save operation
    const flowDataToSave = {
      nodes: flowData.nodes || [],
      edges: flowData.edges || [],
    };
    saveFlowData.mutate(
      { id: agent.id, flowData: flowDataToSave },
      {
        onSuccess: () => {
          setHasChanges(false);
        },
      }
    );
  };

  const handleTest = () => {
    // Open the chat split panel (don't navigate — the /chat route has no page.tsx)
    if (!showChat) {
      handleToggleChat();
    }
  };

  const handleShare = () => {
    // TODO: Implement share logic
    console.log("Sharing agent:", agent.id);
  };

  const handleToggleEnabled = (enabled: boolean) => {
    onUpdate?.({ isEnabled: enabled });
  };

  const handleNewConversation = () => {
    // Reset the builder sidebar (new conversation)
    setSidebarMessages([]);
    setBuilderConversationId(null);
    setSidebarInput("");
  };

  // Toggle chat split view
  const handleToggleChat = useCallback(() => {
    if (showChat) {
      setShowChat(false);
      // Keep execution state visible on canvas after closing chat
      return;
    }
    // On narrow screens, close settings panel to avoid double overlay
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      setSelectedNode(null);
    }
    // Open chat - create a conversation if none exists
    if (chatConversationId) {
      setShowChat(true);
    } else {
      createConversation.mutate(
        { agentId: agent.id },
        {
          onSuccess: (conversation) => {
            setChatConversationId(conversation.id);
            setShowChat(true);
          },
        }
      );
    }
  }, [showChat, chatConversationId, createConversation, agent.id]);

  // Handle flow commands from the Smart Builder Chat
  const handleFlowCommand = useCallback((command: FlowCommand) => {
    if (!canvasRef.current) return;
    switch (command.type) {
      case "add_node":
        canvasRef.current.addNode(command.nodeType, command.afterNodeId, { label: command.label, ...command.data });
        break;
      case "delete_node":
        canvasRef.current.deleteNode(command.nodeId);
        break;
      case "update_node":
        if (command.updates.label) {
          canvasRef.current.updateNodeLabel(command.nodeId, command.updates.label as string);
        }
        canvasRef.current.updateNodeData(command.nodeId, command.updates);
        break;
      case "connect_nodes":
        canvasRef.current.connectNodes(command.sourceId, command.targetId, command.sourceHandle);
        break;
      case "replace_node": {
        const newNodeId = canvasRef.current.replaceNode(command.nodeId, command.newType, command.newData);
        setFlowNodesData((prev) => {
          const updated = { ...prev };
          delete updated[command.nodeId];
          updated[newNodeId] = command.newData;
          return updated;
        });
        break;
      }
      case "add_condition":
        canvasRef.current.addNode("condition", command.afterNodeId, {
          label: "Condition",
          conditions: command.branches.map((b, i) => ({
            id: `branch-${Date.now()}-${i}`,
            text: b.text,
          })),
        });
        break;
    }
    setHasChanges(true);
    // Update node count so sidebar can hide suggestions when flow is no longer empty
    const snapshot = canvasRef.current.getFlowStateSnapshot();
    setFlowNodeCount(snapshot.nodes.length);
    // Auto-fit view after builder modifies the flow (wait for React Flow to render)
    if (command.type === "add_node" || command.type === "add_condition") {
      setTimeout(() => canvasRef.current?.fitView(), 200);
    }
  }, []);

  // Get flow state snapshot for the Smart Builder Chat
  const getFlowStateSnapshot = useCallback(() => {
    return canvasRef.current?.getFlowStateSnapshot() ?? { nodes: [], edges: [], summary: "Empty flow" };
  }, []);

  // Get live flow data from canvas for flow execution
  const getFlowData = useCallback(() => {
    if (!canvasRef.current) return undefined;
    return canvasRef.current.getFlowData();
  }, []);

  // Build flow nodes list for chat execution tracking
  const flowNodesList = useMemo(() => {
    if (!templateFlowData?.nodes) return undefined;
    return templateFlowData.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      data: node.data as { label?: string; composioActionName?: string; actionId?: string; [key: string]: unknown } | undefined,
    }));
  }, [templateFlowData]);

  // Build flow edges list for flow execution mode
  const flowEdgesList = useMemo(() => {
    if (!templateFlowData?.edges) return undefined;
    return templateFlowData.edges;
  }, [templateFlowData]);

  // Extract greeting message and conversation starters from "messageReceived" node
  // Uses flowNodesData (editable state) so edits to the greeting are reflected in chat
  const messageReceivedData = useMemo(() => {
    if (!templateFlowData?.nodes) return { greeting: "", starters: [] as Array<{ id: string; text: string; enabled: boolean }> };
    const triggerNode = templateFlowData.nodes.find((n) => n.type === "messageReceived");
    if (!triggerNode) return { greeting: "", starters: [] as Array<{ id: string; text: string; enabled: boolean }> };
    // Prefer live node data from flowNodesData (user may have edited the greeting)
    const data = flowNodesData[triggerNode.id] || triggerNode.data || {};
    return {
      greeting: (data.greetingMessage as string) || "",
      starters: ((data.conversationStarters as Array<{ id: string; text: string; enabled: boolean }>) || []).filter((s) => s.enabled),
    };
  }, [templateFlowData, flowNodesData]);

  // Compute the current node label + icon for the chat header
  const currentNodeLabel = useMemo(() => {
    if (!flowExecutionState?.isRunning || !flowExecutionState.currentNodeId) return null;
    const node = flowNodesList?.find((n) => n.id === flowExecutionState.currentNodeId);
    return node?.data?.label || null;
  }, [flowExecutionState, flowNodesList]);

  const currentNodeIconConfig = useMemo<NodeIconResult | null>(() => {
    if (!flowExecutionState?.currentNodeId) {
      // Default: messageReceived icon
      return { type: "phosphor", phosphorIcon: "Chats", bgColor: "bg-blue-500" };
    }
    const node = flowNodesList?.find((n) => n.id === flowExecutionState.currentNodeId);
    if (!node) return { type: "phosphor", phosphorIcon: "Chats", bgColor: "bg-blue-500" };
    return getNodeIconConfig(node.type, node.data as { icon?: string } | undefined);
  }, [flowExecutionState, flowNodesList]);

  const handleSelectConversation = (_conversationId: string) => {
    // No-op for now — builder sidebar doesn't expose conversation switching
  };

  const handleNodeSelect = useCallback((nodeId: string | null, nodeType: string | null, initialData?: Record<string, unknown>) => {
    if (nodeId && nodeType) {
      setSelectedNode({ id: nodeId, type: nodeType });
      // On narrow screens, close chat panel to avoid double overlay
      if (typeof window !== "undefined" && window.innerWidth < 1280) {
        setShowChat(false);
      }
      // Always store initial data if provided - this ensures variant and other properties are available
      if (initialData) {
        setFlowNodesData((prev) => ({
          ...prev,
          [nodeId]: { ...prev[nodeId], ...initialData },
        }));
      }
    } else {
      setSelectedNode(null);
    }
  }, []);

  // Handle condition added from canvas (sync flowNodesData with canvas)
  const handleConditionAdded = useCallback((conditionNodeId: string, conditions: Array<{id: string; text: string}>) => {
    setFlowNodesData((prev) => ({
      ...prev,
      [conditionNodeId]: {
        ...prev[conditionNodeId],
        conditions,
      },
    }));
    setHasChanges(true);
  }, []);

  // Helper to extract timestamp from condition or branch node ID
  const getConditionTimestamp = useCallback((nodeId: string): string | null => {
    if (nodeId.startsWith('condition-')) {
      return nodeId.replace('condition-', '');
    }
    if (nodeId.startsWith('branch-')) {
      // branch-1737800000000-0 -> 1737800000000
      const parts = nodeId.replace('branch-', '').split('-');
      return parts[0] || null;
    }
    return null;
  }, []);

  // Helper to extract branch index from branch node ID
  const getBranchIndex = useCallback((nodeId: string): number | undefined => {
    if (nodeId.startsWith('branch-')) {
      // branch-1737800000000-0 -> 0
      const parts = nodeId.replace('branch-', '').split('-');
      return parts[1] !== undefined ? parseInt(parts[1], 10) : undefined;
    }
    return undefined;
  }, []);

  // Get the parent condition node ID from a branch node ID
  const getParentConditionNodeId = useCallback((nodeId: string): string | null => {
    const timestamp = getConditionTimestamp(nodeId);
    return timestamp ? `condition-${timestamp}` : null;
  }, [getConditionTimestamp]);

  // Handle condition deleted from right panel
  const handleDeleteCondition = useCallback((conditionIndex: number) => {
    if (!selectedNode) return;

    // Determine the condition node ID
    const isBranch = selectedNode.type === "conditionBranch";
    const timestamp = getConditionTimestamp(selectedNode.id);
    const conditionNodeId = isBranch
      ? getParentConditionNodeId(selectedNode.id)
      : selectedNode.id;

    if (!conditionNodeId || !timestamp) return;

    // Get current conditions
    const currentConditions = (flowNodesData[conditionNodeId]?.conditions as Array<{id: string; text: string}>) || [];

    // Don't allow deleting if only 1 condition remains
    if (currentConditions.length <= 1) return;

    // Remove the condition at index
    const updatedConditions = currentConditions.filter((_, i) => i !== conditionIndex);

    // Update flowNodesData
    setFlowNodesData((prev) => ({
      ...prev,
      [conditionNodeId]: {
        ...prev[conditionNodeId],
        conditions: updatedConditions,
      },
    }));

    // Tell the canvas to remove the branch node
    if (canvasRef.current) {
      const branchIdToRemove = `branch-${timestamp}-${conditionIndex}`;
      canvasRef.current.removeBranchNode(conditionNodeId, branchIdToRemove, conditionIndex, updatedConditions);
    }

    // Select the condition node (in case we were viewing the deleted branch)
    setSelectedNode({ id: conditionNodeId, type: "condition" });

    setHasChanges(true);
  }, [selectedNode, flowNodesData, getConditionTimestamp, getParentConditionNodeId]);

  // Handler for condition settings updates - also syncs to canvas branch nodes
  const handleConditionUpdate = useCallback((settings: { conditions: Array<{id: string; text: string}>; model: string; forceSelectBranch: boolean }) => {
    if (!selectedNode) return;

    // Determine the condition node ID (could be selected directly or via a branch)
    const isBranch = selectedNode.type === "conditionBranch";
    const timestamp = getConditionTimestamp(selectedNode.id);
    const conditionNodeId = isBranch
      ? getParentConditionNodeId(selectedNode.id)
      : selectedNode.id;

    if (!conditionNodeId || !timestamp) return;

    // Get current conditions count from the CONDITION node (not branch)
    const currentConditions = (flowNodesData[conditionNodeId]?.conditions as Array<{id: string; text: string}>) || [];
    const previousCount = currentConditions.length;

    // Update the CONDITION node data (not the branch node)
    updateNodeData(conditionNodeId, settings);

    // Also update/create the branch nodes on the canvas
    if (canvasRef.current) {
      // Update branch nodes
      settings.conditions.forEach((condition, index) => {
        const branchId = `branch-${timestamp}-${index}`;

        // If this is a new condition (index >= previousCount), create the branch node
        if (index >= previousCount) {
          canvasRef.current?.addBranchNode(conditionNodeId, branchId, index);
        }

        // Update the text (for both new and existing branches)
        canvasRef.current?.updateBranchNodeText(branchId, condition.text);
      });

      // Sync the condition node's data.conditions to update handles
      const syncedConditions = settings.conditions.map((c, i) => ({
        id: `branch-${timestamp}-${i}`,
        text: c.text,
      }));
      canvasRef.current?.updateConditionNodeData(conditionNodeId, syncedConditions);
    }
  }, [selectedNode, updateNodeData, getConditionTimestamp, getParentConditionNodeId, flowNodesData]);

  // Get previous steps in the workflow for data injection
  // Filters to show only related/similar node types based on current node context
  const getPreviousSteps = useCallback((nodeId: string, currentNodeType?: string) => {
    if (!canvasRef.current) return [];

    const flowData = canvasRef.current.getFlowData();
    if (!flowData || !flowData.nodes || !flowData.edges) return [];

    const { nodes, edges } = flowData;

    // Build a map of node ID to node
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Define which node types are related to each other
    const getRelatedTypes = (nodeType: string): string[] => {
      switch (nodeType) {
        case "chatAgent":
        case "messageReceived":
          // Chat-related nodes only show other chat nodes
          return ["messageReceived", "chatAgent"];
        case "agentStep":
          // Agent steps can use data from any previous step
          return ["messageReceived", "chatAgent", "agentStep", "condition", "conditionBranch"];
        case "condition":
        case "conditionBranch":
          // Conditions can use data from any previous step
          return ["messageReceived", "chatAgent", "agentStep", "condition", "conditionBranch"];
        default:
          return ["messageReceived", "chatAgent", "agentStep"];
      }
    };

    const relatedTypes = currentNodeType ? getRelatedTypes(currentNodeType) : [];

    // Find all predecessor nodes by traversing edges backwards
    const predecessors: string[] = [];
    const visited = new Set<string>();
    const queue: string[] = [nodeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // Find all edges where target is currentId
      const incomingEdges = edges.filter(e => e.target === currentId);
      for (const edge of incomingEdges) {
        const sourceId = edge.source;
        const sourceNode = nodeMap.get(sourceId);

        // Only add if it's a related type
        if (sourceId !== nodeId &&
            !predecessors.includes(sourceId) &&
            sourceNode &&
            relatedTypes.includes(sourceNode.type)) {
          predecessors.push(sourceId);
        }
        if (!visited.has(sourceId)) {
          queue.push(sourceId);
        }
      }
    }

    // Map node types to their injectable fields
    const getFieldsForNodeType = (type: string) => {
      switch (type) {
        case "messageReceived":
          return [
            { id: "message", label: "Message content" },
            { id: "sender", label: "Sender name" },
            { id: "timestamp", label: "Timestamp" },
          ];
        case "chatAgent":
          return [
            { id: "response", label: "Agent response" },
            { id: "conversationId", label: "Conversation ID" },
          ];
        case "agentStep":
          return [
            { id: "output", label: "Step output" },
            { id: "status", label: "Step status" },
          ];
        case "condition":
        case "conditionBranch":
          return [
            { id: "selectedBranch", label: "Selected branch" },
            { id: "result", label: "Evaluation result" },
          ];
        default:
          return [
            { id: "output", label: "Output" },
          ];
      }
    };

    // Convert to PreviousStep format
    return predecessors.map(predId => {
      const node = nodeMap.get(predId);
      if (!node) return null;

      const nodeData = flowNodesData[predId] || {};
      const label = (nodeData.label as string) || node.type || "Step";

      return {
        id: predId,
        label,
        type: node.type,
        icon: node.type === "messageReceived" ? "ph:chats-fill" : "ph:robot-fill",
        fields: getFieldsForNodeType(node.type),
      };
    }).filter(Boolean) as Array<{
      id: string;
      label: string;
      type: string;
      icon?: string;
      fields?: { id: string; label: string }[];
    }>;
  }, [flowNodesData]);

  // Compute upstream nodes for the selected node (used by inject sidebar)
  const selectedUpstreamNodes = useMemo((): UpstreamNode[] => {
    if (!selectedNode || !canvasRef.current) return [];
    const flowData = canvasRef.current.getFlowData();
    if (!flowData?.nodes?.length || !flowData?.edges?.length) return [];

    return getUpstreamNodes(
      selectedNode.id,
      flowData.nodes.map((n) => ({
        id: n.id,
        type: n.type || "",
        data: (flowNodesData[n.id] || {}) as Record<string, unknown>,
      })),
      flowData.edges.map((e) => ({ source: e.source, target: e.target })),
    );
  }, [selectedNode, flowNodesData]);

  // Builder conversation ID — persists across messages within a session
  const [builderConversationId, setBuilderConversationId] = useState<string | null>(null);

  const handleSidebarSubmit = async (promptOverride?: string) => {
    const inputText = promptOverride || sidebarInput;
    if (!inputText.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      role: "user" as const,
      content: inputText,
    };

    setSidebarMessages((prev) => [...prev, userMessage]);
    setSidebarInput("");
    setIsLoading(true);

    try {
      // Create a conversation on first message
      let convId = builderConversationId;
      if (!convId) {
        const conv = await createConversation.mutateAsync({
          agentId: agent.id,
          title: `Builder: ${inputText.slice(0, 50)}`,
        });
        convId = conv.id;
        setBuilderConversationId(convId);
      }

      // Build flow state snapshot from canvas
      const flowState = canvasRef.current?.getFlowStateSnapshot() ?? {
        nodes: [],
        edges: [],
        summary: "Empty flow — no nodes configured yet.",
      };

      // Build message history for context
      const messageHistory = sidebarMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      messageHistory.push({ role: "user", content: inputText });

      // Call the flow-builder API with SSE streaming
      const response = await fetch("/api/agents/flow-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId,
          messages: messageHistory,
          agentId: agent.id,
          flowState,
        }),
      });

      if (!response.ok) {
        throw new Error(`Builder API error: ${response.status}`);
      }

      // Process SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let assistantContent = "";
      const assistantMessageId = (Date.now() + 1).toString();

      // Add empty assistant message that we'll fill via streaming
      setSidebarMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: "assistant" as const, content: "" },
      ]);

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "text-delta" && event.delta) {
              setStreamingToolName(null); // Clear tool indicator when text resumes
              assistantContent += event.delta;
              setSidebarMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: assistantContent }
                    : m
                )
              );
            } else if (event.type === "tool-input-start") {
              // Show tool indicator in sidebar
              setStreamingToolName(event.toolName ?? null);
            } else if (event.type === "tool-output-available") {
              setStreamingToolName(null);
            } else if (event.type === "flow-command" && event.command) {
              handleFlowCommand(event.command as FlowCommand);
            } else if (event.type === "error") {
              console.error("Builder stream error:", event.message);
              // Surface the error in the assistant message
              const errorText = event.message || "An error occurred";
              assistantContent += `\n\n**Error:** ${errorText}`;
              setSidebarMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: assistantContent }
                    : m
                )
              );
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // If no text was streamed, add a default message
      if (!assistantContent.trim()) {
        setSidebarMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content: "Done! I've updated the flow." }
              : m
          )
        );
      }
    } catch (error) {
      console.error("Builder error:", error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant" as const,
        content: "Désolé, une erreur est survenue. Veuillez réessayer.",
      };
      setSidebarMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setStreamingToolName(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#FAF9F6]">
      <FlowEditorHeader
        agentId={agent.id}
        agentName={agent.name}
        isEnabled={agent.isEnabled}
        isDraft={true}
        activeTab={activeTab}
        hasChanges={hasChanges}
        isSaving={saveFlowData.isPending}
        onTabChange={setActiveTab}
        onToggleEnabled={handleToggleEnabled}
        onPublish={handlePublish}
        onTest={handleTest}
        onShare={handleShare}
      />

      <div className="flex-1 flex overflow-visible min-h-0">
        {/* Sidebar - always visible by default */}
        {showSidebar && (
          <FlowEditorSidebar
            agentId={agent.id}
            conversations={conversations.data?.items ?? []}
            messages={sidebarMessages}
            input={sidebarInput}
            isLoading={isLoading}
            isFlowEmpty={flowNodeCount <= 1}
            streamingToolName={streamingToolName}
            connectedIntegrations={connectedIntegrationTypes}
            onInputChange={setSidebarInput}
            onSubmit={handleSidebarSubmit}
            onClose={() => setShowSidebar(false)}
            onNewConversation={handleNewConversation}
            onSelectConversation={handleSelectConversation}
          />
        )}

        {/* Main content area */}
        <div className={`flex-1 relative min-h-0 ${activeTab === "flow" ? "overflow-visible" : activeTab === "tasks" ? "overflow-hidden" : "overflow-auto"}`}>
          {activeTab === "flow" && (
            <div className="flex h-full overflow-visible min-h-0 relative">
              {/* Canvas area */}
              <div className="flex-1 relative">
                <FlowEditorCanvas
                  ref={canvasRef}
                  agentId={agent.id}
                  agentName={agent.name}
                  agentDescription={agent.description || undefined}
                  systemPrompt={agent.systemPrompt}
                  onAddNode={() => console.log("Add node")}
                  onNodeSelect={handleNodeSelect}
                  onFlowChange={() => {
                    setHasChanges(true);
                    const snapshot = canvasRef.current?.getFlowStateSnapshot();
                    if (snapshot) setFlowNodeCount(snapshot.nodes.length);
                  }}
                  onConditionAdded={handleConditionAdded}
                  onOpenReplaceModal={handleOpenReplaceModal}
                  initialFlowData={templateFlowData}
                  executionState={flowExecutionState ?? undefined}
                />
                <FlowEditorToolbar
                  onAsk={() => setShowSidebar(true)}
                  onAdd={() => console.log("Add")}
                  onUndo={() => console.log("Undo")}
                  onRedo={() => console.log("Redo")}
                  onAutoLayout={() => console.log("Auto layout")}
                  onFitView={() => canvasRef.current?.fitView()}
                  onClearLastRun={() => setFlowExecutionState(null)}
                  hasLastRun={flowExecutionState !== null && !flowExecutionState.isRunning}
                />
              </div>

              {/* Chat split panel */}
              {showChat && chatConversationId && (
                <div className="absolute right-0 top-0 h-full w-[420px] border-l border-[#E5E7EB] bg-white flex flex-col min-h-0 z-20 shadow-lg xl:relative xl:shadow-none xl:z-auto overflow-hidden">
                  {/* Header: shows current node or "Message Received" */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#E5E7EB]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setShowChat(false); }}
                        className="size-7 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors"
                      >
                        <ArrowLeft className="size-4" />
                      </button>
                      <div className="flex items-center gap-1.5">
                        {currentNodeIconConfig && (
                          <div className={`size-[22px] rounded-[5px] ${currentNodeIconConfig.bgColor} flex items-center justify-center`}>
                            {currentNodeIconConfig.type === "phosphor" ? (
                              (() => {
                                const PHOSPHOR_MAP: Record<string, typeof Chats> = {
                                  Chats, Robot, GitBranch, MagnifyingGlass, ArrowsClockwise, Sparkle, ChatCircle,
                                };
                                const PhIcon = PHOSPHOR_MAP[currentNodeIconConfig.phosphorIcon] || Chats;
                                return <PhIcon className="size-3 text-white" weight="fill" />;
                              })()
                            ) : (
                              <Icon icon={currentNodeIconConfig.icon} className={`size-3 ${currentNodeIconConfig.icon.startsWith("logos:") ? "" : "text-white"}`} />
                            )}
                          </div>
                        )}
                        <span className="text-sm font-medium text-[#374151]">
                          {currentNodeLabel || "Message Received"}
                        </span>
                      </div>
                    </div>
                    {flowExecutionState?.errorNodeIds?.length && !flowExecutionState.isRunning && retryFromFailedFn ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => retryFromFailedFn()}
                          className="text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors px-2 py-1 rounded-lg hover:bg-orange-50"
                        >
                          Retry from failed
                        </button>
                        <button
                          onClick={() => {
                            setChatConversationId(null);
                            setFlowExecutionState(null);
                            setRetryFromFailedFn(null);
                            createConversation.mutate(
                              { agentId: agent.id },
                              {
                                onSuccess: (conversation) => {
                                  setChatConversationId(conversation.id);
                                },
                              }
                            );
                          }}
                          className="text-sm font-medium text-[#374151] hover:text-[#111827] transition-colors px-2 py-1 rounded-lg hover:bg-[#F3F4F6]"
                        >
                          Restart
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setChatConversationId(null);
                          setFlowExecutionState(null);
                          setRetryFromFailedFn(null);
                          createConversation.mutate(
                            { agentId: agent.id },
                            {
                              onSuccess: (conversation) => {
                                setChatConversationId(conversation.id);
                              },
                            }
                          );
                        }}
                        className="text-sm font-medium text-[#374151] hover:text-[#111827] transition-colors px-2 py-1 rounded-lg hover:bg-[#F3F4F6]"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                  <div className="flex-1 min-h-0">
                    <ChatInterface
                      key={chatConversationId}
                      conversationId={chatConversationId}
                      agentId={agent.id}
                      agentName={agent.name}
                      agentAvatar={agent.avatar}
                      flowNodes={flowNodesList}
                      flowEdges={flowEdgesList}
                      onExecutionStateChange={setFlowExecutionState}
                      onRetryFromFailed={(fn) => setRetryFromFailedFn(() => fn)}
                      mode="chat"
                      getFlowData={getFlowData}
                      initialGreeting={messageReceivedData.greeting}
                      conversationStarters={messageReceivedData.starters}
                    />
                  </div>
                </div>
              )}

              {/* Right panel for selected node - don't show for addNode or chatOutcome */}
              {selectedNode && selectedNode.type !== "addNode" && selectedNode.type !== "chatOutcome" && (
                <div className="absolute right-0 top-0 h-full w-[340px] border-l border-[#E5E7EB] bg-white overflow-visible flex flex-col min-h-0 z-20 shadow-lg xl:relative xl:shadow-none xl:z-auto">
                  {selectedNode.type === "searchKnowledgeBase" ? (
                    <SearchKnowledgeBaseSettings
                      nodeId={selectedNode.id}
                      onUpdate={(settings) => console.log("KB settings:", settings)}
                    />
                  ) : selectedNode.type === "enterLoop" ? (
                    <EnterLoopSettings
                      nodeId={selectedNode.id}
                      nodeName={(selectedNodeData?.label as string) || undefined}
                      items={(selectedNodeData?.items as string) || undefined}
                      maxCycles={(selectedNodeData?.maxCycles as number) || undefined}
                      maxCyclesPrompt={(selectedNodeData?.maxCyclesPrompt as string) || undefined}
                      output={(selectedNodeData?.output as string) || undefined}
                      model={(selectedNodeData?.model as string) || undefined}
                      onUpdate={(settings) => updateNodeData(selectedNode.id, settings as unknown as Record<string, unknown>)}
                      onDelete={() => handleDeleteNode(selectedNode.id)}
                      onRename={(newName) => handleRenameNode(selectedNode.id, newName)}
                      onReplace={() => handleOpenReplaceModal(selectedNode.id)}
                    />
                  ) : selectedNode.type === "exitLoop" ? (
                    <ExitLoopSettings
                      nodeId={selectedNode.id}
                      nodeName={(selectedNodeData?.label as string) || undefined}
                      output={(selectedNodeData?.output as string) || undefined}
                      onUpdate={(settings) => updateNodeData(selectedNode.id, settings as unknown as Record<string, unknown>)}
                      onDelete={() => handleDeleteNode(selectedNode.id)}
                      onRename={(newName) => handleRenameNode(selectedNode.id, newName)}
                      onReplace={() => handleOpenReplaceModal(selectedNode.id)}
                    />
                  ) : selectedNode.type === "condition" || selectedNode.type === "conditionBranch" ? (
                    (() => {
                      // For branch nodes, get data from parent condition node
                      const isBranch = selectedNode.type === "conditionBranch";
                      const parentNodeId = isBranch ? getParentConditionNodeId(selectedNode.id) : selectedNode.id;
                      const parentData = parentNodeId ? flowNodesData[parentNodeId] : selectedNodeData;
                      const branchIndex = isBranch ? getBranchIndex(selectedNode.id) : undefined;
                      const conditionNodeId = parentNodeId || selectedNode.id;

                      return (
                        <ConditionSettings
                          nodeId={selectedNode.id}
                          nodeName={(parentData?.label as string) || "Condition"}
                          conditions={(parentData?.conditions as Array<{id: string; text: string; label?: string}>) || []}
                          model={(parentData?.model as string) || "claude-haiku"}
                          forceSelectBranch={(parentData?.forceSelectBranch as boolean) || false}
                          upstreamNodes={selectedUpstreamNodes}
                          onUpdate={handleConditionUpdate}
                          onDeleteCondition={handleDeleteCondition}
                          onRename={(newName) => handleRenameNode(conditionNodeId, newName)}
                          onReplace={() => handleOpenReplaceModal(conditionNodeId)}
                          selectedBranchIndex={branchIndex}
                        />
                      );
                    })()
                  ) : selectedNode.type === "peopleDataLabs" ? (
                    <PeopleDataLabsSettings
                      nodeId={selectedNode.id}
                      nodeName={(selectedNodeData?.label as string) || "Search for leads"}
                      actionType={(selectedNodeData?.actionType as string) || undefined}
                      onUpdate={(settings) => updateNodeData(selectedNode.id, settings as unknown as Record<string, unknown>)}
                      onDelete={() => handleDeleteNode(selectedNode.id)}
                      onRename={(newName) => handleRenameNode(selectedNode.id, newName)}
                      onReplace={() => handleOpenReplaceModal(selectedNode.id)}
                    />
                  ) : ["googleSheets", "googleDrive", "googleDocs", "googleCalendar", "gmail", "outlook", "outlookCalendar", "microsoftTeams", "slack", "notion"].includes(selectedNode.type) ? (
                    <IntegrationActionPanel
                      actionId={selectedNode.type.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}
                      nodeId={selectedNode.id}
                      nodeName={(selectedNodeData?.label as string) || undefined}
                      nodeData={selectedNodeData as Record<string, unknown> | undefined}
                      onDelete={() => handleDeleteNode(selectedNode.id)}
                      onRename={(newName) => handleRenameNode(selectedNode.id, newName)}
                      onReplace={() => handleOpenReplaceModal(selectedNode.id)}
                      onUpdate={(data) => updateNodeData(selectedNode.id, data)}
                    />
                  ) : selectedNode.type === "chatAgent" ? (
                    <FlowNodePanel
                      nodeType="chatAgent"
                      nodeId={selectedNode.id}
                      nodeName={(selectedNodeData?.label as string) || ""}
                      model={(selectedNodeData?.model as string) || ""}
                      variant={(selectedNodeData?.variant as "observe" | "send") || "observe"}
                      message={(selectedNodeData?.message as string) || ""}
                      previousSteps={getPreviousSteps(selectedNode.id, "chatAgent")}
                      onClose={() => setSelectedNode(null)}
                      onUpdate={(data) => updateNodeData(selectedNode.id, data)}
                      onDelete={() => handleDeleteNode(selectedNode.id)}
                      onRename={(newName) => handleRenameNode(selectedNode.id, newName)}
                      onReplace={() => handleOpenReplaceModal(selectedNode.id)}
                    />
                  ) : selectedNode.type === "action" || selectedNode.type === "composioAction" ? (
                    <ActionNodeSettings
                      nodeId={selectedNode.id}
                      nodeName={(selectedNodeData?.label as string) || undefined}
                      nodeData={selectedNodeData || {}}
                      upstreamNodes={selectedUpstreamNodes}
                      onUpdate={(data) => updateNodeData(selectedNode.id, data)}
                      onDelete={() => handleDeleteNode(selectedNode.id)}
                      onRename={(newName) => handleRenameNode(selectedNode.id, newName)}
                      onReplace={() => handleOpenReplaceModal(selectedNode.id)}
                    />
                  ) : (
                    <FlowNodePanel
                      nodeType={selectedNode.type as "messageReceived" | "agentStep"}
                      nodeId={selectedNode.id}
                      nodeName={(selectedNodeData?.label as string) || ""}
                      greetingMessage={(selectedNodeData?.greetingMessage as string) || ""}
                      conversationStarters={(selectedNodeData?.conversationStarters as Array<{id: string; text: string; enabled: boolean}>) || []}
                      prompt={(selectedNodeData?.prompt as string) || ""}
                      model={(selectedNodeData?.model as string) || ""}
                      skills={(selectedNodeData?.skills as Array<{id: string; name: string; service: string; icon: string; isPremium?: boolean}>) || []}
                      onClose={() => setSelectedNode(null)}
                      onUpdate={(data) => updateNodeData(selectedNode.id, data)}
                      onDelete={() => handleDeleteNode(selectedNode.id)}
                      onRename={(newName) => handleRenameNode(selectedNode.id, newName)}
                      onReplace={() => handleOpenReplaceModal(selectedNode.id)}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "settings" && (
            <FlowEditorSettings
              agentId={agent.id}
              agentName={agent.name}
              agentAvatar={agent.avatar}
              greetingMessage=""
              context={agent.context || agent.systemPrompt}
              model={agent.model}
              onUpdate={(data) => onUpdate?.(data)}
            />
          )}

          {activeTab === "tasks" && (
            <AgentChatTab
              agentId={agent.id}
              agentName={agent.name}
              agentAvatar={agent.avatar}
              conversationId={agentChatConversationId}
              onConversationChange={setAgentChatConversationId}
              flowNodes={flowNodesList}
              flowEdges={flowEdgesList}
              initialGreeting={messageReceivedData.greeting}
              conversationStarters={messageReceivedData.starters}
            />
          )}
        </div>
      </div>

      {/* Replace node modal */}
      <AddActionModal
        open={showReplaceModal}
        onOpenChange={setShowReplaceModal}
        agentId={agent.id}
        onSelectStructuralNode={handleReplaceAction}
        onSelectAction={handleComposioActionSelection}
      />
    </div>
  );
}
