import { useTRPC } from "@/trpc/client";
import {
  useMutation,
  useQuery,
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
  const [params] = useAgentsParams();

  return useMutation(
    trpc.agents.create.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Agent "${data.name}" created`);
        // Update cache optimistically instead of invalidating all queries
        const queryKey = trpc.agents.getMany.queryKey(params);
        queryClient.setQueryData(queryKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            items: [{ ...data, _count: { conversations: 0 } }, ...old.items],
            totalCount: old.totalCount + 1,
          };
        });
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
  const [params] = useAgentsParams();

  return useMutation(
    trpc.agents.update.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Agent "${data.name}" updated`);
        // Update list cache optimistically
        const queryKey = trpc.agents.getMany.queryKey(params);
        queryClient.setQueryData(queryKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((a) => a.id === data.id ? { ...data, _count: a._count } : a),
          };
        });
        // Invalidate single item cache to refetch with full data
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
 * Hook to save agent flow data (nodes and edges)
 */
export const useSaveFlowData = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.saveFlowData.mutationOptions({
      onSuccess: (data) => {
        toast.success("Flow saved successfully");
        // Invalidate single item cache to refetch with new flow data
        queryClient.invalidateQueries(
          trpc.agents.getOne.queryOptions({ id: data.id })
        );
      },
      onError: (error) => {
        toast.error(`Failed to save flow: ${error.message}`);
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
  const [params] = useAgentsParams();

  return useMutation(
    trpc.agents.remove.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Agent "${data.name}" removed`);
        // Update cache optimistically instead of invalidating all queries
        const queryKey = trpc.agents.getMany.queryKey(params);
        queryClient.setQueryData(queryKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.filter((a) => a.id !== data.id),
            totalCount: old.totalCount - 1,
          };
        });
        queryClient.removeQueries(
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
 * Hook to fetch a single agent (non-suspense, client-side only)
 * Use this for pages that need to avoid SSR auth issues
 */
export const useAgent = (id: string) => {
  const trpc = useTRPC();
  return useQuery(trpc.agents.getOne.queryOptions({ id }));
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
 * Hook to fetch conversations for an agent (suspense version)
 */
export const useSuspenseConversations = (agentId: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.agents.getConversations.queryOptions({ agentId })
  );
};

/**
 * Hook to fetch conversations for an agent (non-suspense version)
 */
export const useConversations = (agentId: string) => {
  const trpc = useTRPC();
  return useQuery(
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

/**
 * Hook to rename a conversation
 */
export const useRenameConversation = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.renameConversation.mutationOptions({
      onSuccess: () => {
        toast.success("Conversation renamed");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            (query.queryKey[1] === "getConversations" ||
              query.queryKey[1] === "getConversation"),
        });
      },
      onError: (error) => {
        toast.error(`Failed to rename conversation: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to toggle pin on a conversation
 */
export const useTogglePinConversation = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.togglePinConversation.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.isPinned ? "Conversation pinned" : "Conversation unpinned");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getConversations",
        });
      },
      onError: (error) => {
        toast.error(`Failed to toggle pin: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to toggle archive on a conversation
 */
export const useToggleArchiveConversation = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.toggleArchiveConversation.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.isArchived ? "Conversation archived" : "Conversation restored");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getConversations",
        });
      },
      onError: (error) => {
        toast.error(`Failed to toggle archive: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to generate a share link for a conversation
 */
export const useGenerateShareLink = () => {
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.generateShareLink.mutationOptions({
      onSuccess: (data) => {
        navigator.clipboard.writeText(data.shareUrl);
        toast.success("Share link copied to clipboard");
      },
      onError: (error) => {
        toast.error(`Failed to generate share link: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to remove a share link from a conversation
 */
export const useRemoveShareLink = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.removeShareLink.mutationOptions({
      onSuccess: () => {
        toast.success("Share link removed");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getConversations",
        });
      },
      onError: (error) => {
        toast.error(`Failed to remove share link: ${error.message}`);
      },
    })
  );
};

// ==================
// MEMORY HOOKS
// ==================

/**
 * Hook to fetch memories for an agent
 */
export const useSuspenseMemories = (agentId: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.agents.getMemories.queryOptions({ agentId }));
};

/**
 * Hook to set/update a memory
 */
export const useSetMemory = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.setMemory.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Memory "${data.key}" saved`);
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getMemories",
        });
      },
      onError: (error) => {
        toast.error(`Failed to save memory: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to delete a memory
 */
export const useDeleteMemory = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.deleteMemory.mutationOptions({
      onSuccess: () => {
        toast.success("Memory deleted");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getMemories",
        });
      },
      onError: (error) => {
        toast.error(`Failed to delete memory: ${error.message}`);
      },
    })
  );
};

// ==================
// TRIGGER HOOKS
// ==================

/**
 * Hook to fetch triggers for an agent
 */
export const useSuspenseTriggers = (agentId: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.agents.getTriggers.queryOptions({ agentId }));
};

/**
 * Hook to create a trigger
 */
export const useCreateTrigger = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.createTrigger.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Trigger "${data.name}" created`);
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getTriggers",
        });
      },
      onError: (error) => {
        toast.error(`Failed to create trigger: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to update a trigger
 */
export const useUpdateTrigger = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.updateTrigger.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Trigger "${data.name}" updated`);
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getTriggers",
        });
      },
      onError: (error) => {
        toast.error(`Failed to update trigger: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to delete a trigger
 */
export const useDeleteTrigger = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.deleteTrigger.mutationOptions({
      onSuccess: () => {
        toast.success("Trigger deleted");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getTriggers",
        });
      },
      onError: (error) => {
        toast.error(`Failed to delete trigger: ${error.message}`);
      },
    })
  );
};

// ==================
// EMBED HOOKS
// ==================

/**
 * Hook to fetch embed config for an agent
 */
export const useSuspenseEmbed = (agentId: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.agents.getEmbed.queryOptions({ agentId }));
};

/**
 * Hook to upsert embed config
 */
export const useUpsertEmbed = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.upsertEmbed.mutationOptions({
      onSuccess: () => {
        toast.success("Embed settings saved");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" && query.queryKey[1] === "getEmbed",
        });
      },
      onError: (error) => {
        toast.error(`Failed to save embed settings: ${error.message}`);
      },
    })
  );
};

// ==================
// TEMPLATE HOOKS
// ==================

/**
 * Hook to fetch agent templates
 */
export const useSuspenseTemplates = (category?: string) => {
  const trpc = useTRPC();
  const options = trpc.agents.getTemplates.queryOptions({
    category: category as
      | "PRODUCTIVITY"
      | "SALES"
      | "SUPPORT"
      | "RESEARCH"
      | "CREATIVE"
      | "OPERATIONS"
      | "CUSTOM"
      | undefined,
  });
  return useSuspenseQuery(options);
};

/**
 * Hook to create agent from template
 */
export const useCreateFromTemplate = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const [params] = useAgentsParams();

  return useMutation(
    trpc.agents.createFromTemplate.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Agent "${data.name}" created from template`);
        const queryKey = trpc.agents.getMany.queryKey(params);
        queryClient.setQueryData(queryKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            items: [{ ...data, _count: { conversations: 0 } }, ...old.items],
            totalCount: old.totalCount + 1,
          };
        });
      },
      onError: (error) => {
        toast.error(`Failed to create from template: ${error.message}`);
      },
    })
  );
};

// ==================
// KNOWLEDGE BASE HOOKS (RAG)
// ==================

/**
 * Hook to fetch knowledge documents for an agent
 */
export const useSuspenseKnowledge = (agentId: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.agents.getKnowledgeDocuments.queryOptions({ agentId })
  );
};

/**
 * Hook to upload and index a knowledge document (supports sourceType)
 */
export const useUploadKnowledge = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.addKnowledgeDocument.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Document "${data.title}" indexed with ${data._count.chunks} chunks`);
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getKnowledgeDocuments",
        });
      },
      onError: (error) => {
        toast.error(`Failed to upload document: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to delete a knowledge document
 */
export const useDeleteKnowledge = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.deleteKnowledgeDocument.mutationOptions({
      onSuccess: () => {
        toast.success("Document deleted");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getKnowledgeDocuments",
        });
      },
      onError: (error) => {
        toast.error(`Failed to delete document: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to add knowledge from URL
 */
export const useAddKnowledgeFromUrl = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.addKnowledgeFromUrl.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Website "${data.title}" indexed with ${data._count.chunks} chunks`);
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getKnowledgeDocuments",
        });
      },
      onError: (error) => {
        toast.error(`Failed to index website: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to resync a knowledge document
 */
export const useResyncKnowledge = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.resyncKnowledge.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Document "${data.title}" resynced`);
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getKnowledgeDocuments",
        });
      },
      onError: (error) => {
        toast.error(`Failed to resync document: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to fetch knowledge settings for an agent
 */
export const useSuspenseKnowledgeSettings = (agentId: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.agents.getKnowledgeSettings.queryOptions({ agentId })
  );
};

/**
 * Hook to update knowledge settings
 */
export const useUpdateKnowledgeSettings = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.updateKnowledgeSettings.mutationOptions({
      onSuccess: () => {
        toast.success("Knowledge settings updated");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getKnowledgeSettings",
        });
      },
      onError: (error) => {
        toast.error(`Failed to update knowledge settings: ${error.message}`);
      },
    })
  );
};

// ==================
// MULTI-AGENT CONNECTION HOOKS
// ==================

/**
 * Hook to fetch agent connections
 */
export const useSuspenseConnections = (agentId: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.agents.getConnections.queryOptions({ agentId }));
};

/**
 * Hook to fetch available agents for connection
 */
export const useSuspenseAvailableAgents = (agentId: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.agents.getAvailableAgentsForConnection.queryOptions({ agentId })
  );
};

/**
 * Hook to create a connection
 */
export const useCreateConnection = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.createConnection.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Connected to "${data.targetAgent.name}"`);
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            (query.queryKey[1] === "getConnections" ||
              query.queryKey[1] === "getAvailableAgentsForConnection"),
        });
      },
      onError: (error) => {
        toast.error(`Failed to create connection: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to update a connection
 */
export const useUpdateConnection = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.updateConnection.mutationOptions({
      onSuccess: () => {
        toast.success("Connection updated");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getConnections",
        });
      },
      onError: (error) => {
        toast.error(`Failed to update connection: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to delete a connection
 */
export const useDeleteConnection = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.deleteConnection.mutationOptions({
      onSuccess: () => {
        toast.success("Connection removed");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            (query.queryKey[1] === "getConnections" ||
              query.queryKey[1] === "getAvailableAgentsForConnection"),
        });
      },
      onError: (error) => {
        toast.error(`Failed to delete connection: ${error.message}`);
      },
    })
  );
};

// ==================
// SWARM HOOKS
// ==================

/**
 * Hook to fetch swarms for an agent
 */
export const useSuspenseSwarms = (agentId: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.agents.getSwarms.queryOptions({ agentId }));
};

/**
 * Hook to fetch a single swarm with tasks
 */
export const useSuspenseSwarm = (id: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.agents.getSwarm.queryOptions({ id }));
};

/**
 * Hook to create a swarm
 */
export const useCreateSwarm = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.createSwarm.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Swarm "${data.name}" created with ${data.totalTasks} tasks`);
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getSwarms",
        });
      },
      onError: (error) => {
        toast.error(`Failed to create swarm: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to cancel a swarm
 */
export const useCancelSwarm = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.cancelSwarm.mutationOptions({
      onSuccess: () => {
        toast.success("Swarm cancelled");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            (query.queryKey[1] === "getSwarms" || query.queryKey[1] === "getSwarm"),
        });
      },
      onError: (error) => {
        toast.error(`Failed to cancel swarm: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to delete a swarm
 */
export const useDeleteSwarm = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.deleteSwarm.mutationOptions({
      onSuccess: () => {
        toast.success("Swarm deleted");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getSwarms",
        });
      },
      onError: (error) => {
        toast.error(`Failed to delete swarm: ${error.message}`);
      },
    })
  );
};

// ==================
// AGENT EMAIL ADDRESS HOOKS
// ==================

/**
 * Hook to fetch agent email address
 */
export const useSuspenseAgentEmailAddress = (agentId: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.agents.getAgentEmailAddress.queryOptions({ agentId })
  );
};

/**
 * Hook to create agent email address
 */
export const useCreateAgentEmailAddress = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.createAgentEmailAddress.mutationOptions({
      onSuccess: () => {
        toast.success("Email address created");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getAgentEmailAddress",
        });
      },
      onError: (error) => {
        toast.error(`Failed to create email address: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to update agent email address
 */
export const useUpdateAgentEmailAddress = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.updateAgentEmailAddress.mutationOptions({
      onSuccess: () => {
        toast.success("Email settings updated");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getAgentEmailAddress",
        });
      },
      onError: (error) => {
        toast.error(`Failed to update email settings: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to delete agent email address
 */
export const useDeleteAgentEmailAddress = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.deleteAgentEmailAddress.mutationOptions({
      onSuccess: () => {
        toast.success("Email address deleted");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getAgentEmailAddress",
        });
      },
      onError: (error) => {
        toast.error(`Failed to delete email address: ${error.message}`);
      },
    })
  );
};

// ==================
// MEETING RECORDING HOOKS
// ==================

/**
 * Hook to fetch meeting recordings for an agent
 */
export const useSuspenseMeetingRecordings = (agentId: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.agents.getMeetingRecordings.queryOptions({ agentId })
  );
};

/**
 * Hook to fetch a single meeting recording
 */
export const useSuspenseMeetingRecording = (id: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.agents.getMeetingRecording.queryOptions({ id }));
};

/**
 * Hook to schedule a meeting recording
 */
export const useScheduleMeeting = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.scheduleMeetingRecording.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Meeting "${data.title}" scheduled`);
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getMeetingRecordings",
        });
      },
      onError: (error) => {
        toast.error(`Failed to schedule meeting: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to sync calendar meetings
 */
export const useSyncCalendarMeetings = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.syncCalendarMeetings.mutationOptions({
      onSuccess: (data) => {
        if (data.length > 0) {
          toast.success(`Synced ${data.length} new meeting(s) from calendar`);
        } else {
          toast.info("No new meetings found in calendar");
        }
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getMeetingRecordings",
        });
      },
      onError: (error) => {
        toast.error(`Failed to sync calendar: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to delete a meeting recording
 */
export const useDeleteMeetingRecording = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.deleteMeetingRecording.mutationOptions({
      onSuccess: () => {
        toast.success("Meeting recording deleted");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getMeetingRecordings",
        });
      },
      onError: (error) => {
        toast.error(`Failed to delete meeting recording: ${error.message}`);
      },
    })
  );
};

// ==================
// VOICE/PHONE HOOKS
// ==================

/**
 * Hook to fetch agent phone number
 */
export const useSuspensePhoneNumber = (agentId: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.agents.getAgentPhoneNumber.queryOptions({ agentId })
  );
};

/**
 * Hook to purchase a phone number
 */
export const usePurchasePhoneNumber = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.purchasePhoneNumber.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Phone number ${data.phoneNumber} purchased`);
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            (query.queryKey[1] === "getAgentPhoneNumber" ||
              query.queryKey[1] === "getCallHistory"),
        });
      },
      onError: (error) => {
        toast.error(`Failed to purchase phone number: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to release a phone number
 */
export const useReleasePhoneNumber = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.releasePhoneNumber.mutationOptions({
      onSuccess: () => {
        toast.success("Phone number released");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            (query.queryKey[1] === "getAgentPhoneNumber" ||
              query.queryKey[1] === "getCallHistory"),
        });
      },
      onError: (error) => {
        toast.error(`Failed to release phone number: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to update phone settings
 */
export const useUpdatePhoneSettings = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.updatePhoneSettings.mutationOptions({
      onSuccess: () => {
        toast.success("Phone settings updated");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getAgentPhoneNumber",
        });
      },
      onError: (error) => {
        toast.error(`Failed to update phone settings: ${error.message}`);
      },
    })
  );
};

/**
 * Hook to fetch call history
 */
export const useSuspenseCallHistory = (agentId: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.agents.getCallHistory.queryOptions({ agentId }));
};

/**
 * Hook to make an outbound call
 */
export const useMakeOutboundCall = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.makeOutboundCall.mutationOptions({
      onSuccess: () => {
        toast.success("Call initiated");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getCallHistory",
        });
      },
      onError: (error) => {
        toast.error(`Failed to make call: ${error.message}`);
      },
    })
  );
};

// ==================
// ACTIVITY LOG HOOKS
// ==================

/**
 * Hook to fetch activities for a conversation
 */
export const useSuspenseActivities = (conversationId: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.agents.getActivities.queryOptions({ conversationId })
  );
};

// ==================
// ANALYTICS HOOKS
// ==================

/**
 * Hook to fetch agent analytics
 */
export const useSuspenseAgentAnalytics = (agentId: string, days = 30) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.agents.getAgentAnalytics.queryOptions({ agentId, days })
  );
};

/**
 * Hook to fetch user-wide analytics
 */
export const useSuspenseUserAnalytics = (days = 30) => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.agents.getUserAnalytics.queryOptions({ days }));
};

/**
 * Hook to submit feedback
 */
export const useSubmitFeedback = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.agents.submitFeedback.mutationOptions({
      onSuccess: () => {
        toast.success("Thank you for your feedback!");
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "agents" &&
            query.queryKey[1] === "getAgentAnalytics",
        });
      },
      onError: (error) => {
        toast.error(`Failed to submit feedback: ${error.message}`);
      },
    })
  );
};

// ==================
// ONBOARDING HOOKS
// ==================

interface AgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  temperature: number;
  suggestedCategory: string;
}

/**
 * Hook to create an agent from a natural language prompt
 * Calls /api/agents/build to generate config, then creates the agent
 * NOTE: This hook intentionally doesn't use useAgentsParams to avoid useSearchParams requirement
 */
export const useCreateAgentFromPrompt = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation({
    mutationFn: async ({ prompt, capabilities }: { prompt: string; capabilities: string[] }) => {
      // Step 1: Call /api/agents/build to generate agent config from prompt
      const response = await fetch("/api/agents/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: prompt }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate agent configuration");
      }

      // Read the streamed response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to read response");
      }

      let fullText = "";
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }

      // Parse the JSON config from the AI response
      let config: AgentConfig;
      try {
        // Try to extract JSON from the response (AI might include extra text)
        const jsonMatch = fullText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No JSON found in response");
        }
        config = JSON.parse(jsonMatch[0]);
      } catch (e) {
        throw new Error("Failed to parse agent configuration");
      }

      // Step 2: Create the agent using tRPC
      // Enhance the system prompt with selected capabilities
      let enhancedPrompt = config.systemPrompt;
      if (capabilities.length > 0) {
        enhancedPrompt += `\n\nCapabilities enabled: ${capabilities.join(", ")}`;
      }

      // Use the tRPC client to create the agent
      const createMutation = trpc.agents.create.mutationOptions();
      const result = await queryClient.fetchQuery({
        queryKey: ["agents", "create", { systemPrompt: enhancedPrompt }],
        queryFn: async () => {
          const res = await fetch("/api/trpc/agents.create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              json: {
                name: config.name,
                description: config.description,
                systemPrompt: enhancedPrompt,
                temperature: config.temperature,
                model: "ANTHROPIC",
              },
            }),
          });
          if (!res.ok) {
            throw new Error("Failed to create agent");
          }
          const data = await res.json();
          return data.result.data.json;
        },
      });

      return result;
    },
    onSuccess: (data) => {
      toast.success(`Agent "${data.name}" created successfully!`);
      // Invalidate all agents queries to refresh the list
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "agents" && query.queryKey[1] === "getMany",
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create agent: ${error.message}`);
    },
  });
};

// ==================
// SAFE MODE CONFIRMATION HOOKS
// ==================

interface ConfirmActionParams {
  activityId: string;
  confirmed: boolean;
}

interface ConfirmActionResult {
  success: boolean;
  executed: boolean;
  result?: Record<string, unknown>;
  error?: string;
  message?: string;
}

/**
 * Hook to confirm or reject a Safe Mode action
 */
export const useConfirmAction = () => {
  return useMutation({
    mutationFn: async ({ activityId, confirmed }: ConfirmActionParams): Promise<ConfirmActionResult> => {
      const response = await fetch("/api/agents/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, confirmed }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process action");
      }

      return data;
    },
    onSuccess: (data) => {
      if (data.executed) {
        toast.success("Action executed successfully");
      } else if (data.message === "Action rejected") {
        toast.info("Action rejected");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};
