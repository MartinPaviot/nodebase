import { GlobalChat } from "@/features/agents/components/global-chat";
import { requireAuth } from "@/lib/auth-utils";
import { HydrateClient } from "@/trpc/server";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Spinner } from "@/components/ui/spinner";

const Page = async () => {
  await requireAuth();

  return (
    <HydrateClient>
      <ErrorBoundary
        fallback={
          <div className="h-full flex items-center justify-center">
            <p className="text-destructive">Error loading conversations</p>
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
          <GlobalChat />
        </Suspense>
      </ErrorBoundary>
    </HydrateClient>
  );
};

export default Page;
