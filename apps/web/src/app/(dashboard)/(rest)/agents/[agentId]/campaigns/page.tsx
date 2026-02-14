'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, EnvelopeSimple, ArrowRight, Users, ChartBar } from '@phosphor-icons/react';
import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';

interface CampaignSummary {
  id: string;
  name: string;
  status: CampaignStatus;
  leadCount: number;
  contacted: number;
  replies: number;
  positiveReplies: number;
  bounced: number;
  startedAt: string | null;
  createdAt: string;
}

// ============================================================================
// Status Badge
// ============================================================================

function StatusBadge({ status }: { status: CampaignStatus }) {
  const config: Record<CampaignStatus, { label: string; className: string }> = {
    DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700 border-gray-200' },
    ACTIVE: { label: 'Active', className: 'bg-green-100 text-green-700 border-green-200' },
    PAUSED: { label: 'Paused', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    COMPLETED: { label: 'Completed', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    ARCHIVED: { label: 'Archived', className: 'bg-gray-100 text-gray-500 border-gray-200' },
  };

  const { label, className } = config[status] ?? config.DRAFT;

  return <Badge className={className}>{label}</Badge>;
}

// ============================================================================
// Campaign Card
// ============================================================================

function CampaignCard({ campaign, agentId }: { campaign: CampaignSummary; agentId: string }) {
  const router = useRouter();
  const bounceRate = campaign.contacted > 0
    ? ((campaign.bounced / campaign.contacted) * 100).toFixed(1)
    : '0.0';

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => router.push(`/agents/${agentId}/campaigns/${campaign.id}`)}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base">{campaign.name}</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-3.5" />
            <span>{campaign.leadCount} leads</span>
            {campaign.startedAt && (
              <>
                <span>-</span>
                <span>Started {new Date(campaign.startedAt).toLocaleDateString()}</span>
              </>
            )}
          </div>
        </div>
        <StatusBadge status={campaign.status} />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Contacted</div>
            <div className="text-lg font-semibold">{campaign.contacted}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Replies</div>
            <div className="text-lg font-semibold">{campaign.replies}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Positive</div>
            <div className="text-lg font-semibold text-green-600">{campaign.positiveReplies}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Bounce Rate</div>
            <div className="text-lg font-semibold">{bounceRate}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({ agentId }: { agentId: string }) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
      <EnvelopeSimple className="size-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold">No campaigns yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Create your first cold email campaign to start reaching out.
      </p>
      <Button className="mt-4" onClick={() => router.push(`/agents/${agentId}/campaigns/new`)}>
        <Plus className="size-4" />
        New Campaign
      </Button>
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-44 w-full" />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function CampaignsPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.agentId as string;
  const trpc = useTRPC();

  const { data: campaigns, isLoading } = useQuery(
    trpc.agents.getCampaigns.queryOptions({ agentId })
  ) as { data: CampaignSummary[] | undefined; isLoading: boolean };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">
            Manage cold email campaigns for this agent
          </p>
        </div>
        <Button onClick={() => router.push(`/agents/${agentId}/campaigns/new`)}>
          <Plus className="size-4" />
          New Campaign
        </Button>
      </div>

      {/* Campaign Grid */}
      {!campaigns || campaigns.length === 0 ? (
        <EmptyState agentId={agentId} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign: CampaignSummary) => (
            <CampaignCard key={campaign.id} campaign={campaign} agentId={agentId} />
          ))}
        </div>
      )}
    </div>
  );
}
