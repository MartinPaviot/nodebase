"use client";

/**
 * Inject Data Sidebar
 *
 * Reusable sidebar component that shows upstream nodes and their output fields.
 * When a field is clicked, it inserts a {{nodeId.fieldId}} token at the cursor
 * position of the focused textarea.
 *
 * Used by action-node-settings, condition-settings, flow-node-panel, etc.
 */

import { useState, useCallback, useRef, type RefObject } from "react";
import {
  CaretRight,
  MagnifyingGlass,
  Chats,
  Robot,
  GitBranch,
  Gear,
  MagnifyingGlassMinus,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { Icon } from "@iconify/react";
import type { UpstreamNode } from "../lib/flow-graph-utils";

// ── Props ─────────────────────────────────────────────────────────

export interface InjectDataSidebarProps {
  /** Upstream nodes computed via getUpstreamNodes() */
  upstreamNodes: UpstreamNode[];
  /** Called when a field is clicked — parent inserts the token */
  onInject: (nodeId: string, fieldId: string) => void;
  /** Whether the sidebar is visible (e.g., when a text field is focused) */
  visible: boolean;
}

// ── Icon helpers ──────────────────────────────────────────────────

function getNodeIcon(type: string, icon?: string) {
  // If the node has a specific icon (e.g., Composio action with "perplexity")
  if (icon) {
    const iconMap: Record<string, string> = {
      perplexity: "simple-icons:perplexity",
      google: "logos:google-icon",
      youtube: "logos:youtube-icon",
      linkedin: "logos:linkedin-icon",
      ai: "ph:sparkle-fill",
      gmail: "logos:google-gmail",
      slack: "logos:slack-icon",
      notion: "simple-icons:notion",
      hubspot: "logos:hubspot",
    };
    if (iconMap[icon]) {
      return <Icon icon={iconMap[icon]} className="size-3.5" />;
    }
    // Try iconify directly
    return <Icon icon={icon} className="size-3.5" />;
  }

  // Fall back to type-based icons
  switch (type) {
    case "messageReceived":
    case "trigger":
    case "webhookTrigger":
      return <Chats className="size-3.5 text-blue-600" weight="fill" />;
    case "chatAgent":
      return <Chats className="size-3.5 text-blue-600" weight="fill" />;
    case "agentStep":
      return <Robot className="size-3.5 text-indigo-600" weight="fill" />;
    case "condition":
      return <GitBranch className="size-3.5 text-violet-600" weight="bold" />;
    case "enterLoop":
      return <ArrowsClockwise className="size-3.5 text-orange-600" weight="bold" />;
    case "searchKnowledgeBase":
      return <MagnifyingGlassMinus className="size-3.5 text-emerald-600" weight="bold" />;
    case "action":
    case "composioAction":
      return <Gear className="size-3.5 text-gray-600" />;
    default:
      return <Gear className="size-3.5 text-gray-600" />;
  }
}

function getNodeIconBg(type: string) {
  switch (type) {
    case "messageReceived":
    case "trigger":
    case "webhookTrigger":
    case "chatAgent":
      return "bg-blue-100";
    case "agentStep":
      return "bg-indigo-100";
    case "condition":
      return "bg-violet-100";
    case "enterLoop":
      return "bg-orange-100";
    case "searchKnowledgeBase":
      return "bg-emerald-100";
    case "action":
    case "composioAction":
      return "bg-gray-100";
    default:
      return "bg-gray-100";
  }
}

// ── Component ─────────────────────────────────────────────────────

export function InjectDataSidebar({
  upstreamNodes,
  onInject,
  visible,
}: InjectDataSidebarProps) {
  const [expandedSteps, setExpandedSteps] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const toggleStep = useCallback((stepId: string) => {
    setExpandedSteps((prev) =>
      prev.includes(stepId)
        ? prev.filter((id) => id !== stepId)
        : [...prev, stepId]
    );
  }, []);

  if (!visible || upstreamNodes.length === 0) return null;

  // Filter nodes and fields based on search
  const filteredNodes = search.trim()
    ? upstreamNodes.filter((node) => {
        const q = search.toLowerCase();
        if (node.label.toLowerCase().includes(q)) return true;
        return node.fields.some((f) => f.label.toLowerCase().includes(q));
      })
    : upstreamNodes;

  return (
    <div
      className="absolute right-full top-[60px] w-[240px] min-h-[200px] max-h-[500px] border border-[#E5E7EB] rounded-xl bg-white shadow-xl z-50 flex flex-col animate-in slide-in-from-right-2 duration-200 mr-3"
      onMouseDown={(e) => e.preventDefault()} // Prevent losing textarea focus
    >
      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#9CA3AF]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="w-full h-9 pl-9 pr-3 text-[13px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {/* Header */}
      <div className="px-4 py-2 border-t border-[#E5E7EB]">
        <span className="text-[12px] font-medium text-[#6B7280]">
          Inject data from previous steps
        </span>
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {filteredNodes.length === 0 && (
          <div className="text-xs text-[#9CA3AF] text-center py-4">
            No matching steps
          </div>
        )}

        {filteredNodes.map((node) => (
          <div key={node.id}>
            <button
              onClick={() => toggleStep(node.id)}
              className="flex items-center gap-2.5 w-full px-2 py-2.5 hover:bg-[#F3F4F6] rounded-lg transition-colors text-left"
            >
              <CaretRight
                className={`size-3.5 text-[#9CA3AF] transition-transform ${
                  expandedSteps.includes(node.id) ? "rotate-90" : ""
                }`}
                weight="bold"
              />
              <div
                className={`size-6 rounded-md flex items-center justify-center ${getNodeIconBg(
                  node.type
                )}`}
              >
                {getNodeIcon(node.type, node.icon)}
              </div>
              <span className="text-[13px] font-medium text-[#374151] truncate flex-1">
                {node.label}
              </span>
              <span className="text-[10px] text-[#9CA3AF] tabular-nums shrink-0">
                #{node.stepNumber}
              </span>
            </button>

            {/* Expanded fields */}
            {expandedSteps.includes(node.id) && (
              <div className="ml-8 pl-3 border-l-2 border-[#E5E7EB] space-y-1 mt-1 mb-2">
                {node.fields
                  .filter(
                    (f) =>
                      !search.trim() ||
                      f.label.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((field) => (
                    <button
                      key={field.id}
                      onClick={() => onInject(node.id, field.id)}
                      className="flex items-center gap-2 w-full px-2 py-2 hover:bg-blue-50 rounded-lg text-left text-[12px] text-[#6B7280] hover:text-blue-600 transition-colors"
                    >
                      <span className="text-[10px] text-[#9CA3AF] font-mono">
                        {field.type}
                      </span>
                      <span>{field.label}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Injection helper ──────────────────────────────────────────────

/**
 * Inserts a {{nodeId.fieldId}} token at the cursor position in a textarea.
 * Returns the new value string.
 */
export function insertTokenAtCursor(
  textarea: HTMLTextAreaElement | null,
  currentValue: string,
  nodeId: string,
  fieldId: string,
): { newValue: string; cursorPos: number } {
  const token = `{{${nodeId}.${fieldId}}}`;

  if (textarea) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = currentValue.slice(0, start) + token + currentValue.slice(end);
    return { newValue, cursorPos: start + token.length };
  }

  // Fallback: append
  return { newValue: currentValue + token, cursorPos: (currentValue + token).length };
}
