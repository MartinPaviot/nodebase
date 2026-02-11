"use client";

import { Suspense, use } from "react";
import { FlowEditor } from "@/features/agents/components/flow-editor";
import { useSuspenseAgent, useUpdateAgent } from "@/features/agents/hooks/use-agents";
import { useTemplate } from "@/features/templates/hooks/use-templates";
import { CircleNotch } from "@phosphor-icons/react";
import { ErrorBoundary } from "react-error-boundary";

type Props = {
  params: Promise<{ agentId: string }>;
};

function FlowEditorContent({ agentId }: { agentId: string }) {
  const agent = useSuspenseAgent(agentId);
  const updateAgent = useUpdateAgent();

  // Fetch template separately if agent has templateId
  const template = useTemplate(agent.data.templateId);

  const handleUpdate = (data: { id?: string; name?: string; description?: string | null; systemPrompt?: string; avatar?: string | null; isEnabled?: boolean }) => {
    updateAgent.mutate({
      id: agentId,
      ...data,
      description: data.description ?? undefined,
    });
  };

  // Extract flowData from template query
  const templateFlowData = template.data?.flowData as {
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
  } | undefined;

  return (
    <FlowEditor
        agent={{
          id: agent.data.id,
          name: agent.data.name,
          description: agent.data.description ?? undefined,
          systemPrompt: agent.data.systemPrompt,
          avatar: agent.data.avatar,
          isEnabled: agent.data.isEnabled,
          templateId: agent.data.templateId,
        }}
        onUpdate={handleUpdate}
        templateFlowData={templateFlowData}
    />
  );
}

export default function FlowEditorPage({ params }: Props) {
  const { agentId } = use(params);

  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center justify-center h-screen">
          <p className="text-destructive">Error loading agent flow editor</p>
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen">
            <CircleNotch className="size-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <FlowEditorContent agentId={agentId} />
      </Suspense>
    </ErrorBoundary>
  );
}
