"use client";

import { cn } from "@/lib/utils";

interface Suggestion {
  id: string;
  label: string;
}

interface SuggestionsListProps {
  suggestions: Suggestion[];
  onSelect: (suggestion: Suggestion) => void;
  className?: string;
}

export function SuggestionsList({
  suggestions,
  onSelect,
  className,
}: SuggestionsListProps) {
  if (suggestions.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/30 p-3 font-mono text-sm space-y-1",
        className
      )}
    >
      {suggestions.map((suggestion, index) => (
        <button
          key={suggestion.id}
          onClick={() => onSelect(suggestion)}
          className="flex items-start gap-2 w-full text-left hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors"
        >
          <span className="text-primary font-semibold shrink-0 w-4">
            {index + 1}
          </span>
          <span className="text-foreground">{suggestion.label}</span>
        </button>
      ))}
    </div>
  );
}

// Quick action buttons variant
interface QuickSuggestion {
  id: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
}

interface QuickSuggestionsProps {
  suggestions: QuickSuggestion[];
  onSelect: (suggestion: QuickSuggestion) => void;
  className?: string;
}

export function QuickSuggestions({
  suggestions,
  onSelect,
  className,
}: QuickSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.id}
          onClick={() => onSelect(suggestion)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border bg-card",
            "hover:bg-muted/50 transition-colors text-sm"
          )}
        >
          {suggestion.icon && (
            <span className={suggestion.color}>{suggestion.icon}</span>
          )}
          <span>{suggestion.label}</span>
        </button>
      ))}
    </div>
  );
}
