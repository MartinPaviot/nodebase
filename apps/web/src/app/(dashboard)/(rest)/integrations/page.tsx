"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CircleNotch, CheckCircle, XCircle, ArrowSquareOut } from "@phosphor-icons/react";
import { toast } from "sonner";

// ── Brand SVG Icons ──

const GmailIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
    <path d="M2 6L12 13L22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6Z" fill="#F2F2F2" stroke="#D5D5D5" strokeWidth="0.5"/>
    <path d="M22 6L12 13L2 6L12 0L22 6Z" fill="#EA4335" opacity="0"/>
    <path d="M2 6L12 13" stroke="#EA4335" strokeWidth="2" strokeLinecap="round"/>
    <path d="M22 6L12 13" stroke="#EA4335" strokeWidth="2" strokeLinecap="round"/>
    <path d="M2 6V18" stroke="#4285F4" strokeWidth="2" strokeLinecap="round"/>
    <path d="M22 6V18" stroke="#34A853" strokeWidth="2" strokeLinecap="round"/>
    <path d="M2 18H22" stroke="#FBBC05" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const GoogleCalendarIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24">
    <path d="M18 3H6C4.34 3 3 4.34 3 6V18C3 19.66 4.34 21 6 21H18C19.66 21 21 19.66 21 18V6C21 4.34 19.66 3 18 3Z" fill="#FFFFFF" stroke="#4285F4" strokeWidth="1.5"/>
    <rect x="6" y="8" width="12" height="1" fill="#4285F4"/>
    <rect x="8" y="11" width="3" height="2.5" rx="0.5" fill="#4285F4"/>
    <rect x="13" y="11" width="3" height="2.5" rx="0.5" fill="#34A853"/>
    <rect x="8" y="15" width="3" height="2.5" rx="0.5" fill="#FBBC05"/>
    <rect x="13" y="15" width="3" height="2.5" rx="0.5" fill="#EA4335"/>
    <rect x="8" y="2" width="2" height="3" rx="1" fill="#4285F4"/>
    <rect x="14" y="2" width="2" height="3" rx="1" fill="#4285F4"/>
  </svg>
);

const GoogleSheetsIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24">
    <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="#0F9D58"/>
    <path d="M14 2V8H20" fill="#87CEAB"/>
    <rect x="7" y="11" width="10" height="8" rx="0.5" fill="white"/>
    <line x1="7" y1="14" x2="17" y2="14" stroke="#0F9D58" strokeWidth="0.8"/>
    <line x1="7" y1="16.5" x2="17" y2="16.5" stroke="#0F9D58" strokeWidth="0.8"/>
    <line x1="11" y1="11" x2="11" y2="19" stroke="#0F9D58" strokeWidth="0.8"/>
  </svg>
);

const GoogleDriveIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24">
    <path d="M8.01 2.5L1 14.75H7.02L14.03 2.5H8.01Z" fill="#FBBC05"/>
    <path d="M16 2.5L8.99 14.75L12 20.5L19.01 8.25L16 2.5Z" fill="#34A853"/>
    <path d="M23 14.75H10.98L7.97 20.5H20.01L23 14.75Z" fill="#4285F4"/>
  </svg>
);

const GoogleDocsIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24">
    <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="#4285F4"/>
    <path d="M14 2V8H20" fill="#A1C2FA"/>
    <rect x="7" y="12" width="10" height="1" rx="0.5" fill="white"/>
    <rect x="7" y="14.5" width="8" height="1" rx="0.5" fill="white"/>
    <rect x="7" y="17" width="6" height="1" rx="0.5" fill="white"/>
  </svg>
);

const OutlookIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24">
    <path d="M22 6V18C22 19.1 21.1 20 20 20H8C6.9 20 6 19.1 6 18V6C6 4.9 6.9 4 8 4H20C21.1 4 22 4.9 22 6Z" fill="#0078D4"/>
    <path d="M22 6L14 12L6 6" stroke="white" strokeWidth="1.5" fill="none"/>
    <rect x="1" y="5" width="10" height="14" rx="1.5" fill="#0364B8"/>
    <ellipse cx="6" cy="12" rx="3" ry="3.5" stroke="white" strokeWidth="1.5" fill="none"/>
  </svg>
);

const OutlookCalendarIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24">
    <rect x="5" y="3" width="16" height="18" rx="2" fill="#0078D4"/>
    <rect x="7" y="8" width="12" height="11" rx="1" fill="white"/>
    <rect x="8" y="4" width="2" height="3" rx="0.5" fill="white"/>
    <rect x="14" y="4" width="2" height="3" rx="0.5" fill="white"/>
    <rect x="9" y="10" width="2.5" height="2" rx="0.3" fill="#0078D4"/>
    <rect x="13" y="10" width="2.5" height="2" rx="0.3" fill="#0078D4"/>
    <rect x="9" y="14" width="2.5" height="2" rx="0.3" fill="#0078D4"/>
    <rect x="13" y="14" width="2.5" height="2" rx="0.3" fill="#0078D4" opacity="0.5"/>
    <rect x="1" y="5" width="9" height="14" rx="1.5" fill="#0364B8"/>
    <text x="5.5" y="14.5" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="Arial">C</text>
  </svg>
);

const TeamsIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24">
    <circle cx="17" cy="7" r="3" fill="#7B83EB"/>
    <path d="M21 11H13C12.45 11 12 11.45 12 12V19C12 19.55 12.45 20 13 20H21C21.55 20 22 19.55 22 19V12C22 11.45 21.55 11 21 11Z" fill="#7B83EB"/>
    <circle cx="10" cy="6" r="3.5" fill="#5059C9"/>
    <path d="M16 10H4C3.45 10 3 10.45 3 11V20C3 20.55 3.45 21 4 21H16C16.55 21 17 20.55 17 20V11C17 10.45 16.55 10 16 10Z" fill="#5059C9"/>
    <path d="M10 14V21H4C3.45 21 3 20.55 3 20V14H10Z" fill="#7B83EB" opacity="0.3"/>
  </svg>
);

const SlackIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A"/>
    <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0"/>
    <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D"/>
    <path d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#ECB22E"/>
  </svg>
);

const NotionIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24">
    <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.19 2.13c-.42-.326-.98-.7-2.055-.607L3.01 2.71c-.467.047-.56.28-.374.466l1.823 1.032zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.747 0-.933-.234-1.494-.933l-4.577-7.186v6.952L12.57 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.886.747-.933l3.222-.187z" fill="currentColor"/>
  </svg>
);


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
    icon: <GmailIcon />,
    available: true,
    provider: "google",
  },
  {
    type: "GOOGLE_CALENDAR",
    name: "Google Calendar",
    description: "Create and manage calendar events",
    icon: <GoogleCalendarIcon />,
    available: true,
    provider: "google",
  },
  {
    type: "GOOGLE_SHEETS",
    name: "Google Sheets",
    description: "Read, write, and manage spreadsheets",
    icon: <GoogleSheetsIcon />,
    available: true,
    provider: "google",
  },
  {
    type: "GOOGLE_DRIVE",
    name: "Google Drive",
    description: "Access and manage files in Google Drive",
    icon: <GoogleDriveIcon />,
    available: true,
    provider: "google",
  },
  {
    type: "GOOGLE_DOCS",
    name: "Google Docs",
    description: "Create and edit documents",
    icon: <GoogleDocsIcon />,
    available: true,
    provider: "google",
  },
  // Microsoft Suite
  {
    type: "OUTLOOK",
    name: "Microsoft Outlook",
    description: "Send and read emails through your Outlook account",
    icon: <OutlookIcon />,
    available: true,
    provider: "microsoft",
  },
  {
    type: "OUTLOOK_CALENDAR",
    name: "Outlook Calendar",
    description: "Create and manage calendar events in Outlook",
    icon: <OutlookCalendarIcon />,
    available: true,
    provider: "microsoft",
  },
  {
    type: "MICROSOFT_TEAMS",
    name: "Microsoft Teams",
    description: "Send messages and interact with Teams channels",
    icon: <TeamsIcon />,
    available: true,
    provider: "microsoft",
  },
  // Other integrations
  {
    type: "SLACK",
    name: "Slack",
    description: "Send messages and interact with Slack channels",
    icon: <SlackIcon />,
    available: true,
    provider: "slack",
  },
  {
    type: "NOTION",
    name: "Notion",
    description: "Read and write to Notion databases and pages",
    icon: <NotionIcon />,
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
      <div className="px-6 py-8">
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
      <div key={config.type} className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border bg-card ${!config.available ? "opacity-60" : ""}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">{config.icon}</div>
          <div className="min-w-0">
            <p className="font-medium text-sm leading-tight">{config.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {connected ? (connected.accountEmail || connected.accountName) : config.description}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          {connected ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => handleDisconnect(config.type)}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? <CircleNotch className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleConnect(config.type)}
              disabled={!config.available || isConnecting}
            >
              {isConnecting ? <CircleNotch className="h-3.5 w-3.5 animate-spin" /> : "Connect"}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your accounts to enable native tools for your AI agents
        </p>
      </div>

      <div className="space-y-6">
        {/* Google Suite */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google Workspace
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {googleIntegrations.map(renderIntegrationCard)}
          </div>
        </div>

        {/* Microsoft Suite */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 0h11.5v11.5H0V0z" fill="#F25022"/>
              <path d="M12.5 0H24v11.5H12.5V0z" fill="#7FBA00"/>
              <path d="M0 12.5h11.5V24H0V12.5z" fill="#00A4EF"/>
              <path d="M12.5 12.5H24V24H12.5V12.5z" fill="#FFB900"/>
            </svg>
            Microsoft 365
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {microsoftIntegrations.map(renderIntegrationCard)}
          </div>
        </div>

        {/* Other Integrations */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Other</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {otherIntegrations.map(renderIntegrationCard)}
          </div>
        </div>
      </div>
    </div>
  );
}
