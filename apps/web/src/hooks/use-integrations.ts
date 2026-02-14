/**
 * Hook to fetch the current user's connected integrations.
 * Used by the Add Action modal to check Google connection status.
 */

import { useQuery } from "@tanstack/react-query";

interface UserIntegration {
  id: string;
  type: string;
  accountEmail: string | null;
  accountName: string | null;
  createdAt: string;
}

export function useUserIntegrations() {
  return useQuery<UserIntegration[]>({
    queryKey: ["integrations"],
    queryFn: async () => {
      const res = await fetch("/api/integrations", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch integrations");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useHasIntegration(type: string): boolean {
  const { data } = useUserIntegrations();
  return data?.some((i) => i.type === type) ?? false;
}
