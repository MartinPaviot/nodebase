"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { useComposioActions } from "@/hooks/use-composio";
import { formatComposioActionName } from "@/lib/composio-action-names";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AppWithActionsPreviewProps {
  appKey: string;
  appName: string;
  appLogo?: string;
  autoExpand?: boolean;
  maxActions?: number;
  onSelectAction: (actionName: string, actionData: { name: string; description: string }) => void;
  onViewAllActions: () => void;
}

export function AppWithActionsPreview({
  appKey,
  appName,
  appLogo,
  autoExpand = false,
  maxActions = 5,
  onSelectAction,
  onViewAllActions,
}: AppWithActionsPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(autoExpand);
  const actionsQuery = useComposioActions(isExpanded ? appKey : null);
  const actions = actionsQuery.data || [];

  const displayedActions = actions.slice(0, maxActions);
  const hasMore = actions.length > maxActions;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isExpanded) {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  };

  const handleActionClick = (action: { name: string; description: string }) => {
    onSelectAction(action.name, { name: action.name, description: action.description });
  };

  return (
    <div className="w-full">
      {/* App header */}
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 w-full px-1 py-1.5 rounded-md hover:bg-muted/50 transition-colors text-left group"
      >
        <div className="size-4 flex items-center justify-center shrink-0">
          {appLogo ? (
            <img src={appLogo} alt={appName} className="size-4 object-contain" />
          ) : (
            <Icon icon="ph:app-window" className="size-4" />
          )}
        </div>
        <span className="text-sm text-foreground flex-1">{appName}</span>
        {isExpanded ? (
          <CaretDown className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" weight="bold" />
        ) : (
          <CaretRight className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" weight="bold" />
        )}
      </button>

      {/* Actions list */}
      {isExpanded && (
        <div className="ml-6 mt-1 space-y-0.5">
          {actionsQuery.isLoading ? (
            <div className="space-y-1 py-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : actions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">No actions available</p>
          ) : (
            <>
              {displayedActions.map((action) => (
                <button
                  key={action.name}
                  onClick={() => handleActionClick(action)}
                  className={cn(
                    "w-full text-left px-2 py-1 rounded text-xs",
                    "hover:bg-primary/10 hover:text-primary transition-colors",
                    "flex items-start gap-2"
                  )}
                >
                  <Icon icon="ph:lightning" className="size-3 mt-0.5 shrink-0 opacity-60" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{formatComposioActionName(action.name)}</div>
                    {action.description && (
                      <div className="text-muted-foreground line-clamp-1 text-[11px] mt-0.5">
                        {action.description}
                      </div>
                    )}
                  </div>
                </button>
              ))}
              {hasMore && (
                <button
                  onClick={onViewAllActions}
                  className="w-full text-left px-2 py-1 rounded text-xs text-primary hover:bg-primary/10 transition-colors font-medium"
                >
                  View all {actions.length} actions →
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
