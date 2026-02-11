"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistance } from "date-fns";

interface AgentAnalyticsDashboardProps {
  agentId: string;
}

export function AgentAnalyticsDashboard({ agentId }: AgentAnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState("traces");
  const [traces, setTraces] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [optimizations, setOptimizations] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch traces
  const fetchTraces = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/traces`);
      const data = await response.json();
      setTraces(data.traces || []);
    } catch (error) {
      console.error("Error fetching traces:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch insights
  const fetchInsights = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/insights`);
      const data = await response.json();
      setInsights(data.insights || []);
    } catch (error) {
      console.error("Error fetching insights:", error);
    } finally {
      setLoading(false);
    }
  };

  // Generate new insights
  const generateInsights = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 7 }),
      });
      const data = await response.json();
      setInsights(data.insights || []);
    } catch (error) {
      console.error("Error generating insights:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch optimizations
  const fetchOptimizations = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/optimization`);
      const data = await response.json();
      setOptimizations(data.runs || []);
    } catch (error) {
      console.error("Error fetching optimizations:", error);
    } finally {
      setLoading(false);
    }
  };

  // Run optimization
  const runOptimization = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/optimization`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 7 }),
      });
      const data = await response.json();
      await fetchOptimizations();
    } catch (error) {
      console.error("Error running optimization:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch proposals
  const fetchProposals = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/proposals`);
      const data = await response.json();
      setProposals(data.proposals || []);
    } catch (error) {
      console.error("Error fetching proposals:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle proposal action
  const handleProposalAction = async (proposalId: string, action: "approve" | "reject") => {
    try {
      await fetch(`/api/agents/${agentId}/proposals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, action }),
      });
      await fetchProposals();
    } catch (error) {
      console.error("Error updating proposal:", error);
    }
  };

  // Load data on tab change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "traces" && traces.length === 0) fetchTraces();
    if (tab === "insights" && insights.length === 0) fetchInsights();
    if (tab === "optimizations" && optimizations.length === 0) fetchOptimizations();
    if (tab === "proposals" && proposals.length === 0) fetchProposals();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "high":
        return "default";
      case "medium":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-6">Analytics & Optimization</h2>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="traces">Traces</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="optimizations">Optimizations</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
        </TabsList>

        {/* Traces Tab */}
        <TabsContent value="traces" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Complete execution traces with LLM calls and tool usage
            </p>
            <Button onClick={fetchTraces} disabled={loading}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Triggered By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Steps</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {traces.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No traces found
                    </TableCell>
                  </TableRow>
                ) : (
                  traces.map((trace) => (
                    <TableRow key={trace.id}>
                      <TableCell className="font-medium">{trace.triggeredBy}</TableCell>
                      <TableCell>
                        <Badge variant={trace.status === "completed" ? "default" : "destructive"}>
                          {trace.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{trace.totalTokensUsed.toLocaleString()}</TableCell>
                      <TableCell>${trace.totalCost.toFixed(4)}</TableCell>
                      <TableCell>{(trace.totalDuration / 1000).toFixed(2)}s</TableCell>
                      <TableCell>{trace.stepsCount}</TableCell>
                      <TableCell>{formatDistance(new Date(trace.createdAt), new Date(), { addSuffix: true })}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Automatically detected patterns and optimization opportunities
            </p>
            <Button onClick={generateInsights} disabled={loading}>
              Generate Insights
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {insights.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No insights available. Click "Generate Insights" to analyze recent performance.
                </p>
              ) : (
                insights.map((insight) => (
                  <Card key={insight.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold">{insight.title}</h3>
                      <Badge variant={getSeverityColor(insight.severity)}>
                        {insight.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{insight.description}</p>
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Recommendations:</p>
                      <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                        {(insight.recommendations as string[]).map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Detected {formatDistance(new Date(insight.detectedAt), new Date(), { addSuffix: true })}
                    </p>
                  </Card>
                ))
              )}
            </div>
          )}
        </TabsContent>

        {/* Optimizations Tab */}
        <TabsContent value="optimizations" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Prompt optimization runs with A/B testing results
            </p>
            <Button onClick={runOptimization} disabled={loading}>
              Run Optimization
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {optimizations.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No optimization runs yet. Click "Run Optimization" to start.
                </p>
              ) : (
                optimizations.map((opt) => (
                  <Card key={opt.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold">{opt.method.replace(/_/g, " ")}</h3>
                        <p className="text-xs text-muted-foreground">
                          {formatDistance(new Date(opt.startedAt), new Date(), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge variant={opt.status === "completed" ? "default" : "secondary"}>
                        {opt.status}
                      </Badge>
                    </div>

                    {opt.improvements && opt.improvements.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium">Improvements:</p>
                        {opt.improvements.map((imp: any, i: number) => (
                          <div key={i} className="text-xs">
                            <span className="font-medium">{imp.metric}:</span>{" "}
                            <span className={imp.improvement > 0 ? "text-green-600" : "text-red-600"}>
                              {imp.improvement > 0 ? "+" : ""}
                              {imp.improvement.toFixed(1)}%
                            </span>
                            {" "}({imp.baselineValue.toFixed(3)} → {imp.optimizedValue.toFixed(3)})
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}
        </TabsContent>

        {/* Proposals Tab */}
        <TabsContent value="proposals" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Self-modification proposals requiring your approval
            </p>
            <Button onClick={fetchProposals} disabled={loading}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {proposals.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No pending proposals
                </p>
              ) : (
                proposals
                  .filter((p) => p.status === "pending")
                  .map((proposal) => (
                    <Card key={proposal.id} className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold">{proposal.type.replace(/_/g, " ")}</h3>
                        <Badge>{proposal.status}</Badge>
                      </div>

                      <p className="text-sm text-muted-foreground mb-3">{proposal.rationale}</p>

                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-xs font-medium mb-1">Current:</p>
                          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                            {JSON.stringify(proposal.current, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <p className="text-xs font-medium mb-1">Proposed:</p>
                          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                            {JSON.stringify(proposal.proposed, null, 2)}
                          </pre>
                        </div>
                      </div>

                      {proposal.expectedImpact && proposal.expectedImpact.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-medium mb-1">Expected Impact:</p>
                          {proposal.expectedImpact.map((impact: any, i: number) => (
                            <div key={i} className="text-xs text-muted-foreground">
                              {impact.metric}: {impact.currentValue.toFixed(3)} → {impact.expectedValue.toFixed(3)}{" "}
                              (confidence: {(impact.confidence * 100).toFixed(0)}%)
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleProposalAction(proposal.id, "approve")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleProposalAction(proposal.id, "reject")}
                        >
                          Reject
                        </Button>
                      </div>
                    </Card>
                  ))
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}
