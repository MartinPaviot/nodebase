"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  XCircle,
  Edit,
  Clock,
  Bot,
  Mail,
  MessageSquare,
  FileText,
  Calendar,
  Hash,
  Search,
} from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityType } from "@/generated/prisma";

// ============================================
// Types
// ============================================

type ApprovalItem = {
  id: string;
  conversationId: string;
  type: ActivityType;
  title: string;
  details: Record<string, unknown> | null;
  requiresConfirmation: boolean;
  confirmedAt: string | Date | null;
  rejectedAt: string | Date | null;
  createdAt: string | Date;
  conversation: {
    agent: {
      id: string;
      name: string;
      avatar: string | null;
    };
  };
};

// ============================================
// Helpers
// ============================================

const ACTION_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  EMAIL_SENT: { label: "Email", icon: Mail, color: "text-blue-500" },
  SLACK_MESSAGE_SENT: { label: "Slack Message", icon: MessageSquare, color: "text-purple-500" },
  CALENDAR_EVENT_CREATED: { label: "Calendar Event", icon: Calendar, color: "text-green-500" },
  TOOL_CALLED: { label: "Tool Call", icon: Hash, color: "text-orange-500" },
  CONFIRMATION_REQUESTED: { label: "Action", icon: FileText, color: "text-gray-500" },
};

function getTimeAgo(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 1000 / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getActionConfig(type: ActivityType) {
  return ACTION_TYPE_CONFIG[type] || ACTION_TYPE_CONFIG.CONFIRMATION_REQUESTED;
}

// ============================================
// Components
// ============================================

function ApprovalCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

function ApprovalCard({
  item,
  onApprove,
  onReject,
  onEdit,
  isApproving,
  isRejecting,
  showActions = true,
}: {
  item: ApprovalItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (item: ApprovalItem) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
  showActions?: boolean;
}) {
  const config = getActionConfig(item.type);
  const ActionIcon = config.icon;
  const details = item.details as Record<string, unknown> | null;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{item.conversation.agent.name}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                {getTimeAgo(item.createdAt)}
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <ActionIcon className={`h-3 w-3 ${config.color}`} />
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Title */}
        <div className="font-medium">{item.title}</div>

        {/* Details */}
        {details && (
          <div className="bg-muted/50 rounded-lg p-4">
            <pre className="whitespace-pre-wrap text-sm font-mono">
              {JSON.stringify(details, null, 2)}
            </pre>
          </div>
        )}

        {/* Status for history items */}
        {item.confirmedAt && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            Approved {getTimeAgo(item.confirmedAt)}
          </div>
        )}
        {item.rejectedAt && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <XCircle className="h-4 w-4" />
            Rejected {getTimeAgo(item.rejectedAt)}
          </div>
        )}

        {/* Actions */}
        {showActions && !item.confirmedAt && !item.rejectedAt && (
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              onClick={() => onApprove(item.id)}
              disabled={isApproving || isRejecting}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {isApproving ? "Approving..." : "Approve & Send"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(item)}
              disabled={isApproving || isRejecting}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReject(item.id)}
              disabled={isApproving || isRejecting}
            >
              <XCircle className="h-4 w-4 mr-2" />
              {isRejecting ? "Rejecting..." : "Reject"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditDialog({
  item,
  open,
  onOpenChange,
  onSave,
}: {
  item: ApprovalItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string) => void;
}) {
  const [editedContent, setEditedContent] = useState("");

  if (!item) return null;

  const details = item.details as Record<string, unknown> | null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Edit & Approve</DialogTitle>
          <DialogDescription>
            Review the action details before approving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="font-medium">{item.title}</div>

          <Textarea
            value={editedContent || JSON.stringify(details, null, 2)}
            onChange={(e) => setEditedContent(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
            placeholder="Action details..."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(item.id)}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Approve & Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Main Component
// ============================================

export function ApprovalQueue() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<ApprovalItem | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<"approve" | "reject" | null>(null);

  // Queries
  const pendingQuery = useQuery(
    trpc.agents.getPendingApprovals.queryOptions({})
  );

  const historyQuery = useQuery(
    trpc.agents.getApprovalHistory.queryOptions({
      status: activeTab === "approved" ? "approved" : activeTab === "rejected" ? "rejected" : "all",
    })
  );

  // Mutations (using fetch to call the confirm API)
  const handleApprove = async (activityId: string) => {
    setProcessingId(activityId);
    setProcessingAction("approve");
    try {
      const response = await fetch("/api/agents/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, confirmed: true }),
      });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: trpc.agents.getPendingApprovals.queryKey({}) });
        queryClient.invalidateQueries({ queryKey: trpc.agents.getApprovalHistory.queryKey({}) });
      }
    } finally {
      setProcessingId(null);
      setProcessingAction(null);
    }
  };

  const handleReject = async (activityId: string) => {
    setProcessingId(activityId);
    setProcessingAction("reject");
    try {
      const response = await fetch("/api/agents/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, confirmed: false }),
      });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: trpc.agents.getPendingApprovals.queryKey({}) });
        queryClient.invalidateQueries({ queryKey: trpc.agents.getApprovalHistory.queryKey({}) });
      }
    } finally {
      setProcessingId(null);
      setProcessingAction(null);
    }
  };

  const handleEdit = (item: ApprovalItem) => {
    setEditingItem(item);
  };

  const handleSaveEdit = (id: string) => {
    handleApprove(id);
    setEditingItem(null);
  };

  const pendingItems = pendingQuery.data?.items ?? [];
  const historyItems = historyQuery.data?.items ?? [];
  const approvedItems = historyItems.filter(i => i.confirmedAt);
  const rejectedItems = historyItems.filter(i => i.rejectedAt);

  return (
    <div className="h-full">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-lg font-semibold">Approvals</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search" className="pl-9 h-9 w-48" />
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">
                  {pendingQuery.isLoading ? "-" : pendingQuery.data?.total ?? 0}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">
                  {historyQuery.isLoading ? "-" : approvedItems.length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold">
                  {historyQuery.isLoading ? "-" : rejectedItems.length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="pending">
              Pending ({pendingQuery.data?.total ?? 0})
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved ({approvedItems.length})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected ({rejectedItems.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            {pendingQuery.isLoading ? (
              <div className="space-y-4">
                <ApprovalCardSkeleton />
                <ApprovalCardSkeleton />
              </div>
            ) : pendingItems.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-12 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="font-semibold mb-2">All caught up!</h3>
                  <p className="text-sm text-muted-foreground">
                    No pending approvals at the moment
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[calc(100vh-380px)]">
                <div className="space-y-4">
                  {pendingItems.map((item) => (
                    <ApprovalCard
                      key={item.id}
                      item={item as ApprovalItem}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onEdit={handleEdit}
                      isApproving={processingId === item.id && processingAction === "approve"}
                      isRejecting={processingId === item.id && processingAction === "reject"}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="approved" className="mt-4">
            {historyQuery.isLoading ? (
              <div className="space-y-4">
                <ApprovalCardSkeleton />
              </div>
            ) : approvedItems.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-12 text-center text-muted-foreground">
                  No approved items yet
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[calc(100vh-380px)]">
                <div className="space-y-4">
                  {approvedItems.map((item) => (
                    <ApprovalCard
                      key={item.id}
                      item={item as ApprovalItem}
                      onApprove={() => {}}
                      onReject={() => {}}
                      onEdit={() => {}}
                      showActions={false}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="rejected" className="mt-4">
            {historyQuery.isLoading ? (
              <div className="space-y-4">
                <ApprovalCardSkeleton />
              </div>
            ) : rejectedItems.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-12 text-center text-muted-foreground">
                  No rejected items yet
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[calc(100vh-380px)]">
                <div className="space-y-4">
                  {rejectedItems.map((item) => (
                    <ApprovalCard
                      key={item.id}
                      item={item as ApprovalItem}
                      onApprove={() => {}}
                      onReject={() => {}}
                      onEdit={() => {}}
                      showActions={false}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <EditDialog
        item={editingItem}
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
