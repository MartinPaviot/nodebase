"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { type GoogleApp } from "@/lib/google-actions-registry";

interface GoogleAppActionsProps {
  app: GoogleApp;
  isConnected: boolean;
  onSelectAction: (actionKey: string, actionData: { name: string; description: string }) => void;
  onConnect: (integrationType: string) => void;
  disabled?: boolean;
}

export function GoogleAppActions({
  app,
  isConnected,
  onSelectAction,
  onConnect,
  disabled,
}: GoogleAppActionsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="w-full">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full px-1 py-1.5 rounded-md hover:bg-muted/50 transition-colors text-left group"
      >
        <div className="size-4 flex items-center justify-center shrink-0">
          <Icon icon={app.icon} className="size-4" />
        </div>
        <span className="text-sm text-foreground flex-1">{app.name}</span>
        {isConnected ? (
          <span className="size-2 rounded-full bg-emerald-500 shrink-0" title="Connected" />
        ) : (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground border-muted-foreground/30">
            Not connected
          </Badge>
        )}
        {isExpanded ? (
          <CaretDown className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" weight="bold" />
        ) : (
          <CaretRight className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" weight="bold" />
        )}
      </button>

      {isExpanded && (
        <div className="ml-6 mt-1 space-y-0.5">
          {isConnected ? (
            app.actions.map((action) => (
              <button
                key={action.key}
                onClick={() => onSelectAction(action.key, { name: action.name, description: action.description })}
                disabled={disabled}
                className={cn(
                  "w-full text-left px-2 py-1 rounded text-xs",
                  "hover:bg-primary/10 hover:text-primary transition-colors",
                  "flex items-start gap-2",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <Icon icon="ph:lightning" className="size-3 mt-0.5 shrink-0 opacity-60" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{action.name}</div>
                  <div className="text-muted-foreground line-clamp-1 text-[11px] mt-0.5">
                    {action.description}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="py-2 px-2">
              <p className="text-xs text-muted-foreground mb-2">
                Connect {app.name} to use these actions
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onConnect(app.integrationType);
                }}
              >
                Connect {app.name}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
