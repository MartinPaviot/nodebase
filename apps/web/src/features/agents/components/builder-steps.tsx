"use client";

import { Check, CircleNotch, CaretRight, ArrowCounterClockwise } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface BuilderStep {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "error";
  expandable?: boolean;
  hasUndo?: boolean;
}

interface BuilderStepsProps {
  steps: BuilderStep[];
  onStepClick?: (stepId: string) => void;
  onUndo?: (stepId: string) => void;
}

export function BuilderSteps({ steps, onStepClick, onUndo }: BuilderStepsProps) {
  if (steps.length === 0) return null;

  return (
    <div className="space-y-1 my-2">
      {steps.map((step) => (
        <div
          key={step.id}
          className={cn(
            "flex items-center gap-2 text-sm py-0.5",
            step.status === "error" && "text-destructive"
          )}
        >
          {/* Status icon */}
          <div className="size-4 flex items-center justify-center shrink-0">
            {step.status === "completed" && (
              <Check className="size-4 text-emerald-600" />
            )}
            {step.status === "running" && (
              <CircleNotch className="size-4 text-primary animate-spin" />
            )}
            {step.status === "pending" && (
              <div className="size-2 rounded-full bg-muted-foreground/30" />
            )}
            {step.status === "error" && (
              <div className="size-4 rounded-full bg-destructive/20 flex items-center justify-center">
                <span className="text-[10px] text-destructive">!</span>
              </div>
            )}
          </div>

          {/* Label */}
          <span
            className={cn(
              "flex-1",
              step.status === "completed" && "text-muted-foreground",
              step.status === "running" && "text-foreground font-medium"
            )}
          >
            {step.label}
          </span>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {step.hasUndo && step.status === "completed" && onUndo && (
              <button
                onClick={() => onUndo(step.id)}
                className="p-0.5 hover:bg-muted rounded transition-colors"
                title="Undo"
              >
                <ArrowCounterClockwise className="size-3.5 text-muted-foreground" />
              </button>
            )}
            {step.expandable && (
              <button
                onClick={() => onStepClick?.(step.id)}
                className="p-0.5 hover:bg-muted rounded transition-colors"
              >
                <CaretRight className="size-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Preset step configurations for common builder flows
export const AGENT_BUILD_STEPS: Omit<BuilderStep, "status">[] = [
  { id: "view_agent", label: "Viewing current agent" },
  { id: "get_actions", label: "Getting actions for Chat with this Agent" },
  { id: "get_details", label: "Getting actions details" },
  { id: "update_agent", label: "Update Agent", expandable: true, hasUndo: true },
  { id: "view_updated", label: "Viewing current agent" },
  { id: "update_settings", label: "Update Agent Settings", expandable: true },
];
