import { AgentForm } from "@/features/agents/components/agent-form";
import { requireAuth } from "@/lib/auth-utils";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const Page = async () => {
  await requireAuth();

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Get user's credentials to show in the form
  const credentials = await prisma.credential.findMany({
    where: { userId: session!.user.id },
    select: { id: true, name: true, type: true },
  });

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Create new agent</h1>
        <p className="text-muted-foreground">
          Configure your AI agent&apos;s personality and capabilities.
        </p>
      </div>
      <AgentForm credentials={credentials} />
    </div>
  );
};

export default Page;
