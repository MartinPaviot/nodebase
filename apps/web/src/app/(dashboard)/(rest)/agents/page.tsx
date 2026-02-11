import {
  AgentsContainer,
  AgentsList,
  AgentsLoading,
  AgentsError,
} from "@/features/agents/components/agents";
import { agentsParamsLoader } from "@/features/agents/server/params-loader";
import { prefetchAgents } from "@/features/agents/server/prefetch";
import { requireAuth } from "@/lib/auth-utils";
import { HydrateClient } from "@/trpc/server";
import { SearchParams } from "nuqs/server";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

type Props = {
  searchParams: Promise<SearchParams>;
};

const Page = async ({ searchParams }: Props) => {
  await requireAuth();

  const params = await agentsParamsLoader(searchParams);
  prefetchAgents(params);

  return (
    <AgentsContainer>
      <HydrateClient>
        <ErrorBoundary fallback={<AgentsError />}>
          <Suspense fallback={<AgentsLoading />}>
            <AgentsList />
          </Suspense>
        </ErrorBoundary>
      </HydrateClient>
    </AgentsContainer>
  );
};

export default Page;
