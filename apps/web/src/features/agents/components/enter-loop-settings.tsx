"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ArrowsClockwise, Sparkle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface EnterLoopSettingsProps {
  nodeId: string;
  onUpdate?: (settings: EnterLoopSettingsData) => void;
}

export interface EnterLoopSettingsData {
  model: string;
  itemsToLoop: string;
  itemsToLoopAuto: boolean;
  maxCycles: number;
  maxCyclesManual: boolean;
  maxConcurrent: number;
  maxConcurrentAuto: boolean;
  output: string;
  outputAuto: boolean;
}

const MODELS = [
  { id: "claude-haiku", label: "Claude 4.5 Haiku", provider: "Default" },
  { id: "claude-sonnet", label: "Claude 4.5 Sonnet", provider: "Default" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
  { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
];

export function EnterLoopSettings({
  onUpdate,
}: EnterLoopSettingsProps) {
  const [settings, setSettings] = useState<EnterLoopSettingsData>({
    model: "claude-haiku",
    itemsToLoop: "",
    itemsToLoopAuto: true,
    maxCycles: 500,
    maxCyclesManual: true,
    maxConcurrent: 10,
    maxConcurrentAuto: true,
    output: "",
    outputAuto: true,
  });

  const [showMoreConcurrent, setShowMoreConcurrent] = useState(false);

  const updateSetting = <K extends keyof EnterLoopSettingsData>(
    key: K,
    value: EnterLoopSettingsData[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onUpdate?.(newSettings);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 border-b">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <ArrowsClockwise className="size-4 text-violet-600" weight="bold" />
          </div>
          <div>
            <h3 className="font-semibold text-[15px]">Enter loop</h3>
            <p className="text-xs text-muted-foreground">Enter loop</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          Loop over a list of items, processing each item in a parallel branch.{" "}
          <a href="#" className="text-primary hover:underline">
            Learn More
          </a>
          .
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

        {/* Items to loop through */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Items to loop through{" "}
              <span className="text-muted-foreground">(required)</span>
            </Label>
            <button
              onClick={() => updateSetting("itemsToLoopAuto", !settings.itemsToLoopAuto)}
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-0.5 rounded",
                settings.itemsToLoopAuto
                  ? "text-amber-600 bg-amber-50"
                  : "text-muted-foreground"
              )}
            >
              <Sparkle className="size-3" weight="fill" />
              Auto
            </button>
          </div>
          {settings.itemsToLoopAuto ? (
            <div className="text-xs text-muted-foreground italic bg-gray-50 px-3 py-2 rounded-md">
              AI will automatically fill this field
            </div>
          ) : (
            <Input
              value={settings.itemsToLoop}
              onChange={(e) => updateSetting("itemsToLoop", e.target.value)}
              placeholder="Enter items to loop through..."
            />
          )}
        </div>

        {/* Max cycles */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Max cycles</Label>
            <button
              onClick={() => updateSetting("maxCyclesManual", !settings.maxCyclesManual)}
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-0.5 rounded",
                settings.maxCyclesManual
                  ? "text-blue-600 bg-blue-50"
                  : "text-muted-foreground"
              )}
            >
              Set Manually
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            The maximum number of cycles to run. Any items beyond this limit will be
            ignored.
          </p>
          {settings.maxCyclesManual && (
            <Input
              type="number"
              min={1}
              max={10000}
              value={settings.maxCycles}
              onChange={(e) => updateSetting("maxCycles", parseInt(e.target.value) || 500)}
            />
          )}
        </div>

        {/* Max Concurrent */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Max Concurrent</Label>
            <button
              onClick={() =>
                updateSetting("maxConcurrentAuto", !settings.maxConcurrentAuto)
              }
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-0.5 rounded",
                settings.maxConcurrentAuto
                  ? "text-amber-600 bg-amber-50"
                  : "text-muted-foreground"
              )}
            >
              <Sparkle className="size-3" weight="fill" />
              Auto
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            The maximum number of cycles to run in parallel. Cycles beyond this limit
            will enter a queue and will be processed aft...
          </p>
          <Collapsible open={showMoreConcurrent} onOpenChange={setShowMoreConcurrent}>
            <CollapsibleTrigger className="text-xs text-primary hover:underline">
              More
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <p className="text-xs text-muted-foreground">
                Setting a lower value helps prevent rate limiting from external APIs.
                Higher values process items faster but may cause API errors.
              </p>
            </CollapsibleContent>
          </Collapsible>
          {settings.maxConcurrentAuto ? (
            <div className="text-xs text-muted-foreground italic bg-gray-50 px-3 py-2 rounded-md">
              AI will automatically fill this field
            </div>
          ) : (
            <Input
              type="number"
              min={1}
              max={100}
              value={settings.maxConcurrent}
              onChange={(e) =>
                updateSetting("maxConcurrent", parseInt(e.target.value) || 10)
              }
            />
          )}
        </div>

        {/* Output */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Output</Label>
            <button
              onClick={() => updateSetting("outputAuto", !settings.outputAuto)}
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-0.5 rounded",
                settings.outputAuto
                  ? "text-amber-600 bg-amber-50"
                  : "text-muted-foreground"
              )}
            >
              <Sparkle className="size-3" weight="fill" />
              Auto
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Information to be passed to outside of the loop
          </p>
          {settings.outputAuto ? (
            <div className="text-xs text-muted-foreground italic bg-gray-50 px-3 py-2 rounded-md">
              AI will automatically fill this field
            </div>
          ) : (
            <Input
              value={settings.output}
              onChange={(e) => updateSetting("output", e.target.value)}
              placeholder="Enter output configuration..."
            />
          )}
        </div>
      </div>
    </div>
  );
}
