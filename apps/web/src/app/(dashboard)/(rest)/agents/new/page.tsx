import { Suspense } from "react";
import { HomePrompt } from "@/features/agents/components/home-prompt";
import { HomeSuggestions } from "@/features/agents/components/home-suggestions";
import { HomeTemplates } from "@/features/agents/components/home-templates";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAuth } from "@/lib/auth-utils";

export default async function NewAgentPage() {
  await requireAuth();

  return (
    <div className="min-h-full flex flex-col">
      {/* Hero section with gradient */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 bg-gradient-to-b from-primary/5 via-primary/10 to-transparent">
        <div className="w-full max-w-2xl mx-auto text-center space-y-8">
          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            How can I help?
          </h1>

          {/* Main prompt input */}
          <HomePrompt />

          {/* Quick suggestions */}
          <HomeSuggestions />
        </div>
      </div>

      {/* Templates section */}
      <div className="border-t bg-background">
        <div className="container max-w-screen-xl py-8">
          <Suspense fallback={<Skeleton className="h-[400px]" />}>
            <HomeTemplates />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
