'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EnvelopeOpen, CaretDown, CaretUp, Funnel } from '@phosphor-icons/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTRPC } from '@/trpc/client';
import { useQuery } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'OUT_OF_OFFICE' | 'BOUNCE';

interface Reply {
  id: string;
  leadName: string;
  leadEmail: string;
  leadCompany: string;
  campaignId: string;
  campaignName: string;
  sentiment: Sentiment;
  subject: string;
  snippet: string;
  body: string;
  threadHistory: ThreadMessage[];
  receivedAt: string;
}

interface ThreadMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  direction: 'INBOUND' | 'OUTBOUND';
}

// ============================================================================
// Sentiment Badge
// ============================================================================

function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const config: Record<Sentiment, { label: string; className: string }> = {
    POSITIVE: { label: 'Positive', className: 'bg-green-100 text-green-700 border-green-200' },
    NEUTRAL: { label: 'Neutral', className: 'bg-gray-100 text-gray-700 border-gray-200' },
    NEGATIVE: { label: 'Negative', className: 'bg-red-100 text-red-700 border-red-200' },
    OUT_OF_OFFICE: { label: 'Out of Office', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    BOUNCE: { label: 'Bounce', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  };

  const { label, className } = config[sentiment] ?? config.NEUTRAL;

  return <Badge className={className}>{label}</Badge>;
}

// ============================================================================
// Reply Item
// ============================================================================

function ReplyItem({ reply }: { reply: Reply }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b last:border-0">
      <button
        type="button"
        className="flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{reply.leadName}</span>
            <span className="text-sm text-muted-foreground">{reply.leadEmail}</span>
            {reply.leadCompany && (
              <span className="text-sm text-muted-foreground">at {reply.leadCompany}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{reply.campaignName}</Badge>
            <SentimentBadge sentiment={reply.sentiment} />
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{reply.snippet}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs text-muted-foreground">
            {new Date(reply.receivedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {expanded ? (
            <CaretUp className="size-4 text-muted-foreground" />
          ) : (
            <CaretDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t bg-muted/30 px-4 py-4">
          {/* Thread History */}
          {reply.threadHistory.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground uppercase">Thread History</div>
              {reply.threadHistory.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-lg border p-3 ${
                    message.direction === 'OUTBOUND' ? 'ml-6 bg-blue-50' : 'mr-6 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {message.direction === 'OUTBOUND' ? 'You' : message.from}
                      {' -> '}
                      {message.direction === 'OUTBOUND' ? message.to : 'You'}
                    </span>
                    <span>{new Date(message.sentAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 text-sm font-medium">{message.subject}</div>
                  <div className="mt-1 text-sm whitespace-pre-wrap">{message.body}</div>
                </div>
              ))}
            </div>
          )}

          {/* Current Reply */}
          <div className="rounded-lg border bg-white p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{reply.leadName} ({reply.leadEmail})</span>
              <span>{new Date(reply.receivedAt).toLocaleString()}</span>
            </div>
            <div className="mt-1 text-sm font-medium">{reply.subject}</div>
            <div className="mt-2 text-sm whitespace-pre-wrap">{reply.body}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
      <EnvelopeOpen className="size-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold">No replies yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Replies from your campaigns will appear here.
      </p>
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
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <Card>
        <CardContent className="p-0">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border-b p-4 last:border-0">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="mt-2 h-4 w-48" />
              <Skeleton className="mt-2 h-4 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function InboxPage() {
  const params = useParams();
  const agentId = params.agentId as string;
  const trpc = useTRPC();

  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');

  const { data: replies, isLoading: repliesLoading } = useQuery(
    trpc.agents.getInboxReplies.queryOptions({
      agentId,
      campaignId: campaignFilter === 'all' ? undefined : campaignFilter,
      sentiment: sentimentFilter === 'all' ? undefined : sentimentFilter,
    })
  ) as { data: Reply[] | undefined; isLoading: boolean };

  const { data: campaigns } = useQuery(
    trpc.agents.getCampaigns.queryOptions({ agentId })
  ) as { data: { id: string; name: string }[] | undefined };

  if (repliesLoading) {
    return <LoadingSkeleton />;
  }

  const replyCount = replies?.length ?? 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Inbox</h1>
          {replyCount > 0 && (
            <Badge variant="secondary">{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          All replies from your cold email campaigns
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Funnel className="size-4 text-muted-foreground" />

        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All campaigns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All campaigns</SelectItem>
            {campaigns?.map((campaign: { id: string; name: string }) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All sentiments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sentiments</SelectItem>
            <SelectItem value="POSITIVE">Positive</SelectItem>
            <SelectItem value="NEUTRAL">Neutral</SelectItem>
            <SelectItem value="NEGATIVE">Negative</SelectItem>
            <SelectItem value="OUT_OF_OFFICE">Out of Office</SelectItem>
            <SelectItem value="BOUNCE">Bounce</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Replies List */}
      {!replies || replies.length === 0 ? (
        <EmptyState />
      ) : (
        <Card>
          <CardContent className="p-0">
            {replies.map((reply: Reply) => (
              <ReplyItem key={reply.id} reply={reply} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
