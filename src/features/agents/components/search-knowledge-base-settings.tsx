"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, CaretDown, MagnifyingGlass, Sparkle } from "@phosphor-icons/react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { SelectKnowledgeBaseModal } from "./select-knowledge-base-modal";

interface KnowledgeBase {
  id: string;
  name: string;
  type: string;
  icon: string;
}

interface SearchKnowledgeBaseSettingsProps {
  nodeId: string;
  onUpdate?: (settings: SearchKnowledgeBaseSettingsData) => void;
}

export interface SearchKnowledgeBaseSettingsData {
  model: string;
  query: string;
  queryAuto: boolean;
  maxResults: number;
  maxResultsAuto: boolean;
  searchFuzziness: number;
  searchFuzzinessManual: boolean;
  knowledgeBases: KnowledgeBase[];
}

const MODELS = [
  { id: "claude-haiku", label: "Claude 4.5 Haiku", provider: "Default" },
  { id: "claude-sonnet", label: "Claude 4.5 Sonnet", provider: "Default" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
  { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
];

export function SearchKnowledgeBaseSettings({
  onUpdate,
}: SearchKnowledgeBaseSettingsProps) {
  const [settings, setSettings] = useState<SearchKnowledgeBaseSettingsData>({
    model: "claude-haiku",
    query: "",
    queryAuto: true,
    maxResults: 5,
    maxResultsAuto: true,
    searchFuzziness: 100,
    searchFuzzinessManual: false,
    knowledgeBases: [],
  });

  const [showMoreQuery, setShowMoreQuery] = useState(false);
  const [showMoreFuzziness, setShowMoreFuzziness] = useState(false);
  const [showKnowledgeBaseModal, setShowKnowledgeBaseModal] = useState(false);

  const updateSetting = <K extends keyof SearchKnowledgeBaseSettingsData>(
    key: K,
    value: SearchKnowledgeBaseSettingsData[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onUpdate?.(newSettings);
  };

  const handleAddKnowledgeBase = (sourceId: string) => {
    const newKb: KnowledgeBase = {
      id: `kb-${Date.now()}`,
      name: sourceId.charAt(0).toUpperCase() + sourceId.slice(1).replace("-", " "),
      type: sourceId,
      icon: getIconForSource(sourceId),
    };
    updateSetting("knowledgeBases", [...settings.knowledgeBases, newKb]);
  };

  const getIconForSource = (sourceId: string): string => {
    const icons: Record<string, string> = {
      files: "ph:file-text-duotone",
      text: "ph:text-aa-duotone",
      website: "ph:globe-duotone",
      "google-drive": "logos:google-drive",
      onedrive: "logos:microsoft-onedrive",
      dropbox: "logos:dropbox",
      notion: "simple-icons:notion",
      freshdesk: "simple-icons:freshdesk",
    };
    return icons[sourceId] || "ph:database";
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 border-b">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-purple-100 flex items-center justify-center">
            <MagnifyingGlass className="size-4 text-purple-600" weight="duotone" />
          </div>
          <div>
            <h3 className="font-semibold text-[15px]">Search knowledge base</h3>
            <p className="text-xs text-muted-foreground">Knowledge base</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          Retrieve and utilize information from diverse sources.
        </p>
      </div>

      {/* Settings */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Model */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Model <span className="text-muted-foreground">(required)</span>
          </Label>
          <Select
            value={settings.model}
            onValueChange={(value) => updateSetting("model", value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">◇</span>
                    <span>{model.provider}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>Currently {model.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Query */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Query <span className="text-muted-foreground">(required)</span>
            </Label>
            <button
              onClick={() => updateSetting("queryAuto", !settings.queryAuto)}
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-0.5 rounded",
                settings.queryAuto
                  ? "text-amber-600 bg-amber-50"
                  : "text-muted-foreground"
              )}
            >
              <Sparkle className="size-3" weight="fill" />
              Auto
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            What to search for in the knowledge base
          </p>
          {settings.queryAuto ? (
            <div className="text-xs text-muted-foreground italic bg-gray-50 px-3 py-2 rounded-md">
              AI will automatically fill this field
            </div>
          ) : (
            <Input
              value={settings.query}
              onChange={(e) => updateSetting("query", e.target.value)}
              placeholder="Enter search query..."
            />
          )}
          <Collapsible open={showMoreQuery} onOpenChange={setShowMoreQuery}>
            <CollapsibleTrigger className="text-xs text-primary hover:underline">
              More
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <p className="text-xs text-muted-foreground">
                Advanced query options will appear here.
              </p>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Max Results */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Max Results <span className="text-muted-foreground">(required)</span>
            </Label>
            <button
              onClick={() => updateSetting("maxResultsAuto", !settings.maxResultsAuto)}
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-0.5 rounded",
                settings.maxResultsAuto
                  ? "text-amber-600 bg-amber-50"
                  : "text-muted-foreground"
              )}
            >
              <Sparkle className="size-3" weight="fill" />
              Auto
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            This is the maximum number of results from your Knowledge Base that will be
            returned. If the answer to your question is...
          </p>
          {settings.maxResultsAuto ? (
            <div className="text-xs text-muted-foreground italic bg-gray-50 px-3 py-2 rounded-md">
              AI will automatically fill this field
            </div>
          ) : (
            <Input
              type="number"
              min={1}
              max={100}
              value={settings.maxResults}
              onChange={(e) => updateSetting("maxResults", parseInt(e.target.value) || 5)}
            />
          )}
          <Collapsible>
            <CollapsibleTrigger className="text-xs text-primary hover:underline">
              More
            </CollapsibleTrigger>
          </Collapsible>
        </div>

        {/* Search Fuzziness */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Search Fuzziness</Label>
            <button
              onClick={() =>
                updateSetting("searchFuzzinessManual", !settings.searchFuzzinessManual)
              }
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-0.5 rounded",
                settings.searchFuzzinessManual
                  ? "text-blue-600 bg-blue-50"
                  : "text-muted-foreground"
              )}
            >
              Set Manually
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            From 0 to 100 — 0 is pure keyword search, 100 is pure semantic search. Set to
            0 to only return exact keyword...
          </p>
          {settings.searchFuzzinessManual && (
            <div className="space-y-2">
              <Slider
                value={[settings.searchFuzziness]}
                onValueChange={([value]) => updateSetting("searchFuzziness", value)}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
              <Input
                type="number"
                min={0}
                max={100}
                value={settings.searchFuzziness}
                onChange={(e) =>
                  updateSetting("searchFuzziness", parseInt(e.target.value) || 0)
                }
                className="w-20"
              />
            </div>
          )}
          <Collapsible open={showMoreFuzziness} onOpenChange={setShowMoreFuzziness}>
            <CollapsibleTrigger className="text-xs text-primary hover:underline">
              More
            </CollapsibleTrigger>
          </Collapsible>
        </div>

        {/* Knowledge base */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Knowledge base</Label>
            <Button
              size="sm"
              variant="default"
              className="size-6 p-0 rounded-full"
              onClick={() => setShowKnowledgeBaseModal(true)}
            >
              <Plus className="size-3" />
            </Button>
          </div>

          {settings.knowledgeBases.length > 0 ? (
            <div className="space-y-2">
              {settings.knowledgeBases.map((kb) => (
                <div
                  key={kb.id}
                  className="flex items-center gap-2 p-2 rounded-lg border bg-gray-50"
                >
                  <Icon icon={kb.icon} className="size-4" />
                  <span className="text-sm">{kb.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No knowledge bases added yet. Click + to add one.
            </p>
          )}
        </div>
      </div>

      <SelectKnowledgeBaseModal
        open={showKnowledgeBaseModal}
        onOpenChange={setShowKnowledgeBaseModal}
        onSelectSource={handleAddKnowledgeBase}
      />
    </div>
  );
}
