import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { TemplateCategory, TemplateRole, TemplateUseCase } from "@prisma/client";

interface TemplateFilters {
  category?: string;
  role?: string;
  useCase?: string;
  featured?: boolean;
  community?: boolean;
  search?: string;
}

/**
 * Hook to fetch templates with suspense
 */
export const useSuspenseTemplates = (filters?: TemplateFilters) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.agents.getTemplates.queryOptions({
      category: filters?.category as TemplateCategory | undefined,
      role: filters?.role as TemplateRole | undefined,
      useCase: filters?.useCase as TemplateUseCase | undefined,
      featured: filters?.featured,
      community: filters?.community,
      search: filters?.search,
    })
  );
};

/**
 * Hook to fetch a single template (suspense version)
 */
export const useSuspenseTemplate = (id: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.agents.getTemplate.queryOptions({ id }));
};

/**
 * Hook to fetch a single template (non-suspense, for conditional fetching)
 */
export const useTemplate = (id: string | null | undefined) => {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.agents.getTemplate.queryOptions({ id: id || "" }),
    enabled: !!id,
  });
};

/**
 * Hook to create an agent from a template
 */
export const useCreateAgentFromTemplate = () => {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.agents.createFromTemplate.mutationOptions({
      onSuccess: (agent) => {
        toast.success(`Agent "${agent.name}" created from template`);
        // Invalidate agents list
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" && query.queryKey[1] === "getMany",
        });
        // Invalidate templates to update usage count
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getTemplates",
        });
        router.push(`/agents/${agent.id}`);
      },
      onError: (error) => {
        toast.error(`Failed to create agent: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to share an agent as a template
 */
export const useShareAsTemplate = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.agents.shareAsTemplate.mutationOptions({
      onSuccess: () => {
        toast.success("Agent shared as template successfully!");
        // Invalidate templates to show new community template
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getTemplates",
        });
      },
      onError: (error) => {
        toast.error(`Failed to share template: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to rate a template
 */
export const useRateTemplate = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.agents.rateTemplate.mutationOptions({
      onSuccess: () => {
        toast.success("Thank you for your rating!");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            (query.queryKey[1] === "getTemplates" ||
              query.queryKey[1] === "getTemplate"),
        });
      },
      onError: (error) => {
        toast.error(`Failed to rate template: ${error.message}`);
      },
    })
  );
};
