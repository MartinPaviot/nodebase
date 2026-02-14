"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Envelope,
  Plus,
  ArrowsClockwise,
  Pause,
  Play,
  Trash,
  ShieldCheck,
  Heartbeat,
  PaperPlaneTilt,
  CheckCircle,
} from "@phosphor-icons/react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// =============================================================================
// Types
// =============================================================================

type MailboxStatus = "CONNECTING" | "WARMING" | "READY" | "PAUSED" | "ERROR";

type DnsStatus = "PASS" | "WARN" | "FAIL" | "UNKNOWN";

interface DashboardStats {
  totalAccounts: number;
  readyCount: number;
  averageHealthScore: number;
  averageDeliveryRate: number;
}

interface Mailbox {
  id: string;
  email: string;
  domain: string;
  status: MailboxStatus;
  healthScore: number;
  warmupScore: number;
  sentToday: number;
  dailySendLimit: number;
}

interface DomainGroup {
  domain: string;
  mailboxes: Mailbox[];
  readyCount: number;
  totalCount: number;
  avgHealth: number;
}

interface DomainHealth {
  domain: string;
  spfStatus: DnsStatus;
  dkimStatus: DnsStatus;
  dmarcStatus: DnsStatus;
  mxStatus: DnsStatus;
}

// =============================================================================
// Status Helpers
// =============================================================================

function getStatusBadgeProps(status: MailboxStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "CONNECTING":
      return {
        label: "Connecting",
        className: "bg-yellow-50 text-yellow-700 border-yellow-200",
      };
    case "WARMING":
      return {
        label: "Warming",
        className: "bg-blue-50 text-blue-700 border-blue-200",
      };
    case "READY":
      return {
        label: "Ready",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "PAUSED":
      return {
        label: "Paused",
        className: "bg-gray-50 text-gray-500 border-gray-200",
      };
    case "ERROR":
      return {
        label: "Error",
        className: "bg-red-50 text-red-700 border-red-200",
      };
    default:
      return {
        label: status,
        className: "bg-gray-50 text-gray-500 border-gray-200",
      };
  }
}

function getDnsBadgeProps(status: DnsStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "PASS":
      return {
        label: "PASS",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "WARN":
      return {
        label: "WARN",
        className: "bg-yellow-50 text-yellow-700 border-yellow-200",
      };
    case "FAIL":
      return {
        label: "FAIL",
        className: "bg-red-50 text-red-700 border-red-200",
      };
    case "UNKNOWN":
    default:
      return {
        label: "UNKNOWN",
        className: "bg-gray-50 text-gray-500 border-gray-200",
      };
  }
}

function getHealthColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
}

function getHealthBadgeClass(score: number): string {
  if (score >= 80) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 60) return "bg-yellow-50 text-yellow-700 border-yellow-200";
  return "bg-red-50 text-red-700 border-red-200";
}

function getProgressColor(score: number): string {
  if (score >= 80) return "[&>[data-slot=progress-indicator]]:bg-emerald-500";
  if (score >= 60) return "[&>[data-slot=progress-indicator]]:bg-yellow-500";
  return "[&>[data-slot=progress-indicator]]:bg-red-500";
}

// =============================================================================
// Group mailboxes by domain
// =============================================================================

function groupByDomain(mailboxes: Mailbox[]): DomainGroup[] {
  const grouped = new Map<string, Mailbox[]>();

  for (const mb of mailboxes) {
    const list = grouped.get(mb.domain) || [];
    list.push(mb);
    grouped.set(mb.domain, list);
  }

  return Array.from(grouped.entries()).map(([domain, mbs]) => {
    const readyCount = mbs.filter((m) => m.status === "READY").length;
    const avgHealth =
      mbs.length > 0
        ? Math.round(mbs.reduce((sum, m) => sum + m.healthScore, 0) / mbs.length)
        : 0;

    return {
      domain,
      mailboxes: mbs,
      readyCount,
      totalCount: mbs.length,
      avgHealth,
    };
  });
}

// =============================================================================
// Main Page
// =============================================================================

export default function MailboxesSettingsPage() {
  const searchParams = useSearchParams();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Toast on successful OAuth callback
  useEffect(() => {
    if (searchParams.get("added") === "true") {
      toast.success("Mailbox connected successfully");
    }
  }, [searchParams]);

  // ---- Queries ----

  const { data: stats, isLoading: statsLoading } = useQuery(
    trpc.mailbox.getDashboardStats.queryOptions()
  );

  const { data: mailboxes, isLoading: mailboxesLoading } = useQuery(
    trpc.mailbox.getMailboxes.queryOptions()
  );

  const { data: domainHealthData, isLoading: dnsLoading } = useQuery(
    trpc.mailbox.getDomainHealth.queryOptions()
  );

  // ---- Mutations ----

  const connectMailbox = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/integrations/google/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: "GMAIL_MAILBOX" }),
      });
      if (!res.ok) throw new Error("Failed to start connection");
      const data = await res.json();
      return data as { url: string };
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error: Error) => {
      toast.error(`Connection failed: ${error.message}`);
    },
  });

  const pauseMailbox = useMutation(
    trpc.mailbox.pauseMailbox.mutationOptions({
      onSuccess: () => {
        toast.success("Mailbox paused");
        queryClient.invalidateQueries({ queryKey: trpc.mailbox.getMailboxes.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.mailbox.getDashboardStats.queryKey() });
      },
      onError: (error) => {
        toast.error(`Failed to pause: ${error.message}`);
      },
    })
  );

  const resumeMailbox = useMutation(
    trpc.mailbox.resumeMailbox.mutationOptions({
      onSuccess: () => {
        toast.success("Mailbox resumed");
        queryClient.invalidateQueries({ queryKey: trpc.mailbox.getMailboxes.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.mailbox.getDashboardStats.queryKey() });
      },
      onError: (error) => {
        toast.error(`Failed to resume: ${error.message}`);
      },
    })
  );

  const removeMailbox = useMutation(
    trpc.mailbox.removeMailbox.mutationOptions({
      onSuccess: () => {
        toast.success("Mailbox removed");
        queryClient.invalidateQueries({ queryKey: trpc.mailbox.getMailboxes.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.mailbox.getDashboardStats.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.mailbox.getDomainHealth.queryKey() });
      },
      onError: (error) => {
        toast.error(`Failed to remove: ${error.message}`);
      },
    })
  );

  const refreshDomainHealth = useMutation(
    trpc.mailbox.refreshDomainHealth.mutationOptions({
      onSuccess: () => {
        toast.success("DNS records refreshed");
        queryClient.invalidateQueries({ queryKey: trpc.mailbox.getDomainHealth.queryKey() });
      },
      onError: (error) => {
        toast.error(`Refresh failed: ${error.message}`);
      },
    })
  );

  // ---- Derived Data ----

  const domainGroups = mailboxes ? groupByDomain(mailboxes as unknown as Mailbox[]) : [];
  const domainHealth = (domainHealthData as unknown as DomainHealth[] | undefined) ?? [];
  const dashStats = stats as unknown as DashboardStats | undefined;

  // ---- Loading State ----

  if (statsLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mailboxes</h1>
          <p className="text-sm text-muted-foreground">
            Manage email accounts for cold outreach campaigns
          </p>
        </div>
        <Button
          onClick={() => connectMailbox.mutate()}
          disabled={connectMailbox.isPending}
        >
          <Plus className="size-4" />
          {connectMailbox.isPending ? "Connecting..." : "Connect Mailbox"}
        </Button>
      </div>

      {/* Connected counter */}
      {dashStats && (
        <p className="text-sm text-muted-foreground -mt-4">
          {dashStats.totalAccounts} connected
        </p>
      )}

      {/* Summary Cards */}
      <SummaryCards stats={dashStats} />

      {/* Domain Grid */}
      <DomainGrid groups={domainGroups} loading={mailboxesLoading} />

      {/* DNS Health Table */}
      <DnsHealthTable
        domains={domainHealth}
        loading={dnsLoading}
        onRefresh={(domain: string) => refreshDomainHealth.mutate({ domain })}
        refreshingDomain={
          refreshDomainHealth.isPending
            ? (refreshDomainHealth.variables as { domain: string } | undefined)?.domain
            : undefined
        }
      />

      {/* Mailbox Accounts Table */}
      <MailboxAccountsTable
        groups={domainGroups}
        loading={mailboxesLoading}
        onPause={(id: string) => pauseMailbox.mutate({ id })}
        onResume={(id: string) => resumeMailbox.mutate({ id })}
        onRemove={(id: string) => removeMailbox.mutate({ id })}
        pausingId={pauseMailbox.isPending ? (pauseMailbox.variables as { id: string } | undefined)?.id : undefined}
        resumingId={resumeMailbox.isPending ? (resumeMailbox.variables as { id: string } | undefined)?.id : undefined}
      />
    </div>
  );
}

// =============================================================================
// Summary Cards
// =============================================================================

function SummaryCards({ stats }: { stats: DashboardStats | undefined }) {
  if (!stats) {
    return (
      <div className="grid gap-4 grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-2">
      {/* Total Accounts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
          <Envelope className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalAccounts}</div>
        </CardContent>
      </Card>

      {/* Ready */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ready</CardTitle>
          <CheckCircle className="size-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.readyCount}
            <span className="text-sm font-normal text-muted-foreground">
              /{stats.totalAccounts}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">accounts ready</p>
        </CardContent>
      </Card>

      {/* Avg Health Score */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Health Score</CardTitle>
          <Heartbeat className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{stats.averageHealthScore}</span>
            <Badge variant="outline" className={getHealthBadgeClass(stats.averageHealthScore)}>
              {stats.averageHealthScore >= 80
                ? "Good"
                : stats.averageHealthScore >= 60
                  ? "Fair"
                  : "Low"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
          <PaperPlaneTilt className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.averageDeliveryRate}%</div>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// Domain Grid
// =============================================================================

function DomainGrid({
  groups,
  loading,
}: {
  groups: DomainGroup[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Domains</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Domains</h2>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <Card key={group.domain}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{group.domain}</CardTitle>
              <CardDescription>
                {group.readyCount}/{group.totalCount} ready
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Health</span>
                <span className={`font-medium ${getHealthColor(group.avgHealth)}`}>
                  {group.avgHealth}/100
                </span>
              </div>
              <Progress
                value={group.avgHealth}
                className={`h-2 ${getProgressColor(group.avgHealth)}`}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// DNS Health Table
// =============================================================================

function DnsHealthTable({
  domains,
  loading,
  onRefresh,
  refreshingDomain,
}: {
  domains: DomainHealth[];
  loading: boolean;
  onRefresh: (domain: string) => void;
  refreshingDomain: string | undefined;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">DNS Health</h2>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (domains.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">DNS Health</h2>
      <Card>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>SPF</TableHead>
                <TableHead>DKIM</TableHead>
                <TableHead>DMARC</TableHead>
                <TableHead>MX</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((d) => {
                const isRefreshing = refreshingDomain === d.domain;
                return (
                  <TableRow key={d.domain}>
                    <TableCell className="font-medium">{d.domain}</TableCell>
                    <TableCell>
                      <DnsBadge status={d.spfStatus} />
                    </TableCell>
                    <TableCell>
                      <DnsBadge status={d.dkimStatus} />
                    </TableCell>
                    <TableCell>
                      <DnsBadge status={d.dmarcStatus} />
                    </TableCell>
                    <TableCell>
                      <DnsBadge status={d.mxStatus} />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onRefresh(d.domain)}
                        disabled={isRefreshing}
                        title="Refresh DNS records"
                      >
                        <ArrowsClockwise
                          className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
                        />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function DnsBadge({ status }: { status: DnsStatus }) {
  const props = getDnsBadgeProps(status);
  return (
    <Badge variant="outline" className={props.className}>
      {props.label}
    </Badge>
  );
}

// =============================================================================
// Mailbox Accounts Table
// =============================================================================

function MailboxAccountsTable({
  groups,
  loading,
  onPause,
  onResume,
  onRemove,
  pausingId,
  resumingId,
}: {
  groups: DomainGroup[];
  loading: boolean;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRemove: (id: string) => void;
  pausingId: string | undefined;
  resumingId: string | undefined;
}) {
  const [removeTarget, setRemoveTarget] = useState<Mailbox | null>(null);

  if (loading) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Accounts</h2>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const allMailboxes = groups.flatMap((g) => g.mailboxes);

  if (allMailboxes.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Accounts</h2>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No mailbox accounts connected yet. Click &quot;Connect Mailbox&quot; to get started.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Accounts</h2>
      <Card>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Warmup</TableHead>
                <TableHead>Sent / Limit</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allMailboxes.map((mb) => {
                const statusProps = getStatusBadgeProps(mb.status);
                const isPausing = pausingId === mb.id;
                const isResuming = resumingId === mb.id;

                return (
                  <TableRow key={mb.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Envelope className="size-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{mb.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusProps.className}>
                        {statusProps.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`font-medium ${getHealthColor(mb.healthScore)}`}>
                        {mb.healthScore}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{mb.warmupScore}%</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {mb.sentToday}/{mb.dailySendLimit}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {mb.status === "PAUSED" ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onResume(mb.id)}
                            disabled={isResuming}
                            title="Resume"
                          >
                            <Play className="size-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onPause(mb.id)}
                            disabled={isPausing || mb.status === "CONNECTING"}
                            title="Pause"
                          >
                            <Pause className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setRemoveTarget(mb)}
                          title="Remove"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Remove Confirmation Dialog */}
      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove mailbox</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-medium text-foreground">
                {removeTarget?.email}
              </span>
              ? This will disconnect the account and stop all outreach from this
              address. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (removeTarget) {
                  onRemove(removeTarget.id);
                  setRemoveTarget(null);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// Page Skeleton
// =============================================================================

function PageSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>

      {/* Summary cards skeleton */}
      <div className="grid gap-4 grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>

      {/* Domain grid skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-24" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      </div>

      {/* DNS table skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-48" />
      </div>

      {/* Accounts table skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
