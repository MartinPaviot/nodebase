"use client";

import { useState } from "react";
import { NODE_MODELS } from "../lib/models";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowsClockwise,
  Sparkle,
  DotsThree,
  TextT,
  Trash,
  Info,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface EnterLoopSettingsProps {
  nodeId: string;
  nodeName?: string;
  items?: string;
  maxCycles?: number;
  maxCyclesPrompt?: string;
  output?: string;
  model?: string;
  onUpdate?: (settings: EnterLoopSettingsData) => void;
  onRename?: (newName: string) => void;
  onDelete?: () => void;
  onReplace?: () => void;
}

export interface EnterLoopSettingsData {
  model: string;
  items: string;
  itemsMode: "prompt" | "manual";
  maxCycles: number;
  maxCyclesPrompt: string;
  maxCyclesMode: "prompt" | "manual";
  maxConcurrent: number;
  maxConcurrentAuto: boolean;
  output: string;
  outputMode: "prompt" | "manual";
}

const MODELS = NODE_MODELS;

export function EnterLoopSettings({
  nodeName,
  items,
  maxCycles,
  maxCyclesPrompt,
  output,
  model,
  onUpdate,
  onRename,
  onDelete,
  onReplace,
}: EnterLoopSettingsProps) {
  const [settings, setSettings] = useState<EnterLoopSettingsData>({
    model: model || "claude-haiku",
    items: items || "",
    itemsMode: items ? "prompt" : "manual",
    maxCycles: maxCycles ?? 3,
    maxCyclesPrompt: maxCyclesPrompt || "",
    maxCyclesMode: maxCyclesPrompt ? "prompt" : "manual",
    maxConcurrent: 10,
    maxConcurrentAuto: true,
    output: output || "",
    outputMode: output ? "prompt" : "manual",
  });

  const [showMoreConcurrent, setShowMoreConcurrent] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const displayName = nodeName || "Enter loop";

  const openRenameDialog = () => {
    setRenameValue(displayName);
    setRenameDialogOpen(true);
  };

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      onRename?.(trimmed);
    }
    setRenameDialogOpen(false);
  };

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <ArrowsClockwise className="size-4 text-violet-600" weight="bold" />
            </div>
            <div>
              <h3
                className="font-semibold text-[15px] cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded -mx-1"
                onClick={openRenameDialog}
              >
                {displayName}
              </h3>
              <p className="text-xs text-muted-foreground">
                Enter loop → Enter loop
              </p>
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

        {/* Items to loop through */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Items to loop through{" "}
              <span className="text-muted-foreground">(required)</span>
            </Label>
            <button
              onClick={() => updateSetting("itemsMode", settings.itemsMode === "prompt" ? "manual" : "prompt")}
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-0.5 rounded",
                settings.itemsMode === "prompt"
                  ? "text-violet-600 bg-violet-50"
                  : "text-muted-foreground"
              )}
            >
              <Sparkle className="size-3" weight="fill" />
              Prompt AI
            </button>
          </div>
          {settings.itemsMode === "prompt" ? (
            <div className="rounded-lg bg-violet-100 px-3 py-3">
              <textarea
                value={settings.items}
                onChange={(e) => updateSetting("items", e.target.value)}
                placeholder="Describe what items the AI should loop through..."
                rows={3}
                className="w-full bg-transparent text-sm text-violet-700 placeholder:text-violet-400 resize-none outline-none"
              />
            </div>
          ) : (
            <Input
              value={settings.items}
              onChange={(e) => updateSetting("items", e.target.value)}
              placeholder="Enter items to loop through..."
            />
          )}
        </div>

        {/* Max cycles */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Max cycles</Label>
            <button
              onClick={() => updateSetting("maxCyclesMode", settings.maxCyclesMode === "prompt" ? "manual" : "prompt")}
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-0.5 rounded",
                settings.maxCyclesMode === "prompt"
                  ? "text-violet-600 bg-violet-50"
                  : "text-muted-foreground"
              )}
            >
              <Sparkle className="size-3" weight="fill" />
              Prompt AI
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-justify">
            The maximum number of cycles to run. Any items beyond this limit will be
            ignored.
          </p>
          {settings.maxCyclesMode === "prompt" ? (
            <div className="rounded-lg bg-violet-100 px-3 py-3">
              <textarea
                value={settings.maxCyclesPrompt}
                onChange={(e) => updateSetting("maxCyclesPrompt", e.target.value)}
                placeholder="Describe when to adjust max cycles..."
                rows={3}
                className="w-full bg-transparent text-sm text-violet-700 placeholder:text-violet-400 resize-none outline-none"
              />
            </div>
          ) : (
            <Input
              type="number"
              min={1}
              max={10000}
              value={settings.maxCycles}
              onChange={(e) => updateSetting("maxCycles", parseInt(e.target.value) || 3)}
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
          <p className="text-xs text-muted-foreground text-justify">
            The maximum number of cycles to run in parallel. Cycles beyond this limit
            will enter a queue and will be processed...
          </p>
          <Collapsible open={showMoreConcurrent} onOpenChange={setShowMoreConcurrent}>
            <CollapsibleTrigger className="text-xs text-primary hover:underline">
              More
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <p className="text-xs text-muted-foreground text-justify">
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
            <div className="flex items-center gap-1">
              <Label className="text-sm font-medium">Output</Label>
              <Info className="size-3.5 text-muted-foreground" />
            </div>
            <button
              onClick={() => updateSetting("outputMode", settings.outputMode === "prompt" ? "manual" : "prompt")}
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-0.5 rounded",
                settings.outputMode === "prompt"
                  ? "text-violet-600 bg-violet-50"
                  : "text-muted-foreground"
              )}
            >
              <Sparkle className="size-3" weight="fill" />
              Prompt AI
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-justify">
            Information to be passed to outside of the loop
          </p>
          {settings.outputMode === "prompt" ? (
            <div className="rounded-lg bg-violet-100 px-3 py-3">
              <textarea
                value={settings.output}
                onChange={(e) => updateSetting("output", e.target.value)}
                placeholder="Describe what output should be passed outside the loop..."
                rows={3}
                className="w-full bg-transparent text-sm text-violet-700 placeholder:text-violet-400 resize-none outline-none"
              />
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
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameSubmit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
