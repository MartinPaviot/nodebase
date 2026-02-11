/**
 * Hooks React Query pour Composio
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ============================================
// Types
// ============================================

export interface ComposioApp {
  key: string;
  name: string;
  description: string;
  logo: string;
  categories: string[];
  auth_schemes: Array<{
    mode: "OAUTH2" | "OAUTH1" | "API_KEY" | "BASIC";
    name: string;
  }>;
}

export interface ComposioAction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ComposioConnection {
  id: string;
  integrationId: string;
  appName: string;
  status: "ACTIVE" | "EXPIRED" | "INVALID";
  createdAt: string;
}

// ============================================
// Query Keys
// ============================================

export const composioKeys = {
  all: ["composio"] as const,
  apps: () => [...composioKeys.all, "apps"] as const,
  appsSearch: (search: string) => [...composioKeys.apps(), { search }] as const,
  actions: (appKey: string) => [...composioKeys.all, "actions", appKey] as const,
  connections: (userId: string) => [...composioKeys.all, "connections", userId] as const,
};

// ============================================
// Hooks
// ============================================

/**
 * Fetch all available Composio apps
 */
export function useComposioApps(search?: string) {
  return useQuery({
    queryKey: search ? composioKeys.appsSearch(search) : composioKeys.apps(),
    queryFn: async () => {
      const url = search
        ? `/api/integrations/composio/apps?search=${encodeURIComponent(search)}`
        : "/api/integrations/composio/apps";

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch apps");

      const json = await res.json();
      return json.data as ComposioApp[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch actions for a specific app
 */
export function useComposioActions(appKey: string | null) {
  return useQuery({
    queryKey: appKey ? composioKeys.actions(appKey) : ["composio", "actions", "none"],
    queryFn: async () => {
      if (!appKey) return [];

      const res = await fetch(`/api/integrations/composio/actions?app=${encodeURIComponent(appKey)}`);
      if (!res.ok) throw new Error("Failed to fetch actions");

      const json = await res.json();
      return json.data as ComposioAction[];
    },
    enabled: !!appKey,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch user's Composio connections
 */
export function useComposioConnections(userId: string) {
  return useQuery({
    queryKey: composioKeys.connections(userId),
    queryFn: async () => {
      const res = await fetch(`/api/integrations/composio/connections?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) throw new Error("Failed to fetch connections");

      const json = await res.json();
      return json.data as ComposioConnection[];
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Connect to a Composio app (OAuth flow)
 */
export function useComposioConnect() {
  return useMutation({
    mutationFn: async ({
      userId,
      appName,
      redirectUrl,
    }: {
      userId: string;
      appName: string;
      redirectUrl?: string;
    }) => {
      const res = await fetch("/api/integrations/composio/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, appName, redirectUrl }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to initiate connection");
      }

      return res.json();
    },
    onSuccess: (data) => {
      // Redirect to OAuth URL
      window.location.href = data.data.redirectUrl;
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Disconnect from a Composio app
 */
export function useComposioDisconnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ connectionId }: { connectionId: string }) => {
      const res = await fetch("/api/integrations/composio/disconnect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to disconnect");
      }

      return res.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate connections cache
      queryClient.invalidateQueries({ queryKey: composioKeys.all });
      toast.success("Integration disconnected");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Add a Composio action as an agent tool
 */
export function useAddAgentTool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      agentId,
      appKey,
      actionName,
      description,
    }: {
      agentId: string;
      appKey: string;
      actionName: string;
      description: string;
    }) => {
      const res = await fetch(`/api/agents/${agentId}/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "composio_action",
          name: actionName,
          config: {
            appKey,
            actionName,
            description,
          },
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add tool");
      }

      return res.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate agent tools cache
      queryClient.invalidateQueries({ queryKey: ["agent", variables.agentId, "tools"] });
      toast.success("Action added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
