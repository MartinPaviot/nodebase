"use client";

import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSuspenseAgentEmailAddress,
  useCreateAgentEmailAddress,
  useUpdateAgentEmailAddress,
  useDeleteAgentEmailAddress,
} from "../hooks/use-agents";
import {
  Envelope,
  Copy,
  Trash,
  CircleNotch,
  Plus,
  Info,
} from "@phosphor-icons/react";
import { toast } from "sonner";

interface AgentEmailSettingsProps {
  agentId: string;
}

function AgentEmailSettingsContent({ agentId }: AgentEmailSettingsProps) {
  const { data: emailAddress } = useSuspenseAgentEmailAddress(agentId);
  const createEmailAddress = useCreateAgentEmailAddress();
  const updateEmailAddress = useUpdateAgentEmailAddress();
  const deleteEmailAddress = useDeleteAgentEmailAddress();

  const handleCreate = () => {
    createEmailAddress.mutate({ agentId, autoReply: true });
  };

  const handleToggleAutoReply = (autoReply: boolean) => {
    updateEmailAddress.mutate({ agentId, autoReply });
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this email address? Emails sent to this address will no longer be processed.")) {
      deleteEmailAddress.mutate({ agentId });
    }
  };

  const copyEmail = () => {
    if (emailAddress) {
      const fullEmail = `${emailAddress.localPart}@${emailAddress.domain}`;
      navigator.clipboard.writeText(fullEmail);
      toast.success("Email address copied to clipboard");
    }
  };

  if (!emailAddress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Envelope className="size-5" />
            Email Inbound
          </CardTitle>
          <CardDescription>
            Create a unique email address for this agent to receive and respond to emails automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Envelope className="size-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              No email address configured for this agent.
            </p>
            <Button onClick={handleCreate} disabled={createEmailAddress.isPending}>
              {createEmailAddress.isPending ? (
                <CircleNotch className="size-4 mr-2 animate-spin" />
              ) : (
                <Plus className="size-4 mr-2" />
              )}
              Create Email Address
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const fullEmail = `${emailAddress.localPart}@${emailAddress.domain}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Envelope className="size-5" />
          Email Inbound
        </CardTitle>
        <CardDescription>
          Forward emails to this address to trigger your agent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email Address Display */}
        <div className="space-y-2">
          <Label>Agent Email Address</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono">
              {fullEmail}
            </code>
            <Button variant="outline" size="icon" onClick={copyEmail}>
              <Copy className="size-4" />
            </Button>
          </div>
        </div>

        {/* Auto-Reply Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-reply">Auto-Reply</Label>
            <p className="text-sm text-muted-foreground">
              Automatically generate and send email responses
            </p>
          </div>
          <Switch
            id="auto-reply"
            checked={emailAddress.autoReply}
            onCheckedChange={handleToggleAutoReply}
            disabled={updateEmailAddress.isPending}
          />
        </div>

        {/* Setup Instructions */}
        <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Info className="size-4 mt-0.5 text-muted-foreground" />
            <div className="space-y-2 text-sm">
              <p className="font-medium">Setup Instructions</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Configure your email provider to forward emails to this address</li>
                <li>Or set up an email parsing service (SendGrid, Mailgun, Postmark)</li>
                <li>Point the inbound webhook to: <code className="text-xs bg-background px-1 py-0.5 rounded">/api/webhooks/email/inbound</code></li>
                <li>Incoming emails will create conversations and trigger auto-replies</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Delete Button */}
        <div className="pt-4 border-t">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleteEmailAddress.isPending}
          >
            {deleteEmailAddress.isPending ? (
              <CircleNotch className="size-4 mr-2 animate-spin" />
            ) : (
              <Trash className="size-4 mr-2" />
            )}
            Delete Email Address
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AgentEmailSettingsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}

export function AgentEmailSettings({ agentId }: AgentEmailSettingsProps) {
  return (
    <Suspense fallback={<AgentEmailSettingsSkeleton />}>
      <AgentEmailSettingsContent agentId={agentId} />
    </Suspense>
  );
}
