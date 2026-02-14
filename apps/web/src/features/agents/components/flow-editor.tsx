"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { FlowEditorHeader } from "./flow-editor-header";
import { FlowEditorCanvas, type FlowEditorCanvasRef, type FlowExecutionState } from "./flow-editor-canvas";
import { FlowEditorSidebar } from "./flow-editor-sidebar";
import { FlowEditorToolbar } from "./flow-editor-toolbar";
import { FlowEditorSettings } from "./flow-editor-settings";
import { AgentPurposeCard } from "./agent-purpose-card";
import { FlowNodePanel } from "./flow-node-panel";
import { SearchKnowledgeBaseSettings } from "./search-knowledge-base-settings";
import { EnterLoopSettings } from "./enter-loop-settings";
import { ConditionSettings } from "./condition-settings";
import { PeopleDataLabsSettings } from "./people-data-labs-settings";
import { IntegrationActionPanel } from "./integration-action-panel";
import { AddActionModal } from "./add-action-modal";
import { ChatInterface } from "./chat-interface";
import { X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useConversations, useCreateConversation, useSaveFlowData } from "../hooks/use-agents";

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

  const [activeTab, setActiveTab] = useState<"settings" | "flow" | "tasks">("flow");
  const [showSidebar, setShowSidebar] = useState(false);

  // Chat split view state
  const [showChat, setShowChat] = useState(false);
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);
  const [flowExecutionState, setFlowExecutionState] = useState<FlowExecutionState | null>(null);
  const [sidebarMessages, setSidebarMessages] = useState<
    { id: string; role: "user" | "assistant"; content: string }[]
  >([]);
  const [sidebarInput, setSidebarInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // AI-generated purpose card state
  const [purposeCard, setPurposeCard] = useState<{
    description: string;
    trigger: string;
    tools: string[];
    features: string[];
  } | null>(null);

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
    // Navigate to chat with this agent
    router.push(`/agents/${agent.id}/chat`);
  };

  const handleShare = () => {
    // TODO: Implement share logic
    console.log("Sharing agent:", agent.id);
  };

  const handleToggleEnabled = (enabled: boolean) => {
    onUpdate?.({ isEnabled: enabled });
  };

  const handleNewConversation = () => {
    createConversation.mutate(
      { agentId: agent.id },
      {
        onSuccess: (conversation) => {
          router.push(`/agents/${agent.id}/chat/${conversation.id}`);
        },
      }
    );
  };

  // Toggle chat split view
  const handleToggleChat = useCallback(() => {
    if (showChat) {
      setShowChat(false);
      setFlowExecutionState(null);
      return;
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

  // Build flow nodes list for chat execution tracking
  const flowNodesList = useMemo(() => {
    if (!templateFlowData?.nodes) return undefined;
    return templateFlowData.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      data: node.data as { label?: string; composioActionName?: string; actionId?: string; [key: string]: unknown } | undefined,
    }));
  }, [templateFlowData]);

  const handleSelectConversation = (conversationId: string) => {
    router.push(`/agents/${agent.id}/chat/${conversationId}`);
  };

  const handleNodeSelect = useCallback((nodeId: string | null, nodeType: string | null, initialData?: Record<string, unknown>) => {
    if (nodeId && nodeType) {
      setSelectedNode({ id: nodeId, type: nodeType });
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

  const handleSidebarSubmit = async () => {
    if (!sidebarInput.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      role: "user" as const,
      content: sidebarInput,
    };

    setSidebarMessages((prev) => [...prev, userMessage]);
    const userInput = sidebarInput;
    setSidebarInput("");
    setIsLoading(true);

    try {
      // Call the purpose API to generate AI-based purpose card
      const response = await fetch("/api/agents/purpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: userInput,
          agentId: agent.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate purpose");
      }

      const data = await response.json();

      // Set the AI-generated purpose card
      if (data.purpose) {
        setPurposeCard({
          description: data.purpose.description || userInput,
          trigger: data.purpose.trigger || "Conversation (direct chat)",
          tools: data.purpose.tools || [],
          features: data.purpose.features || [],
        });
      }

      // Add assistant message
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant" as const,
        content: `J'ai analysé votre demande et configuré l'agent. Voici ce que votre agent va faire :\n\n• **But** : ${data.purpose?.description || userInput}\n• **Déclencheur** : ${data.purpose?.trigger || "Conversation"}\n\nVous pouvez voir le résumé sur le canvas. Voulez-vous modifier quelque chose ?`,
      };

      setSidebarMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error:", error);
      // Fallback: show a basic card
      setPurposeCard({
        description: userInput,
        trigger: "Conversation (direct chat)",
        tools: ["Web Search", "Browser"],
        features: ["Responds to user messages"],
      });

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant" as const,
        content: "J'ai créé une configuration de base pour votre agent. Vous pouvez l'affiner davantage.",
      };

      setSidebarMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
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
            onInputChange={setSidebarInput}
            onSubmit={handleSidebarSubmit}
            onClose={() => setShowSidebar(false)}
            onNewConversation={handleNewConversation}
            onSelectConversation={handleSelectConversation}
          />
        )}

        {/* Main content area */}
        <div className={`flex-1 relative min-h-0 ${activeTab === "flow" ? "overflow-visible" : "overflow-auto"}`}>
          {activeTab === "flow" && (
            <div className="flex h-full overflow-visible min-h-0">
              {/* Canvas area */}
              <div className="flex-1 relative">
                {/* AI-generated purpose card - positioned as overlay */}
                {purposeCard && (
                  <div className="absolute top-6 left-6 z-10">
                    <AgentPurposeCard
                      description={purposeCard.description}
                      trigger={purposeCard.trigger}
                      tools={purposeCard.tools}
                      features={purposeCard.features}
                    />
                  </div>
                )}

                <FlowEditorCanvas
                  ref={canvasRef}
                  agentId={agent.id}
                  agentName={agent.name}
                  agentDescription={agent.description || undefined}
                  systemPrompt={agent.systemPrompt}
                  onAddNode={() => console.log("Add node")}
                  onNodeSelect={handleNodeSelect}
                  onFlowChange={() => setHasChanges(true)}
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
                  onSettings={() => setActiveTab("settings")}
                  onChat={handleToggleChat}
                  isChatOpen={showChat}
                />
              </div>

              {/* Chat split panel */}
              {showChat && chatConversationId && (
                <div className="w-[420px] border-l border-[#E5E7EB] bg-white h-full flex flex-col min-h-0">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-[#E5E7EB]">
                    <span className="text-sm font-medium text-[#374151]">Chat with {agent.name}</span>
                    <button
                      onClick={() => { setShowChat(false); setFlowExecutionState(null); }}
                      className="size-7 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                    <ChatInterface
                      conversationId={chatConversationId}
                      agentName={agent.name}
                      agentAvatar={agent.avatar}
                      flowNodes={flowNodesList}
                      onExecutionStateChange={setFlowExecutionState}
                    />
                  </div>
                </div>
              )}

              {/* Right panel for selected node - don't show for addNode or chatOutcome */}
              {selectedNode && selectedNode.type !== "addNode" && selectedNode.type !== "chatOutcome" && (
                <div className="w-[340px] border-l border-[#E5E7EB] bg-white h-full overflow-visible flex flex-col min-h-0">
                  {selectedNode.type === "searchKnowledgeBase" ? (
                    <SearchKnowledgeBaseSettings
                      nodeId={selectedNode.id}
                      onUpdate={(settings) => console.log("KB settings:", settings)}
                    />
                  ) : selectedNode.type === "enterLoop" ? (
                    <EnterLoopSettings
                      nodeId={selectedNode.id}
                      onUpdate={(settings) => console.log("Loop settings:", settings)}
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
                          conditions={(parentData?.conditions as Array<{id: string; text: string}>) || []}
                          model={(parentData?.model as string) || "claude-haiku"}
                          forceSelectBranch={(parentData?.forceSelectBranch as boolean) || false}
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
                      actionId={(selectedNodeData?.actionId as string) || selectedNode.type.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}
                      nodeId={selectedNode.id}
                      nodeName={(selectedNodeData?.label as string) || undefined}
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
            <div className="flex-1 overflow-auto bg-[#FAF9F6] p-8">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-[24px] font-semibold text-[#1a1a1a] mb-6">Tasks</h2>
                <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 text-center">
                  <div className="size-16 rounded-2xl bg-[#F3F4F6] flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">📋</span>
                  </div>
                  <p className="text-[#6B7280] text-[15px]">No tasks yet</p>
                  <p className="text-[#9CA3AF] text-[13px] mt-1">
                    Tasks will appear here when your agent runs scheduled jobs
                  </p>
                </div>
              </div>
            </div>
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
