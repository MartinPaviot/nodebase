import { ConversationView } from "@/features/agents/components/conversation-view";
import { prefetchConversation } from "@/features/agents/server/prefetch";
import { requireAuth } from "@/lib/auth-utils";
import { HydrateClient } from "@/trpc/server";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Spinner } from "@/components/ui/spinner";

type Props = {
  params: Promise<{ agentId: string; conversationId: string }>;
};

const Page = async ({ params }: Props) => {
  await requireAuth();

  const { conversationId } = await params;

  prefetchConversation(conversationId);

  return (
    <HydrateClient>
      <ErrorBoundary
        fallback={
          <div className="container py-8">
            <p className="text-destructive">Error loading conversation</p>
          </div>
        }
      >
        <Suspense
          fallback={
            <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
              <Spinner className="size-8" />
            </div>
          }
        >
          <ConversationView conversationId={conversationId} />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  );
};

export default Page;
