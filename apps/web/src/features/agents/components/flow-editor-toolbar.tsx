"use client";

import {
  Sparkle,
  Plus,
  ArrowUUpLeft,
  ArrowUUpRight,
  MagicWand,
  Scan,
  Eraser,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface FlowEditorToolbarProps {
  onAsk: () => void;
  onAdd: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAutoLayout: () => void;
  onFitView: () => void;
  onClearLastRun?: () => void;
  hasLastRun?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
}

export function FlowEditorToolbar({
  onAsk,
  onAdd,
  onUndo,
  onRedo,
  onAutoLayout,
  onFitView,
  onClearLastRun,
  hasLastRun = false,
  canUndo = false,
  canRedo = false,
}: FlowEditorToolbarProps) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 max-w-[calc(100%-2rem)]">
      <div className="flex items-center gap-1 bg-white border border-[#E5E7EB] rounded-2xl px-2 py-1.5 shadow-lg">
        {/* Ask button - Brand blue */}
        <button
          onClick={onAsk}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-primary hover:bg-primary/10 transition-colors"
        >
          <Sparkle className="size-4" />
          <span className="text-sm font-medium">Ask</span>
        </button>

        <Divider />

        {/* Clear last run */}
        {hasLastRun && onClearLastRun && (
          <>
            <button
              onClick={onClearLastRun}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors"
            >
              <Eraser className="size-4" />
              <span className="text-xs font-medium">Clear run</span>
            </button>
            <Divider />
          </>
        )}

        {/* Add node */}
        <ToolbarButton onClick={onAdd}>
          <Plus className="size-4" />
        </ToolbarButton>

        <Divider />

        {/* Undo/Redo */}
        <ToolbarButton onClick={onUndo} disabled={!canUndo}>
          <ArrowUUpLeft className="size-4" />
        </ToolbarButton>
        <ToolbarButton onClick={onRedo} disabled={!canRedo}>
          <ArrowUUpRight className="size-4" />
        </ToolbarButton>

        <Divider />

        {/* Auto layout / Magic wand */}
        <ToolbarButton onClick={onAutoLayout}>
          <MagicWand className="size-4" />
        </ToolbarButton>

        {/* Fit view */}
        <ToolbarButton onClick={onFitView}>
          <Scan className="size-4" />
        </ToolbarButton>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-[#E5E7EB] mx-0.5" />;
}

interface ToolbarButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

function ToolbarButton({ children, onClick, disabled }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "size-8 rounded-lg flex items-center justify-center transition-colors",
        disabled
          ? "text-[#D1D5DB] cursor-not-allowed"
          : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151]"
      )}
    >
      {children}
    </button>
  );
}
