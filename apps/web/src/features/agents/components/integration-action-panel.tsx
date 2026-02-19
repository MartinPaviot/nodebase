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
  PencilSimple,
  Sparkle,
  Lightning,
  CaretDown,
  Plus,
} from "@phosphor-icons/react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ============================================
// FIELD MODE SYSTEM
// ============================================

type FieldMode = "manual" | "prompt" | "auto";

function FieldModeSelector({
  mode,
  onModeChange,
  showPromptOption = true,
}: {
  mode: FieldMode;
  onModeChange: (mode: FieldMode) => void;
  showPromptOption?: boolean;
}) {
  const getModeLabel = () => {
    switch (mode) {
      case "manual": return "Set Manually";
      case "prompt": return "Prompt AI";
      case "auto": return "Auto";
    }
  };

  const getModeIcon = () => {
    switch (mode) {
      case "manual": return <PencilSimple className="size-3" weight="bold" />;
      case "prompt": return <Sparkle className="size-3" weight="fill" />;
      case "auto": return <Lightning className="size-3" weight="fill" />;
    }
  };

  const getModeColor = () => {
    switch (mode) {
      case "manual": return "text-blue-600 bg-blue-50 hover:bg-blue-100";
      case "prompt": return "text-violet-600 bg-violet-50 hover:bg-violet-100";
      case "auto": return "text-emerald-600 bg-emerald-50 hover:bg-emerald-100";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn("flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors", getModeColor())}>
          {getModeIcon()}
          <span>{getModeLabel()}</span>
          <CaretDown className="size-3 opacity-60" weight="bold" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[280px]">
        <DropdownMenuItem className="flex flex-col items-start gap-0.5 py-2 cursor-pointer" onSelect={() => onModeChange("manual")}>
          <div className="flex items-center gap-2">
            <PencilSimple className="size-4 text-blue-600" weight="bold" />
            <span className="font-medium text-blue-600">Set Manually</span>
          </div>
          <span className="text-xs text-muted-foreground ml-6">Enter the value for this field manually</span>
        </DropdownMenuItem>
        {showPromptOption && (
          <DropdownMenuItem className="flex flex-col items-start gap-0.5 py-2 cursor-pointer" onSelect={() => onModeChange("prompt")}>
            <div className="flex items-center gap-2">
              <Sparkle className="size-4 text-violet-500" weight="fill" />
              <span className="font-medium text-violet-600">Prompt AI</span>
            </div>
            <span className="text-xs text-muted-foreground ml-6">AI will fill out the field using the prompt and context</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="flex flex-col items-start gap-0.5 py-2 cursor-pointer" onSelect={() => onModeChange("auto")}>
          <div className="flex items-center gap-2">
            <Lightning className="size-4 text-emerald-500" weight="fill" />
            <span className="font-medium text-emerald-600">Auto</span>
          </div>
          <span className="text-xs text-muted-foreground ml-6">AI will fill out the field using context from previous steps</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Renders field input based on mode */
function EmailFieldInput({
  value,
  mode,
  onChange,
  placeholder,
  promptPlaceholder,
  multiline,
}: {
  value: string;
  mode: FieldMode;
  onChange: (value: string) => void;
  placeholder: string;
  promptPlaceholder?: string;
  multiline?: boolean;
}) {
  if (mode === "auto") {
    return (
      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
        <p className="text-xs text-emerald-700">AI will automatically fill this field</p>
      </div>
    );
  }

  if (mode === "prompt") {
    return (
      <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={promptPlaceholder || "Describe what AI should generate..."}
          className="w-full min-h-[60px] bg-transparent text-xs text-violet-800 placeholder:text-violet-400 resize-y focus:outline-none"
        />
      </div>
    );
  }

  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-h-[120px] p-3 bg-white border border-[#E5E7EB] rounded-lg text-[13px] text-[#374151] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
      />
    );
  }

  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-10 bg-white border-[#E5E7EB] rounded-lg text-[13px]"
    />
  );
}

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
  /** Pass-through node data for integration-specific fields */
  nodeData?: Record<string, unknown>;
  onClose?: () => void;
  onDelete?: () => void;
  onRename?: (newName: string) => void;
  onReplace?: () => void;
  onUpdate?: (data: Record<string, unknown>) => void;
}

export function IntegrationActionPanel({
  actionId,
  nodeName,
  nodeData,
  onDelete,
  onRename,
  onReplace,
  onUpdate,
}: IntegrationActionPanelProps) {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Resolve actionId to a base integration key in INTEGRATION_CONFIGS.
  // The AI builder sometimes stores a sub-action (e.g. "draft", "send_email")
  // as the actionId instead of the integration name ("gmail").
  const getBaseActionId = (id: string) => {
    // Direct match — most common case
    if (INTEGRATION_CONFIGS[id]) return id;

    // Prefix-based mappings
    if (id.startsWith("gs-")) return "google-sheets";
    if (id.startsWith("gmail-") || id.startsWith("gmail_")) return "gmail";
    if (id.startsWith("outlook-") || id.startsWith("outlook_")) return "outlook";
    if (id.startsWith("slack-") || id.startsWith("slack_")) return "slack";
    if (id.startsWith("notion-") || id.startsWith("notion_")) return "notion";

    // Sub-action names that belong to Gmail/email
    const gmailSubActions = ["send", "send_email", "draft", "draft_email", "create_draft", "list", "list_emails", "search", "search_emails"];
    if (gmailSubActions.includes(id)) return "gmail";

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
        body: JSON.stringify({ type: config.type, returnUrl: window.location.pathname + window.location.search }),
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
        <p className="text-[11px] text-[#9CA3AF] mb-5 text-justify">{config.description}</p>

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

        {/* Email-specific fields (Gmail, Outlook) */}
        {(baseActionId === "gmail" || baseActionId === "outlook") && (
          <>
            {/* Action Type */}
            <div className="mb-5">
              <div className="flex items-center gap-1 mb-2">
                <label className="text-[13px] font-medium text-[#374151]">
                  Action
                </label>
                <Info className="size-3.5 text-[#9CA3AF]" />
              </div>
              <Select
                value={(nodeData?.action as string) || (nodeData?.actionType as string) || (nodeData?.actionId as string) || "send"}
                onValueChange={(v) => onUpdate?.({ action: v })}
              >
                <SelectTrigger className="h-10 bg-white border-[#E5E7EB] rounded-lg text-[13px]">
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="send">Send email</SelectItem>
                  <SelectItem value="draft">Create draft</SelectItem>
                  <SelectItem value="list">List emails</SelectItem>
                  <SelectItem value="search">Search emails</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            <div className="mb-5">
              <div className="flex items-center gap-1 mb-2">
                <label className="text-[13px] font-medium text-[#374151]">
                  Model
                </label>
                <Info className="size-3.5 text-[#9CA3AF]" />
              </div>
              <Select
                value={(nodeData?.model as string) || "fast"}
                onValueChange={(v) => onUpdate?.({ model: v })}
              >
                <SelectTrigger className="h-10 bg-white border-[#E5E7EB] rounded-lg text-[13px]">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fast">Claude 4.5 Haiku — Fast</SelectItem>
                  <SelectItem value="smart">Claude 4.5 Sonnet — Balanced</SelectItem>
                  <SelectItem value="deep">Claude 4.5 Opus — Most capable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ask for Confirmation */}
            <div className="mb-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Label className="text-[13px] font-medium text-[#374151]">
                    Ask for Confirmation
                  </Label>
                  <Info className="size-3.5 text-[#9CA3AF]" />
                </div>
                <Switch
                  checked={(nodeData?.askForConfirmation as boolean) || false}
                  onCheckedChange={(v) => onUpdate?.({ askForConfirmation: v })}
                />
              </div>
              <p className="text-[11px] text-[#9CA3AF] mt-1 text-justify">
                Require approval before sending
              </p>
            </div>

            {/* To */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <label className="text-[13px] font-medium text-[#374151]">
                    To
                  </label>
                  <span className="text-[#9CA3AF] text-[12px]">(required)</span>
                </div>
                <FieldModeSelector
                  mode={(nodeData?.toMode as FieldMode) || "auto"}
                  onModeChange={(m) => onUpdate?.({ toMode: m })}
                />
              </div>
              <EmailFieldInput
                value={(nodeData?.to as string) || ""}
                mode={(nodeData?.toMode as FieldMode) || "auto"}
                onChange={(v) => onUpdate?.({ to: v })}
                placeholder="Recipient email address"
                promptPlaceholder="e.g. Use the contact email from the previous step"
              />
            </div>

            {/* Cc */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <label className="text-[13px] font-medium text-[#374151]">
                    Cc
                  </label>
                </div>
                <FieldModeSelector
                  mode={(nodeData?.ccMode as FieldMode) || "manual"}
                  onModeChange={(m) => onUpdate?.({ ccMode: m })}
                />
              </div>
              <EmailFieldInput
                value={(nodeData?.cc as string) || ""}
                mode={(nodeData?.ccMode as FieldMode) || "manual"}
                onChange={(v) => onUpdate?.({ cc: v })}
                placeholder="CC email addresses (comma separated)"
                promptPlaceholder="e.g. CC the team lead"
              />
            </div>

            {/* Bcc */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <label className="text-[13px] font-medium text-[#374151]">
                    Bcc
                  </label>
                </div>
                <FieldModeSelector
                  mode={(nodeData?.bccMode as FieldMode) || "manual"}
                  onModeChange={(m) => onUpdate?.({ bccMode: m })}
                />
              </div>
              <EmailFieldInput
                value={(nodeData?.bcc as string) || ""}
                mode={(nodeData?.bccMode as FieldMode) || "manual"}
                onChange={(v) => onUpdate?.({ bcc: v })}
                placeholder="BCC email addresses (comma separated)"
                promptPlaceholder="e.g. BCC compliance team"
              />
            </div>

            {/* Subject */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <label className="text-[13px] font-medium text-[#374151]">
                    Subject
                  </label>
                  <span className="text-[#9CA3AF] text-[12px]">(required)</span>
                </div>
                <FieldModeSelector
                  mode={(nodeData?.subjectMode as FieldMode) || "prompt"}
                  onModeChange={(m) => onUpdate?.({ subjectMode: m })}
                />
              </div>
              <EmailFieldInput
                value={(nodeData?.subject as string) || ""}
                mode={(nodeData?.subjectMode as FieldMode) || "prompt"}
                onChange={(v) => onUpdate?.({ subject: v })}
                placeholder="Email subject"
                promptPlaceholder="e.g. Generate a subject based on the email body"
              />
            </div>

            {/* Body */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <label className="text-[13px] font-medium text-[#374151]">
                    Body
                  </label>
                  <span className="text-[#9CA3AF] text-[12px]">(required)</span>
                </div>
                <FieldModeSelector
                  mode={(nodeData?.bodyMode as FieldMode) || "prompt"}
                  onModeChange={(m) => onUpdate?.({ bodyMode: m })}
                />
              </div>
              <EmailFieldInput
                value={(nodeData?.body as string) || ""}
                mode={(nodeData?.bodyMode as FieldMode) || "prompt"}
                onChange={(v) => onUpdate?.({ body: v })}
                placeholder="Email body content"
                promptPlaceholder="e.g. Write a follow-up email based on the LinkedIn profile data"
                multiline
              />
            </div>

            {/* Signature */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <label className="text-[13px] font-medium text-[#374151]">
                    Signature
                  </label>
                </div>
                <FieldModeSelector
                  mode={(nodeData?.signatureMode as FieldMode) || "manual"}
                  onModeChange={(m) => onUpdate?.({ signatureMode: m })}
                  showPromptOption={false}
                />
              </div>
              <EmailFieldInput
                value={(nodeData?.signature as string) || ""}
                mode={(nodeData?.signatureMode as FieldMode) || "manual"}
                onChange={(v) => onUpdate?.({ signature: v })}
                placeholder="e.g. Best regards, John Doe"
                multiline
              />
            </div>

            {/* From Name */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <label className="text-[13px] font-medium text-[#374151]">
                    From Name
                  </label>
                </div>
                <FieldModeSelector
                  mode={(nodeData?.fromNameMode as FieldMode) || "auto"}
                  onModeChange={(m) => onUpdate?.({ fromNameMode: m })}
                  showPromptOption={false}
                />
              </div>
              <EmailFieldInput
                value={(nodeData?.fromName as string) || ""}
                mode={(nodeData?.fromNameMode as FieldMode) || "auto"}
                onChange={(v) => onUpdate?.({ fromName: v })}
                placeholder="Sender display name"
              />
            </div>
          </>
        )}
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
