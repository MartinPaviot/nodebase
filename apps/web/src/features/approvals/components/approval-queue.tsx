"use client";

import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CircleNotch, FunnelSimple } from "@phosphor-icons/react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApprovalCard } from "./approval-card";

type Tab = "pending" | "history";

export function ApprovalQueue() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  // Fetch pending approvals
  const pending = useQuery(
    trpc.agents.getPendingApprovals.queryOptions({ page: 1, pageSize: 50 }),
  );

  // Fetch approval history
  const history = useQuery(
    trpc.agents.getApprovalHistory.queryOptions({
      page: 1,
      pageSize: 50,
      status: "all",
    }),
  );

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (activityId: string) => {
      const res = await fetch("/api/agents/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, confirmed: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to approve");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Action approved and executed");
      queryClient.invalidateQueries({
        queryKey: trpc.agents.getPendingApprovals.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.agents.getApprovalHistory.queryKey(),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (activityId: string) => {
      const res = await fetch("/api/agents/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, confirmed: false }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to reject");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Action rejected");
      queryClient.invalidateQueries({
        queryKey: trpc.agents.getPendingApprovals.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.agents.getApprovalHistory.queryKey(),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Edit & Approve mutation
  const updateArgsMutation = useMutation(
    trpc.agents.updateApprovalArgs.mutationOptions({
      onSuccess: () => {
        // Args updated, now approve
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const handleApprove = (activityId: string) => {
    approveMutation.mutate(activityId);
  };

  const handleReject = (activityId: string) => {
    rejectMutation.mutate(activityId);
  };

  const handleEditApprove = async (
    activityId: string,
    updatedArgs: Record<string, unknown>,
  ) => {
    try {
      await updateArgsMutation.mutateAsync({ activityId, updatedArgs });
      approveMutation.mutate(activityId);
    } catch {
      // Error handled by mutation onError
    }
  };

  const currentData = tab === "pending" ? pending : history;
  const items = currentData.data?.items || [];

  // Extract unique agents and action types for filters
  const agents = Array.from(
    new Map(
      items.map((item) => [
        item.conversation.agent.id,
        item.conversation.agent,
      ]),
    ).values(),
  );

  const actionTypes = Array.from(
    new Set(
      items
        .map((item) => {
          const details = item.details as Record<string, unknown> | null;
          return (details?.actionType as string) || null;
        })
        .filter(Boolean),
    ),
  );

  // Apply filters
  const filteredItems = items.filter((item) => {
    if (agentFilter !== "all" && item.conversation.agent.id !== agentFilter)
      return false;
    const details = item.details as Record<string, unknown> | null;
    const actionType = (details?.actionType as string) || "";
    if (actionFilter !== "all" && actionType !== actionFilter) return false;
    return true;
  });

  const isMutating =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    updateArgsMutation.isPending;

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Approval Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve agent actions before they execute
          </p>
        </div>
        {pending.data && pending.data.total > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full text-sm font-medium">
            <span className="size-2 bg-amber-500 rounded-full animate-pulse" />
            {pending.data.total} pending
          </div>
        )}
      </div>

      {/* Tabs + Filters */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          className="w-auto"
        >
          <TabsList>
            <TabsTrigger value="pending" className="gap-1.5">
              Pending
              {pending.data && pending.data.total > 0 && (
                <span className="bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">
                  {pending.data.total}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <FunnelSimple className="size-4 text-muted-foreground" />
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actionTypes.map((type) => (
                <SelectItem key={type} value={type!}>
                  {type!.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {currentData.isLoading ? (
        <div className="flex items-center justify-center h-48">
          <CircleNotch className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <p className="text-sm text-muted-foreground">
            {tab === "pending"
              ? "No pending approvals. Your agents are all caught up!"
              : "No approval history yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <ApprovalCard
              key={item.id}
              activity={{
                id: item.id,
                title: item.title,
                createdAt: item.createdAt,
                details: item.details as {
                  actionType: string;
                  actionArgs: Record<string, unknown>;
                  evalResult?: {
                    l1Passed?: boolean;
                    l2Score?: number;
                    l2Passed?: boolean;
                    groundingScore?: number;
                    groundingPassed?: boolean;
                    claims?: Array<{
                      text: string;
                      type: "factual" | "temporal" | "quantitative" | "relational";
                      grounded: boolean;
                      evidence?: string;
                    }>;
                    l3Triggered?: boolean;
                    l3Passed?: boolean;
                    suggestions?: string[];
                    blockReason?: string;
                  };
                } | null,
                conversation: {
                  agent: item.conversation.agent,
                },
              }}
              onApprove={handleApprove}
              onReject={handleReject}
              onEditApprove={handleEditApprove}
              isLoading={isMutating}
            />
          ))}
        </div>
      )}
    </div>
  );
}
