"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { GitBranch, DotsThree, Plus, Info, Trash, TextT, ArrowsClockwise, WarningCircle } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ConditionSettingsProps {
  nodeId: string;
  nodeName?: string;
  conditions?: ConditionItem[];
  model?: string;
  forceSelectBranch?: boolean;
  onUpdate?: (settings: ConditionSettingsData) => void;
  onDeleteCondition?: (conditionIndex: number) => void;
  onRename?: (newName: string) => void;
  onReplace?: () => void;
  // If set, show only this specific condition (for branch node selection)
  selectedBranchIndex?: number;
}

interface ConditionItem {
  id: string;
  text: string;
}

export interface ConditionSettingsData {
  conditions: ConditionItem[];
  model: string;
  forceSelectBranch: boolean;
  [key: string]: unknown;
}

const MODELS = [
  { id: "claude-haiku", label: "Claude 4.5 Haiku", provider: "Default" },
  { id: "claude-sonnet", label: "Claude 4.5 Sonnet", provider: "Default" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
  { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
];

export function ConditionSettings({
  nodeName = "Condition",
  conditions = [],
  model = "claude-haiku",
  forceSelectBranch = false,
  onUpdate,
  onDeleteCondition,
  onRename,
  onReplace,
  selectedBranchIndex,
}: ConditionSettingsProps) {
  const isBranchView = selectedBranchIndex !== undefined;
  // Initialize with at least one empty condition
  const [localConditions, setLocalConditions] = useState<ConditionItem[]>(
    conditions.length > 0 ? conditions : [{ id: "cond-1", text: "" }]
  );
  const [localModel, setLocalModel] = useState(model);
  const [localForceSelect, setLocalForceSelect] = useState(forceSelectBranch);

  // Rename dialog state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Open rename dialog with current name
  const openRenameDialog = () => {
    setRenameValue(nodeName);
    setRenameDialogOpen(true);
  };

  // Handle rename submit
  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      onRename?.(trimmed);
    }
    setRenameDialogOpen(false);
  };

  // Sync local state with props when they change (e.g., when a new condition is added from canvas)
  useEffect(() => {
    if (conditions.length > 0) {
      setLocalConditions(conditions);
    }
  }, [conditions]);

  useEffect(() => {
    setLocalModel(model);
  }, [model]);

  useEffect(() => {
    setLocalForceSelect(forceSelectBranch);
  }, [forceSelectBranch]);

  const handleConditionChange = (id: string, text: string) => {
    const updated = localConditions.map((c) =>
      c.id === id ? { ...c, text } : c
    );
    setLocalConditions(updated);
    onUpdate?.({
      conditions: updated,
      model: localModel,
      forceSelectBranch: localForceSelect,
    });
  };

  const handleAddCondition = () => {
    const newCondition: ConditionItem = {
      id: `cond-${Date.now()}`,
      text: "",
    };
    const updated = [...localConditions, newCondition];
    setLocalConditions(updated);
    onUpdate?.({
      conditions: updated,
      model: localModel,
      forceSelectBranch: localForceSelect,
    });
  };

  const handleModelChange = (value: string) => {
    setLocalModel(value);
    onUpdate?.({
      conditions: localConditions,
      model: value,
      forceSelectBranch: localForceSelect,
    });
  };

  const handleForceSelectChange = (checked: boolean) => {
    setLocalForceSelect(checked);
    onUpdate?.({
      conditions: localConditions,
      model: localModel,
      forceSelectBranch: checked,
    });
  };

  const handleDeleteCondition = (index: number) => {
    // Don't allow deleting if only 1 condition remains
    if (localConditions.length <= 1) return;

    // Call parent handler to remove from canvas
    onDeleteCondition?.(index);
  };

  // Get the specific condition when in branch view
  const selectedCondition = isBranchView ? localConditions[selectedBranchIndex] : null;

  // Branch view - simplified view for a single condition (like Lindy)
  if (isBranchView && selectedCondition) {
    return (
      <div className="h-full flex flex-col min-h-0">
        {/* Header - fixed, never pushed */}
        <div className="px-5 py-2.5 border-b border-[#E5E7EB] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-lg bg-violet-100 flex items-center justify-center">
                <GitBranch className="size-4 text-violet-600" weight="bold" />
              </div>
              <h3
                className="font-semibold text-[15px] text-[#1a1a1a] cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded -mx-1"
                onClick={openRenameDialog}
              >
                {nodeName}
              </h3>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-[#9CA3AF] hover:text-[#6B7280] p-1">
                  <DotsThree className="size-4" weight="bold" />
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
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <WarningCircle className="size-4" />
                  <span>Add error handling</span>
                </DropdownMenuItem>
                {localConditions.length > 1 && (
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer"
                    variant="destructive"
                    onClick={() => handleDeleteCondition(selectedBranchIndex)}
                  >
                    <Trash className="size-4" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content - simplified for branch view */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div className="space-y-2">
            <span className="text-[14px] font-medium text-[#6B7280]">
              Condition
            </span>
            <div
              className="min-h-[80px] bg-white border border-[#E5E7EB] rounded-xl p-3 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary cursor-text"
              onClick={(e) => {
                const editable = e.currentTarget.querySelector('[contenteditable]') as HTMLElement;
                editable?.focus();
              }}
            >
              <span className="text-[14px] text-[#9CA3AF]">Go down this path if </span>
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => {
                  const text = e.currentTarget.innerText || "";
                  handleConditionChange(selectedCondition.id, text);
                }}
                onInput={(e) => {
                  const text = e.currentTarget.innerText || "";
                  handleConditionChange(selectedCondition.id, text);
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const text = e.clipboardData.getData("text/plain");
                  document.execCommand("insertText", false, text);
                }}
                data-placeholder='e.g. "the customer asks to speak to a human"'
                className={`text-[14px] text-[#374151] outline-none whitespace-pre-wrap ${!selectedCondition.text ? "empty:before:content-[attr(data-placeholder)] empty:before:text-[#9CA3AF]" : ""}`}
              >
                {selectedCondition.text}
              </span>
            </div>
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

  // Full condition node view - shows all conditions and settings
  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header - fixed, never pushed */}
      <div className="px-5 py-2.5 border-b border-[#E5E7EB] shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-lg bg-violet-100 flex items-center justify-center">
              <GitBranch className="size-4 text-violet-600" weight="bold" />
            </div>
            <h3
              className="font-semibold text-[15px] text-[#1a1a1a] cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded -mx-1"
              onClick={openRenameDialog}
            >
              {nodeName}
            </h3>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-[#9CA3AF] hover:text-[#6B7280] p-1">
                <DotsThree className="size-4" weight="bold" />
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
              <DropdownMenuItem className="gap-2 cursor-pointer">
                <WarningCircle className="size-4" />
                <span>Add error handling</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer" variant="destructive">
                <Trash className="size-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* Model selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <Label className="text-[14px] font-medium text-[#374151]">Model</Label>
            <Info className="size-3.5 text-[#9CA3AF]" />
          </div>
          <Select value={localModel} onValueChange={handleModelChange}>
            <SelectTrigger className="w-full h-10 bg-white border-[#E5E7EB] rounded-lg">
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

        {/* Force select branch toggle */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label className="text-[14px] font-medium text-[#374151]">
              Force the agent to select a branch
            </Label>
            <p className="text-[12px] text-[#9CA3AF]">
              If disabled, the agent will stop the task if none of the conditions are met.
            </p>
          </div>
          <Switch
            checked={localForceSelect}
            onCheckedChange={handleForceSelectChange}
            className="data-[state=checked]:bg-primary"
          />
        </div>

        {/* Conditions list */}
        <div className="space-y-4">
          {localConditions.map((condition, index) => (
            <div key={condition.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-medium text-[#6B7280]">
                  Condition {index + 1}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="text-[#9CA3AF] hover:text-[#6B7280] p-1">
                      <DotsThree className="size-4" weight="bold" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[180px]">
                    <DropdownMenuItem
                      className="gap-2 cursor-pointer"
                      onSelect={() => {
                        const container = document.querySelector(`[data-condition-id="${condition.id}"]`);
                        const editable = container?.querySelector('[contenteditable]') as HTMLElement;
                        editable?.focus();
                      }}
                    >
                      <TextT className="size-4" />
                      <span>Rename</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={onReplace}>
                      <ArrowsClockwise className="size-4" />
                      <span>Replace</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 cursor-pointer">
                      <WarningCircle className="size-4" />
                      <span>Add error handling</span>
                    </DropdownMenuItem>
                    {localConditions.length > 1 && (
                      <DropdownMenuItem
                        className="gap-2 cursor-pointer"
                        variant="destructive"
                        onClick={() => handleDeleteCondition(index)}
                      >
                        <Trash className="size-4" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div
                data-condition-id={condition.id}
                className="min-h-[80px] bg-white border border-[#E5E7EB] rounded-xl p-3 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary cursor-text"
                onClick={(e) => {
                  const editable = e.currentTarget.querySelector('[contenteditable]') as HTMLElement;
                  editable?.focus();
                }}
              >
                <span className="text-[14px] text-[#9CA3AF]">Go down this path if </span>
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const text = e.currentTarget.innerText || "";
                    handleConditionChange(condition.id, text);
                  }}
                  onInput={(e) => {
                    const text = e.currentTarget.innerText || "";
                    handleConditionChange(condition.id, text);
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData.getData("text/plain");
                    document.execCommand("insertText", false, text);
                  }}
                  data-placeholder='e.g. "the customer asks to speak to a human"'
                  className={`text-[14px] text-[#374151] outline-none whitespace-pre-wrap ${!condition.text ? "empty:before:content-[attr(data-placeholder)] empty:before:text-[#9CA3AF]" : ""}`}
                >
                  {condition.text}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Help text */}
        <p className="text-[13px] text-[#9CA3AF]">
          Please define each condition. The agent will follow the first path which condition is met. Add examples to improve performance.
        </p>

        {/* Add Condition button */}
        <Button
          variant="outline"
          onClick={handleAddCondition}
          className="w-auto border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]"
        >
          <Plus className="size-4 mr-2" />
          Add Condition
        </Button>
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
