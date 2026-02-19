"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  Sparkle,
  DotsThree,
  TextT,
  Trash,
  Info,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface ExitLoopSettingsProps {
  nodeId: string;
  nodeName?: string;
  output?: string;
  onUpdate?: (settings: ExitLoopSettingsData) => void;
  onRename?: (newName: string) => void;
  onDelete?: () => void;
  onReplace?: () => void;
}

export interface ExitLoopSettingsData {
  output: string;
  outputMode: "prompt" | "manual";
}

export function ExitLoopSettings({
  nodeName,
  output,
  onUpdate,
  onRename,
  onDelete,
  onReplace,
}: ExitLoopSettingsProps) {
  const [settings, setSettings] = useState<ExitLoopSettingsData>({
    output: output || "",
    outputMode: output ? "prompt" : "manual",
  });

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const displayName = nodeName || "Exit loop";

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

  const updateSetting = <K extends keyof ExitLoopSettingsData>(
    key: K,
    value: ExitLoopSettingsData[K]
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
            <div className="size-8 rounded-lg bg-teal-100 flex items-center justify-center">
              <ArrowsClockwise className="size-4 text-teal-600" weight="bold" />
            </div>
            <div>
              <h3
                className="font-semibold text-[15px] cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded -mx-1"
                onClick={openRenameDialog}
              >
                {displayName}
              </h3>
              <p className="text-xs text-muted-foreground">
                Exit loop → Exit loop
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
          Marks the end of a loop iteration. When all items have been processed,
          data is passed to the next step.
        </p>
      </div>

      {/* Settings */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
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
                placeholder="Describe what output should be passed after the loop completes..."
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
