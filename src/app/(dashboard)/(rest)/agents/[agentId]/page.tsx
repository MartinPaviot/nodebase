import { AgentDetail } from "@/features/agents/components/agent-detail";
import {
  prefetchAgent,
  prefetchConversations,
} from "@/features/agents/server/prefetch";
import { requireAuth } from "@/lib/auth-utils";
import { HydrateClient } from "@/trpc/server";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Loader2Icon } from "lucide-react";

type Props = {
  params: Promise<{ agentId: string }>;
};

const Page = async ({ params }: Props) => {
  await requireAuth();

  const { agentId } = await params;

  prefetchAgent(agentId);
  prefetchConversations(agentId);

  return (
    <HydrateClient>
      <ErrorBoundary
        fallback={
          <div className="container py-8">
            <p className="text-destructive">Error loading agent</p>
          </div>
        }
      >
        <Suspense
          fallback={
            <div className="container py-8 flex items-center justify-center">
              <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <AgentDetail agentId={agentId} />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  );
};

export default Page;
