"use client";

import { useState, useRef, useCallback } from "react";
import { NODE_MODELS } from "../lib/models";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
  ArrowsClockwise,
  DotsThree,
  TextT,
  Trash,
  Info,
  Sparkle,
  Warning,
} from "@phosphor-icons/react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { useIntegrationIcons } from "@/hooks/use-integration-icons";
import { InjectDataSidebar, insertTokenAtCursor } from "./inject-data-sidebar";
import type { UpstreamNode } from "../lib/flow-graph-utils";

// ── Field mode types ──────────────────────────────────────────────
type FieldMode = "prompt" | "manual" | "auto";

// ── Per-action field schema ───────────────────────────────────────
interface FieldDef {
  key: string;
  label: string;
  description?: string;
  required?: boolean;
  type: "textarea" | "text" | "number" | "boolean" | "dropdown";
  options?: { value: string; label: string }[];
  defaultMode: FieldMode;
}

// ── Field schemas per action icon / provider ──────────────────────
const PERPLEXITY_FIELDS: FieldDef[] = [
  { key: "prompt", label: "Query", required: true, type: "textarea", defaultMode: "prompt" },
  {
    key: "perplexityModel",
    label: "Model",
    description: "The Perplexity model to use",
    type: "dropdown",
    options: [
      { value: "sonar", label: "Sonar (fast)" },
      { value: "sonar-pro", label: "Sonar Pro (advanced)" },
      { value: "sonar-reasoning", label: "Sonar Reasoning (fast reasoning)" },
      { value: "sonar-reasoning-pro", label: "Sonar Reasoning Pro (advanced reasoning)" },
    ],
    defaultMode: "manual",
  },
  { key: "searchMode", label: "Search Mode", description: "Type of search to perform", type: "text", defaultMode: "auto" },
  { key: "domainFilter", label: "Domain Filter", description: "Allowlist or denylist domains", type: "text", defaultMode: "auto" },
  { key: "recencyFilter", label: "Recency Filter", description: "How recent should results be?", type: "text", defaultMode: "auto" },
  { key: "afterDate", label: "After Date", description: "Published after (MM/DD/YYYY)", type: "text", defaultMode: "auto" },
  { key: "beforeDate", label: "Before Date", description: "Published before (MM/DD/YYYY)", type: "text", defaultMode: "auto" },
  { key: "returnImages", label: "Return Images", description: "Include relevant images", type: "boolean", defaultMode: "auto" },
  { key: "returnRelatedQuestions", label: "Return Related Questions", description: "Get suggested follow-up questions", type: "boolean", defaultMode: "manual" },
  { key: "returnVideos", label: "Return Videos", description: "Include relevant videos", type: "boolean", defaultMode: "auto" },
  { key: "temperature", label: "Temperature", description: "Response creativity level", type: "number", defaultMode: "manual" },
  { key: "maxTokens", label: "Max Tokens", description: "Limit response length", type: "number", defaultMode: "auto" },
];

const GOOGLE_SEARCH_FIELDS: FieldDef[] = [
  { key: "prompt", label: "Query", required: true, description: "The search query", type: "textarea", defaultMode: "prompt" },
  { key: "maxResults", label: "Max Results", description: "The maximum number of results to return. Max is 20", type: "number", defaultMode: "manual" },
  { key: "location", label: "Location", description: 'Optional location to localize results, e.g. "San Francisco, CA"', type: "text", defaultMode: "auto" },
];

const THINK_FIELDS: FieldDef[] = [
  { key: "prompt", label: "Thought", required: true, description: "What should the AI think about?", type: "textarea", defaultMode: "prompt" },
];

const YOUTUBE_FIELDS: FieldDef[] = [
  { key: "prompt", label: "URL or Video ID", required: true, description: "The YouTube video URL or ID to transcribe", type: "textarea", defaultMode: "prompt" },
];

const AI_WRITE_FIELDS: FieldDef[] = [
  { key: "prompt", label: "Prompt", required: true, description: "Instructions for the AI writer", type: "textarea", defaultMode: "prompt" },
];

const LINKEDIN_COMPOSIO_FIELDS: FieldDef[] = [
  { key: "linkedinProfileUrls", label: "LinkedIn profile URLs", required: true, type: "text", defaultMode: "auto" },
];

function getFieldsForAction(icon?: string, subtitle?: string): FieldDef[] {
  if (icon === "perplexity") return PERPLEXITY_FIELDS;
  if (icon === "google") return GOOGLE_SEARCH_FIELDS;
  if (icon === "youtube") return YOUTUBE_FIELDS;
  if (icon === "linkedin") return LINKEDIN_COMPOSIO_FIELDS;
  if (subtitle?.includes("Think") || subtitle?.includes("Unify")) return THINK_FIELDS;
  if (subtitle?.includes("Write")) return AI_WRITE_FIELDS;
  // Fallback: just a prompt field
  return [{ key: "prompt", label: "Prompt", required: true, type: "textarea", defaultMode: "prompt" }];
}

// ── Icon helpers ──────────────────────────────────────────────────
function getIconForAction(icon?: string): string {
  switch (icon) {
    case "perplexity": return "simple-icons:perplexity";
    case "google": return "logos:google-icon";
    case "youtube": return "logos:youtube-icon";
    case "linkedin": return "logos:linkedin-icon";
    case "ai": return "ph:sparkle-fill";
    default: return "ph:gear-fill";
  }
}

function getIconBgForAction(icon?: string): string {
  switch (icon) {
    case "perplexity": return "bg-teal-50";
    case "google": return "bg-blue-50";
    case "youtube": return "bg-red-50";
    case "linkedin": return "bg-blue-50";
    case "ai": return "bg-violet-50";
    default: return "bg-gray-100";
  }
}

// ── MODELS ────────────────────────────────────────────────────────
const MODELS = NODE_MODELS;

// ── Props ─────────────────────────────────────────────────────────
interface ActionNodeSettingsProps {
  nodeId: string;
  nodeName?: string;
  nodeData: Record<string, unknown>;
  upstreamNodes?: UpstreamNode[];
  onUpdate?: (data: Record<string, unknown>) => void;
  onDelete?: () => void;
  onRename?: (newName: string) => void;
  onReplace?: () => void;
}

// ── Component ─────────────────────────────────────────────────────
export function ActionNodeSettings({
  nodeName,
  nodeData,
  upstreamNodes = [],
  onUpdate,
  onDelete,
  onRename,
  onReplace,
}: ActionNodeSettingsProps) {
  const icon = nodeData.icon as string | undefined;
  const subtitle = (nodeData.subtitle as string) || "";
  const description = (nodeData.description as string) || "";
  const credits = nodeData.credits as number | undefined;
  const model = (nodeData.model as string) || "claude-haiku";
  const hasWarning = nodeData.hasWarning as boolean | undefined;
  const warningText = nodeData.warningText as string | undefined;

  const fields = getFieldsForAction(icon, subtitle);
  const displayName = nodeName || "Action";

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [localModel, setLocalModel] = useState(model);
  const [fieldModes, setFieldModes] = useState<Record<string, FieldMode>>(() => {
    const modes: Record<string, FieldMode> = {};
    for (const f of fields) {
      modes[f.key] = f.defaultMode;
    }
    return modes;
  });

  // Inject sidebar state
  const [focusedFieldKey, setFocusedFieldKey] = useState<string | null>(null);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const handleInject = useCallback(
    (nodeId: string, fieldId: string) => {
      if (!focusedFieldKey) return;
      const textarea = textareaRefs.current[focusedFieldKey];
      const currentValue = (nodeData[focusedFieldKey] as string) || "";
      const { newValue, cursorPos } = insertTokenAtCursor(textarea, currentValue, nodeId, fieldId);
      onUpdate?.({ [focusedFieldKey]: newValue });

      // Restore focus and cursor position
      setTimeout(() => {
        const ta = textareaRefs.current[focusedFieldKey];
        if (ta) {
          ta.focus();
          ta.setSelectionRange(cursorPos, cursorPos);
        }
      }, 0);
    },
    [focusedFieldKey, nodeData, onUpdate]
  );

  const { getIcon } = useIntegrationIcons();
  const integrationIcon = getIcon(icon || "");

  const openRenameDialog = () => {
    setRenameValue(displayName);
    setRenameDialogOpen(true);
  };

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed) onRename?.(trimmed);
    setRenameDialogOpen(false);
  };

  const updateField = (key: string, value: unknown) => {
    onUpdate?.({ [key]: value });
  };

  const toggleFieldMode = (key: string, current: FieldMode) => {
    const next: FieldMode = current === "prompt" ? "manual" : current === "manual" ? "auto" : "prompt";
    setFieldModes((prev) => ({ ...prev, [key]: next }));
  };

  // ── Render a single field ───────────────────────────────────────
  const renderField = (field: FieldDef) => {
    const mode = fieldModes[field.key] || field.defaultMode;
    const value = nodeData[field.key];

    return (
      <div key={field.key} className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Label className="text-sm font-medium">
              {field.label}
              {field.required && (
                <span className="text-muted-foreground ml-1">(required)</span>
              )}
            </Label>
            {field.description && !field.required && (
              <Info className="size-3.5 text-muted-foreground" />
            )}
          </div>
          {/* Mode toggle button */}
          <button
            onClick={() => toggleFieldMode(field.key, mode)}
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-0.5 rounded",
              mode === "prompt" ? "text-violet-600 bg-violet-50" :
              mode === "auto" ? "text-amber-600 bg-amber-50" :
              "text-blue-600 bg-blue-50"
            )}
          >
            <Sparkle className="size-3" weight="fill" />
            {mode === "prompt" ? "Prompt AI" : mode === "auto" ? "Auto" : "Set Manually"}
          </button>
        </div>

        {field.description && (
          <p className="text-xs text-muted-foreground text-justify">{field.description}</p>
        )}

        {/* Auto mode */}
        {mode === "auto" && (
          <div className="text-xs text-muted-foreground italic bg-gray-50 px-3 py-2 rounded-md">
            AI will automatically fill this field
          </div>
        )}

        {/* Prompt mode */}
        {mode === "prompt" && (
          <div className="rounded-lg bg-violet-100 px-3 py-3">
            <textarea
              ref={(el) => { textareaRefs.current[field.key] = el; }}
              value={(value as string) || ""}
              onChange={(e) => updateField(field.key, e.target.value)}
              onFocus={() => setFocusedFieldKey(field.key)}
              onBlur={() => setTimeout(() => setFocusedFieldKey((prev) => prev === field.key ? null : prev), 200)}
              placeholder={`Describe what the AI should use for ${field.label.toLowerCase()}...`}
              rows={field.type === "textarea" ? 4 : 2}
              className="w-full bg-transparent text-sm text-violet-700 placeholder:text-violet-400 resize-none outline-none"
            />
          </div>
        )}

        {/* Manual mode */}
        {mode === "manual" && field.type === "textarea" && (
          <textarea
            ref={(el) => { textareaRefs.current[field.key] = el; }}
            value={(value as string) || ""}
            onChange={(e) => updateField(field.key, e.target.value)}
            onFocus={() => setFocusedFieldKey(field.key)}
            onBlur={() => setTimeout(() => setFocusedFieldKey((prev) => prev === field.key ? null : prev), 200)}
            rows={4}
            className="w-full min-h-[100px] rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        )}

        {mode === "manual" && field.type === "text" && (
          <Input
            value={(value as string) || ""}
            onChange={(e) => updateField(field.key, e.target.value)}
          />
        )}

        {mode === "manual" && field.type === "number" && (
          <Input
            type="number"
            value={value != null ? String(value) : ""}
            onChange={(e) => updateField(field.key, parseFloat(e.target.value) || 0)}
          />
        )}

        {mode === "manual" && field.type === "boolean" && (
          <Switch
            checked={!!value}
            onCheckedChange={(checked) => updateField(field.key, checked)}
          />
        )}

        {mode === "manual" && field.type === "dropdown" && field.options && (
          <Select
            value={(value as string) || field.options[0]?.value || ""}
            onValueChange={(v) => updateField(field.key, v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    );
  };

  return (
    <div className="relative h-full overflow-visible">
      {/* Inject data sidebar */}
      <InjectDataSidebar
        upstreamNodes={upstreamNodes}
        onInject={handleInject}
        visible={focusedFieldKey !== null}
      />

      <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("size-8 rounded-lg flex items-center justify-center", getIconBgForAction(icon))}>
              {integrationIcon.type === "img" ? (
                <img src={integrationIcon.src} alt={integrationIcon.label} className="size-5" />
              ) : (
                <Icon icon={integrationIcon.icon} className="size-5" />
              )}
            </div>
            <div>
              <h3
                className="font-semibold text-[15px] cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded -mx-1"
                onClick={openRenameDialog}
              >
                {displayName}
              </h3>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-[#9CA3AF] hover:text-[#6B7280] p-1">
                <DotsThree className="size-5" weight="bold" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={openRenameDialog}>
                <TextT className="size-4" />
                <span>Rename</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={onReplace}>
                <ArrowsClockwise className="size-4" />
                <span>Replace</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer" variant="destructive" onSelect={onDelete}>
                <Trash className="size-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description + credits */}
        <div className="mt-3 flex items-start gap-2">
          <p className="text-sm text-muted-foreground flex-1 text-justify">{description}</p>
          {credits != null && (
            <span className="shrink-0 text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              {credits} cr
            </span>
          )}
        </div>

        {/* Warning */}
        {hasWarning && warningText && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <Warning className="size-4 text-amber-600 shrink-0 mt-0.5" weight="fill" />
            <p className="text-xs text-amber-700">{warningText}</p>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Model */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Model <span className="text-muted-foreground">(required)</span>
          </Label>
          <Select value={localModel} onValueChange={(v) => { setLocalModel(v); onUpdate?.({ model: v }); }}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">◇</span>
                    <span>{m.provider}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>Currently {m.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dynamic fields */}
        {fields.map(renderField)}
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
              if (e.key === "Enter") { e.preventDefault(); handleRenameSubmit(); }
            }}
            placeholder="Enter new name..."
            autoFocus
            onFocus={(e) => e.target.select()}
            className="mt-2"
          />
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRenameSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
