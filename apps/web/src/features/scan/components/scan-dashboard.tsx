"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  AlertCircle,
  TrendingUp,
  Users,
  HeadphonesIcon,
  Megaphone,
  DollarSign,
  FolderKanban,
  RefreshCw,
  Play,
  Plug,
  Search,
} from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScanCategory } from "@prisma/client";
import Link from "next/link";

// ============================================
// Types
// ============================================

type ScanSignal = {
  id: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  connectorId: string;
  detectedAt: string;
};

type CategoryScanResult = {
  category: ScanCategory;
  signals: ScanSignal[];
  scannedAt: string | null;
};

// ============================================
// Helpers
// ============================================

const CATEGORY_CONFIG: Record<ScanCategory, { label: string; icon: React.ElementType; color: string }> = {
  SALES: { label: "Sales", icon: TrendingUp, color: "text-blue-500" },
  SUPPORT: { label: "Support", icon: HeadphonesIcon, color: "text-purple-500" },
  MARKETING: { label: "Marketing", icon: Megaphone, color: "text-pink-500" },
  HR: { label: "HR", icon: Users, color: "text-green-500" },
  FINANCE: { label: "Finance", icon: DollarSign, color: "text-yellow-500" },
  PROJECTS: { label: "Projects", icon: FolderKanban, color: "text-orange-500" },
};

const SEVERITY_CONFIG = {
  critical: { label: "Critical", color: "bg-red-500 text-white" },
  high: { label: "High", color: "bg-orange-500 text-white" },
  medium: { label: "Medium", color: "bg-yellow-500 text-black" },
  low: { label: "Low", color: "bg-gray-400 text-white" },
};

function getSeverityCount(results: CategoryScanResult[], severity: ScanSignal["severity"]): number {
  return results.reduce(
    (count, result) => count + result.signals.filter((s) => s.severity === severity).length,
    0
  );
}

function getTotalSignals(results: CategoryScanResult[]): number {
  return results.reduce((count, result) => count + result.signals.length, 0);
}

// ============================================
// Components
// ============================================

function SeveritySummary({ results }: { results: CategoryScanResult[] }) {
  const critical = getSeverityCount(results, "critical");
  const high = getSeverityCount(results, "high");
  const medium = getSeverityCount(results, "medium");
  const total = getTotalSignals(results);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Signals</p>
              <p className="text-2xl font-bold">{total}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600">Critical</p>
              <p className="text-2xl font-bold text-red-600">{critical}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600">High</p>
              <p className="text-2xl font-bold text-orange-600">{high}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-orange-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600">Medium</p>
              <p className="text-2xl font-bold text-yellow-600">{medium}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-yellow-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-12" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SignalCard({ signal }: { signal: ScanSignal }) {
  const severityConfig = SEVERITY_CONFIG[signal.severity];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={severityConfig.color}>{severityConfig.label}</Badge>
              <span className="text-xs text-muted-foreground">{signal.connectorId}</span>
            </div>
            <h4 className="font-medium truncate">{signal.title}</h4>
            <p className="text-sm text-muted-foreground">{signal.description}</p>
          </div>
          <Button size="sm" variant="outline">
            <Play className="h-3 w-3 mr-1" />
            Act
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CategorySection({ result }: { result: CategoryScanResult }) {
  const config = CATEGORY_CONFIG[result.category];
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${config.color}`} />
            <CardTitle className="text-lg">{config.label}</CardTitle>
            {result.signals.length > 0 && (
              <Badge variant="secondary">{result.signals.length} signals</Badge>
            )}
          </div>
          {result.scannedAt && (
            <span className="text-xs text-muted-foreground">
              Scanned {new Date(result.scannedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {result.signals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No signals detected
          </p>
        ) : (
          <div className="space-y-3">
            {result.signals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NoIntegrationsState() {
  return (
    <Card className="border-dashed">
      <CardContent className="p-12 text-center">
        <Plug className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Connectez vos outils</h3>
        <p className="text-muted-foreground mb-4">
          Pour detecter des signaux, connectez d'abord vos outils (Gmail, Calendar, Slack, etc.)
        </p>
        <Button asChild>
          <Link href="/integrations">Configurer les integrations</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================
// Main Component
// ============================================

export function ScanDashboard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"all" | ScanCategory>("all");

  // Queries
  const integrationsQuery = useQuery(
    trpc.scan.getConnectedIntegrations.queryOptions()
  );

  const resultsQuery = useQuery(
    trpc.scan.getLatestResults.queryOptions({})
  );

  // Mutation for running scan
  const scanMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/trpc/scan.runScan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.scan.getLatestResults.queryKey({}) });
    },
  });

  const handleScan = () => {
    scanMutation.mutate();
  };

  const hasIntegrations = integrationsQuery.data && integrationsQuery.data.length > 0;
  const results = resultsQuery.data ?? [];

  const filteredResults =
    activeTab === "all"
      ? results
      : results.filter((r) => r.category === activeTab);

  const allSignals = results.flatMap((r) => r.signals);
  const criticalSignals = allSignals.filter(
    (s) => s.severity === "critical" || s.severity === "high"
  );

  // Loading state
  if (integrationsQuery.isLoading || resultsQuery.isLoading) {
    return (
      <div className="h-full">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h1 className="text-lg font-semibold">Scan</h1>
          <Skeleton className="h-9 w-28" />
        </div>
        {/* Content */}
        <div className="p-6 space-y-6">
          <SummarySkeleton />
        </div>
      </div>
    );
  }

  // No integrations state
  if (!hasIntegrations) {
    return (
      <div className="h-full">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h1 className="text-lg font-semibold">Scan</h1>
        </div>
        {/* Content */}
        <div className="p-6">
          <NoIntegrationsState />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-lg font-semibold">Scan</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search signals..." className="pl-9 h-9 w-48" />
          </div>
          <Button size="sm" onClick={handleScan} disabled={scanMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${scanMutation.isPending ? "animate-spin" : ""}`} />
            {scanMutation.isPending ? "Scanning..." : "Run Scan"}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Summary */}
        <SeveritySummary results={results} />

        {/* Critical Alerts */}
        {criticalSignals.length > 0 && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-red-600 flex items-center gap-2 text-base">
                <AlertCircle className="h-5 w-5" />
                Requires Immediate Attention
              </CardTitle>
              <CardDescription>
                {criticalSignals.length} critical or high priority signals detected
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {criticalSignals.slice(0, 5).map((signal) => (
                  <SignalCard key={signal.id} signal={signal} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Category Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="all">
              All ({getTotalSignals(results)})
            </TabsTrigger>
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
              const categoryResult = results.find((r) => r.category === key);
              const count = categoryResult?.signals.length ?? 0;
              return (
                <TabsTrigger key={key} value={key}>
                  {config.label} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <ScrollArea className="h-[calc(100vh-400px)]">
              <div className="grid gap-4 md:grid-cols-2">
                {results
                  .filter((r) => r.signals.length > 0)
                  .map((result) => (
                    <CategorySection key={result.category} result={result} />
                  ))}
              </div>
              {getTotalSignals(results) === 0 && (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <h3 className="font-semibold mb-2">No signals detected</h3>
                    <p className="text-sm text-muted-foreground">
                      Everything looks good! Run a scan to check for new signals.
                    </p>
                  </CardContent>
                </Card>
              )}
            </ScrollArea>
          </TabsContent>

          {Object.keys(CATEGORY_CONFIG).map((key) => {
            const categoryResult = results.find((r) => r.category === key);
            return (
              <TabsContent key={key} value={key} className="mt-4">
                {categoryResult && <CategorySection result={categoryResult} />}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
}
