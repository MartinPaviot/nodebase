"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle,
  XCircle,
  PencilSimple,
  Clock,
  EnvelopeSimple,
  CalendarBlank,
  ChatText,
  File,
  Trash,
} from "@phosphor-icons/react";
import { EvalBadge } from "./eval-badge";
import { formatDistanceToNow } from "date-fns";

// Action type labels and icons
const ACTION_CONFIG: Record<
  string,
  { label: string; icon: typeof EnvelopeSimple }
> = {
  send_email: { label: "Send Email", icon: EnvelopeSimple },
  send_outlook_email: { label: "Send Email (Outlook)", icon: EnvelopeSimple },
  create_calendar_event: { label: "Create Event", icon: CalendarBlank },
  send_slack_message: { label: "Slack Message", icon: ChatText },
  send_teams_message: { label: "Teams Message", icon: ChatText },
  create_notion_page: { label: "Create Notion Page", icon: File },
  append_to_notion: { label: "Append to Notion", icon: File },
  create_doc: { label: "Create Doc", icon: File },
  append_to_doc: { label: "Append to Doc", icon: File },
  append_to_sheet: { label: "Append to Sheet", icon: File },
  update_sheet: { label: "Update Sheet", icon: File },
  create_spreadsheet: { label: "Create Spreadsheet", icon: File },
  upload_drive_file: { label: "Upload File", icon: File },
  delete_drive_file: { label: "Delete File", icon: Trash },
};

interface ClaimInfo {
  text: string;
  type: "factual" | "temporal" | "quantitative" | "relational";
  grounded: boolean;
  evidence?: string;
}

interface ApprovalCardProps {
  activity: {
    id: string;
    title: string;
    createdAt: string | Date;
    details: {
      actionType: string;
      actionArgs: Record<string, unknown>;
      evalResult?: {
        l1Passed?: boolean;
        l2Score?: number;
        l2Passed?: boolean;
        groundingScore?: number;
        groundingPassed?: boolean;
        claims?: ClaimInfo[];
        l3Triggered?: boolean;
        l3Passed?: boolean;
        suggestions?: string[];
        blockReason?: string;
      };
    } | null;
    conversation: {
      agent: {
        id: string;
        name: string;
        avatar: string | null;
      };
    };
  };
  onApprove: (activityId: string) => void;
  onReject: (activityId: string) => void;
  onEditApprove: (
    activityId: string,
    updatedArgs: Record<string, unknown>,
  ) => void;
  isLoading?: boolean;
}

function getContentPreview(
  actionType: string,
  args: Record<string, unknown>,
): string {
  switch (actionType) {
    case "send_email":
    case "send_outlook_email":
      return `To: ${args.to || "?"}\nSubject: ${args.subject || "?"}\n\n${args.body || ""}`;
    case "send_slack_message":
    case "send_teams_message":
      return `Channel: ${args.channel || "?"}\n\n${args.text || args.message || ""}`;
    case "create_notion_page":
    case "create_doc":
      return `Title: ${args.title || "?"}\n\n${args.content || ""}`;
    case "create_calendar_event":
      return `${args.summary || "?"}\nStart: ${args.startDateTime || "?"}\nEnd: ${args.endDateTime || "?"}`;
    default:
      return JSON.stringify(args, null, 2);
  }
}

export function ApprovalCard({
  activity,
  onApprove,
  onReject,
  onEditApprove,
  isLoading,
}: ApprovalCardProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editedArgs, setEditedArgs] = useState<Record<string, unknown>>({});

  const details = activity.details as ApprovalCardProps["activity"]["details"];
  const actionType = details?.actionType || "unknown";
  const actionArgs = (details?.actionArgs || {}) as Record<string, unknown>;
  const evalResult = details?.evalResult;
  const config = ACTION_CONFIG[actionType] || {
    label: actionType,
    icon: File,
  };
  const ActionIcon = config.icon;

  const contentPreview = getContentPreview(actionType, actionArgs);
  const timeAgo = formatDistanceToNow(new Date(activity.createdAt), {
    addSuffix: true,
  });

  const handleOpenEdit = () => {
    setEditedArgs({ ...actionArgs });
    setEditDialogOpen(true);
  };

  const handleEditApprove = () => {
    onEditApprove(activity.id, editedArgs);
    setEditDialogOpen(false);
  };

  return (
    <>
      <div className="border rounded-xl bg-card p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-muted flex items-center justify-center text-xs font-medium">
              {activity.conversation.agent.avatar ||
                activity.conversation.agent.name.charAt(0)}
            </div>
            <span className="text-sm font-medium">
              {activity.conversation.agent.name}
            </span>
            <Badge variant="outline" className="gap-1 text-xs h-5">
              <ActionIcon className="size-3" />
              {config.label}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="size-3" />
            {timeAgo}
          </span>
        </div>

        {/* Content preview */}
        <pre className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 whitespace-pre-wrap font-sans max-h-40 overflow-y-auto">
          {contentPreview}
        </pre>

        {/* Claims / Fact check */}
        {evalResult?.claims && evalResult.claims.length > 0 && (
          <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Fact Check ({evalResult.claims.filter((c) => c.grounded).length}/{evalResult.claims.length} verified)
            </p>
            <ul className="space-y-1">
              {evalResult.claims.map((claim, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs">
                  {claim.grounded ? (
                    <CheckCircle weight="fill" className="size-3.5 mt-0.5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle weight="fill" className="size-3.5 mt-0.5 text-red-500 shrink-0" />
                  )}
                  <span className={claim.grounded ? "text-muted-foreground" : "text-red-600 dark:text-red-400"}>
                    {claim.text}
                    {!claim.grounded && claim.evidence && (
                      <span className="text-muted-foreground"> — {claim.evidence}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Eval results */}
        {evalResult && <EvalBadge evalResult={evalResult} />}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => onApprove(activity.id)}
            disabled={isLoading}
          >
            <CheckCircle className="size-3.5" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={handleOpenEdit}
            disabled={isLoading}
          >
            <PencilSimple className="size-3.5" />
            Edit & Approve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-destructive hover:text-destructive"
            onClick={() => onReject(activity.id)}
            disabled={isLoading}
          >
            <XCircle className="size-3.5" />
            Reject
          </Button>
        </div>
      </div>

      {/* Edit & Approve Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit & Approve: {config.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {(actionType === "send_email" ||
              actionType === "send_outlook_email") && (
              <>
                <div>
                  <Label>To</Label>
                  <Input
                    value={(editedArgs.to as string) || ""}
                    onChange={(e) =>
                      setEditedArgs((p) => ({ ...p, to: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Subject</Label>
                  <Input
                    value={(editedArgs.subject as string) || ""}
                    onChange={(e) =>
                      setEditedArgs((p) => ({ ...p, subject: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Body</Label>
                  <Textarea
                    value={(editedArgs.body as string) || ""}
                    onChange={(e) =>
                      setEditedArgs((p) => ({ ...p, body: e.target.value }))
                    }
                    rows={8}
                  />
                </div>
              </>
            )}
            {(actionType === "send_slack_message" ||
              actionType === "send_teams_message") && (
              <>
                <div>
                  <Label>Channel</Label>
                  <Input
                    value={(editedArgs.channel as string) || ""}
                    onChange={(e) =>
                      setEditedArgs((p) => ({
                        ...p,
                        channel: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Message</Label>
                  <Textarea
                    value={
                      (editedArgs.text as string) ||
                      (editedArgs.message as string) ||
                      ""
                    }
                    onChange={(e) =>
                      setEditedArgs((p) => ({ ...p, text: e.target.value }))
                    }
                    rows={6}
                  />
                </div>
              </>
            )}
            {/* Fallback: JSON editor for other action types */}
            {![
              "send_email",
              "send_outlook_email",
              "send_slack_message",
              "send_teams_message",
            ].includes(actionType) && (
              <div>
                <Label>Action Data (JSON)</Label>
                <Textarea
                  value={JSON.stringify(editedArgs, null, 2)}
                  onChange={(e) => {
                    try {
                      setEditedArgs(JSON.parse(e.target.value));
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  rows={10}
                  className="font-mono text-xs"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditApprove} className="gap-1.5">
              <CheckCircle className="size-4" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
