"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DotsThree,
  TextT,
  ArrowsClockwise,
  Trash,
  Info,
  CheckCircle,
  CircleNotch,
  ArrowSquareOut,
  Link as LinkIcon,
  XCircle,
} from "@phosphor-icons/react";
import { Icon } from "@iconify/react";
import { toast } from "sonner";

// Integration configuration
interface IntegrationConfig {
  type: string;
  provider: "google" | "microsoft" | "slack" | "notion";
  name: string;
  icon: string;
  color: string;
  description: string;
}

const INTEGRATION_CONFIGS: Record<string, IntegrationConfig> = {
  // Google Suite
  "google-sheets": {
    type: "GOOGLE_SHEETS",
    provider: "google",
    name: "Google Sheets",
    icon: "mdi:google-spreadsheet",
    color: "#34A853",
    description: "Read, write, and manage spreadsheets",
  },
  "google-drive": {
    type: "GOOGLE_DRIVE",
    provider: "google",
    name: "Google Drive",
    icon: "mdi:google-drive",
    color: "#4285F4",
    description: "Access and manage files in Google Drive",
  },
  "google-docs": {
    type: "GOOGLE_DOCS",
    provider: "google",
    name: "Google Docs",
    icon: "mdi:file-document",
    color: "#4285F4",
    description: "Create and edit documents",
  },
  "google-calendar": {
    type: "GOOGLE_CALENDAR",
    provider: "google",
    name: "Google Calendar",
    icon: "mdi:calendar",
    color: "#4285F4",
    description: "Create and manage calendar events",
  },
  "gmail": {
    type: "GMAIL",
    provider: "google",
    name: "Gmail",
    icon: "logos:google-gmail",
    color: "#EA4335",
    description: "Send and read emails",
  },
  // Microsoft Suite
  "outlook": {
    type: "OUTLOOK",
    provider: "microsoft",
    name: "Microsoft Outlook",
    icon: "vscode-icons:file-type-outlook",
    color: "#0078D4",
    description: "Send and read emails through Outlook",
  },
  "outlook-calendar": {
    type: "OUTLOOK_CALENDAR",
    provider: "microsoft",
    name: "Outlook Calendar",
    icon: "vscode-icons:file-type-outlook",
    color: "#0078D4",
    description: "Create and manage calendar events in Outlook",
  },
  "teams": {
    type: "MICROSOFT_TEAMS",
    provider: "microsoft",
    name: "Microsoft Teams",
    icon: "logos:microsoft-teams",
    color: "#6264A7",
    description: "Send messages and interact with Teams channels",
  },
  // Other
  "slack": {
    type: "SLACK",
    provider: "slack",
    name: "Slack",
    icon: "devicon:slack",
    color: "#4A154B",
    description: "Send messages and interact with Slack channels",
  },
  "notion": {
    type: "NOTION",
    provider: "notion",
    name: "Notion",
    icon: "simple-icons:notion",
    color: "#000000",
    description: "Read and write to Notion databases and pages",
  },
};

interface Integration {
  id: string;
  type: string;
  accountEmail: string | null;
  accountName: string | null;
}

interface IntegrationActionPanelProps {
  actionId: string; // e.g., "google-sheets", "gs-append-row"
  nodeId: string;
  nodeName?: string;
  onClose?: () => void;
  onDelete?: () => void;
  onRename?: (newName: string) => void;
  onReplace?: () => void;
  onUpdate?: (data: { spreadsheetId?: string; range?: string }) => void;
}

export function IntegrationActionPanel({
  actionId,
  nodeName,
  onDelete,
  onRename,
  onReplace,
}: IntegrationActionPanelProps) {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Get the base action ID (remove sub-action prefix like "gs-")
  const getBaseActionId = (id: string) => {
    if (id.startsWith("gs-")) return "google-sheets";
    // Add more mappings as needed
    return id;
  };

  const baseActionId = getBaseActionId(actionId);
  const config = INTEGRATION_CONFIGS[baseActionId];

  // Fetch integration status
  useEffect(() => {
    if (!config) return;

    const fetchIntegration = async () => {
      try {
        const res = await fetch("/api/integrations");
        if (res.ok) {
          const integrations: Integration[] = await res.json();
          const found = integrations.find((i) => i.type === config.type);
          setIntegration(found || null);
        }
      } catch (error) {
        console.error("Failed to fetch integration:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchIntegration();
  }, [config]);

  const getProviderEndpoint = (action: "connect" | "disconnect") => {
    if (!config) return "";
    switch (config.provider) {
      case "google":
        return `/api/integrations/google/${action}`;
      case "microsoft":
        return `/api/integrations/microsoft/${action}`;
      case "slack":
        return `/api/integrations/slack/${action}`;
      case "notion":
        return `/api/integrations/notion/${action}`;
      default:
        return `/api/integrations/google/${action}`;
    }
  };

  const handleConnect = async () => {
    if (!config) return;
    setConnecting(true);
    try {
      const endpoint = getProviderEndpoint("connect");
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: config.type }),
      });

      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      } else {
        toast.error("Failed to initiate connection");
      }
    } catch (error) {
      console.error("Connect error:", error);
      toast.error("Failed to connect");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!config) return;
    setDisconnecting(true);
    try {
      const endpoint = getProviderEndpoint("disconnect");
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: config.type }),
      });

      if (res.ok) {
        setIntegration(null);
        toast.success("Account disconnected");
      } else {
        toast.error("Failed to disconnect");
      }
    } catch (error) {
      console.error("Disconnect error:", error);
      toast.error("Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  const openRenameDialog = () => {
    setRenameValue(nodeName || config?.name || "Action");
    setRenameDialogOpen(true);
  };

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      onRename?.(trimmed);
    }
    setRenameDialogOpen(false);
  };

  if (!config) {
    return (
      <div className="h-full overflow-auto bg-white p-5">
        <p className="text-sm text-muted-foreground">Unknown action type</p>
      </div>
    );
  }

  const displayLabel = nodeName || config.name;

  return (
    <div className="h-full overflow-auto bg-white">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div
              className="size-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${config.color}15` }}
            >
              <Icon
                icon={config.icon}
                className="size-5"
                style={{ color: config.color }}
              />
            </div>
            <span
              className="font-semibold text-[16px] text-[#1a1a1a] cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded -mx-1"
              onClick={openRenameDialog}
            >
              {displayLabel}
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-[#9CA3AF] hover:text-[#6B7280] p-1">
                <DotsThree className="size-5" weight="bold" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onSelect={openRenameDialog}
              >
                <TextT className="size-4" />
                <span>Rename</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onSelect={onReplace}
              >
                <ArrowsClockwise className="size-4" />
                <span>Replace</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                variant="destructive"
                onSelect={onDelete}
              >
                <Trash className="size-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description */}
        <p className="text-[11px] text-[#9CA3AF] mb-5">{config.description}</p>

        {/* Connection Section */}
        <div className="mb-5">
          <div className="flex items-center gap-1 mb-3">
            <LinkIcon className="size-4 text-[#6B7280]" />
            <label className="text-[13px] font-medium text-[#374151]">
              Connection
            </label>
            <Info className="size-3.5 text-[#9CA3AF]" />
          </div>

          {loading ? (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <CircleNotch className="size-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : integration ? (
            <div className="space-y-3">
              {/* Connected account info */}
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="size-5 text-green-600" weight="fill" />
                  <div>
                    <p className="font-medium text-sm text-green-800">
                      {integration.accountName || "Connected"}
                    </p>
                    {integration.accountEmail && (
                      <p className="text-xs text-green-600">
                        {integration.accountEmail}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Disconnect button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <>
                    <CircleNotch className="size-4 mr-2 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  <>
                    <XCircle className="size-4 mr-2" />
                    Disconnect account
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button
              className="w-full"
              onClick={handleConnect}
              disabled={connecting}
              style={{
                backgroundColor: config.color,
                borderColor: config.color,
              }}
            >
              {connecting ? (
                <>
                  <CircleNotch className="size-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <ArrowSquareOut className="size-4 mr-2" />
                  Connect {config.name}
                </>
              )}
            </Button>
          )}
        </div>

        {/* Spreadsheet/Document selector (only show when connected) */}
        {integration && baseActionId === "google-sheets" && (
          <>
            <div className="mb-5">
              <div className="flex items-center gap-1 mb-2">
                <label className="text-[13px] font-medium text-[#374151]">
                  Spreadsheet
                </label>
                <span className="text-[#9CA3AF] text-[12px]">(required)</span>
              </div>
              <Select>
                <SelectTrigger className="h-10 bg-white border-[#E5E7EB] rounded-lg text-[13px]">
                  <SelectValue placeholder="Select a spreadsheet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="browse">Browse spreadsheets...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mb-5">
              <div className="flex items-center gap-1 mb-2">
                <label className="text-[13px] font-medium text-[#374151]">
                  Sheet
                </label>
                <span className="text-[#9CA3AF] text-[12px]">(required)</span>
              </div>
              <Select>
                <SelectTrigger className="h-10 bg-white border-[#E5E7EB] rounded-lg text-[13px]">
                  <SelectValue placeholder="Select a sheet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sheet1">Sheet1</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* Model selection (for AI-powered actions) */}
        <div className="mb-5">
          <div className="flex items-center gap-1 mb-2">
            <label className="text-[13px] font-medium text-[#374151]">
              Model
            </label>
            <Info className="size-3.5 text-[#9CA3AF]" />
          </div>
          <Select defaultValue="balanced">
            <SelectTrigger className="h-10 bg-white border-[#E5E7EB] rounded-lg text-[13px]">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="balanced">Balanced</SelectItem>
              <SelectItem value="fastest">Fastest</SelectItem>
              <SelectItem value="smartest">Smartest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Title field */}
        <div className="mb-5">
          <div className="flex items-center gap-1 mb-2">
            <label className="text-[13px] font-medium text-[#374151]">
              Title
            </label>
            <Info className="size-3.5 text-[#9CA3AF]" />
          </div>
          <Input
            placeholder="Optional title for this action"
            className="h-10 bg-white border-[#E5E7EB] rounded-lg text-[13px]"
          />
        </div>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleRenameSubmit();
              }
            }}
            placeholder="Enter new name..."
            autoFocus
            onFocus={(e) => e.target.select()}
            className="mt-2"
          />
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleRenameSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
