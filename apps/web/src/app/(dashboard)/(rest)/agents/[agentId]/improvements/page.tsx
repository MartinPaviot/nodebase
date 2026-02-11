'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle,
  XCircle,
  Clock,
  TrendingDown,
  TrendingUp,
  Wrench,
  Zap,
  DollarSign,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function AgentImprovementsPage() {
  const params = useParams();
  const agentId = params.agentId as string;
  const trpc = useTRPC();

  // Fetch modification proposals
  const { data: proposals, isLoading, refetch } = useQuery(
    trpc.agents.getModificationProposals.queryOptions({ agentId })
  );

  // Fetch performance analysis
  const { data: analysis, isLoading: analysisLoading } = useQuery(
    trpc.agents.getPerformanceAnalysis.queryOptions({ agentId })
  );

  // Mutation for approving/rejecting proposals
  const approveProposal = useMutation(
    trpc.agents.approveModification.mutationOptions({
      onSuccess: () => {
        toast.success('Modification applied successfully');
        refetch();
      },
      onError: (error) => {
        toast.error(`Failed to apply modification: ${error.message}`);
      },
    })
  );

  if (isLoading || analysisLoading) {
    return <LoadingSkeleton />;
  }

  const pendingProposals = proposals?.filter((p: any) => p.status === 'PENDING') || [];
  const historicalProposals = proposals?.filter((p: any) => p.status !== 'PENDING') || [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Agent Improvement Proposals</h1>
        <p className="text-muted-foreground">
          Your agent has analyzed its performance and suggests these modifications
        </p>
      </div>

      {/* Performance Summary */}
      {analysis && <PerformanceSummary analysis={analysis} />}

      {/* Pending Proposals */}
      {pendingProposals.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <h2 className="text-2xl font-semibold">Pending Proposals</h2>
            <Badge>{pendingProposals.length}</Badge>
          </div>

          {pendingProposals.map((proposal: any) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onApprove={() => approveProposal.mutate({ proposalId: proposal.id, approved: true })}
              onReject={() => approveProposal.mutate({ proposalId: proposal.id, approved: false })}
              isProcessing={approveProposal.isPending}
            />
          ))}
        </div>
      ) : (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            No pending proposals. Your agent is performing well! We'll notify you when improvements are suggested.
          </AlertDescription>
        </Alert>
      )}

      {/* Historical Proposals */}
      {historicalProposals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Historical Proposals</h2>
          <div className="space-y-3">
            {historicalProposals.map((proposal: any) => (
              <HistoricalProposalCard key={proposal.id} proposal={proposal} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Performance Summary Component
// ============================================================================

function PerformanceSummary({ analysis }: { analysis: any }) {
  const getStatusColor = (value: number, threshold: number, inverse = false) => {
    if (inverse) {
      return value <= threshold ? 'text-green-600' : 'text-red-600';
    }
    return value >= threshold ? 'text-green-600' : 'text-red-600';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Analysis (Last 30 Days)</CardTitle>
        <CardDescription>Current metrics that triggered improvement suggestions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">User Satisfaction</div>
            <div className={`text-2xl font-bold ${getStatusColor(analysis.avgSatisfaction, 4.0)}`}>
              {analysis.avgSatisfaction.toFixed(1)}/5.0
            </div>
            {analysis.avgSatisfaction < 3.5 && (
              <div className="text-xs text-yellow-600">Below target (3.5)</div>
            )}
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Success Rate</div>
            <div className={`text-2xl font-bold ${getStatusColor(analysis.successRate * 100, 80)}`}>
              {(analysis.successRate * 100).toFixed(1)}%
            </div>
            {analysis.successRate < 0.8 && (
              <div className="text-xs text-yellow-600">Below target (80%)</div>
            )}
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Avg Cost</div>
            <div className={`text-2xl font-bold ${getStatusColor(analysis.avgCost, 0.5, true)}`}>
              ${analysis.avgCost.toFixed(3)}
            </div>
            {analysis.avgCost > 0.5 && (
              <div className="text-xs text-yellow-600">High cost per conversation</div>
            )}
          </div>
        </div>

        {/* Common Issues */}
        {(analysis.commonFailures.length > 0 || analysis.hallucinationRate > 0.1) && (
          <>
            <Separator className="my-4" />
            <div className="space-y-2">
              <div className="text-sm font-medium">Detected Issues</div>
              {analysis.commonFailures.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {analysis.commonFailures.map((failure: string) => (
                    <Badge key={failure} variant="destructive">
                      {failure.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              )}
              {analysis.hallucinationRate > 0.1 && (
                <div className="text-sm text-red-600">
                  <AlertTriangle className="mr-1 inline h-4 w-4" />
                  Hallucination rate: {(analysis.hallucinationRate * 100).toFixed(1)}%
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Proposal Card Component
// ============================================================================

function ProposalCard({
  proposal,
  onApprove,
  onReject,
  isProcessing,
}: {
  proposal: any;
  onApprove: () => void;
  onReject: () => void;
  isProcessing: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PROMPT_REFINEMENT':
        return <Wrench className="h-5 w-5" />;
      case 'MODEL_DOWNGRADE':
        return <TrendingDown className="h-5 w-5 text-green-600" />;
      case 'MODEL_UPGRADE':
        return <TrendingUp className="h-5 w-5 text-blue-600" />;
      case 'ADD_RAG':
        return <Zap className="h-5 w-5 text-purple-600" />;
      default:
        return <Wrench className="h-5 w-5" />;
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'MODEL_DOWNGRADE':
        return 'default';
      case 'MODEL_UPGRADE':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {getTypeIcon(proposal.type)}
            <div className="space-y-1">
              <CardTitle className="text-xl">
                {proposal.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())}
              </CardTitle>
              <CardDescription>{proposal.rationale}</CardDescription>
            </div>
          </div>
          <Badge variant={getTypeBadgeVariant(proposal.type)}>
            {proposal.type.replace(/_/g, ' ')}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Impact */}
        <div className="rounded-lg bg-blue-50 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
            <Sparkles className="h-4 w-4" />
            Expected Impact
          </div>
          <div className="mt-1 text-sm text-blue-700">{proposal.impact}</div>
          {proposal.estimatedSavings && (
            <div className="mt-2 flex items-center gap-1 text-sm font-semibold text-green-600">
              <DollarSign className="h-4 w-4" />
              Estimated savings: ${proposal.estimatedSavings.toFixed(2)}
            </div>
          )}
        </div>

        {/* Show/Hide Details */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
          className="w-full"
        >
          {showDetails ? 'Hide' : 'Show'} Details
        </Button>

        {/* Details */}
        {showDetails && (
          <div className="space-y-3 rounded-lg border p-4">
            <div>
              <div className="mb-1 text-sm font-medium">Current</div>
              <div className="rounded bg-muted p-3 font-mono text-sm">
                {proposal.current.length > 200
                  ? proposal.current.substring(0, 200) + '...'
                  : proposal.current}
              </div>
            </div>

            <div>
              <div className="mb-1 text-sm font-medium">Proposed</div>
              <div className="rounded bg-green-50 p-3 font-mono text-sm">
                {proposal.proposed.length > 200
                  ? proposal.proposed.substring(0, 200) + '...'
                  : proposal.proposed}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-3">
        <Button
          onClick={onApprove}
          disabled={isProcessing}
          className="flex-1"
        >
          <CheckCircle className="mr-2 h-4 w-4" />
          Approve & Apply
        </Button>
        <Button
          onClick={onReject}
          disabled={isProcessing}
          variant="outline"
          className="flex-1"
        >
          <XCircle className="mr-2 h-4 w-4" />
          Reject
        </Button>
      </CardFooter>
    </Card>
  );
}

// ============================================================================
// Historical Proposal Card Component
// ============================================================================

function HistoricalProposalCard({ proposal }: { proposal: any }) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPLIED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPLIED':
        return <Badge className="bg-green-600">Applied</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(proposal.status)}
            <CardTitle className="text-base">
              {proposal.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(proposal.status)}
            <span className="text-xs text-muted-foreground">
              {new Date(proposal.proposedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">{proposal.rationale}</div>
        {proposal.appliedAt && (
          <div className="mt-2 text-xs text-green-600">
            Applied on {new Date(proposal.appliedAt).toLocaleDateString()}
          </div>
        )}
        {proposal.reviewedAt && !proposal.appliedAt && (
          <div className="mt-2 text-xs text-red-600">
            Rejected on {new Date(proposal.reviewedAt).toLocaleDateString()}
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
      <Skeleton className="h-48 w-full" />
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    </div>
  );
}
