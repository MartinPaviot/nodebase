"use client";

import { formatDistanceToNow } from "date-fns";
import {
  EmptyView,
  EntityContainer,
  EntityHeader,
  EntityItem,
  EntityList,
  EntityPagination,
  EntitySearch,
  ErrorView,
  LoadingView,
} from "@/components/entity-components";
import {
  useCreateAgent,
  useRemoveAgent,
  useSuspenseAgents,
} from "../hooks/use-agents";
import { useUpgradeModal } from "@/hooks/use-upgrade-modal";
import { useRouter } from "next/navigation";
import { useAgentsParams } from "../hooks/use-agents-params";
import { useEntitySearch } from "../hooks/use-entity-search";
import type { Agent } from "@/generated/prisma";
import { BotIcon } from "lucide-react";

export const AgentsSearch = () => {
  const [params, setParams] = useAgentsParams();
  const { searchValue, onSearchChange } = useEntitySearch({
    params,
    setParams,
  });

  return (
    <EntitySearch
      value={searchValue}
      onChange={onSearchChange}
      placeholder="Search agents"
    />
  );
};

export const AgentsList = () => {
  const agents = useSuspenseAgents();

  return (
    <EntityList
      items={agents.data.items}
      getKey={(agent) => agent.id}
      renderItem={(agent) => <AgentItem data={agent} />}
      emptyView={<AgentsEmpty />}
    />
  );
};

export const AgentsHeader = ({ disabled }: { disabled?: boolean }) => {
  const router = useRouter();
  const { handleError, modal } = useUpgradeModal();

  const handleCreate = () => {
    router.push("/agents/new");
  };

  return (
    <>
      {modal}
      <EntityHeader
        title="Agents"
        description="Create and manage your AI agents"
        newButtonLabel="New agent"
        onNew={handleCreate}
        disabled={disabled}
        isCreating={false}
      />
    </>
  );
};

export const AgentsPagination = () => {
  const agents = useSuspenseAgents();
  const [params, setParams] = useAgentsParams();

  return (
    <EntityPagination
      disabled={agents.isFetching}
      totalPages={agents.data.totalPages}
      page={agents.data.page}
      onPageChange={(page) => setParams({ ...params, page })}
    />
  );
};

export const AgentsContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <EntityContainer
      header={<AgentsHeader />}
      search={<AgentsSearch />}
      pagination={<AgentsPagination />}
    >
      {children}
    </EntityContainer>
  );
};

export const AgentsLoading = () => {
  return <LoadingView message="Loading agents..." />;
};

export const AgentsError = () => {
  return <ErrorView message="Error loading agents" />;
};

export const AgentsEmpty = () => {
  const router = useRouter();
  const { handleError, modal } = useUpgradeModal();

  const handleCreate = () => {
    router.push("/agents/new");
  };

  return (
    <>
      {modal}
      <EmptyView
        onNew={handleCreate}
        message="You haven't created any agents yet. Get started by creating your first AI agent."
      />
    </>
  );
};

type AgentWithCount = Agent & {
  _count: {
    conversations: number;
  };
};

export const AgentItem = ({ data }: { data: AgentWithCount }) => {
  const removeAgent = useRemoveAgent();
  const handleRemove = () => {
    removeAgent.mutate({ id: data.id });
  };

  return (
    <EntityItem
      href={`/agents/${data.id}`}
      title={data.name}
      subtitle={
        <>
          {data._count.conversations} conversation
          {data._count.conversations !== 1 ? "s" : ""} &bull; Updated{" "}
          {formatDistanceToNow(data.updatedAt, { addSuffix: true })}
        </>
      }
      image={
        data.avatar ? (
          <img
            src={data.avatar}
            alt={data.name}
            className="size-8 rounded-full object-cover"
          />
        ) : (
          <div className="size-8 flex items-center justify-center rounded-full bg-primary/10">
            <BotIcon className="size-4 text-primary" />
          </div>
        )
      }
      onRemove={handleRemove}
      isRemoving={removeAgent.isPending}
    />
  );
};
