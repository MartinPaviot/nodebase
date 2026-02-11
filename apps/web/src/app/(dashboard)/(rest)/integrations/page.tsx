"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Envelope, Calendar, ChatCircle, FileText, CircleNotch, CheckCircle, XCircle, ArrowSquareOut, Table, FolderOpen, Files, MicrosoftOutlookLogo, MicrosoftTeamsLogo } from "@phosphor-icons/react";
import { toast } from "sonner";

type IntegrationType =
  | "GMAIL"
  | "GOOGLE_CALENDAR"
  | "GOOGLE_SHEETS"
  | "GOOGLE_DRIVE"
  | "GOOGLE_DOCS"
  | "OUTLOOK"
  | "OUTLOOK_CALENDAR"
  | "MICROSOFT_TEAMS"
  | "SLACK"
  | "NOTION";

interface Integration {
  id: string;
  type: IntegrationType;
  accountEmail: string | null;
  accountName: string | null;
  createdAt: string;
}

interface IntegrationConfig {
  type: IntegrationType;
  name: string;
  description: string;
  icon: React.ReactNode;
  available: boolean;
  provider: "google" | "microsoft" | "slack" | "notion";
}

const integrationConfigs: IntegrationConfig[] = [
  // Google Suite
  {
    type: "GMAIL",
    name: "Gmail",
    description: "Send and read emails through your Gmail account",
    icon: <Envelope className="h-6 w-6" />,
    available: true,
    provider: "google",
  },
  {
    type: "GOOGLE_CALENDAR",
    name: "Google Calendar",
    description: "Create and manage calendar events",
    icon: <Calendar className="h-6 w-6" />,
    available: true,
    provider: "google",
  },
  {
    type: "GOOGLE_SHEETS",
    name: "Google Sheets",
    description: "Read, write, and manage spreadsheets",
    icon: <Table className="h-6 w-6" />,
    available: true,
    provider: "google",
  },
  {
    type: "GOOGLE_DRIVE",
    name: "Google Drive",
    description: "Access and manage files in Google Drive",
    icon: <FolderOpen className="h-6 w-6" />,
    available: true,
    provider: "google",
  },
  {
    type: "GOOGLE_DOCS",
    name: "Google Docs",
    description: "Create and edit documents",
    icon: <Files className="h-6 w-6" />,
    available: true,
    provider: "google",
  },
  // Microsoft Suite
  {
    type: "OUTLOOK",
    name: "Microsoft Outlook",
    description: "Send and read emails through your Outlook account",
    icon: <MicrosoftOutlookLogo className="h-6 w-6" />,
    available: true,
    provider: "microsoft",
  },
  {
    type: "OUTLOOK_CALENDAR",
    name: "Outlook Calendar",
    description: "Create and manage calendar events in Outlook",
    icon: <Calendar className="h-6 w-6" />,
    available: true,
    provider: "microsoft",
  },
  {
    type: "MICROSOFT_TEAMS",
    name: "Microsoft Teams",
    description: "Send messages and interact with Teams channels",
    icon: <MicrosoftTeamsLogo className="h-6 w-6" />,
    available: true,
    provider: "microsoft",
  },
  // Other integrations
  {
    type: "SLACK",
    name: "Slack",
    description: "Send messages and interact with Slack channels",
    icon: <ChatCircle className="h-6 w-6" />,
    available: true,
    provider: "slack",
  },
  {
    type: "NOTION",
    name: "Notion",
    description: "Read and write to Notion databases and pages",
    icon: <FileText className="h-6 w-6" />,
    available: true,
    provider: "notion",
  },
];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<IntegrationType | null>(null);
  const [disconnecting, setDisconnecting] = useState<IntegrationType | null>(null);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  async function fetchIntegrations() {
    try {
      const res = await fetch("/api/integrations");
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data);
      }
    } catch (error) {
      console.error("Failed to fetch integrations:", error);
    } finally {
      setLoading(false);
    }
  }

  function getAppNameForType(type: IntegrationType): string {
    // Map integration types to Composio app names
    const mapping: Record<IntegrationType, string> = {
      GMAIL: "gmail",
      GOOGLE_CALENDAR: "googlecalendar",
      GOOGLE_SHEETS: "googlesheets",
      GOOGLE_DRIVE: "googledrive",
      GOOGLE_DOCS: "googledocs",
      OUTLOOK: "outlook",
      OUTLOOK_CALENDAR: "outlookcalendar",
      MICROSOFT_TEAMS: "microsoftteams",
      SLACK: "slack",
      NOTION: "notion",
    };
    return mapping[type] || type.toLowerCase();
  }

  async function handleConnect(type: IntegrationType) {
    setConnecting(type);
    try {
      // Use Composio Connect API
      const res = await fetch("/api/integrations/composio/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "current-user", // TODO: Get from session
          appName: getAppNameForType(type),
          redirectUrl: `${window.location.origin}/integrations?callback=success`,
        }),
      });

      if (res.ok) {
        const { data } = await res.json();
        window.location.href = data.redirectUrl;
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to initiate connection");
      }
    } catch (error) {
      console.error("Connect error:", error);
      toast.error("Failed to connect");
    } finally {
      setConnecting(null);
    }
  }

  async function handleDisconnect(type: IntegrationType) {
    setDisconnecting(type);
    try {
      const integration = isConnected(type);
      if (!integration) return;

      // Use Composio Disconnect API
      const res = await fetch("/api/integrations/composio/disconnect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: integration.id,
        }),
      });

      if (res.ok) {
        setIntegrations(prev => prev.filter(i => i.type !== type));
        toast.success("Integration disconnected");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to disconnect");
      }
    } catch (error) {
      console.error("Disconnect error:", error);
      toast.error("Failed to disconnect");
    } finally {
      setDisconnecting(null);
    }
  }

  function isConnected(type: IntegrationType): Integration | undefined {
    return integrations.find(i => i.type === type);
  }

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <CircleNotch className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const googleIntegrations = integrationConfigs.filter(c => c.provider === "google");
  const microsoftIntegrations = integrationConfigs.filter(c => c.provider === "microsoft");
  const otherIntegrations = integrationConfigs.filter(c => !["google", "microsoft"].includes(c.provider));

  const renderIntegrationCard = (config: IntegrationConfig) => {
    const connected = isConnected(config.type);
    const isConnecting = connecting === config.type;
    const isDisconnecting = disconnecting === config.type;

    return (
      <Card key={config.type} className={!config.available ? "opacity-60" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                {config.icon}
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {config.name}
                  {connected && (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                  {!config.available && (
                    <Badge variant="secondary">Coming Soon</Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-1">
                  {config.description}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {connected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-sm">{connected.accountName || "Connected Account"}</p>
                  <p className="text-sm text-muted-foreground">{connected.accountEmail}</p>
                </div>
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleDisconnect(config.type)}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? (
                  <>
                    <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Disconnect
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button
              className="w-full"
              onClick={() => handleConnect(config.type)}
              disabled={!config.available || isConnecting}
            >
              {isConnecting ? (
                <>
                  <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <ArrowSquareOut className="h-4 w-4 mr-2" />
                  Connect {config.name}
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground mt-2">
          Connect your accounts to enable native tools for your AI agents
        </p>
      </div>

      {/* Google Suite */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google Workspace
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {googleIntegrations.map(renderIntegrationCard)}
        </div>
      </div>

      {/* Microsoft Suite */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M0 0h11.5v11.5H0V0z" fill="#F25022"/>
            <path d="M12.5 0H24v11.5H12.5V0z" fill="#7FBA00"/>
            <path d="M0 12.5h11.5V24H0V12.5z" fill="#00A4EF"/>
            <path d="M12.5 12.5H24V24H12.5V12.5z" fill="#FFB900"/>
          </svg>
          Microsoft 365
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {microsoftIntegrations.map(renderIntegrationCard)}
        </div>
      </div>

      {/* Other Integrations */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Other Integrations</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {otherIntegrations.map(renderIntegrationCard)}
        </div>
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-semibold mb-2">How integrations work</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>Once connected, your AI agents can use these integrations as native tools</li>
          <li><strong>Google Suite:</strong> Gmail, Calendar, Sheets, Drive, and Docs - full read/write access</li>
          <li><strong>Microsoft Suite:</strong> Outlook mail and calendar, plus Teams messaging</li>
          <li><strong>Slack:</strong> Send messages, list channels, and respond to mentions</li>
          <li><strong>Notion:</strong> Read and write to databases and pages</li>
          <li>Your tokens are securely stored and automatically refreshed</li>
        </ul>
      </div>
    </div>
  );
}
