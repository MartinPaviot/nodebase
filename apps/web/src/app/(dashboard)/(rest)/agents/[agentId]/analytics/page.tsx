'use client';

import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, TrendingUp, TrendingDown, DollarSign, Clock, ThumbsUp, ThumbsDown, AlertTriangle, Lightbulb } from 'lucide-react';
import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';

export default function AgentAnalyticsPage() {
  const params = useParams();
  const agentId = params.agentId as string;
  const trpc = useTRPC();

  // Fetch analytics data
  const { data: metrics, isLoading: metricsLoading } = useQuery(
    trpc.agents.getMetrics.queryOptions({
      agentId,
      timeframe: 30, // Last 30 days
    })
  );

  const { data: insights, isLoading: insightsLoading } = useQuery(
    trpc.agents.getLatestInsights.queryOptions({
      agentId,
    })
  );

  const { data: evaluations, isLoading: evalsLoading } = useQuery(
    trpc.agents.getEvaluations.queryOptions({
      agentId,
      limit: 10,
    })
  );

  const { data: abTests, isLoading: testsLoading } = useQuery(
    trpc.agents.getABTests.queryOptions({
      agentId,
    })
  );

  if (metricsLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Agent Analytics</h1>
        <p className="text-muted-foreground">
          Performance metrics, insights, and optimization results
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="tests">A/B Tests</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <PerformanceOverview metrics={metrics} />
        </TabsContent>

        {/* Evaluations Tab */}
        <TabsContent value="evaluations" className="space-y-4">
          <MultiTurnEvaluations evaluations={evaluations ?? []} loading={evalsLoading} />
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <InsightsView insights={insights} loading={insightsLoading} />
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback" className="space-y-4">
          <FeedbackView agentId={agentId} />
        </TabsContent>

        {/* A/B Tests Tab */}
        <TabsContent value="tests" className="space-y-4">
          <ABTestsView tests={abTests ?? []} loading={testsLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Performance Overview Component
// ============================================================================

function PerformanceOverview({ metrics }: { metrics: any }) {
  if (!metrics) {
    return <div className="text-center text-muted-foreground">No metrics available</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Conversations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalConversations || 0}</div>
          <p className="text-xs text-muted-foreground">Last 30 days</p>
        </CardContent>
      </Card>

      {/* Success Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          {(metrics.successRate || 0) >= 0.8 ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {((metrics.successRate || 0) * 100).toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">Completed successfully</p>
        </CardContent>
      </Card>

      {/* Average Cost */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Cost</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${(metrics.avgCost || 0).toFixed(3)}
          </div>
          <p className="text-xs text-muted-foreground">Per conversation</p>
        </CardContent>
      </Card>

      {/* Average Latency */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {((metrics.avgLatency || 0) / 1000).toFixed(1)}s
          </div>
          <p className="text-xs text-muted-foreground">P50 response time</p>
        </CardContent>
      </Card>

      {/* User Satisfaction */}
      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">User Satisfaction</CardTitle>
          {(metrics.avgSatisfaction || 3) >= 4 ? (
            <ThumbsUp className="h-4 w-4 text-green-500" />
          ) : (
            <ThumbsDown className="h-4 w-4 text-yellow-500" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {(metrics.avgSatisfaction || 3).toFixed(1)}/5.0
          </div>
          <p className="text-xs text-muted-foreground">
            Based on {metrics.totalFeedback || 0} feedback responses
          </p>
        </CardContent>
      </Card>

      {/* Token Usage */}
      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Token Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Input tokens</span>
              <span className="text-sm font-medium">
                {(metrics.totalTokensIn || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Output tokens</span>
              <span className="text-sm font-medium">
                {(metrics.totalTokensOut || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between border-t pt-1">
              <span className="text-sm font-medium">Total cost</span>
              <span className="text-sm font-bold">
                ${(metrics.totalCost || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Multi-Turn Evaluations Component
// ============================================================================

function MultiTurnEvaluations({ evaluations, loading }: { evaluations: any[]; loading: boolean }) {
  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!evaluations || evaluations.length === 0) {
    return <div className="text-center text-muted-foreground">No evaluations yet</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Conversation Evaluations</CardTitle>
          <CardDescription>
            Goal completion and satisfaction scores for recent conversations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {evaluations.map((evaluation: any) => (
              <div
                key={evaluation.id}
                className="flex items-center justify-between border-b pb-4 last:border-0"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={evaluation.goalCompleted ? 'default' : 'secondary'}>
                      {evaluation.goalCompleted ? 'Goal Completed' : 'Incomplete'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(evaluation.evaluatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-sm">
                    Satisfaction: {evaluation.userSatisfactionScore.toFixed(1)}/5.0
                    <span className="mx-2">•</span>
                    Confidence: {(evaluation.goalCompletionConfidence * 100).toFixed(0)}%
                  </div>
                  {evaluation.categories.length > 0 && (
                    <div className="flex gap-1">
                      {evaluation.categories.map((cat: string) => (
                        <Badge key={cat} variant="outline" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {evaluation.failureModes.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" />
                      {evaluation.failureModes.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Insights View Component
// ============================================================================

function InsightsView({ insights, loading }: { insights: any; loading: boolean }) {
  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!insights) {
    return (
      <div className="text-center text-muted-foreground">
        No insights available. Generate insights to see patterns and opportunities.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Clusters */}
      {insights.clusters && insights.clusters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Conversation Clusters</CardTitle>
            <CardDescription>
              Automatically detected patterns in {insights.totalConversations} conversations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.clusters.map((cluster: any) => (
                <div key={cluster.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{cluster.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {cluster.size} conversations • Avg satisfaction:{' '}
                        {cluster.avgSatisfaction.toFixed(1)}/5
                      </div>
                    </div>
                    <Badge>{((cluster.size / insights.totalConversations) * 100).toFixed(0)}%</Badge>
                  </div>
                  {cluster.commonKeywords.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {cluster.commonKeywords.map((kw: string) => (
                        <Badge key={kw} variant="secondary" className="text-xs">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Anomalies */}
      {insights.anomalies && insights.anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Anomalies Detected
            </CardTitle>
            <CardDescription>
              Conversations with unusual cost, latency, or failure patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {insights.anomalies.map((anomaly: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={anomaly.severity === 'high' ? 'destructive' : 'secondary'}>
                        {anomaly.type}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{anomaly.description}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Opportunities */}
      {insights.opportunities && insights.opportunities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-blue-500" />
              Optimization Opportunities
            </CardTitle>
            <CardDescription>Suggested improvements based on usage patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.opportunities.map((opp: any, idx: number) => (
                <div key={idx} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{opp.type.replace(/_/g, ' ')}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{opp.suggestion}</div>
                      <div className="mt-2 text-sm font-medium text-green-600">{opp.impact}</div>
                    </div>
                    {opp.estimatedSavings && (
                      <div className="text-right">
                        <div className="text-sm font-medium text-green-600">
                          Save ${opp.estimatedSavings.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {opp.affectedConversations} conversations
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Feedback View Component
// ============================================================================

function FeedbackView({ agentId }: { agentId: string }) {
  const trpc = useTRPC();
  const { data: feedback, isLoading } = useQuery(
    trpc.agents.getFeedback.queryOptions({
      agentId,
      limit: 20,
    })
  );

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!feedback || feedback.length === 0) {
    return <div className="text-center text-muted-foreground">No feedback yet</div>;
  }

  const thumbsUp = feedback.filter((f: any) => f.type === 'THUMBS_UP').length;
  const thumbsDown = feedback.filter((f: any) => f.type === 'THUMBS_DOWN').length;
  const edits = feedback.filter((f: any) => f.type === 'USER_EDIT').length;

  return (
    <div className="space-y-4">
      {/* Feedback Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Thumbs Up</CardTitle>
            <ThumbsUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{thumbsUp}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Thumbs Down</CardTitle>
            <ThumbsDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{thumbsDown}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Edits</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{edits}</div>
          </CardContent>
        </Card>
      </div>

      {/* Feedback List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Feedback</CardTitle>
          <CardDescription>Latest user feedback and corrections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {feedback.map((item: any) => (
              <div key={item.id} className="border-b pb-4 last:border-0">
                <div className="flex items-center justify-between">
                  <Badge>{item.type.replace(/_/g, ' ')}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </div>
                {item.userEdit && (
                  <div className="mt-2 space-y-1">
                    <div className="text-xs text-muted-foreground">User corrected:</div>
                    <div className="rounded bg-muted p-2 text-sm">{item.userEdit}</div>
                  </div>
                )}
                {item.correctionText && (
                  <div className="mt-2 space-y-1">
                    <div className="text-xs text-muted-foreground">Correction:</div>
                    <div className="rounded bg-muted p-2 text-sm">{item.correctionText}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// A/B Tests View Component
// ============================================================================

function ABTestsView({ tests, loading }: { tests: any[]; loading: boolean }) {
  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!tests || tests.length === 0) {
    return <div className="text-center text-muted-foreground">No A/B tests yet</div>;
  }

  return (
    <div className="space-y-4">
      {tests.map((test: any) => (
        <Card key={test.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>A/B Test</CardTitle>
              <Badge variant={test.status === 'RUNNING' ? 'default' : 'secondary'}>
                {test.status}
              </Badge>
            </div>
            <CardDescription>
              Started {new Date(test.startedAt).toLocaleDateString()}
              {test.endedAt && ` • Ended ${new Date(test.endedAt).toLocaleDateString()}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Test Configuration */}
              <div>
                <div className="text-sm font-medium">Traffic Split</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {((1 - test.trafficSplit) * 100).toFixed(0)}% Variant A (current) /{' '}
                  {(test.trafficSplit * 100).toFixed(0)}% Variant B (new)
                </div>
              </div>

              {/* Results */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-medium">Variant A (Current)</div>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Traces</span>
                      <span className="font-medium">{test.variantATraces}</span>
                    </div>
                    {test.variantAScore !== null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Avg Score</span>
                        <span className="font-medium">{test.variantAScore.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="text-sm font-medium">Variant B (New)</div>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Traces</span>
                      <span className="font-medium">{test.variantBTraces}</span>
                    </div>
                    {test.variantBScore !== null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Avg Score</span>
                        <span className="font-medium">{test.variantBScore.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Winner */}
              {test.winningVariant && (
                <div className="rounded-lg bg-green-50 p-3">
                  <div className="font-medium text-green-900">
                    Winner: Variant {test.winningVariant}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
}
