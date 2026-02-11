import type { inferInput } from "@trpc/tanstack-react-query";
import { prefetch, trpc } from "@/trpc/server";

type Input = inferInput<typeof trpc.agents.getMany>;

/**
 * Prefetch all agents
 */
export const prefetchAgents = (params: Input) => {
  return prefetch(trpc.agents.getMany.queryOptions(params));
};

/**
 * Prefetch a single agent
 */
export const prefetchAgent = (id: string) => {
  return prefetch(trpc.agents.getOne.queryOptions({ id }));
};

/**
 * Prefetch conversations for an agent
 */
export const prefetchConversations = (agentId: string) => {
  return prefetch(trpc.agents.getConversations.queryOptions({ agentId }));
};

/**
 * Prefetch a single conversation
 */
export const prefetchConversation = (id: string) => {
  return prefetch(trpc.agents.getConversation.queryOptions({ id }));
};
