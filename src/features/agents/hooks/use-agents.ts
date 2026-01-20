import { useTRPC } from "@/trpc/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useAgentsParams } from "./use-agents-params";

/**
 * Hook to fetch all agents using suspense
 */
export const useSuspenseAgents = () => {
  const trpc = useTRPC();
  const [params] = useAgentsParams();

  return useSuspenseQuery(trpc.agents.getMany.queryOptions(params));
};

/**
 * Hook to create a new agent
 */
export const useCreateAgent = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.create.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Agent "${data.name}" created`);
        queryClient.invalidateQueries(trpc.agents.getMany.queryOptions({}));
      },
      onError: (error) => {
        toast.error(`Failed to create agent: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to update an agent
 */
export const useUpdateAgent = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.update.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Agent "${data.name}" updated`);
        queryClient.invalidateQueries(trpc.agents.getMany.queryOptions({}));
        queryClient.invalidateQueries(
          trpc.agents.getOne.queryOptions({ id: data.id })
        );
      },
      onError: (error) => {
        toast.error(`Failed to update agent: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to remove an agent
 */
export const useRemoveAgent = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.agents.remove.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Agent "${data.name}" removed`);
        queryClient.invalidateQueries(trpc.agents.getMany.queryOptions({}));
        queryClient.invalidateQueries(
          trpc.agents.getOne.queryFilter({ id: data.id })
        );
      },
    })
  );
};

/**
 * Hook to fetch a single agent using suspense
 */
export const useSuspenseAgent = (id: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.agents.getOne.queryOptions({ id }));
};

/**
 * Hook to create a new conversation
 */
export const useCreateConversation = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.createConversation.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getConversations",
        });
      },
      onError: (error) => {
        toast.error(`Failed to create conversation: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to fetch conversations for an agent
 */
export const useSuspenseConversations = (agentId: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.agents.getConversations.queryOptions({ agentId })
  );
};

/**
 * Hook to fetch a single conversation
 */
export const useSuspenseConversation = (id: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.agents.getConversation.queryOptions({ id }));
};

/**
 * Hook to delete a conversation
 */
export const useDeleteConversation = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.deleteConversation.mutationOptions({
      onSuccess: () => {
        toast.success("Conversation deleted");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getConversations",
        });
      },
      onError: (error) => {
        toast.error(`Failed to delete conversation: ${error.message}`);
      },
    })
  );
};
