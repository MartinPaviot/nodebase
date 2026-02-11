"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

interface ConfirmationDialogProps {
  open: boolean;
  onConfirm: () => void;
  onReject: () => void;
  actionType: string;
  actionDetails: Record<string, unknown>;
  isLoading?: boolean;
}

const actionLabels: Record<string, string> = {
  send_email: "Send Email",
  create_calendar_event: "Create Calendar Event",
  send_slack_message: "Send Slack Message",
  create_notion_page: "Create Notion Page",
  append_to_notion: "Append to Notion Page",
};

export function ConfirmationDialog({
  open,
  onConfirm,
  onReject,
  actionType,
  actionDetails,
  isLoading = false,
}: ConfirmationDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Badge variant="outline">{actionLabels[actionType] || actionType}</Badge>
            Confirm Action
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>The agent wants to perform the following action:</p>
              <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-[200px]">
                {JSON.stringify(actionDetails, null, 2)}
              </pre>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onReject} disabled={isLoading}>
            Reject
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "Processing..." : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
