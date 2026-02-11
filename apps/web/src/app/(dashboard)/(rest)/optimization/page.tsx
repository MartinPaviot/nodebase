'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play,
  CheckCircle,
  Clock,
  TrendingUp,
  Zap,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function OptimizationQueuePage() {
  const [selectedTab, setSelectedTab] = useState('runs');
  const trpc = useTRPC();

  // Fetch optimization runs
  const { data: runs, isLoading: runsLoading, refetch: refetchRuns } = useQuery(
    trpc.optimization.getOptimizationRuns.queryOptions()
  );

  // Fetch A/B tests
  const { data: tests, isLoading: testsLoading, refetch: refetchTests } = useQuery(
    trpc.optimization.getAllABTests.queryOptions()
  );

  // Mutation to select A/B test winner
  const selectWinner = useMutation(
    trpc.optimization.selectABTestWinner.mutationOptions({
      onSuccess: () => {
        toast.success('Winner selected and rolled out');
        refetchTests();
      },
      onError: (error) => {
        toast.error(`Failed to select winner: ${error.message}`);
      },
    })
  );

  if (runsLoading && testsLoading) {
    return <LoadingSkeleton />;
  }

  const pendingRuns = runs?.filter((r: any) => r.status === 'analyzing' || r.status === 'testing') || [];
  const completedRuns = runs?.filter((r: any) => r.status === 'completed') || [];
  const activeTests = tests?.filter((t: any) => t.status === 'RUNNING') || [];
  const completedTests = tests?.filter((t: any) => t.status === 'COMPLETED') || [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Optimization Queue</h1>
        <p className="text-muted-foreground">
          Monitor optimization runs and A/B tests across all agents
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Runs</CardTitle>
            <Play className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRuns.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Runs</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedRuns.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active A/B Tests</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTests.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tests?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="runs">Optimization Runs</TabsTrigger>
          <TabsTrigger value="tests">A/B Tests</TabsTrigger>
        </TabsList>

        {/* Optimization Runs Tab */}
        <TabsContent value="runs" className="space-y-4">
          {pendingRuns.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">In Progress</h2>
              {pendingRuns.map((run: any) => (
                <OptimizationRunCard key={run.id} run={run} />
              ))}
            </div>
          )}

          {completedRuns.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Completed</h2>
              {completedRuns.map((run: any) => (
                <OptimizationRunCard key={run.id} run={run} />
              ))}
            </div>
          )}

          {runs?.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              No optimization runs yet. Optimization runs are triggered automatically when agents accumulate feedback.
            </div>
          )}
        </TabsContent>

        {/* A/B Tests Tab */}
        <TabsContent value="tests" className="space-y-4">
          {activeTests.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Active Tests</h2>
              {activeTests.map((test: any) => (
                <ABTestCard
                  key={test.id}
                  test={test}
                  onSelectWinner={(variant: 'A' | 'B') => {
                    selectWinner.mutate({ testId: test.id, variant });
                  }}
                  isProcessing={selectWinner.isPending}
                />
              ))}
            </div>
          )}

          {completedTests.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Completed Tests</h2>
              {completedTests.map((test: any) => (
                <ABTestCard key={test.id} test={test} />
              ))}
            </div>
          )}

          {tests?.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              No A/B tests yet. Tests are created when optimization runs propose prompt improvements.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Optimization Run Card Component
// ============================================================================

function OptimizationRunCard({ run }: { run: any }) {
  const [showDetails, setShowDetails] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'analyzing':
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Analyzing</Badge>;
      case 'testing':
        return <Badge variant="secondary"><Play className="mr-1 h-3 w-3" />Testing</Badge>;
      case 'completed':
        return <Badge className="bg-green-600"><CheckCircle className="mr-1 h-3 w-3" />Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              <Link
                href={`/agents/${run.agentId}`}
                className="flex items-center gap-2 hover:underline"
              >
                Agent: {run.agent?.name || run.agentId}
                <ExternalLink className="h-4 w-4" />
              </Link>
            </CardTitle>
            <CardDescription>
              Triggered {new Date(run.triggeredAt).toLocaleDateString()} by {run.triggeredBy}
            </CardDescription>
          </div>
          {getStatusBadge(run.status)}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Edit Patterns */}
        {run.editPatterns && run.editPatterns.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium">Detected Patterns ({run.editPatterns.length})</div>
            <div className="space-y-2">
              {run.editPatterns.slice(0, showDetails ? undefined : 2).map((pattern: any, idx: number) => (
                <div key={idx} className="rounded-lg border p-2 text-sm">
                  <div className="font-medium">{pattern.pattern}</div>
                  <div className="text-xs text-muted-foreground">
                    Frequency: {pattern.frequency} occurrences
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test Results */}
        {run.testResults && run.testResults.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium">Prompt Variations Tested</div>
            <div className="space-y-2">
              {run.testResults.slice(0, showDetails ? undefined : 1).map((result: any, idx: number) => (
                <div key={idx} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="outline">Variation {idx + 1}</Badge>
                    <span className="text-sm font-medium">
                      Score: {(result.avgScore * 100).toFixed(0)}%
                    </span>
                  </div>
                  {showDetails && (
                    <div className="text-xs text-muted-foreground">{result.variation.rationale}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendation */}
        <div className="rounded-lg bg-blue-50 p-3">
          <div className="text-sm font-medium text-blue-900">Recommendation</div>
          <div className="mt-1 text-sm text-blue-700">{run.recommendation}</div>
        </div>

        {/* A/B Test Link */}
        {run.abTestId && (
          <div className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4 text-purple-500" />
            <span className="text-muted-foreground">A/B Test:</span>
            <Link href={`#test-${run.abTestId}`} className="font-medium hover:underline">
              {run.abTestId}
            </Link>
          </div>
        )}

        {/* Toggle Details */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
          className="w-full"
        >
          <Eye className="mr-2 h-4 w-4" />
          {showDetails ? 'Hide' : 'Show'} Details
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// A/B Test Card Component
// ============================================================================

function ABTestCard({
  test,
  onSelectWinner,
  isProcessing,
}: {
  test: any;
  onSelectWinner?: (variant: 'A' | 'B') => void;
  isProcessing?: boolean;
}) {
  const isActive = test.status === 'RUNNING';
  const canSelectWinner = isActive && test.variantATraces >= 50 && test.variantBTraces >= 50;

  const scoreDiff = test.variantBScore && test.variantAScore
    ? test.variantBScore - test.variantAScore
    : 0;

  return (
    <Card id={`test-${test.id}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              <Link
                href={`/agents/${test.agentId}`}
                className="flex items-center gap-2 hover:underline"
              >
                Agent: {test.agent?.name || test.agentId}
                <ExternalLink className="h-4 w-4" />
              </Link>
            </CardTitle>
            <CardDescription>
              Started {new Date(test.startedAt).toLocaleDateString()}
              {test.endedAt && ` • Ended ${new Date(test.endedAt).toLocaleDateString()}`}
            </CardDescription>
          </div>
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {test.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Traffic Split */}
        <div className="rounded-lg border p-3">
          <div className="text-sm font-medium">Traffic Split</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {((1 - test.trafficSplit) * 100).toFixed(0)}% to Variant A (current) /{' '}
            {(test.trafficSplit * 100).toFixed(0)}% to Variant B (new)
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid gap-3 md:grid-cols-2">
          {/* Variant A */}
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-medium">Variant A (Current)</div>
              {test.winningVariant === 'A' && (
                <Badge className="bg-green-600">Winner</Badge>
              )}
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Traces</span>
                <span className="font-medium">{test.variantATraces}</span>
              </div>
              {test.variantAScore !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Score</span>
                  <span className="font-medium">{test.variantAScore.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Variant B */}
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-medium">Variant B (New)</div>
              {test.winningVariant === 'B' && (
                <Badge className="bg-green-600">Winner</Badge>
              )}
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Traces</span>
                <span className="font-medium">{test.variantBTraces}</span>
              </div>
              {test.variantBScore !== null && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Score</span>
                    <span className="font-medium">{test.variantBScore.toFixed(1)}</span>
                  </div>
                  {scoreDiff !== 0 && (
                    <div className={`flex justify-between text-xs font-medium ${scoreDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      <span>Difference</span>
                      <span>{scoreDiff > 0 ? '+' : ''}{scoreDiff.toFixed(1)} points</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Winner Selection */}
        {canSelectWinner && onSelectWinner && (
          <div className="rounded-lg bg-yellow-50 p-3">
            <div className="mb-2 text-sm font-medium text-yellow-900">
              Ready to select winner
            </div>
            <div className="mb-3 text-xs text-yellow-700">
              Both variants have reached 50+ samples. You can now select a winner to roll out.
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSelectWinner('A')}
                disabled={isProcessing}
              >
                Select A
              </Button>
              <Button
                size="sm"
                onClick={() => onSelectWinner('B')}
                disabled={isProcessing}
              >
                Select B
              </Button>
            </div>
          </div>
        )}

        {/* Winner Announced */}
        {test.winningVariant && (
          <div className="rounded-lg bg-green-50 p-3">
            <div className="text-sm font-medium text-green-900">
              Winner: Variant {test.winningVariant}
            </div>
            <div className="mt-1 text-xs text-green-700">
              This variant has been rolled out to 100% of traffic.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    </div>
  );
}
