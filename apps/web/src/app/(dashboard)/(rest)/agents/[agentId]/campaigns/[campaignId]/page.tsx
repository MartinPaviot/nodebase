'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Play,
  Pause,
  ArrowClockwise,
  Users,
  EnvelopeSimple,
  ChatCircle,
  ThumbsUp,
  Warning,
  Clock,
  Trophy,
  ChartLineUp,
  ArrowLeft,
} from '@phosphor-icons/react';
import { useTRPC } from '@/trpc/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
type LeadStatus = 'PENDING' | 'IN_SEQUENCE' | 'REPLIED' | 'POSITIVE' | 'NEGATIVE' | 'BOUNCED' | 'UNSUBSCRIBED' | 'COMPLETED' | 'PAUSED';
type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'OUT_OF_OFFICE' | 'BOUNCE' | null;

interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  leadCount: number;
  contacted: number;
  replies: number;
  positiveReplies: number;
  bounced: number;
  delivered: number;
  opened: number;
  startedAt: string | null;
  createdAt: string;
  abTestEnabled: boolean;
  sequence: SequenceStep[];
  config: CampaignConfig;
}

interface SequenceStep {
  type: string;
  directive?: string;
  subjectHint?: string;
  toneHint?: string;
  maxWords?: number;
  abEnabled?: boolean;
  variants?: Array<{ directive: string; weight: number }>;
  days?: number;
  businessDaysOnly?: boolean;
  stats?: {
    sent: number;
    delivered: number;
    opened: number;
    replied: number;
    positiveRate: number;
  };
}

interface CampaignConfig {
  timezone?: string;
  sendingDays?: string[];
  startHour?: number;
  endHour?: number;
  dailySendLimit?: number;
  mailboxStrategy?: string;
  abTestEnabled?: boolean;
}

interface Lead {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  status: LeadStatus;
  currentStep: number;
  totalSteps: number;
  lastEmailAt: string | null;
  sentiment: Sentiment;
}

interface DailyStat {
  date: string;
  sent: number;
  delivered: number;
  opened: number;
  replied: number;
}

interface ABTestResult {
  stepIndex: number;
  stepLabel: string;
  variantA: { sent: number; replies: number; positiveRate: number };
  variantB: { sent: number; replies: number; positiveRate: number };
  winner: 'A' | 'B' | null;
  confidence: number;
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

function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const config: Record<LeadStatus, { label: string; className: string }> = {
    PENDING: { label: 'Pending', className: 'bg-gray-100 text-gray-700 border-gray-200' },
    IN_SEQUENCE: { label: 'In Sequence', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    REPLIED: { label: 'Replied', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    POSITIVE: { label: 'Positive', className: 'bg-green-100 text-green-700 border-green-200' },
    NEGATIVE: { label: 'Negative', className: 'bg-red-100 text-red-700 border-red-200' },
    BOUNCED: { label: 'Bounced', className: 'bg-red-100 text-red-700 border-red-200' },
    UNSUBSCRIBED: { label: 'Unsubscribed', className: 'bg-orange-100 text-orange-700 border-orange-200' },
    COMPLETED: { label: 'Completed', className: 'bg-gray-100 text-gray-600 border-gray-200' },
    PAUSED: { label: 'Paused', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  };

  const { label, className } = config[status] ?? config.PENDING;

  return <Badge className={className}>{label}</Badge>;
}

function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  if (!sentiment) return <span className="text-xs text-muted-foreground">-</span>;

  const config: Record<string, { label: string; className: string }> = {
    POSITIVE: { label: 'Positive', className: 'bg-green-100 text-green-700 border-green-200' },
    NEUTRAL: { label: 'Neutral', className: 'bg-gray-100 text-gray-700 border-gray-200' },
    NEGATIVE: { label: 'Negative', className: 'bg-red-100 text-red-700 border-red-200' },
    OUT_OF_OFFICE: { label: 'OOO', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    BOUNCE: { label: 'Bounce', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  };

  const { label, className } = config[sentiment] ?? config.NEUTRAL;

  return <Badge className={className}>{label}</Badge>;
}

// ============================================================================
// Metric Cards
// ============================================================================

function MetricCards({ campaign }: { campaign: Campaign }) {
  const contactedRate = campaign.leadCount > 0
    ? ((campaign.contacted / campaign.leadCount) * 100).toFixed(1)
    : '0.0';
  const replyRate = campaign.contacted > 0
    ? ((campaign.replies / campaign.contacted) * 100).toFixed(1)
    : '0.0';
  const positiveRate = campaign.contacted > 0
    ? ((campaign.positiveReplies / campaign.contacted) * 100).toFixed(1)
    : '0.0';
  const bounceRate = campaign.contacted > 0
    ? ((campaign.bounced / campaign.contacted) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Contacted</CardTitle>
          <Users className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{campaign.contacted}</div>
          <p className="text-xs text-muted-foreground">{contactedRate}% of {campaign.leadCount} leads</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Replies</CardTitle>
          <ChatCircle className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{campaign.replies}</div>
          <p className="text-xs text-muted-foreground">{replyRate}% reply rate</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Positive</CardTitle>
          <ThumbsUp className="size-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{campaign.positiveReplies}</div>
          <p className="text-xs text-muted-foreground">{positiveRate}% positive rate</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Bounced</CardTitle>
          <Warning className="size-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{campaign.bounced}</div>
          <p className="text-xs text-muted-foreground">{bounceRate}% bounce rate</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Leads Tab
// ============================================================================

function LeadsTab({
  agentId,
  campaignId,
}: {
  agentId: string;
  campaignId: string;
}) {
  const trpc = useTRPC();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | LeadStatus>('all');

  const { data, isLoading } = useQuery(
    trpc.agents.getLeads.queryOptions({
      campaignId,
      page,
      status: statusFilter === 'all' ? undefined : statusFilter as LeadStatus,
    })
  );

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const leads = (data?.items ?? []) as unknown as Lead[];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | LeadStatus)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="IN_SEQUENCE">In Sequence</SelectItem>
            <SelectItem value="REPLIED">Replied</SelectItem>
            <SelectItem value="POSITIVE">Positive</SelectItem>
            <SelectItem value="NEGATIVE">Negative</SelectItem>
            <SelectItem value="BOUNCED">Bounced</SelectItem>
            <SelectItem value="UNSUBSCRIBED">Unsubscribed</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="PAUSED">Paused</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Step</TableHead>
                <TableHead>Last Email</TableHead>
                <TableHead>Sentiment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No leads found
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">
                      {lead.firstName} {lead.lastName}
                    </TableCell>
                    <TableCell>{lead.email}</TableCell>
                    <TableCell>{lead.company || '-'}</TableCell>
                    <TableCell>
                      <LeadStatusBadge status={lead.status} />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {lead.currentStep}/{lead.totalSteps}
                      </span>
                    </TableCell>
                    <TableCell>
                      {lead.lastEmailAt
                        ? new Date(lead.lastEmailAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <SentimentBadge sentiment={lead.sentiment} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sequence Tab
// ============================================================================

function SequenceTab({ sequence }: { sequence: SequenceStep[] }) {
  return (
    <div className="space-y-3">
      {sequence.map((step, index) => (
        <Card key={index}>
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1">
                <Badge variant="outline" className="text-xs">{index + 1}</Badge>
                {step.type === 'email' ? (
                  <EnvelopeSimple className="size-4 text-blue-500" />
                ) : (
                  <Clock className="size-4 text-yellow-500" />
                )}
              </div>

              <div className="flex-1">
                {step.type === 'email' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-700 border-blue-200">Email</Badge>
                      {step.subjectHint && (
                        <span className="text-sm text-muted-foreground">
                          Subject: {step.subjectHint}
                        </span>
                      )}
                      {step.abEnabled && (
                        <Badge variant="outline" className="text-xs">A/B</Badge>
                      )}
                    </div>
                    <p className="text-sm">{step.directive}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {step.toneHint && <span>Tone: {step.toneHint}</span>}
                      {step.maxWords && <span>Max: {step.maxWords} words</span>}
                    </div>

                    {/* Per-step stats */}
                    {step.stats && (
                      <div className="mt-3 grid grid-cols-4 gap-4 rounded-lg bg-muted/50 p-3">
                        <div>
                          <div className="text-xs text-muted-foreground">Sent</div>
                          <div className="text-sm font-semibold">{step.stats.sent}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Delivered</div>
                          <div className="text-sm font-semibold">{step.stats.delivered}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Replied</div>
                          <div className="text-sm font-semibold">{step.stats.replied}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Positive Rate</div>
                          <div className="text-sm font-semibold">{step.stats.positiveRate.toFixed(1)}%</div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Wait</Badge>
                    <p className="text-sm">
                      Wait {step.days} {step.businessDaysOnly ? 'business ' : ''}day{step.days !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// Analytics Tab
// ============================================================================

function AnalyticsTab({ campaignId }: { campaignId: string }) {
  const trpc = useTRPC();

  const { data: stats, isLoading } = useQuery(
    trpc.agents.getCampaignStats.queryOptions({
      campaignId,
      days: 30,
    })
  );

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const dailyStats = (stats ?? []) as unknown as DailyStat[];

  if (dailyStats.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No analytics data available yet. Data will appear once emails start sending.
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChartLineUp className="size-5" />
          Daily Performance
        </CardTitle>
        <CardDescription>Sent, delivered, opened, and replied emails per day (last 30 days)</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Sent</TableHead>
              <TableHead className="text-right">Delivered</TableHead>
              <TableHead className="text-right">Opened</TableHead>
              <TableHead className="text-right">Replied</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dailyStats.map((stat) => (
              <TableRow key={stat.date}>
                <TableCell className="font-medium">
                  {new Date(stat.date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                </TableCell>
                <TableCell className="text-right">{stat.sent}</TableCell>
                <TableCell className="text-right">{stat.delivered}</TableCell>
                <TableCell className="text-right">{stat.opened}</TableCell>
                <TableCell className="text-right">{stat.replied}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// A/B Test Tab
// ============================================================================

function ABTestTab({ campaignId }: { campaignId: string }) {
  const trpc = useTRPC();

  const { data: stats, isLoading } = useQuery(
    trpc.agents.getCampaignStats.queryOptions({
      campaignId,
      days: 30,
    })
  );

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  // A/B test results will be computed from campaign email data in future
  const abResults: ABTestResult[] = [];

  if (abResults.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No A/B test data available. Make sure at least one sequence step has A/B testing enabled.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {abResults.map((result) => (
        <Card key={result.stepIndex}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Step {result.stepIndex + 1}: {result.stepLabel}
              </CardTitle>
              {result.winner && (
                <Badge className="bg-green-100 text-green-700 border-green-200">
                  <Trophy className="mr-1 size-3" />
                  Variant {result.winner} wins
                </Badge>
              )}
            </div>
            {result.confidence > 0 && (
              <CardDescription>
                Confidence: {(result.confidence * 100).toFixed(0)}%
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className={`rounded-lg border p-4 ${result.winner === 'A' ? 'border-green-300 bg-green-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Variant A</span>
                  {result.winner === 'A' && <Trophy className="size-4 text-green-600" />}
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sent</span>
                    <span className="font-medium">{result.variantA.sent}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Replies</span>
                    <span className="font-medium">{result.variantA.replies}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Positive Rate</span>
                    <span className="font-medium">{result.variantA.positiveRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <div className={`rounded-lg border p-4 ${result.winner === 'B' ? 'border-green-300 bg-green-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Variant B</span>
                  {result.winner === 'B' && <Trophy className="size-4 text-green-600" />}
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sent</span>
                    <span className="font-medium">{result.variantB.sent}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Replies</span>
                    <span className="font-medium">{result.variantB.replies}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Positive Rate</span>
                    <span className="font-medium">{result.variantB.positiveRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
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
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function CampaignDetailPage() {
  const params = useParams();
  const agentId = params.agentId as string;
  const campaignId = params.campaignId as string;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: campaign, isLoading } = useQuery(
    trpc.agents.getCampaign.queryOptions({ agentId, campaignId })
  );

  const updateStatus = useMutation(
    trpc.agents.updateCampaignStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.agents.getCampaign.queryKey({ agentId, campaignId }),
        });
      },
    })
  );

  if (isLoading || !campaign) {
    return <LoadingSkeleton />;
  }

  const handleStart = () => updateStatus.mutate({ campaignId, status: 'ACTIVE' });
  const handlePause = () => updateStatus.mutate({ campaignId, status: 'PAUSED' });
  const handleResume = () => updateStatus.mutate({ campaignId, status: 'ACTIVE' });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
            <StatusBadge status={campaign.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {campaign.leadCount} leads
            {campaign.startedAt && (
              <> - Started {new Date(campaign.startedAt).toLocaleDateString()}</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {campaign.status === 'DRAFT' && (
            <Button onClick={handleStart} disabled={updateStatus.isPending}>
              <Play className="size-4" />
              Start
            </Button>
          )}
          {campaign.status === 'ACTIVE' && (
            <Button variant="outline" onClick={handlePause} disabled={updateStatus.isPending}>
              <Pause className="size-4" />
              Pause
            </Button>
          )}
          {campaign.status === 'PAUSED' && (
            <Button onClick={handleResume} disabled={updateStatus.isPending}>
              <ArrowClockwise className="size-4" />
              Resume
            </Button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <MetricCards campaign={campaign} />

      {/* Tabs */}
      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="sequence">Sequence</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          {campaign.abTestEnabled && (
            <TabsTrigger value="abtest">A/B Test</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="leads" className="space-y-4">
          <LeadsTab agentId={agentId} campaignId={campaignId} />
        </TabsContent>

        <TabsContent value="sequence" className="space-y-4">
          <SequenceTab sequence={campaign.sequence ?? []} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <AnalyticsTab campaignId={campaignId} />
        </TabsContent>

        {campaign.abTestEnabled && (
          <TabsContent value="abtest" className="space-y-4">
            <ABTestTab campaignId={campaignId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
