"use client";

import { use } from "react";
import { FlowEditor } from "@/features/agents/components/flow-editor";
import { useAgent, useUpdateAgent } from "@/features/agents/hooks/use-agents";
import { useTemplate } from "@/features/templates/hooks/use-templates";
import { CircleNotch } from "@phosphor-icons/react";

type Props = {
  params: Promise<{ agentId: string }>;
};

function FlowEditorContent({ agentId }: { agentId: string }) {
  const agent = useAgent(agentId);
  const updateAgent = useUpdateAgent();

  // Fetch template separately if agent has templateId
  const template = useTemplate(agent.data?.templateId);

  const handleUpdate = (data: Record<string, unknown>) => {
    updateAgent.mutate({
      id: agentId,
      ...data,
    });
  };

  // Loading state - wait for agent AND template (if templateId exists)
  const isLoadingTemplate = agent.data?.templateId && template.isLoading;
  if (agent.isLoading || isLoadingTemplate) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#FAF9F6]">
        <CircleNotch className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (agent.error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#FAF9F6] gap-4">
        <p className="text-destructive font-medium">Error loading agent</p>
        <p className="text-sm text-muted-foreground max-w-md text-center">
          {agent.error.message}
        </p>
      </div>
    );
  }

  // No data state
  if (!agent.data) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#FAF9F6]">
        <p className="text-muted-foreground">Agent not found</p>
      </div>
    );
  }

  // FlowData type
  type FlowData = {
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
  };

  // Priority: agent's saved flowData > template's flowData
  // If agent has saved flowData, use it; otherwise fall back to template
  const agentFlowData = agent.data?.flowData as FlowData | undefined;
  const templateFlowData = template.data?.flowData as FlowData | undefined;

  // Use agent's flowData if it exists and has nodes, otherwise use template's
  const flowDataToUse = (agentFlowData?.nodes && agentFlowData.nodes.length > 0)
    ? agentFlowData
    : templateFlowData;

  return (
    <FlowEditor
      agent={{
        id: agent.data.id,
        name: agent.data.name,
        description: agent.data.description ?? undefined,
        systemPrompt: agent.data.systemPrompt,
        avatar: agent.data.avatar,
        isEnabled: agent.data.isEnabled,
        context: agent.data.context ?? undefined,
        model: agent.data.model ?? undefined,
        temperature: agent.data.temperature ?? undefined,
        templateId: agent.data.templateId,
      }}
      onUpdate={handleUpdate}
      templateFlowData={flowDataToUse}
    />
  );
}

export default function AgentPage({ params }: Props) {
  const { agentId } = use(params);

  return <FlowEditorContent agentId={agentId} />;
}
