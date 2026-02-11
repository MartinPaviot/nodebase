"use client";

import Link from "next/link";
import { Robot } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface AgentCardProps {
  agentId: string;
  agentName: string;
  agentIcon?: string;
  iconColor?: string;
  className?: string;
}

export function AgentCard({
  agentId,
  agentName,
  agentIcon,
  iconColor = "#6366F1",
  className,
}: AgentCardProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-xl border bg-card",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className="size-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${iconColor}20` }}
        >
          {agentIcon ? (
            <span className="text-base">{agentIcon}</span>
          ) : (
            <Robot className="size-4" style={{ color: iconColor }} />
          )}
        </div>
        <span className="font-medium text-sm">{agentName}</span>
      </div>
      <Link
        href={`/agents/${agentId}`}
        className="text-sm text-primary hover:underline font-medium"
      >
        Go to Agent
      </Link>
    </div>
  );
}

// Variant for showing agent being built with progress
interface AgentBuildingCardProps {
  agentName: string;
  status: "building" | "ready" | "error";
  agentId?: string;
  iconColor?: string;
}

export function AgentBuildingCard({
  agentName,
  status,
  agentId,
  iconColor = "#6366F1",
}: AgentBuildingCardProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border bg-indigo-50 border-indigo-200">
      <div className="flex items-center gap-3">
        <div
          className="size-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: iconColor }}
        >
          <Robot className="size-4 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-sm">
            {status === "building" ? "Building agent..." : agentName}
          </span>
          {status === "building" && (
            <span className="text-xs text-muted-foreground">
              Please wait...
            </span>
          )}
        </div>
      </div>
      {status === "ready" && agentId && (
        <Link
          href={`/agents/${agentId}`}
          className="text-sm text-primary hover:underline font-medium"
        >
          Go to Agent
        </Link>
      )}
      {status === "error" && (
        <span className="text-sm text-destructive">Failed</span>
      )}
    </div>
  );
}
