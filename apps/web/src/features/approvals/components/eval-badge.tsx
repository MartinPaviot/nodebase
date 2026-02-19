"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Warning, CaretDown, CaretUp } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface EvalResultSummary {
  l1Passed?: boolean;
  l2Score?: number;
  l2Passed?: boolean;
  groundingScore?: number;
  groundingPassed?: boolean;
  l3Triggered?: boolean;
  l3Passed?: boolean;
  suggestions?: string[];
  blockReason?: string;
}

interface EvalBadgeProps {
  evalResult: EvalResultSummary;
  className?: string;
}

type ConfidenceLevel = "high" | "needs_review" | "issues";

function getConfidenceLevel(evalResult: EvalResultSummary): ConfidenceLevel {
  // Issues found: L1 fail, L3 block, or grounding < 50
  if (evalResult.l1Passed === false) return "issues";
  if (evalResult.l3Triggered && evalResult.l3Passed === false) return "issues";
  if (evalResult.groundingScore !== undefined && evalResult.groundingScore < 50) return "issues";

  // High confidence: L1 pass + L2 >= 80 + grounding >= 80 + (L3 pass or not triggered)
  const l2Ok = evalResult.l2Score === undefined || evalResult.l2Score >= 80;
  const groundingOk = evalResult.groundingScore === undefined || evalResult.groundingScore >= 80;
  const l3Ok = !evalResult.l3Triggered || evalResult.l3Passed;
  if (l2Ok && groundingOk && l3Ok) return "high";

  // Everything else: needs review
  return "needs_review";
}

function getConfidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case "high": return "High confidence";
    case "needs_review": return "Needs review";
    case "issues": return "Issues found";
  }
}

function getHumanReadableIssues(evalResult: EvalResultSummary): string[] {
  const issues: string[] = [];

  if (evalResult.l1Passed === false) {
    issues.push("Required checks failed");
  }
  if (evalResult.l2Score !== undefined && evalResult.l2Score < 60) {
    issues.push("Content quality is low");
  } else if (evalResult.l2Score !== undefined && evalResult.l2Score < 80) {
    issues.push("Content quality could be improved");
  }
  if (evalResult.groundingScore !== undefined && evalResult.groundingScore < 50) {
    issues.push("Multiple facts could not be verified");
  } else if (evalResult.groundingScore !== undefined && evalResult.groundingScore < 80) {
    issues.push("Some facts could not be verified");
  }
  if (evalResult.l3Triggered && evalResult.l3Passed === false) {
    issues.push(evalResult.blockReason?.replace(/^L3 blocked: /, "") || "AI review flagged concerns");
  }

  return issues;
}

export function EvalBadge({ evalResult, className }: EvalBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const level = getConfidenceLevel(evalResult);
  const issues = getHumanReadableIssues(evalResult);

  const colorMap = {
    high: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
    needs_review: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    issues: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  };

  const iconMap = {
    high: <CheckCircle weight="fill" className="size-4" />,
    needs_review: <Warning weight="fill" className="size-4" />,
    issues: <XCircle weight="fill" className="size-4" />,
  };

  return (
    <div className={cn("rounded-lg text-sm", className)}>
      {/* Main badge */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg w-full text-left",
          colorMap[level],
        )}
      >
        {iconMap[level]}
        <span className="font-medium">{getConfidenceLabel(level)}</span>
        {issues.length > 0 && (
          <span className="opacity-70 truncate flex-1">
            — {issues[0]}
          </span>
        )}
        {expanded ? (
          <CaretUp className="size-3.5 ml-auto shrink-0" />
        ) : (
          <CaretDown className="size-3.5 ml-auto shrink-0" />
        )}
      </button>

      {/* Expandable details */}
      {expanded && (
        <div className="mt-2 px-3 space-y-2 text-xs text-muted-foreground">
          {/* Human-readable issues */}
          {issues.length > 0 && (
            <ul className="space-y-1">
              {issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <Warning weight="fill" className="size-3 mt-0.5 text-amber-500 shrink-0" />
                  {issue}
                </li>
              ))}
            </ul>
          )}

          {/* Technical details */}
          <div className="border-t pt-2 space-y-1">
            <p className="font-medium text-foreground/70">Details</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {evalResult.l1Passed !== undefined && (
                <div className="flex items-center gap-1">
                  {evalResult.l1Passed ? (
                    <CheckCircle weight="fill" className="size-3 text-green-500" />
                  ) : (
                    <XCircle weight="fill" className="size-3 text-red-500" />
                  )}
                  Assertions (L1)
                </div>
              )}
              {evalResult.l2Score !== undefined && (
                <div className="flex items-center gap-1.5">
                  <div className="w-10 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        evalResult.l2Score >= 80 ? "bg-green-500" : evalResult.l2Score >= 60 ? "bg-yellow-500" : "bg-red-500",
                      )}
                      style={{ width: `${Math.min(100, evalResult.l2Score)}%` }}
                    />
                  </div>
                  Quality (L2): {evalResult.l2Score}
                </div>
              )}
              {evalResult.groundingScore !== undefined && (
                <div className="flex items-center gap-1.5">
                  <div className="w-10 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        evalResult.groundingScore >= 80 ? "bg-green-500" : evalResult.groundingScore >= 50 ? "bg-yellow-500" : "bg-red-500",
                      )}
                      style={{ width: `${Math.min(100, evalResult.groundingScore)}%` }}
                    />
                  </div>
                  Fact-check: {evalResult.groundingScore}%
                </div>
              )}
              {evalResult.l3Triggered && (
                <div className="flex items-center gap-1">
                  {evalResult.l3Passed ? (
                    <CheckCircle weight="fill" className="size-3 text-green-500" />
                  ) : (
                    <Warning weight="fill" className="size-3 text-red-500" />
                  )}
                  AI Review (L3)
                </div>
              )}
            </div>
          </div>

          {/* Suggestions */}
          {evalResult.suggestions && evalResult.suggestions.length > 0 && (
            <div className="border-t pt-2">
              <p className="font-medium text-foreground/70 mb-1">Suggestions</p>
              <ul className="space-y-0.5">
                {evalResult.suggestions.map((s, i) => (
                  <li key={i} className="text-muted-foreground">• {s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
