import { ChatLayout } from "@/features/agents/components/chat-layout";
import {
  prefetchAgent,
  prefetchConversations,
} from "@/features/agents/server/prefetch";
import { requireAuth } from "@/lib/auth-utils";
import { HydrateClient } from "@/trpc/server";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Spinner } from "@/components/ui/spinner";

type Props = {
  params: Promise<{ agentId: string }>;
  children: React.ReactNode;
};

const Layout = async ({ params, children }: Props) => {
  await requireAuth();

  const { agentId } = await params;

  prefetchAgent(agentId);
  prefetchConversations(agentId);

  return (
    <HydrateClient>
      <ErrorBoundary
        fallback={
          <div className="h-full flex items-center justify-center">
            <p className="text-destructive">Error loading chat</p>
          </div>
        }
      >
        <Suspense
          fallback={
            <div className="h-full flex items-center justify-center">
              <Spinner className="size-8" />
            </div>
          }
        >
          <ChatLayout agentId={agentId}>{children}</ChatLayout>
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  );
};

export default Layout;
