"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { createPortal } from "react-dom";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  type OnSelectionChangeFunc,
  type EdgeProps,
  Handle,
  Position,
  SelectionMode,
  getBezierPath,
  BaseEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Chats,
  Robot,
  Lightning,
  Plus,
  MagnifyingGlass,
  GitBranch,
  Sparkle,
  Warning,
  ArrowsClockwise,
  Envelope,
  Play,
  Stop,
  Table,
  PaperPlaneTilt,
  Note,
  CaretUp,
  DotsThree,
} from "@phosphor-icons/react";
import { Icon } from "@iconify/react";
import { AddActionModal } from "./add-action-modal";
import { SelectKnowledgeBaseModal } from "./select-knowledge-base-modal";
import { PDLIcon } from "@/components/icons/pdl-icon";

// Standard node width for consistency
const NODE_WIDTH = 200;

// Icons for menu options
import { TextT, ShieldCheck, Sliders, Trash } from "@phosphor-icons/react";

// Node type determines which menu options are shown
type NodeMenuType = "action" | "condition" | "trigger" | "branch" | "outcome";

// Dropdown menu component for node actions (Rename, Replace, etc.)
function NodeOptionsMenu({
  type = "action",
  buttonRef,
  onClose,
  onRename,
  onReplace,
  onAddErrorHandling,
  onSetFieldsToManual,
  onDelete,
}: {
  type?: NodeMenuType;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onRename?: () => void;
  onReplace?: () => void;
  onAddErrorHandling?: () => void;
  onSetFieldsToManual?: () => void;
  onDelete?: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Calculate position from button ref
  useEffect(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top,
        left: rect.right + 4,
      });
    }
  }, [buttonRef]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as globalThis.Node)) {
        onClose();
      }
    };

    // Add listener with a small delay to avoid immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Action nodes have "Set all fields to Manual" option
  const showSetFieldsOption = type === "action";

  const handleRename = () => {
    onRename?.();
    onClose();
  };

  const handleReplace = () => {
    if (onReplace) {
      onReplace();
    } else {
      onClose();
    }
  };

  const handleAddErrorHandling = () => {
    onAddErrorHandling?.();
    onClose();
  };

  const handleSetFieldsToManual = () => {
    onSetFieldsToManual?.();
    onClose();
  };

  const handleDelete = () => {
    onDelete?.();
    onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed w-[200px] bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden py-1"
      style={{ top: position.top, left: position.left, zIndex: 9999 }}
    >
      <button
        onClick={handleRename}
        className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-50 text-left"
      >
        <TextT className="size-4 text-gray-500" weight="regular" />
        <span className="text-sm text-gray-700">Rename</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); handleReplace(); }}
        className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-50 text-left"
      >
        <ArrowsClockwise className="size-4 text-gray-500" weight="regular" />
        <span className="text-sm text-gray-700">Replace</span>
      </button>
      <button
        onClick={handleAddErrorHandling}
        className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-50 text-left"
      >
        <ShieldCheck className="size-4 text-gray-500" weight="regular" />
        <span className="text-sm text-gray-700">Add error handling</span>
      </button>
      {showSetFieldsOption && (
        <button
          onClick={handleSetFieldsToManual}
          className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-50 text-left"
        >
          <Sliders className="size-4 text-gray-500" weight="regular" />
          <span className="text-sm text-gray-700">Set all fields to Manual</span>
        </button>
      )}
      <button
        onClick={handleDelete}
        className="flex items-center gap-3 w-full px-3 py-2 hover:bg-red-50 text-left"
      >
        <Trash className="size-4 text-red-500" weight="regular" />
        <span className="text-sm text-red-600">Delete</span>
      </button>
    </div>,
    document.body
  );
}

// Real integration icons using Iconify
const INTEGRATION_ICONS: Record<string, { icon: string; label: string }> = {
  gmail: { icon: "logos:google-gmail", label: "Gmail" },
  "google-calendar": { icon: "logos:google-calendar", label: "Google Calendar" },
  "google-sheets": { icon: "logos:google-sheets", label: "Google Sheets" },
  slack: { icon: "logos:slack-icon", label: "Slack" },
  notion: { icon: "simple-icons:notion", label: "Notion" },
  hubspot: { icon: "logos:hubspot", label: "HubSpot" },
  salesforce: { icon: "logos:salesforce", label: "Salesforce" },
  stripe: { icon: "logos:stripe", label: "Stripe" },
  github: { icon: "mdi:github", label: "GitHub" },
  discord: { icon: "logos:discord-icon", label: "Discord" },
  perplexity: { icon: "ph:compass-duotone", label: "Perplexity" },
  browser: { icon: "ph:globe-duotone", label: "Browser" },
  code: { icon: "ph:code-duotone", label: "Code" },
  channels: { icon: "ph:chat-circle-dots-duotone", label: "Channels" },
};

// Message Received Node (Trigger) - Sleek minimal design
function MessageReceivedNode({ selected }: { selected?: boolean }) {
  const [showOptions, setShowOptions] = useState(false);
  const optionsBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div
      className={`bg-white rounded-xl px-3 py-2 shadow-sm hover:shadow transition-shadow ${
        selected ? "border-2 border-cyan-400" : "border border-slate-200/80"
      }`}
      style={{ width: NODE_WIDTH }}
    >
      <div className="flex items-center gap-2">
        <div className="size-6 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
          <Chats className="size-3.5 text-white" weight="fill" />
        </div>
        <span className="font-medium text-slate-700 text-xs flex-1 text-left truncate">Message Received</span>
        <div className="relative flex-shrink-0">
          <button
            ref={optionsBtnRef}
            onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
            className="text-slate-400 hover:text-slate-600 p-0.5 flex items-center justify-center"
          >
            <DotsThree className="size-4" weight="bold" />
          </button>
          {showOptions && <NodeOptionsMenu type="trigger" buttonRef={optionsBtnRef} onClose={() => setShowOptions(false)} />}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-blue-500 !border-white !border-2 !size-2.5 !-bottom-1"
      />
    </div>
  );
}

// Chat Agent Node - for "Chat with this Agent" actions (Observe messages / Send message)
function ChatAgentNode({ id, data, selected }: { id: string; data: { label?: string; variant?: "observe" | "send"; hasOutgoingEdge?: boolean; onSelectAction?: (actionId: string, sourceNodeId?: string) => void; onOpenReplaceModal?: (nodeId: string) => void }; selected?: boolean }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const optionsBtnRef = useRef<HTMLButtonElement>(null);
  const variant = data.variant || "observe";
  const label = data.label || (variant === "observe" ? "Observe messages" : "Send message");

  const menuItems = [
    { id: "action", label: "Perform an action", icon: Sparkle, color: "text-pink-500" },
    { id: "knowledge-base", label: "Search knowledge base", icon: MagnifyingGlass, color: "text-blue-500" },
    { id: "loop", label: "Enter loop", icon: ArrowsClockwise, color: "text-teal-500" },
    { id: "condition", label: "Condition", icon: GitBranch, color: "text-violet-500" },
    { id: "agent-step", label: "Enter agent step", icon: Robot, color: "text-blue-500" },
  ];

  const handleSelect = (actionId: string) => {
    setShowMenu(false);
    data.onSelectAction?.(actionId, id);
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className={`bg-white rounded-xl px-3 py-2 shadow-sm hover:shadow transition-shadow ${
          selected ? "border-2 border-cyan-400" : "border border-blue-200"
        }`}
        style={{ width: NODE_WIDTH }}
      >
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
            <Chats className="size-3.5 text-white" weight="fill" />
          </div>
          <span className="font-medium text-slate-700 text-xs flex-1 text-left truncate">{label}</span>
          <div className="relative flex-shrink-0">
            <button
              ref={optionsBtnRef}
              onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
              className="text-slate-400 hover:text-slate-600 p-0.5 flex items-center justify-center"
            >
              <DotsThree className="size-4" weight="bold" />
            </button>
            {showOptions && (
              <NodeOptionsMenu
                type="action"
                buttonRef={optionsBtnRef}
                onClose={() => setShowOptions(false)}
                onReplace={() => {
                  setShowOptions(false);
                  data.onOpenReplaceModal?.(id);
                }}
              />
            )}
          </div>
        </div>

        <Handle
          type="target"
          position={Position.Top}
          className="!bg-blue-500 !border-white !border-2 !size-2.5 !-top-1"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-blue-500 !border-white !border-2 !size-2.5 !-bottom-1"
        />
      </div>

      {/* Integrated add button with menu - only show if no outgoing edge */}
      {!data.hasOutgoingEdge && (
        <div className="relative mt-2 flex flex-col items-center">
          {/* Dotted line connecting to the "+" button */}
          <div
            className="h-5 w-0 border-l border-dashed border-slate-300"
            style={{ borderLeftWidth: '1.5px' }}
          />
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="size-5 rounded-full bg-white border-2 border-cyan-400 flex items-center justify-center hover:bg-cyan-50 transition-all shadow-sm"
          >
            <Plus className="size-3 text-cyan-500" weight="bold" />
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[220px] bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                <span className="text-xs text-gray-500 font-medium">Select next step</span>
              </div>
              <div className="py-0.5">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className={`size-3.5 ${item.color}`} weight="fill" />
                      <span className="text-xs text-gray-700">{item.label}</span>
                    </div>
                    <Plus className="size-3 text-gray-300" weight="bold" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Extended AgentStepData with integrated "+" button props
interface AgentStepDataExtended extends AgentStepData {
  hasOutgoingEdge?: boolean;
  onSelectAction?: (actionId: string, sourceNodeId?: string) => void;
  onOpenReplaceModal?: (nodeId: string) => void;
}

// Agent Step Node - Compact Lindy-style design
function AgentStepNode({ id, data, selected }: { id: string; data: AgentStepDataExtended; selected?: boolean }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const optionsBtnRef = useRef<HTMLButtonElement>(null);

  const menuItems = [
    { id: "action", label: "Perform an action", icon: Sparkle, color: "text-pink-500" },
    { id: "knowledge-base", label: "Search knowledge base", icon: MagnifyingGlass, color: "text-blue-500" },
    { id: "loop", label: "Enter loop", icon: ArrowsClockwise, color: "text-teal-500" },
    { id: "condition", label: "Condition", icon: GitBranch, color: "text-violet-500" },
    { id: "agent-step", label: "Enter agent step", icon: Robot, color: "text-blue-500" },
  ];

  const handleSelect = (actionId: string) => {
    setShowMenu(false);
    data.onSelectAction?.(actionId, id);
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className={`bg-white rounded-xl px-3 py-2.5 shadow-sm hover:shadow transition-all ${
          selected ? "border-2 border-cyan-400" : "border border-slate-200/80"
        }`}
        style={{ width: NODE_WIDTH }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          <div className="size-5 rounded bg-indigo-500 flex items-center justify-center flex-shrink-0">
            <Robot className="size-3 text-white" weight="fill" />
          </div>
          <span className="font-medium text-slate-700 text-xs flex-1 text-left truncate">Agent Step</span>
          <div className="relative flex-shrink-0">
            <button
              ref={optionsBtnRef}
              onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
              className="text-slate-400 hover:text-slate-600 p-0.5 flex items-center justify-center"
            >
              <DotsThree className="size-4" weight="bold" />
            </button>
            {showOptions && (
              <NodeOptionsMenu
                type="action"
                buttonRef={optionsBtnRef}
                onClose={() => setShowOptions(false)}
                onReplace={() => {
                  setShowOptions(false);
                  data.onOpenReplaceModal?.(id);
                }}
              />
            )}
          </div>
        </div>

        {/* Role description */}
        {data.rolePreview && (
          <p className="text-[10px] text-slate-500 mb-2">
            <span className="text-slate-400">&lt;role&gt;</span> {data.rolePreview}...
          </p>
        )}

        {/* Integration icons */}
        {data.integrations && data.integrations.length > 0 && (
          <div className="flex items-center gap-1">
            {data.integrations.slice(0, 6).map((integration, i) => {
              const config = INTEGRATION_ICONS[integration.toLowerCase()];
              return (
                <div
                  key={i}
                  className="size-5 rounded flex items-center justify-center bg-slate-50"
                  title={config?.label || integration}
                >
                  {config ? (
                    <Icon icon={config.icon} className="size-3.5" />
                  ) : (
                    <Lightning className="size-3 text-slate-400" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Handle
          type="target"
          position={Position.Top}
          className="!bg-indigo-500 !border-white !border-2 !size-2.5 !-top-1"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-indigo-500 !border-white !border-2 !size-2.5 !-bottom-1"
        />
      </div>

      {/* Integrated add button with menu - only show if no outgoing edge */}
      {!data.hasOutgoingEdge && (
        <div className="relative mt-2 flex flex-col items-center">
          <div
            className="h-5 w-0 border-l border-dashed border-slate-300"
            style={{ borderLeftWidth: '1.5px' }}
          />
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="size-5 rounded-full bg-white border-2 border-cyan-400 flex items-center justify-center hover:bg-cyan-50 transition-all shadow-sm"
          >
            <Plus className="size-3 text-cyan-500" weight="bold" />
          </button>

          {showMenu && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[220px] bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                <span className="text-xs text-gray-500 font-medium">Select next step</span>
              </div>
              <div className="py-0.5">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className={`size-3.5 ${item.color}`} weight="fill" />
                      <span className="text-xs text-gray-700">{item.label}</span>
                    </div>
                    <Plus className="size-3 text-gray-300" weight="bold" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Add Node Button with dropdown menu - Lindy style
function AddNodePlaceholder({ data }: { data: { onSelectAction?: (actionId: string) => void } }) {
  const [showMenu, setShowMenu] = useState(false);

  const menuItems = [
    { id: "action", label: "Perform an action", icon: Sparkle, color: "text-pink-500" },
    { id: "knowledge-base", label: "Search knowledge base", icon: MagnifyingGlass, color: "text-blue-500" },
    { id: "loop", label: "Enter loop", icon: ArrowsClockwise, color: "text-teal-500" },
    { id: "condition", label: "Condition", icon: GitBranch, color: "text-violet-500" },
    { id: "agent-step", label: "Enter agent step", icon: Robot, color: "text-blue-500" },
  ];

  const handleSelect = (actionId: string) => {
    setShowMenu(false);
    data.onSelectAction?.(actionId);
  };

  return (
    <div className="relative">
      {/* Plus button - cyan circle */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="size-6 rounded-full bg-white border-2 border-cyan-400 flex items-center justify-center hover:bg-cyan-50 transition-all shadow-sm"
      >
        <Plus className="size-3.5 text-cyan-500" weight="bold" />
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-[220px] bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
            <span className="text-xs text-gray-500 font-medium">Select next step</span>
          </div>

          {/* Menu items */}
          <div className="py-0.5">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <item.icon className={`size-3.5 ${item.color}`} weight="fill" />
                  <span className="text-xs text-gray-700">{item.label}</span>
                </div>
                <Plus className="size-3 text-gray-300" weight="bold" />
              </button>
            ))}
          </div>
        </div>
      )}

      <Handle
        type="target"
        position={Position.Top}
        className="!bg-transparent !border-transparent !size-1"
      />
    </div>
  );
}

// Condition Node - Lindy style (purple icon, multiple outputs for branches)
function ConditionNode({ id, data, selected }: { id: string; data: { label?: string; conditions?: Array<{ id: string; text: string }>; onAddCondition?: (nodeId: string) => void; onOpenReplaceModal?: (nodeId: string) => void }; selected?: boolean }) {
  const [showOptions, setShowOptions] = useState(false);
  const optionsBtnRef = useRef<HTMLButtonElement>(null);
  // Capitalize first letter of label
  const label = data.label || "Condition";
  const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);
  const conditions = data.conditions || [];
  // Only show handles for actual conditions that exist
  const conditionCount = conditions.length || 1;

  // Simple formula: divide space into (conditionCount + 2) sections
  // conditionCount visible handles + 1 invisible handle + add button position
  const totalDivisions = conditionCount + 2;

  return (
    <div className="flex flex-col items-center">
      <div
        className={`bg-white rounded-xl px-3 py-2 shadow-sm hover:shadow transition-shadow relative ${
          selected ? "border-2 border-cyan-400" : "border border-violet-200"
        }`}
        style={{ width: NODE_WIDTH }}
      >
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-violet-500 flex items-center justify-center flex-shrink-0">
            <GitBranch className="size-3.5 text-white" weight="fill" />
          </div>
          <span className="font-medium text-slate-700 text-xs flex-1 text-left truncate">
            {capitalizedLabel}
          </span>
          <div className="relative flex-shrink-0">
            <button
              ref={optionsBtnRef}
              onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
              className="text-slate-400 hover:text-slate-600 p-0.5 flex items-center justify-center"
            >
              <DotsThree className="size-4" weight="bold" />
            </button>
            {showOptions && (
              <NodeOptionsMenu
                type="condition"
                buttonRef={optionsBtnRef}
                onClose={() => setShowOptions(false)}
                onReplace={() => {
                  setShowOptions(false);
                  data.onOpenReplaceModal?.(id);
                }}
              />
            )}
          </div>
        </div>

        <Handle
          type="target"
          position={Position.Top}
          className="!bg-violet-400 !border-white !border-2 !size-2.5 !-top-1"
        />

        {/* Source handles - one per condition + one extra invisible for the next potential branch */}
        {Array.from({ length: conditionCount + 1 }).map((_, index) => {
          const leftPercent = ((index + 1) / totalDivisions) * 100;
          const isVisible = index < conditionCount;
          return (
            <Handle
              key={`branch-${index}`}
              type="source"
              position={Position.Bottom}
              id={`branch-${index}`}
              className="!bg-violet-400 !border-white !border-2 !size-2.5 !-bottom-1"
              style={{ left: `${leftPercent}%`, opacity: isVisible ? 1 : 0 }}
            />
          );
        })}
      </div>

      {/* Add condition button with dotted line - aligned with the invisible handle */}
      <div
        className="flex flex-col items-center"
        style={{
          position: 'relative',
          left: `calc(${((conditionCount + 1) / totalDivisions) * 100}% - 50%)`,
          marginTop: '-2px'
        }}
      >
        {/* Dotted line connecting to the "+" button */}
        <div
          className="h-4 w-0 border-l border-dashed border-slate-300"
          style={{ borderLeftWidth: '1.5px' }}
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onAddCondition?.(id);
          }}
          className="size-4 rounded-full bg-white border-2 border-cyan-400 flex items-center justify-center hover:bg-cyan-50 transition-all"
          title="Add condition"
        >
          <Plus className="size-2.5 text-cyan-500" weight="bold" />
        </button>
      </div>
    </div>
  );
}

// Condition Branch Node - subtle pill style like Lindy
function ConditionBranchNode({ id, data, selected }: { id: string; data: { conditionText?: string; conditionIndex?: number; hasWarning?: boolean; hasOutgoingEdge?: boolean; onSelectAction?: (actionId: string, sourceNodeId?: string) => void }; selected?: boolean }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const optionsBtnRef = useRef<HTMLButtonElement>(null);
  const text = data.conditionText || "";
  const isEmpty = text.trim() === "";

  // Truncate text for display - longer than main nodes
  const displayText = isEmpty
    ? "Define a condition"
    : text.length > 28
      ? text.substring(0, 25) + "..."
      : text;

  const menuItems = [
    { id: "action", label: "Perform an action", icon: Sparkle, color: "text-pink-500" },
    { id: "knowledge-base", label: "Search knowledge base", icon: MagnifyingGlass, color: "text-blue-500" },
    { id: "loop", label: "Enter loop", icon: ArrowsClockwise, color: "text-teal-500" },
    { id: "condition", label: "Condition", icon: GitBranch, color: "text-violet-500" },
    { id: "agent-step", label: "Enter agent step", icon: Robot, color: "text-blue-500" },
  ];

  const handleSelect = (actionId: string) => {
    setShowMenu(false);
    // Pass this branch's ID as the source node
    data.onSelectAction?.(actionId, id);
  };

  return (
    <div className="flex flex-col items-center">
      {/* Subtle condition pill - Lindy style */}
      <div
        className={`bg-gray-200 rounded-full px-3 py-1.5 border transition-all ${
          selected ? "border-cyan-400 border-2" : isEmpty ? "border-amber-300 border-dashed" : "border-slate-200"
        }`}
      >
        <div className="flex items-center gap-2">
          {isEmpty && (
            <Warning className="size-3.5 text-amber-500 flex-shrink-0" weight="fill" />
          )}
          <span className={`text-xs ${isEmpty ? "text-amber-600" : "text-slate-500"}`}>
            {displayText}
          </span>
          <div className="relative flex-shrink-0">
            <button
              ref={optionsBtnRef}
              onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
              className="text-slate-300 hover:text-slate-500 p-0.5 flex items-center justify-center"
            >
              <DotsThree className="size-4" weight="bold" />
            </button>
            {showOptions && <NodeOptionsMenu type="branch" buttonRef={optionsBtnRef} onClose={() => setShowOptions(false)} />}
          </div>
        </div>

        <Handle
          type="target"
          position={Position.Top}
          className="!bg-slate-300 !border-white !border-2 !size-2 !-top-1"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-slate-300 !border-white !border-2 !size-2 !-bottom-1"
        />
      </div>

      {/* Integrated add button with menu - only show if no outgoing edge */}
      {!data.hasOutgoingEdge && (
        <div className="relative mt-2 flex flex-col items-center">
          {/* Dotted line connecting to the "+" button */}
          <div
            className="h-5 w-0 border-l border-dashed border-slate-300"
            style={{ borderLeftWidth: '1.5px' }}
          />
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="size-5 rounded-full bg-white border-2 border-cyan-400 flex items-center justify-center hover:bg-cyan-50 transition-all shadow-sm"
          >
            <Plus className="size-3 text-cyan-500" weight="bold" />
          </button>

          {/* Dropdown menu */}
          {showMenu && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[220px] bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
              <span className="text-xs text-gray-500 font-medium">Select next step</span>
            </div>
            <div className="py-0.5">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <item.icon className={`size-3.5 ${item.color}`} weight="fill" />
                    <span className="text-xs text-gray-700">{item.label}</span>
                  </div>
                  <Plus className="size-3 text-gray-300" weight="bold" />
                </button>
              ))}
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
}

// Icon mapping for action nodes based on integration/type
const ACTION_ICONS: Record<string, { icon: string; color: string }> = {
  // Google
  "google-sheets": { icon: "logos:google-sheets", color: "bg-green-500" },
  "google-drive": { icon: "logos:google-drive", color: "bg-blue-500" },
  "google-calendar": { icon: "logos:google-calendar", color: "bg-blue-500" },
  "gmail": { icon: "logos:google-gmail", color: "bg-red-500" },
  // Communication
  "slack": { icon: "logos:slack-icon", color: "bg-purple-500" },
  "discord": { icon: "logos:discord-icon", color: "bg-indigo-500" },
  "telegram": { icon: "logos:telegram", color: "bg-blue-500" },
  "whatsapp": { icon: "logos:whatsapp-icon", color: "bg-green-500" },
  "teams": { icon: "logos:microsoft-teams", color: "bg-purple-500" },
  "zoom": { icon: "logos:zoom-icon", color: "bg-blue-500" },
  "outlook": { icon: "logos:microsoft-icon", color: "bg-blue-500" },
  // CRM & Sales
  "hubspot": { icon: "logos:hubspot", color: "bg-orange-500" },
  "salesforce": { icon: "logos:salesforce", color: "bg-blue-500" },
  "pipedrive": { icon: "simple-icons:pipedrive", color: "bg-green-500" },
  "apollo": { icon: "ph:rocket-fill", color: "bg-purple-500" },
  "clearbit": { icon: "simple-icons:clearbit", color: "bg-blue-500" },
  "clay": { icon: "ph:cube-fill", color: "bg-indigo-500" },
  "hunter": { icon: "ph:envelope-simple-fill", color: "bg-orange-500" },
  "lemlist": { icon: "ph:paper-plane-tilt-fill", color: "bg-purple-500" },
  "snov": { icon: "ph:envelope-fill", color: "bg-blue-500" },
  "crunchbase": { icon: "simple-icons:crunchbase", color: "bg-blue-500" },
  // Project Management
  "notion": { icon: "logos:notion-icon", color: "bg-slate-800" },
  "airtable": { icon: "logos:airtable", color: "bg-blue-500" },
  "jira": { icon: "logos:jira", color: "bg-blue-500" },
  "asana": { icon: "logos:asana-icon", color: "bg-red-500" },
  "trello": { icon: "logos:trello", color: "bg-blue-500" },
  "monday": { icon: "logos:monday-icon", color: "bg-yellow-500" },
  "linear": { icon: "logos:linear-icon", color: "bg-indigo-500" },
  // Development
  "github": { icon: "logos:github-icon", color: "bg-slate-800" },
  "gitlab": { icon: "logos:gitlab", color: "bg-orange-500" },
  "bitbucket": { icon: "logos:bitbucket", color: "bg-blue-500" },
  // Cloud
  "aws": { icon: "logos:aws", color: "bg-orange-500" },
  "azure": { icon: "logos:azure-icon", color: "bg-blue-500" },
  "gcp": { icon: "logos:google-cloud", color: "bg-blue-500" },
  // Storage
  "dropbox": { icon: "logos:dropbox", color: "bg-blue-500" },
  "box": { icon: "simple-icons:box", color: "bg-blue-500" },
  "onedrive": { icon: "logos:microsoft-onedrive", color: "bg-blue-500" },
  // Marketing & Email
  "mailchimp": { icon: "logos:mailchimp", color: "bg-yellow-500" },
  "sendgrid": { icon: "logos:sendgrid-icon", color: "bg-blue-500" },
  // Payments
  "stripe": { icon: "logos:stripe", color: "bg-purple-500" },
  // Support
  "zendesk": { icon: "logos:zendesk-icon", color: "bg-green-500" },
  "intercom": { icon: "logos:intercom-icon", color: "bg-blue-500" },
  // Social Media
  "twitter": { icon: "logos:twitter", color: "bg-blue-500" },
  "facebook": { icon: "logos:facebook", color: "bg-blue-500" },
  "instagram": { icon: "logos:instagram-icon", color: "bg-pink-500" },
  "linkedin": { icon: "logos:linkedin-icon", color: "bg-blue-500" },
  "youtube": { icon: "logos:youtube-icon", color: "bg-red-500" },
  "tiktok": { icon: "logos:tiktok-icon", color: "bg-slate-800" },
  "reddit": { icon: "logos:reddit-icon", color: "bg-orange-500" },
  "pinterest": { icon: "logos:pinterest", color: "bg-red-500" },
  // E-commerce
  "shopify": { icon: "logos:shopify", color: "bg-green-500" },
  "woocommerce": { icon: "logos:woocommerce-icon", color: "bg-purple-500" },
  // Forms
  "typeform": { icon: "simple-icons:typeform", color: "bg-slate-800" },
  "calendly": { icon: "simple-icons:calendly", color: "bg-blue-500" },
  // AI & Research
  "perplexity": { icon: "ph:compass-fill", color: "bg-violet-500" },
  "people-data-labs": { icon: "mdi:account-search", color: "bg-[#7F35FD]" },
  "ai": { icon: "ph:sparkle-fill", color: "bg-violet-500" },
  // Utilities
  "web-browser": { icon: "ph:globe-fill", color: "bg-blue-500" },
  "http": { icon: "ph:globe-fill", color: "bg-blue-500" },
  "generate-media": { icon: "ph:image-fill", color: "bg-pink-500" },
  "meeting-recorder": { icon: "ph:microphone-fill", color: "bg-red-500" },
  "nodebase-phone": { icon: "ph:phone-fill", color: "bg-green-500" },
  "utilities": { icon: "ph:wrench-fill", color: "bg-slate-500" },
  // Generic
  "table": { icon: "ph:table-fill", color: "bg-emerald-500" },
  "send": { icon: "ph:paper-plane-tilt-fill", color: "bg-cyan-500" },
  "search": { icon: "ph:magnifying-glass-bold", color: "bg-blue-500" },
  "message": { icon: "ph:chat-circle-text-fill", color: "bg-indigo-500" },
  // Automation
  "zapier": { icon: "logos:zapier-icon", color: "bg-orange-500" },
  "twilio": { icon: "logos:twilio-icon", color: "bg-red-500" },
};

// Action Node (colored based on icon type)
function ActionNode({ id, data, selected }: { id: string; data: { label?: string; icon?: string; hasWarning?: boolean; outputs?: string[]; hasOutgoingEdge?: boolean; onSelectAction?: (actionId: string, sourceNodeId?: string) => void; onOpenReplaceModal?: (nodeId: string) => void }; selected?: boolean }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const optionsBtnRef = useRef<HTMLButtonElement>(null);
  const outputs = data.outputs || [];
  const hasMultipleOutputs = outputs.length > 1;

  // Update menu position when showing
  useEffect(() => {
    if (showMenu && nodeRef.current) {
      const rect = nodeRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2 - 110, // 110 = half of menu width (220px)
      });
    }
  }, [showMenu]);

  // Close action menu when clicking outside
  useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as globalThis.Node)) {
        setShowMenu(false);
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  // Get icon config or use default
  const iconConfig = data.icon && ACTION_ICONS[data.icon]
    ? ACTION_ICONS[data.icon]
    : { icon: "ph:sparkle-fill", color: "bg-emerald-500" };

  const menuItems = [
    { id: "action", label: "Perform an action", icon: Sparkle, color: "text-pink-500" },
    { id: "knowledge-base", label: "Search knowledge base", icon: MagnifyingGlass, color: "text-blue-500" },
    { id: "loop", label: "Enter loop", icon: ArrowsClockwise, color: "text-teal-500" },
    { id: "condition", label: "Condition", icon: GitBranch, color: "text-violet-500" },
    { id: "agent-step", label: "Enter agent step", icon: Robot, color: "text-blue-500" },
  ];

  const handleSelect = (actionId: string) => {
    setShowMenu(false);
    data.onSelectAction?.(actionId, id);
  };

  return (
    <div ref={nodeRef} className="flex flex-col items-center relative">
      {/* Main node card */}
      <div
        className={`bg-white rounded-xl px-3 py-2 shadow-sm hover:shadow transition-shadow ${
          selected ? "border-2 border-cyan-400" : "border border-emerald-200"
        }`}
        style={{ width: NODE_WIDTH }}
      >
        <div className="flex items-center gap-2">
          <div className={`size-6 rounded-lg ${iconConfig.color} flex items-center justify-center flex-shrink-0`}>
            <Icon icon={iconConfig.icon} className="size-3.5 text-white" />
          </div>
          <span className="font-medium text-slate-700 text-xs flex-1 text-left truncate">
            {data.label || "Action"}
          </span>
          {data.hasWarning && (
            <Warning className="size-3 text-amber-500 flex-shrink-0" weight="fill" />
          )}
          <div className="relative flex-shrink-0">
            <button
              ref={optionsBtnRef}
              onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
              className="text-slate-400 hover:text-slate-600 p-0.5 flex items-center justify-center"
            >
              <DotsThree className="size-4" weight="bold" />
            </button>
            {showOptions && (
              <NodeOptionsMenu
                type="action"
                buttonRef={optionsBtnRef}
                onClose={() => setShowOptions(false)}
                onReplace={() => {
                  setShowOptions(false);
                  data.onOpenReplaceModal?.(id);
                }}
              />
            )}
          </div>
        </div>

        {/* Output labels for multi-output actions */}
        {hasMultipleOutputs && (
          <div className="flex justify-between mt-2 px-1 text-[9px] text-slate-400">
            <span>{outputs[0]}</span>
            <span>{outputs[1]}</span>
          </div>
        )}

        <Handle
          type="target"
          position={Position.Top}
          className="!bg-emerald-500 !border-white !border-2 !size-2.5 !-top-1"
        />
        {hasMultipleOutputs ? (
          <>
            <Handle
              type="source"
              position={Position.Bottom}
              id="left"
              className="!bg-emerald-500 !border-white !border-2 !size-2.5 !-bottom-1 !left-[25%]"
            />
            <Handle
              type="source"
              position={Position.Bottom}
              id="right"
              className="!bg-emerald-500 !border-white !border-2 !size-2.5 !-bottom-1 !left-[75%]"
            />
          </>
        ) : (
          <Handle
            type="source"
            position={Position.Bottom}
            className="!bg-emerald-500 !border-white !border-2 !size-2.5 !-bottom-1"
          />
        )}
      </div>

      {/* Action selection menu - rendered as portal */}
      {showMenu && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed w-[220px] bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden"
          style={{ top: menuPosition.top, left: menuPosition.left, zIndex: 9999 }}
        >
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
            <span className="text-xs text-gray-500 font-medium">Select next step</span>
          </div>
          <div className="py-0.5">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <item.icon className={`size-3.5 ${item.color}`} weight="fill" />
                  <span className="text-xs text-gray-700">{item.label}</span>
                </div>
                <Plus className="size-3 text-gray-300" weight="bold" />
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Add button - only show if no outgoing edge and single output */}
      {!data.hasOutgoingEdge && !hasMultipleOutputs && (
        <div className="relative mt-2 flex flex-col items-center">
          <div
            className="h-5 w-0 border-l border-dashed border-slate-300"
            style={{ borderLeftWidth: '1.5px' }}
          />
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="size-5 rounded-full bg-white border-2 border-cyan-400 flex items-center justify-center hover:bg-cyan-50 transition-all shadow-sm"
          >
            <Plus className="size-3 text-cyan-500" weight="bold" />
          </button>
        </div>
      )}
    </div>
  );
}

// Send Email Node (orange - with warning and dual outputs)
function SendEmailNode({ data, selected }: { data: { label?: string; hasWarning?: boolean }; selected?: boolean }) {
  const [showOptions, setShowOptions] = useState(false);
  const optionsBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div
      className={`bg-white rounded-xl px-3 py-2 shadow-sm hover:shadow transition-shadow ${
        selected ? "border-2 border-cyan-400" : "border border-orange-200"
      }`}
      style={{ width: NODE_WIDTH }}
    >
      <div className="flex items-center gap-2">
        <div className="size-6 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
          <Envelope className="size-3.5 text-white" weight="fill" />
        </div>
        <span className="font-medium text-slate-700 text-xs flex-1 text-left truncate">
          {data.label || "Send email"}
        </span>
        {data.hasWarning && (
          <Warning className="size-3 text-amber-500 flex-shrink-0" weight="fill" />
        )}
        <div className="relative flex-shrink-0">
          <button
            ref={optionsBtnRef}
            onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
            className="text-slate-400 hover:text-slate-600 p-0.5 flex items-center justify-center"
          >
            <DotsThree className="size-4" weight="bold" />
          </button>
          {showOptions && <NodeOptionsMenu type="action" buttonRef={optionsBtnRef} onClose={() => setShowOptions(false)} />}
        </div>
      </div>

      {/* Output labels */}
      <div className="flex justify-between mt-2 px-1 text-[9px] text-slate-400">
        <span>After email sent</span>
        <span>After reply received</span>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="!bg-orange-500 !border-white !border-2 !size-2.5 !-top-1"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="sent"
        className="!bg-orange-500 !border-white !border-2 !size-2.5 !-bottom-1 !left-[25%]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="reply"
        className="!bg-orange-500 !border-white !border-2 !size-2.5 !-bottom-1 !left-[75%]"
      />
    </div>
  );
}

// People Data Labs Node - Search for leads
function PeopleDataLabsNode({ id, data, selected }: { id: string; data: { label?: string; hasOutgoingEdge?: boolean; onSelectAction?: (actionId: string, sourceNodeId?: string) => void; onOpenReplaceModal?: (nodeId: string) => void }; selected?: boolean }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const optionsBtnRef = useRef<HTMLButtonElement>(null);
  const label = data.label || "Search for leads";

  const menuItems = [
    { id: "action", label: "Perform an action", icon: Sparkle, color: "text-pink-500" },
    { id: "knowledge-base", label: "Search knowledge base", icon: MagnifyingGlass, color: "text-blue-500" },
    { id: "loop", label: "Enter loop", icon: ArrowsClockwise, color: "text-teal-500" },
    { id: "condition", label: "Condition", icon: GitBranch, color: "text-violet-500" },
    { id: "agent-step", label: "Enter agent step", icon: Robot, color: "text-blue-500" },
  ];

  const handleSelect = (actionId: string) => {
    setShowMenu(false);
    data.onSelectAction?.(actionId, id);
  };

  return (
    <div className="flex flex-col items-center">
      {/* Main node card */}
      <div
        className={`bg-white rounded-xl px-3 py-2 shadow-sm hover:shadow transition-shadow ${
          selected ? "border-2 border-cyan-400" : "border border-[#7F35FD]/30"
        }`}
        style={{ width: NODE_WIDTH }}
      >
        <div className="flex items-center gap-2">
          {/* People Data Labs icon */}
          <div className="size-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
            <PDLIcon size={14} />
          </div>
          <span className="font-medium text-slate-700 text-xs flex-1 text-left truncate">
            {label}
          </span>
          <div className="relative flex-shrink-0">
            <button
              ref={optionsBtnRef}
              onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
              className="text-slate-400 hover:text-slate-600 p-0.5 flex items-center justify-center"
            >
              <DotsThree className="size-4" weight="bold" />
            </button>
            {showOptions && (
              <NodeOptionsMenu
                type="action"
                buttonRef={optionsBtnRef}
                onClose={() => setShowOptions(false)}
                onReplace={() => {
                  setShowOptions(false);
                  data.onOpenReplaceModal?.(id);
                }}
              />
            )}
          </div>
        </div>

        <Handle
          type="target"
          position={Position.Top}
          className="!bg-[#7F35FD] !border-white !border-2 !size-2.5 !-top-1"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-[#7F35FD] !border-white !border-2 !size-2.5 !-bottom-1"
        />
      </div>

      {/* Integrated add button with menu - only show if no outgoing edge */}
      {!data.hasOutgoingEdge && (
        <div className="relative mt-2 flex flex-col items-center">
          <div
            className="h-5 w-0 border-l border-dashed border-slate-300"
            style={{ borderLeftWidth: '1.5px' }}
          />
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="size-5 rounded-full bg-white border-2 border-cyan-400 flex items-center justify-center hover:bg-cyan-50 transition-all shadow-sm"
          >
            <Plus className="size-3 text-cyan-500" weight="bold" />
          </button>

          {showMenu && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[220px] bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                <span className="text-xs text-gray-500 font-medium">Select next step</span>
              </div>
              <div className="py-0.5">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className={`size-3.5 ${item.color}`} weight="fill" />
                      <span className="text-xs text-gray-700">{item.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Google Sheets Node
function GoogleSheetsNode({ id, data, selected }: { id: string; data: { label?: string; actionId?: string; hasOutgoingEdge?: boolean; onSelectAction?: (actionId: string, sourceNodeId?: string) => void; onOpenReplaceModal?: (nodeId: string) => void }; selected?: boolean }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const optionsBtnRef = useRef<HTMLButtonElement>(null);
  const label = data.label || "Google Sheets";

  const menuItems = [
    { id: "action", label: "Perform an action", icon: Sparkle, color: "text-pink-500" },
    { id: "knowledge-base", label: "Search knowledge base", icon: MagnifyingGlass, color: "text-blue-500" },
    { id: "loop", label: "Enter loop", icon: ArrowsClockwise, color: "text-teal-500" },
    { id: "condition", label: "Condition", icon: GitBranch, color: "text-violet-500" },
    { id: "agent-step", label: "Enter agent step", icon: Robot, color: "text-blue-500" },
  ];

  const handleSelect = (actionId: string) => {
    setShowMenu(false);
    data.onSelectAction?.(actionId, id);
  };

  return (
    <div className="flex flex-col items-center">
      {/* Main node card */}
      <div
        className={`bg-white rounded-xl px-3 py-2 shadow-sm hover:shadow transition-shadow ${
          selected ? "border-2 border-cyan-400" : "border border-[#34A853]/30"
        }`}
        style={{ width: NODE_WIDTH }}
      >
        <div className="flex items-center gap-2">
          {/* Google Sheets logo */}
          <div className="size-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
            <Icon icon="logos:google-sheets" className="size-4" />
          </div>
          <span className="font-medium text-slate-700 text-xs flex-1 text-left truncate">
            {label}
          </span>
          <div className="relative flex-shrink-0">
            <button
              ref={optionsBtnRef}
              onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
              className="text-slate-400 hover:text-slate-600 p-0.5 flex items-center justify-center"
            >
              <DotsThree className="size-4" weight="bold" />
            </button>
            {showOptions && (
              <NodeOptionsMenu
                type="action"
                buttonRef={optionsBtnRef}
                onClose={() => setShowOptions(false)}
                onReplace={() => {
                  setShowOptions(false);
                  data.onOpenReplaceModal?.(id);
                }}
              />
            )}
          </div>
        </div>

        <Handle
          type="target"
          position={Position.Top}
          className="!bg-[#34A853] !border-white !border-2 !size-2.5 !-top-1"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-[#34A853] !border-white !border-2 !size-2.5 !-bottom-1"
        />
      </div>

      {/* Integrated add button with menu - only show if no outgoing edge */}
      {!data.hasOutgoingEdge && (
        <div className="relative mt-2 flex flex-col items-center">
          <div
            className="h-5 w-0 border-l border-dashed border-slate-300"
            style={{ borderLeftWidth: '1.5px' }}
          />
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="size-5 rounded-full bg-white border-2 border-cyan-400 flex items-center justify-center hover:bg-cyan-50 transition-all shadow-sm"
          >
            <Plus className="size-3 text-cyan-500" weight="bold" />
          </button>

          {showMenu && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[220px] bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                <span className="text-xs text-gray-500 font-medium">Select next step</span>
              </div>
              <div className="py-0.5">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className={`size-3.5 ${item.color}`} weight="fill" />
                      <span className="text-xs text-gray-700">{item.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Integration configuration for generic integration nodes
const INTEGRATION_NODE_CONFIG: Record<string, { icon: string; color: string; borderColor: string }> = {
  gmail: { icon: "logos:google-gmail", color: "#EA4335", borderColor: "#EA4335" },
  googleDrive: { icon: "logos:google-drive", color: "#4285F4", borderColor: "#4285F4" },
  googleDocs: { icon: "simple-icons:googledocs", color: "#4285F4", borderColor: "#4285F4" },
  googleCalendar: { icon: "logos:google-calendar", color: "#4285F4", borderColor: "#4285F4" },
  outlook: { icon: "vscode-icons:file-type-outlook", color: "#0078D4", borderColor: "#0078D4" },
  outlookCalendar: { icon: "vscode-icons:file-type-outlook", color: "#0078D4", borderColor: "#0078D4" },
  microsoftTeams: { icon: "logos:microsoft-teams", color: "#6264A7", borderColor: "#6264A7" },
  slack: { icon: "logos:slack-icon", color: "#4A154B", borderColor: "#4A154B" },
  notion: { icon: "simple-icons:notion", color: "#000000", borderColor: "#000000" },
};

// Generic Integration Node (for gmail, googleDrive, etc.)
function IntegrationNode({ id, data, selected, type }: { id: string; type: string; data: { label?: string; actionId?: string; hasOutgoingEdge?: boolean; onSelectAction?: (actionId: string, sourceNodeId?: string) => void; onOpenReplaceModal?: (nodeId: string) => void }; selected?: boolean }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const optionsBtnRef = useRef<HTMLButtonElement>(null);

  const config = INTEGRATION_NODE_CONFIG[type] || { icon: "mdi:cog", color: "#6B7280", borderColor: "#6B7280" };
  const label = data.label || type.replace(/([A-Z])/g, ' $1').trim();

  const menuItems = [
    { id: "action", label: "Perform an action", icon: Sparkle, color: "text-pink-500" },
    { id: "knowledge-base", label: "Search knowledge base", icon: MagnifyingGlass, color: "text-blue-500" },
    { id: "loop", label: "Enter loop", icon: ArrowsClockwise, color: "text-teal-500" },
    { id: "condition", label: "Condition", icon: GitBranch, color: "text-violet-500" },
    { id: "agent-step", label: "Enter agent step", icon: Robot, color: "text-blue-500" },
  ];

  const handleSelect = (actionId: string) => {
    setShowMenu(false);
    data.onSelectAction?.(actionId, id);
  };

  return (
    <div className="flex flex-col items-center">
      {/* Main node card */}
      <div
        className={`bg-white rounded-xl px-3 py-2 shadow-sm hover:shadow transition-shadow ${
          selected ? "border-2 border-cyan-400" : `border`
        }`}
        style={{ width: NODE_WIDTH, borderColor: selected ? undefined : `${config.borderColor}30` }}
      >
        <div className="flex items-center gap-2">
          {/* Integration logo */}
          <div className="size-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
            <Icon icon={config.icon} className="size-4" />
          </div>
          <span className="font-medium text-slate-700 text-xs flex-1 text-left truncate">
            {label}
          </span>
          <div className="relative flex-shrink-0">
            <button
              ref={optionsBtnRef}
              onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
              className="text-slate-400 hover:text-slate-600 p-0.5 flex items-center justify-center"
            >
              <DotsThree className="size-4" weight="bold" />
            </button>
            {showOptions && (
              <NodeOptionsMenu
                type="action"
                buttonRef={optionsBtnRef}
                onClose={() => setShowOptions(false)}
                onReplace={() => {
                  setShowOptions(false);
                  data.onOpenReplaceModal?.(id);
                }}
              />
            )}
          </div>
        </div>

        <Handle
          type="target"
          position={Position.Top}
          className="!border-white !border-2 !size-2.5 !-top-1"
          style={{ backgroundColor: config.color }}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!border-white !border-2 !size-2.5 !-bottom-1"
          style={{ backgroundColor: config.color }}
        />
      </div>

      {/* Integrated add button with menu - only show if no outgoing edge */}
      {!data.hasOutgoingEdge && (
        <div className="relative mt-2 flex flex-col items-center">
          <div
            className="h-5 w-0 border-l border-dashed border-slate-300"
            style={{ borderLeftWidth: '1.5px' }}
          />
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="size-5 rounded-full bg-white border-2 border-cyan-400 flex items-center justify-center hover:bg-cyan-50 transition-all shadow-sm"
          >
            <Plus className="size-3 text-cyan-500" weight="bold" />
          </button>

          {showMenu && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[220px] bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                <span className="text-xs text-gray-500 font-medium">Select next step</span>
              </div>
              <div className="py-0.5">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className={`size-3.5 ${item.color}`} weight="fill" />
                      <span className="text-xs text-gray-700">{item.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Enter Loop Node
function EnterLoopNode({ data, selected }: { data: { label?: string }; selected?: boolean }) {
  const [showOptions, setShowOptions] = useState(false);
  const optionsBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div
      className={`bg-white rounded-xl px-3 py-2 shadow-sm hover:shadow transition-shadow ${
        selected ? "border-2 border-cyan-400" : "border border-teal-200"
      }`}
      style={{ width: NODE_WIDTH }}
    >
      <div className="flex items-center gap-2">
        <div className="size-6 rounded-lg bg-teal-500 flex items-center justify-center flex-shrink-0">
          <Play className="size-3.5 text-white" weight="fill" />
        </div>
        <span className="font-medium text-slate-700 text-xs flex-1 text-left truncate">
          {data.label || "Enter loop"}
        </span>
        <div className="relative flex-shrink-0">
          <button
            ref={optionsBtnRef}
            onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
            className="text-slate-400 hover:text-slate-600 p-0.5 flex items-center justify-center"
          >
            <DotsThree className="size-4" weight="bold" />
          </button>
          {showOptions && <NodeOptionsMenu type="action" buttonRef={optionsBtnRef} onClose={() => setShowOptions(false)} />}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="!bg-teal-500 !border-white !border-2 !size-2.5 !-top-1"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-teal-500 !border-white !border-2 !size-2.5 !-bottom-1"
      />
    </div>
  );
}

// Exit Loop Node
function ExitLoopNode({ data, selected }: { data: { label?: string }; selected?: boolean }) {
  const [showOptions, setShowOptions] = useState(false);
  const optionsBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div
      className={`bg-white rounded-xl px-3 py-2 shadow-sm hover:shadow transition-shadow ${
        selected ? "border-2 border-cyan-400" : "border border-teal-200"
      }`}
      style={{ width: NODE_WIDTH }}
    >
      <div className="flex items-center gap-2">
        <div className="size-6 rounded-lg bg-teal-500 flex items-center justify-center flex-shrink-0">
          <Stop className="size-3.5 text-white" weight="fill" />
        </div>
        <span className="font-medium text-slate-700 text-xs flex-1 text-left truncate">
          {data.label || "Exit loop"}
        </span>
        <div className="relative flex-shrink-0">
          <button
            ref={optionsBtnRef}
            onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
            className="text-slate-400 hover:text-slate-600 p-0.5 flex items-center justify-center"
          >
            <DotsThree className="size-4" weight="bold" />
          </button>
          {showOptions && <NodeOptionsMenu type="action" buttonRef={optionsBtnRef} onClose={() => setShowOptions(false)} />}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="!bg-teal-500 !border-white !border-2 !size-2.5 !-top-1"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-teal-500 !border-white !border-2 !size-2.5 !-bottom-1"
      />
    </div>
  );
}

// Select Action Node - Sleek minimal
function SelectActionNode({ data, selected }: { data: { label?: string; hasWarning?: boolean }; selected?: boolean }) {
  const [showOptions, setShowOptions] = useState(false);
  const optionsBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div
      className={`bg-white rounded-xl px-3 py-2 shadow-sm hover:shadow transition-shadow ${
        selected ? "border-2 border-cyan-400" : "border border-slate-200/80"
      }`}
      style={{ width: NODE_WIDTH }}
    >
      <div className="flex items-center gap-2">
        <div className="size-6 rounded-lg bg-violet-500 flex items-center justify-center flex-shrink-0">
          <Sparkle className="size-3.5 text-white" weight="fill" />
        </div>
        <span className="font-medium text-slate-700 text-xs flex-1 text-left truncate">
          {data.label || "Select action"}
        </span>
        {data.hasWarning && (
          <Warning className="size-3 text-amber-500 flex-shrink-0" weight="fill" />
        )}
        <div className="relative flex-shrink-0">
          <button
            ref={optionsBtnRef}
            onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
            className="text-slate-400 hover:text-slate-600 p-0.5 flex items-center justify-center"
          >
            <DotsThree className="size-4" weight="bold" />
          </button>
          {showOptions && <NodeOptionsMenu type="action" buttonRef={optionsBtnRef} onClose={() => setShowOptions(false)} />}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="!bg-violet-500 !border-white !border-2 !size-2.5 !-top-1"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-violet-500 !border-white !border-2 !size-2.5 !-bottom-1"
      />
    </div>
  );
}

// Search Knowledge Base Node - Same format as Condition
function SearchKnowledgeBaseNode({ id, data, selected }: { id: string; data: { label?: string; hasOutgoingEdge?: boolean; onSelectAction?: (actionId: string, sourceNodeId?: string) => void; onOpenReplaceModal?: (nodeId: string) => void }; selected?: boolean }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const optionsBtnRef = useRef<HTMLButtonElement>(null);
  const label = data.label || "Search knowledge base";
  const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

  const menuItems = [
    { id: "action", label: "Perform an action", icon: Sparkle, color: "text-pink-500" },
    { id: "knowledge-base", label: "Search knowledge base", icon: MagnifyingGlass, color: "text-blue-500" },
    { id: "loop", label: "Enter loop", icon: ArrowsClockwise, color: "text-teal-500" },
    { id: "condition", label: "Condition", icon: GitBranch, color: "text-violet-500" },
    { id: "agent-step", label: "Enter agent step", icon: Robot, color: "text-blue-500" },
  ];

  const handleSelect = (actionId: string) => {
    setShowMenu(false);
    data.onSelectAction?.(actionId, id);
  };

  return (
    <div className="flex flex-col items-center">
      {/* Main node card */}
      <div
        className={`bg-white rounded-xl px-3 py-2 shadow-sm hover:shadow transition-shadow ${
          selected ? "border-2 border-cyan-400" : "border border-blue-200"
        }`}
        style={{ width: NODE_WIDTH }}
      >
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
            <MagnifyingGlass className="size-3.5 text-white" weight="bold" />
          </div>
          <span className="font-medium text-slate-700 text-xs flex-1 text-left truncate">
            {capitalizedLabel}
          </span>
          <div className="relative flex-shrink-0">
            <button
              ref={optionsBtnRef}
              onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
              className="text-slate-400 hover:text-slate-600 p-0.5 flex items-center justify-center"
            >
              <DotsThree className="size-4" weight="bold" />
            </button>
            {showOptions && (
              <NodeOptionsMenu
                type="action"
                buttonRef={optionsBtnRef}
                onClose={() => setShowOptions(false)}
                onReplace={() => {
                  setShowOptions(false);
                  data.onOpenReplaceModal?.(id);
                }}
              />
            )}
          </div>
        </div>

        <Handle
          type="target"
          position={Position.Top}
          className="!bg-blue-500 !border-white !border-2 !size-2.5 !-top-1"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-blue-500 !border-white !border-2 !size-2.5 !-bottom-1"
        />
      </div>

      {/* Integrated add button with menu - only show if no outgoing edge */}
      {!data.hasOutgoingEdge && (
        <div className="relative mt-2 flex flex-col items-center">
          <div
            className="h-5 w-0 border-l border-dashed border-slate-300"
            style={{ borderLeftWidth: '1.5px' }}
          />
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="size-5 rounded-full bg-white border-2 border-cyan-400 flex items-center justify-center hover:bg-cyan-50 transition-all shadow-sm"
          >
            <Plus className="size-3 text-cyan-500" weight="bold" />
          </button>

          {showMenu && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[220px] bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                <span className="text-xs text-gray-500 font-medium">Select next step</span>
              </div>
              <div className="py-0.5">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className={`size-3.5 ${item.color}`} weight="fill" />
                      <span className="text-xs text-gray-700">{item.label}</span>
                    </div>
                    <Plus className="size-3 text-gray-300" weight="bold" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Loop Node - Sleek minimal with integrated "+" button
function LoopNode({ id, data, selected }: { id: string; data: { label?: string; hasOutgoingEdge?: boolean; onSelectAction?: (actionId: string, sourceNodeId?: string) => void; onOpenReplaceModal?: (nodeId: string) => void }; selected?: boolean }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const optionsBtnRef = useRef<HTMLButtonElement>(null);

  const menuItems = [
    { id: "action", label: "Perform an action", icon: Sparkle, color: "text-pink-500" },
    { id: "knowledge-base", label: "Search knowledge base", icon: MagnifyingGlass, color: "text-blue-500" },
    { id: "loop", label: "Enter loop", icon: ArrowsClockwise, color: "text-teal-500" },
    { id: "condition", label: "Condition", icon: GitBranch, color: "text-violet-500" },
    { id: "agent-step", label: "Enter agent step", icon: Robot, color: "text-blue-500" },
  ];

  const handleSelect = (actionId: string) => {
    setShowMenu(false);
    data.onSelectAction?.(actionId, id);
  };

  return (
    <div className="flex flex-col items-center">
      {/* Main node card */}
      <div
        className={`bg-white rounded-xl px-3 py-2 shadow-sm hover:shadow transition-shadow ${
          selected ? "border-2 border-cyan-400" : "border border-slate-200/80"
        }`}
        style={{ width: NODE_WIDTH }}
      >
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0">
            <ArrowsClockwise className="size-3.5 text-white" weight="bold" />
          </div>
          <span className="font-medium text-slate-700 text-xs flex-1 text-left truncate">
            {data.label || "Enter loop"}
          </span>
          <div className="relative flex-shrink-0">
            <button
              ref={optionsBtnRef}
              onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
              className="text-slate-400 hover:text-slate-600 p-0.5 flex items-center justify-center"
            >
              <DotsThree className="size-4" weight="bold" />
            </button>
            {showOptions && (
              <NodeOptionsMenu
                type="action"
                buttonRef={optionsBtnRef}
                onClose={() => setShowOptions(false)}
                onReplace={() => {
                  setShowOptions(false);
                  data.onOpenReplaceModal?.(id);
                }}
              />
            )}
          </div>
        </div>

        <Handle
          type="target"
          position={Position.Top}
          className="!bg-green-500 !border-white !border-2 !size-2.5 !-top-1"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-green-500 !border-white !border-2 !size-2.5 !-bottom-1"
        />
      </div>

      {/* Integrated add button with menu - only show if no outgoing edge */}
      {!data.hasOutgoingEdge && (
        <div className="relative mt-2 flex flex-col items-center">
          <div
            className="h-5 w-0 border-l border-dashed border-slate-300"
            style={{ borderLeftWidth: '1.5px' }}
          />
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="size-5 rounded-full bg-white border-2 border-cyan-400 flex items-center justify-center hover:bg-cyan-50 transition-all shadow-sm"
          >
            <Plus className="size-3 text-cyan-500" weight="bold" />
          </button>

          {showMenu && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[220px] bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                <span className="text-xs text-gray-500 font-medium">Select next step</span>
              </div>
              <div className="py-0.5">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className={`size-3.5 ${item.color}`} weight="fill" />
                      <span className="text-xs text-gray-700">{item.label}</span>
                    </div>
                    <Plus className="size-3 text-gray-300" weight="bold" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Custom edge with add button on hover (only for workflow edges, not structural edges)
function AddButtonEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Check if this is a structural edge (condition → branch) or placeholder edge (to "add" node) - don't show "+" on these
  const isStructuralEdge = (data as { isStructural?: boolean })?.isStructural === true;
  const isPlaceholderEdge = (data as { isPlaceholder?: boolean })?.isPlaceholder === true;

  // Check if this edge is connected to the selected node
  const selectedNodeId = (data as { selectedNodeId?: string })?.selectedNodeId;
  const isConnectedToSelected = selectedNodeId && (source === selectedNodeId || target === selectedNodeId);

  const menuItems = [
    { id: "action", label: "Perform an action", icon: Sparkle, color: "text-pink-500" },
    { id: "knowledge-base", label: "Search knowledge base", icon: MagnifyingGlass, color: "text-blue-500" },
    { id: "loop", label: "Enter loop", icon: ArrowsClockwise, color: "text-teal-500" },
    { id: "condition", label: "Condition", icon: GitBranch, color: "text-violet-500" },
    { id: "agent-step", label: "Enter agent step", icon: Robot, color: "text-blue-500" },
  ];

  const handleSelect = (actionId: string) => {
    setShowMenu(false);
    setIsHovered(false);
    (data as { onInsertNode?: (edgeId: string, actionId: string) => void })?.onInsertNode?.(id, actionId);
  };

  // Determine edge style based on selection state
  const baseStroke = isConnectedToSelected ? "#22D3EE" : "#94A3B8"; // cyan-400 when selected
  const strokeWidth = isConnectedToSelected ? 2 : 1.5;

  // Placeholder edges should be dashed
  const edgeStyle = isPlaceholderEdge
    ? { ...style, strokeDasharray: "5,5", stroke: "#CBD5E1", strokeWidth: 1.5 }
    : { ...style, stroke: baseStroke, strokeWidth };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      {/* Only add hover detection for workflow edges (not structural or placeholder edges) */}
      {!isStructuralEdge && !isPlaceholderEdge && (
        <>
          {/* Invisible wider path for easier hover detection */}
          <path
            d={edgePath}
            fill="none"
            strokeWidth={20}
            stroke="transparent"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => !showMenu && setIsHovered(false)}
          />
          {/* Add button that appears on hover */}
          {(isHovered || showMenu) && (
            <foreignObject
              width={24}
              height={24}
              x={labelX - 12}
              y={labelY - 12}
              className="overflow-visible"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => !showMenu && setIsHovered(false)}
            >
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="size-6 rounded-full bg-white border-2 border-cyan-400 flex items-center justify-center hover:bg-cyan-50 transition-all shadow-md"
                >
                  <Plus className="size-3.5 text-cyan-500" weight="bold" />
                </button>

                {/* Dropdown menu */}
                {showMenu && (
                  <div
                    className="absolute top-8 left-1/2 -translate-x-1/2 w-[220px] bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden"
                    onMouseLeave={() => {
                      setShowMenu(false);
                      setIsHovered(false);
                    }}
                  >
                    <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                      <span className="text-xs text-gray-500 font-medium">Insert step</span>
                    </div>
                    <div className="py-0.5">
                      {menuItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item.id)}
                          className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <item.icon className={`size-3.5 ${item.color}`} weight="fill" />
                            <span className="text-xs text-gray-700">{item.label}</span>
                          </div>
                          <Plus className="size-3 text-gray-300" weight="bold" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </foreignObject>
          )}
        </>
      )}
    </>
  );
}

// Chat Outcome Node - subtle pill style like Lindy ("After message sent" / "After reply received")
function ChatOutcomeNode({ id, data, selected }: { id: string; data: { label?: string; hasOutgoingEdge?: boolean; onSelectAction?: (actionId: string, sourceNodeId?: string) => void }; selected?: boolean }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const optionsBtnRef = useRef<HTMLButtonElement>(null);
  const label = data.label || "Outcome";

  const menuItems = [
    { id: "action", label: "Perform an action", icon: Sparkle, color: "text-pink-500" },
    { id: "knowledge-base", label: "Search knowledge base", icon: MagnifyingGlass, color: "text-blue-500" },
    { id: "loop", label: "Enter loop", icon: ArrowsClockwise, color: "text-teal-500" },
    { id: "condition", label: "Condition", icon: GitBranch, color: "text-violet-500" },
    { id: "agent-step", label: "Enter agent step", icon: Robot, color: "text-blue-500" },
  ];

  const handleSelect = (actionId: string) => {
    setShowMenu(false);
    data.onSelectAction?.(actionId, id);
  };

  return (
    <div className="flex flex-col items-center">
      {/* Subtle outcome pill - Lindy style */}
      <div
        className={`bg-gray-200 rounded-full px-3 py-1.5 border transition-all ${
          selected ? "border-cyan-400 border-2" : "border-slate-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{label}</span>
          <div className="relative flex-shrink-0">
            <button
              ref={optionsBtnRef}
              onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
              className="text-slate-300 hover:text-slate-500 p-0.5 flex items-center justify-center"
            >
              <DotsThree className="size-4" weight="bold" />
            </button>
            {showOptions && <NodeOptionsMenu type="outcome" buttonRef={optionsBtnRef} onClose={() => setShowOptions(false)} />}
          </div>
        </div>

        <Handle
          type="target"
          position={Position.Top}
          className="!bg-slate-300 !border-white !border-2 !size-2 !-top-1"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-slate-300 !border-white !border-2 !size-2 !-bottom-1"
        />
      </div>

      {/* Add button below - only show if no outgoing edge */}
      {!data.hasOutgoingEdge && (
        <div className="relative mt-1 flex flex-col items-center">
          {/* Dotted line connecting to the "+" button */}
          <div
            className="h-4 w-0 border-l border-dashed border-slate-300"
            style={{ borderLeftWidth: '1.5px' }}
          />
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="size-5 rounded-full bg-white border-2 border-cyan-400 flex items-center justify-center hover:bg-cyan-50 transition-all shadow-sm"
          >
            <Plus className="size-3 text-cyan-500" weight="bold" />
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <div className="absolute top-9 left-1/2 -translate-x-1/2 w-[220px] bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                <span className="text-xs text-gray-500 font-medium">Select next step</span>
              </div>
              <div className="py-0.5">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className={`size-3.5 ${item.color}`} weight="fill" />
                      <span className="text-xs text-gray-700">{item.label}</span>
                    </div>
                    <Plus className="size-3 text-gray-300" weight="bold" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Node types
const nodeTypes: NodeTypes = {
  messageReceived: MessageReceivedNode,
  chatAgent: ChatAgentNode,
  agentStep: AgentStepNode,
  addNode: AddNodePlaceholder,
  condition: ConditionNode,
  conditionBranch: ConditionBranchNode,
  selectAction: SelectActionNode,
  searchKnowledgeBase: SearchKnowledgeBaseNode,
  loop: LoopNode,
  action: ActionNode,
  sendEmail: SendEmailNode,
  peopleDataLabs: PeopleDataLabsNode,
  googleSheets: GoogleSheetsNode,
  // Integration node types
  gmail: IntegrationNode,
  googleDrive: IntegrationNode,
  googleDocs: IntegrationNode,
  googleCalendar: IntegrationNode,
  outlook: IntegrationNode,
  outlookCalendar: IntegrationNode,
  microsoftTeams: IntegrationNode,
  slack: IntegrationNode,
  notion: IntegrationNode,
  enterLoop: EnterLoopNode,
  exitLoop: ExitLoopNode,
  chatOutcome: ChatOutcomeNode,
};

// Edge types
const edgeTypes: EdgeTypes = {
  addButton: AddButtonEdge,
};

interface AgentStepData {
  rolePreview?: string;
  integrations?: string[];
}

// Flow data from template
interface TemplateFlowData {
  nodes?: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data?: Record<string, unknown>;
  }>;
  edges?: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  }>;
}

interface FlowEditorCanvasProps {
  agentId: string;
  agentName: string;
  agentDescription?: string;
  systemPrompt?: string;
  tools?: string[];
  onAddNode?: () => void;
  onNodeSelect?: (nodeId: string | null, nodeType: string | null, initialData?: Record<string, unknown>) => void;
  onFlowChange?: () => void;
  onConditionAdded?: (conditionNodeId: string, conditions: Array<{id: string; text: string}>) => void;
  onOpenReplaceModal?: (nodeId: string) => void;
  initialFlowData?: TemplateFlowData;
}

export interface FlowEditorCanvasRef {
  updateBranchNodeText: (branchId: string, text: string) => void;
  addBranchNode: (conditionNodeId: string, branchId: string, branchIndex: number) => void;
  removeBranchNode: (conditionNodeId: string, branchId: string, branchIndex: number, updatedConditions: Array<{id: string; text: string}>) => void;
  updateConditionNodeData: (conditionNodeId: string, conditions: Array<{id: string; text: string}>) => void;
  getFlowData: () => TemplateFlowData;
  deleteNode: (nodeId: string) => void;
  updateNodeLabel: (nodeId: string, newLabel: string) => void;
  replaceNode: (nodeId: string, newType: string, newData: Record<string, unknown>) => string;
}

export const FlowEditorCanvas = forwardRef<FlowEditorCanvasRef, FlowEditorCanvasProps>(function FlowEditorCanvas({
  systemPrompt,
  onNodeSelect,
  onFlowChange,
  onConditionAdded,
  onOpenReplaceModal,
  initialFlowData,
}: FlowEditorCanvasProps, ref) {
  // Modal state for adding actions
  const [showActionModal, setShowActionModal] = useState(false);
  const [showKBModal, setShowKBModal] = useState(false);

  // Track the source node when opening modals (to know where to place new nodes)
  const pendingSourceNodeRef = useRef<string | undefined>(undefined);

  // Track selected node for edge highlighting
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Store the action handler in a ref to avoid re-creating nodes
  const handleSelectActionRef = useRef<(actionId: string, sourceNodeId?: string) => void>(() => {});

  // Store the add condition handler in a ref
  const handleAddConditionRef = useRef<(conditionNodeId: string) => void>(() => {});

  // Store the insert node handler in a ref (for edge "+ " button)
  const handleInsertNodeRef = useRef<(edgeId: string, actionId: string) => void>(() => {});

  // Store the flow change callback in a ref
  const onFlowChangeRef = useRef(onFlowChange);
  onFlowChangeRef.current = onFlowChange;

  // Store the condition added callback in a ref
  const onConditionAddedRef = useRef(onConditionAdded);
  onConditionAddedRef.current = onConditionAdded;

  // Store the replace modal callback in a ref
  const onOpenReplaceModalRef = useRef(onOpenReplaceModal);
  onOpenReplaceModalRef.current = onOpenReplaceModal;

  // Store the node select callback in a ref for use in handlers
  const onNodeSelectRef = useRef(onNodeSelect);
  onNodeSelectRef.current = onNodeSelect;

  // Edge style configuration
  const edgeStyle = {
    stroke: "#94A3B8",
    strokeWidth: 1.5,
  };

  // Helper to create an edge with the addButton type and handler
  const createEdge = useCallback((
    id: string,
    source: string,
    target: string,
    options?: { sourceHandle?: string; targetHandle?: string }
  ): Edge => ({
    id,
    source,
    target,
    sourceHandle: options?.sourceHandle,
    targetHandle: options?.targetHandle,
    type: "addButton",
    data: { onInsertNode: handleInsertNodeRef.current },
    style: edgeStyle,
  }), [edgeStyle]);

  // Initialize nodes from template flowData or use defaults
  const initialNodes = useMemo<Node[]>(() => {
    // If we have template flowData, use it
    if (initialFlowData?.nodes && initialFlowData.nodes.length > 0) {
      const flowNodes: Node[] = [];
      const branchNodesToAdd: Node[] = [];

      initialFlowData.nodes.forEach((node) => {
        // Skip conditionBranch nodes here - we create them from the condition node's data
        // to ensure proper sync, but we'll use their saved positions if available
        if (node.type === "conditionBranch") {
          return;
        }

        // Check if this node has an outgoing edge (for integrated "+" button)
        const hasOutgoingEdge = initialFlowData.edges?.some(e => e.source === node.id) || false;

        const baseNode: Node = {
          id: node.id,
          type: node.type,
          position: node.position,
          data: {
            ...node.data,
            hasOutgoingEdge,
            // Add onSelectAction for nodes with integrated "+" button (use closure to always get latest ref value)
            onSelectAction: (actionId: string, sourceNodeId?: string) => handleSelectActionRef.current(actionId, sourceNodeId),
            // Add onOpenReplaceModal for Replace functionality
            onOpenReplaceModal: (nodeId: string) => onOpenReplaceModalRef.current?.(nodeId),
            // Inject rolePreview from systemPrompt if it's an agentStep
            ...(node.type === "agentStep" && !node.data?.rolePreview
              ? { rolePreview: systemPrompt?.slice(0, 35) }
              : {}),
          },
        };

        flowNodes.push(baseNode);

        // If it's a condition node, create branch nodes
        if (node.type === "condition") {
          const conditions = (node.data?.conditions as Array<{ id: string; text: string }>) || [
            { id: `${node.id}-branch-0`, text: "" },
          ];

          // Ensure at least 1 condition
          if (conditions.length < 1) {
            conditions.push({ id: `${node.id}-branch-0`, text: "" });
          }

          // Update the condition node with conditions data
          baseNode.data = {
            ...baseNode.data,
            conditions,
          };

          // Create branch nodes - use saved positions if available, otherwise calculate
          const defaultBranchY = node.position.y + 80;
          const branchSpacing = 160; // pixels between branch centers
          const totalBranchWidth = (conditions.length - 1) * branchSpacing;
          conditions.forEach((condition, index) => {
            const branchId = condition.id || `${node.id}-branch-${index}`;

            // Check if this branch node exists in saved flowData with a position
            const savedBranchNode = initialFlowData.nodes?.find(n => n.id === branchId);

            // Use saved position if available, otherwise calculate default position
            let branchPosition: { x: number; y: number };
            if (savedBranchNode?.position) {
              branchPosition = savedBranchNode.position;
            } else {
              // Center all branches around the condition node
              const offsetX = -totalBranchWidth / 2 + index * branchSpacing;
              branchPosition = { x: node.position.x + offsetX, y: defaultBranchY };
            }

            // Check if this branch has an outgoing edge (a node connected to it)
            const hasOutgoingEdge = initialFlowData.edges?.some(e => e.source === branchId) || false;
            branchNodesToAdd.push({
              id: branchId,
              type: "conditionBranch",
              position: branchPosition,
              data: {
                conditionText: condition.text || "",
                conditionIndex: index + 1,
                hasOutgoingEdge,
              },
            });
          });
        }
      });

      // Add branch nodes
      flowNodes.push(...branchNodesToAdd);

      // Only add the "add" node if there are no condition nodes
      // (branches have their own "+" buttons)
      const hasConditionNodes = initialFlowData.nodes?.some(n => n.type === "condition");

      if (!hasConditionNodes) {
        // Find the last node to append the add button after it
        const lastNode = flowNodes.reduce((prev, curr) =>
          curr.position.y > prev.position.y ? curr : prev
        );

        // Add the "add" node at the end
        flowNodes.push({
          id: "add",
          type: "addNode",
          position: { x: lastNode.position.x + 57, y: lastNode.position.y + 100 },
          data: {
            onSelectAction: (actionId: string) => handleSelectActionRef.current(actionId),
          },
        });
      }

      return flowNodes;
    }

    // Default nodes if no template flowData - just Message Received + add button
    return [
      {
        id: "trigger",
        type: "messageReceived",
        position: { x: 300, y: 50 },
        data: {},
      },
      {
        id: "add",
        type: "addNode",
        position: { x: 357, y: 180 },
        data: {
          onSelectAction: (actionId: string) => handleSelectActionRef.current(actionId),
        },
      },
    ];
  }, [initialFlowData]);

  // Initialize edges from template flowData or use defaults
  const initialEdges: Edge[] = useMemo(() => {
    // If we have template flowData, use it
    if (initialFlowData?.edges && initialFlowData.edges.length > 0) {
      // Get condition node IDs to filter out their edges (we'll recreate them consistently)
      const conditionNodeIds = new Set(
        initialFlowData.nodes?.filter(n => n.type === "condition").map(n => n.id) || []
      );

      // Copy edges from template, EXCLUDING edges that originate from condition nodes
      // (we'll add those ourselves to ensure consistency)
      const flowEdges: Edge[] = initialFlowData.edges
        .filter(edge => !conditionNodeIds.has(edge.source))
        .map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          // Use sourceHandle/targetHandle for branching nodes
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          type: "addButton",
          style: edgeStyle,
          // Workflow edges show "+" on hover
          data: { onInsertNode: handleInsertNodeRef.current },
        }));

      // Add edges from condition nodes to their branch nodes (consistently created)
      // Use a Set to track edge IDs and avoid duplicates
      const existingEdgeIds = new Set(flowEdges.map(e => e.id));

      initialFlowData.nodes?.forEach((node) => {
        if (node.type === "condition") {
          const conditions = (node.data?.conditions as Array<{ id: string; text: string }>) || [
            { id: `${node.id}-branch-0`, text: "" },
          ];

          // Ensure at least 1 condition
          const conditionsToUse = conditions.length >= 1 ? conditions : [
            { id: `${node.id}-branch-0`, text: "" },
          ];

          conditionsToUse.forEach((condition, index) => {
            const branchId = condition.id || `${node.id}-branch-${index}`;
            const edgeId = `e-${node.id}-${branchId}`;

            // Only add if not already exists
            if (!existingEdgeIds.has(edgeId)) {
              existingEdgeIds.add(edgeId);
              flowEdges.push({
                id: edgeId,
                source: node.id,
                sourceHandle: `branch-${index}`,
                target: branchId,
                type: "addButton",
                style: edgeStyle,
                data: { isStructural: true }, // Structural edge - no "+" on hover
              });
            }
          });
        }
      });

      // Find the last node (considering branch nodes) to connect to "add"
      // Branch nodes are the lowest, so we don't need to connect condition directly to add
      const conditionNodes = initialFlowData.nodes?.filter(n => n.type === "condition") || [];

      if (conditionNodes.length > 0) {
        // Don't add edge from condition to "add" - branches handle the continuation
      } else {
        // Find the last node from the edges to connect to "add"
        const lastTarget = initialFlowData.edges.reduce((prev, curr) => {
          const prevNode = initialFlowData.nodes?.find((n) => n.id === prev.target);
          const currNode = initialFlowData.nodes?.find((n) => n.id === curr.target);
          if (!prevNode || !currNode) return prev;
          return currNode.position.y > prevNode.position.y ? curr : prev;
        });

        // Add edge to the "add" node (placeholder edge - dashed, no hover "+")
        flowEdges.push({
          id: `e-${lastTarget.target}-add`,
          source: lastTarget.target,
          target: "add",
          type: "addButton",
          style: edgeStyle,
          data: { isPlaceholder: true }, // Placeholder edge - dashed, no hover "+"
        });
      }

      return flowEdges;
    }

    // Default edges if no template flowData - just trigger to add (placeholder edge - dashed, no hover "+")
    return [
      {
        id: "e-trigger-add",
        source: "trigger",
        target: "add",
        type: "addButton",
        style: edgeStyle,
        data: { isPlaceholder: true }, // Placeholder edge - dashed, no hover "+"
      },
    ];
  }, [initialFlowData]);

  // Generate a stable key based on flowData to force re-render when template data arrives
  const flowKey = useMemo(() => {
    if (initialFlowData?.nodes && initialFlowData.nodes.length > 0) {
      return `template-${initialFlowData.nodes.length}-${initialFlowData.nodes[0]?.id}`;
    }
    return "default";
  }, [initialFlowData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Edge style for new edges
  const edgeStyleForRef = {
    stroke: "#94A3B8",
    strokeWidth: 1.5,
  };

  // Expose methods to update canvas from parent
  useImperativeHandle(ref, () => ({
    updateBranchNodeText: (branchId: string, text: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === branchId && node.type === "conditionBranch") {
            return {
              ...node,
              data: {
                ...node.data,
                conditionText: text,
              },
            };
          }
          return node;
        })
      );
    },
    addBranchNode: (conditionNodeId: string, branchId: string, branchIndex: number) => {
      // Find the condition node to get its position
      setNodes((nds) => {
        const conditionNode = nds.find(n => n.id === conditionNodeId);
        if (!conditionNode) return nds;

        // Get timestamp from condition node ID for matching branches
        const timestamp = conditionNodeId.replace('condition-', '');

        // Find all existing branches for this condition
        const existingBranches = nds.filter(n =>
          n.type === "conditionBranch" && n.id.startsWith(`branch-${timestamp}-`)
        );

        // New total count after adding this branch
        const newTotalCount = existingBranches.length + 1;
        const branchSpacing = 160;
        const totalBranchWidth = (newTotalCount - 1) * branchSpacing;
        const branchY = conditionNode.position.y + 80;

        // Create new branch node at its centered position
        const newBranchOffsetX = -totalBranchWidth / 2 + branchIndex * branchSpacing;
        const newBranchNode: Node = {
          id: branchId,
          type: "conditionBranch",
          position: { x: conditionNode.position.x + newBranchOffsetX, y: branchY },
          data: {
            conditionText: "",
            conditionIndex: branchIndex + 1,
            onSelectAction: (actionId: string, sourceNodeId?: string) => handleSelectActionRef.current(actionId, sourceNodeId),
          },
        };

        // Reposition all existing branches to be centered with the new count
        const updatedNodes = nds.map(node => {
          if (node.id === conditionNodeId) {
            const existingConditions = (node.data?.conditions as Array<{id: string; text: string}>) || [];
            return {
              ...node,
              data: {
                ...node.data,
                conditions: [...existingConditions, { id: branchId, text: "" }],
              },
            };
          }
          // Reposition existing branches
          if (node.type === "conditionBranch" && node.id.startsWith(`branch-${timestamp}-`)) {
            const branchIdxMatch = node.id.match(/branch-\d+-(\d+)/);
            if (branchIdxMatch) {
              const existingIdx = parseInt(branchIdxMatch[1], 10);
              const repositionedOffsetX = -totalBranchWidth / 2 + existingIdx * branchSpacing;
              return {
                ...node,
                position: { x: conditionNode.position.x + repositionedOffsetX, y: branchY },
              };
            }
          }
          return node;
        });

        return updatedNodes.concat(newBranchNode);
      });

      // Add edge from condition to new branch (structural - no "+" on hover)
      // Filter out any existing edge with the same ID to avoid duplicates
      const newEdgeId = `e-${conditionNodeId}-${branchId}`;
      setEdges((eds) => [
        ...eds.filter(e => e.id !== newEdgeId),
        {
          id: newEdgeId,
          source: conditionNodeId,
          sourceHandle: `branch-${branchIndex}`,
          target: branchId,
          type: "addButton",
          style: edgeStyleForRef,
          data: { isStructural: true },
        },
      ]);
    },
    removeBranchNode: (conditionNodeId: string, branchId: string, branchIndex: number, updatedConditions: Array<{id: string; text: string}>) => {
      // Get timestamp from condition node ID
      const timestamp = conditionNodeId.replace('condition-', '');

      setNodes((nds) => {
        const conditionNode = nds.find(n => n.id === conditionNodeId);
        if (!conditionNode) return nds;

        // Calculate new positioning for remaining branches
        const newTotalCount = updatedConditions.length;
        const branchSpacing = 160;
        const totalBranchWidth = (newTotalCount - 1) * branchSpacing;
        const branchY = conditionNode.position.y + 80;

        // Filter out the deleted branch node
        const filteredNodes = nds.filter(n => n.id !== branchId);

        // Update condition node and reposition remaining branches
        return filteredNodes.map((node, _) => {
          if (node.id === conditionNodeId) {
            // Update condition node with new conditions (reindexed)
            const reindexedConditions = updatedConditions.map((c, i) => ({
              id: `branch-${timestamp}-${i}`,
              text: c.text,
            }));
            return {
              ...node,
              data: {
                ...node.data,
                conditions: reindexedConditions,
              },
            };
          }
          // Reposition and reindex remaining branches
          if (node.type === "conditionBranch" && node.id.startsWith(`branch-${timestamp}-`)) {
            const branchIdxMatch = node.id.match(/branch-\d+-(\d+)/);
            if (branchIdxMatch) {
              const oldIdx = parseInt(branchIdxMatch[1], 10);
              // Calculate new index (accounting for deleted branch)
              const newIdx = oldIdx > branchIndex ? oldIdx - 1 : oldIdx;
              const repositionedOffsetX = -totalBranchWidth / 2 + newIdx * branchSpacing;

              // Rename the branch node ID if needed
              const newBranchId = `branch-${timestamp}-${newIdx}`;
              return {
                ...node,
                id: newBranchId,
                position: { x: conditionNode.position.x + repositionedOffsetX, y: branchY },
                data: {
                  ...node.data,
                  conditionIndex: newIdx + 1,
                },
              };
            }
          }
          return node;
        });
      });

      // Remove the edge to the deleted branch and update remaining edges
      setEdges((eds) => {
        // Remove edge to deleted branch
        const filteredEdges = eds.filter(e => e.target !== branchId);

        // Update remaining edges with new sourceHandles
        return filteredEdges.map(edge => {
          if (edge.source === conditionNodeId && edge.sourceHandle?.startsWith('branch-')) {
            const handleMatch = edge.sourceHandle.match(/branch-(\d+)/);
            if (handleMatch) {
              const oldHandleIdx = parseInt(handleMatch[1], 10);
              if (oldHandleIdx > branchIndex) {
                // Decrement handle index
                const newHandleIdx = oldHandleIdx - 1;
                const newTargetId = `branch-${timestamp}-${newHandleIdx}`;
                return {
                  ...edge,
                  id: `e-${conditionNodeId}-${newTargetId}`,
                  sourceHandle: `branch-${newHandleIdx}`,
                  target: newTargetId,
                };
              }
            }
          }
          return edge;
        });
      });
    },
    updateConditionNodeData: (conditionNodeId: string, conditions: Array<{id: string; text: string}>) => {
      // Update the condition node's data.conditions array to sync handles
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === conditionNodeId && node.type === "condition") {
            return {
              ...node,
              data: {
                ...node.data,
                conditions,
              },
            };
          }
          return node;
        })
      );
    },
    deleteNode: (nodeId: string) => {
      // Don't allow deleting the trigger node
      const nodeToDelete = nodes.find(n => n.id === nodeId);
      if (!nodeToDelete || nodeToDelete.type === "messageReceived") {
        return;
      }

      // Find ALL nodes that have an edge pointing to this node (they'll lose their outgoing edge)
      const nodesPointingToDeleted = edges
        .filter(e => e.target === nodeId)
        .map(e => e.source);

      // Remove the node and update source nodes that were pointing to it
      setNodes((nds) => nds
        .filter((node) => node.id !== nodeId)
        .map((node) => {
          if (nodesPointingToDeleted.includes(node.id)) {
            return {
              ...node,
              data: { ...node.data, hasOutgoingEdge: false },
            };
          }
          return node;
        })
      );

      // Remove all edges connected to this node
      setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));

      // If deleting a condition node, also delete its branch nodes
      if (nodeToDelete.type === "condition") {
        const branchNodeIds = nodes
          .filter(n => n.type === "conditionBranch" && n.id.includes(nodeId.replace("condition-", "")))
          .map(n => n.id);

        setNodes((nds) => nds.filter((node) => !branchNodeIds.includes(node.id)));
        setEdges((eds) => eds.filter((edge) =>
          !branchNodeIds.includes(edge.source) && !branchNodeIds.includes(edge.target)
        ));
      }
    },
    updateNodeLabel: (nodeId: string, newLabel: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                label: newLabel,
              },
            };
          }
          return node;
        })
      );
    },
    replaceNode: (nodeId: string, newType: string, newData: Record<string, unknown>) => {
      // Find the node to replace
      const nodeToReplace = nodes.find(n => n.id === nodeId);
      if (!nodeToReplace || nodeToReplace.type === "messageReceived") {
        return nodeId; // Don't replace trigger node
      }

      // Generate new node ID
      const newNodeId = `node-${Date.now()}`;

      // Replace the node with a new one at the same position
      setNodes((nds) => nds.map((node) => {
        if (node.id === nodeId) {
          return {
            id: newNodeId,
            type: newType,
            position: node.position,
            data: {
              ...newData,
              hasOutgoingEdge: node.data?.hasOutgoingEdge || false,
              onSelectAction: (actionId: string, sourceNodeId?: string) => handleSelectActionRef.current(actionId, sourceNodeId),
            },
          };
        }
        return node;
      }));

      // Update edges to point to the new node ID
      setEdges((eds) => eds.map((edge) => {
        if (edge.source === nodeId) {
          return { ...edge, id: `e-${newNodeId}-${edge.target}`, source: newNodeId };
        }
        if (edge.target === nodeId) {
          return { ...edge, id: `e-${edge.source}-${newNodeId}`, target: newNodeId };
        }
        return edge;
      }));

      // Notify parent of flow change
      onFlowChangeRef.current?.();

      // Return the new node ID so the parent can select it
      return newNodeId;
    },
    getFlowData: () => {
      // Return a clean version of the flow data (without internal handlers)
      // Filter out the "add" placeholder node
      const cleanNodes = nodes
        .filter((node) => node.type !== "addNode")
        .map((node) => {
          const cleanData: Record<string, unknown> = {};
          if (node.data?.label) cleanData.label = node.data.label;
          if (node.data?.rolePreview) cleanData.rolePreview = node.data.rolePreview;
          if (node.data?.integrations) cleanData.integrations = node.data.integrations;
          if (node.data?.conditions) cleanData.conditions = node.data.conditions;
          if (node.data?.conditionText) cleanData.conditionText = node.data.conditionText;
          if (node.data?.conditionIndex !== undefined) cleanData.conditionIndex = node.data.conditionIndex;
          if (node.data?.icon) cleanData.icon = node.data.icon;
          if (node.data?.hasWarning !== undefined) cleanData.hasWarning = node.data.hasWarning;
          if (node.data?.outputs) cleanData.outputs = node.data.outputs;
          if (node.data?.model) cleanData.model = node.data.model;
          if (node.data?.forceSelectBranch !== undefined) cleanData.forceSelectBranch = node.data.forceSelectBranch;
          if (node.data?.variant) cleanData.variant = node.data.variant;
          if (node.data?.actionType) cleanData.actionType = node.data.actionType;

          return {
            id: node.id,
            type: node.type || "unknown",
            position: node.position,
            data: cleanData,
          };
        });

      // Filter out edges connected to "add" node and internal data
      const cleanEdges = edges
        .filter((edge) => edge.source !== "add" && edge.target !== "add")
        .map((edge) => {
          const cleanEdge: {
            id: string;
            source: string;
            target: string;
            sourceHandle?: string;
            targetHandle?: string;
          } = {
            id: edge.id,
            source: edge.source,
            target: edge.target,
          };
          if (edge.sourceHandle) cleanEdge.sourceHandle = edge.sourceHandle;
          if (edge.targetHandle) cleanEdge.targetHandle = edge.targetHandle;
          return cleanEdge;
        });

      return {
        nodes: cleanNodes,
        edges: cleanEdges,
      };
    },
  }), [nodes, edges, setNodes, setEdges]);

  // Force update when flowKey changes (template data arrives) and add handlers
  const prevFlowKeyRef = useRef(flowKey);
  useEffect(() => {
    const flowKeyChanged = prevFlowKeyRef.current !== flowKey;

    if (flowKeyChanged && initialFlowData?.nodes) {
      setNodes(initialNodes);
      setEdges(initialEdges);
      prevFlowKeyRef.current = flowKey;
    }

    // Always add handlers after a small delay (for both initial mount and flowKey changes)
    const timeoutId = setTimeout(() => {
      setNodes((nds) =>
        nds.map((node) => {
          // Node types that need the integrated "+" button (onSelectAction handler)
          const needsSelectAction = ["conditionBranch", "chatAgent", "searchKnowledgeBase", "action", "agentStep", "loop", "peopleDataLabs"].includes(node.type || "");

          if (needsSelectAction && !node.data?.onSelectAction) {
            return {
              ...node,
              data: {
                ...node.data,
                onSelectAction: (actionId: string, sourceNodeId?: string) => handleSelectActionRef.current(actionId, sourceNodeId),
              },
            };
          }
          // Update condition nodes with onAddCondition
          if (node.type === "condition" && !node.data?.onAddCondition) {
            return {
              ...node,
              data: {
                ...node.data,
                onAddCondition: handleAddConditionRef.current,
              },
            };
          }
          return node;
        })
      );
    }, 10);

    return () => clearTimeout(timeoutId);
  }, [flowKey, initialFlowData, initialNodes, initialEdges, setNodes, setEdges]);

  // Update edges with onInsertNode handler after mount (preserve isStructural and isPlaceholder flags)
  useEffect(() => {
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        type: "addButton",
        data: {
          ...edge.data,
          onInsertNode: handleInsertNodeRef.current,
          // Preserve the isStructural flag if it exists
          isStructural: (edge.data as { isStructural?: boolean })?.isStructural,
          // Preserve the isPlaceholder flag if it exists
          isPlaceholder: (edge.data as { isPlaceholder?: boolean })?.isPlaceholder,
        },
      }))
    );
  }, [setEdges]);

  // Update edges with selectedNodeId for highlighting
  useEffect(() => {
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        data: {
          ...edge.data,
          selectedNodeId,
        },
      }))
    );
  }, [selectedNodeId, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Map action IDs to node types
  const getNodeTypeForAction = (actionId: string): string => {
    // Handle PDL sub-actions - all map to peopleDataLabs node type
    if (actionId.startsWith("pdl-")) {
      return "peopleDataLabs";
    }
    // Handle Google Sheets sub-actions - all map to googleSheets node type
    if (actionId.startsWith("gs-")) {
      return "googleSheets";
    }

    const actionToNodeType: Record<string, string> = {
      "knowledge-base": "searchKnowledgeBase",
      "condition": "condition",
      "select-action": "selectAction",
      "agent-step": "agentStep",
      "loop": "loop",
      "observe-messages": "chatAgent",
      "send-message": "chatAgent",
      "people-data": "peopleDataLabs",
      // Integration node types
      "google-sheets": "googleSheets",
      "google-drive": "googleDrive",
      "google-docs": "googleDocs",
      "google-calendar": "googleCalendar",
      "gmail": "gmail",
      "outlook": "outlook",
      "outlook-calendar": "outlookCalendar",
      "teams": "microsoftTeams",
      "slack": "slack",
      "notion": "notion",
    };
    // Default to "action" type for all other actions
    return actionToNodeType[actionId] || "action";
  };

  // Handle adding a new node when action is selected
  // sourceNodeId is optional - if provided, adds after that node; otherwise uses "add" node
  const handleSelectAction = useCallback((actionId: string, sourceNodeId?: string) => {
    // If it's "action", open the full modal for more options
    if (actionId === "action") {
      pendingSourceNodeRef.current = sourceNodeId; // Remember where we came from
      setShowActionModal(true);
      return;
    }

    // If it's "knowledge-base", open the KB source selection modal
    if (actionId === "knowledge-base") {
      pendingSourceNodeRef.current = sourceNodeId; // Remember where we came from
      setShowKBModal(true);
      return;
    }

    // Special handling for condition - creates a condition node with 1 branch by default
    if (actionId === "condition") {
      const timestamp = Date.now();
      const conditionNodeId = `condition-${timestamp}`;
      const branch1Id = `branch-${timestamp}-0`;

      // Determine position - if from a branch node, position below it; otherwise use "add" node
      let conditionPosition = { x: 250, y: 300 };
      if (sourceNodeId) {
        const sourceNode = nodes.find(n => n.id === sourceNodeId);
        if (sourceNode) {
          conditionPosition = {
            x: sourceNode.position.x,
            y: sourceNode.position.y + 100,
          };
        }
      } else {
        const addNode = nodes.find(n => n.id === "add");
        if (addNode) {
          conditionPosition = { x: addNode.position.x - 30, y: addNode.position.y };
        }
      }

      // Create condition node with 1 branch
      const conditionNode: Node = {
        id: conditionNodeId,
        type: "condition",
        position: conditionPosition,
        data: {
          label: "Condition",
          conditions: [
            { id: branch1Id, text: "" },
          ],
          onAddCondition: handleAddConditionRef.current,
        },
      };

      // Create single branch node below the condition (centered - offset 0 for single branch)
      const branchY = conditionPosition.y + 80;
      const branch1Node: Node = {
        id: branch1Id,
        type: "conditionBranch",
        position: { x: conditionPosition.x, y: branchY }, // Centered under condition
        data: {
          conditionText: "",
          conditionIndex: 1,
          onSelectAction: (actionId: string, sourceNodeId?: string) => handleSelectActionRef.current(actionId, sourceNodeId),
        },
      };

      // Update nodes - remove "add" node only if not adding from a specific source
      setNodes((nds) => {
        if (sourceNodeId) {
          // Adding from a branch - just add the new nodes
          return nds.concat([conditionNode, branch1Node]);
        } else {
          // Adding from "add" node - remove it
          return nds
            .filter((n) => n.id !== "add")
            .concat([conditionNode, branch1Node]);
        }
      });

      // Add edges
      setEdges((eds) => {
        // Determine the actual source - use provided sourceNodeId or find from "add" node
        let effectiveSourceId = sourceNodeId;
        if (!sourceNodeId) {
          const edgeToAdd = eds.find(e => e.target === "add");
          effectiveSourceId = edgeToAdd?.source || "trigger";
        }

        const filteredEdges = sourceNodeId
          ? eds // Keep all edges when adding from a branch
          : eds.filter(e => e.target !== "add"); // Remove edge to "add" when replacing it

        return filteredEdges.concat([
          // Edge from previous node to condition (workflow edge - shows "+" on hover)
          {
            id: `e-${effectiveSourceId}-${conditionNodeId}`,
            source: effectiveSourceId || "trigger",
            target: conditionNodeId,
            type: "addButton",
            style: edgeStyle,
            data: { onInsertNode: handleInsertNodeRef.current },
          },
          // Edge from condition to branch 1 (structural - no "+" on hover)
          {
            id: `e-${conditionNodeId}-${branch1Id}`,
            source: conditionNodeId,
            sourceHandle: "branch-0",
            target: branch1Id,
            type: "addButton",
            style: edgeStyle,
            data: { isStructural: true },
          },
        ]);
      });

      // Notify parent to sync flowNodesData with initial conditions
      const initialConditions = [{ id: branch1Id, text: "" }];
      onConditionAddedRef.current?.(conditionNodeId, initialConditions);

      // Select the new condition node visually and pass to parent
      setSelectedNodeId(conditionNodeId);
      onNodeSelectRef.current?.(conditionNodeId, "condition");

      // Notify parent of flow change
      onFlowChangeRef.current?.();
      return;
    }

    const nodeType = getNodeTypeForAction(actionId);
    const newNodeId = `node-${Date.now()}`;

    // Determine position based on source node or "add" node
    let newNodePosition = { x: 250, y: 300 };
    let effectiveSourceId = sourceNodeId;

    if (sourceNodeId) {
      // Adding after a specific node (e.g., branch) - place where the "+" button was
      const sourceNode = nodes.find(n => n.id === sourceNodeId);
      if (sourceNode) {
        newNodePosition = {
          x: sourceNode.position.x,
          y: sourceNode.position.y + 100,
        };
      }
    } else {
      // Adding via global "add" node
      const addNode = nodes.find(n => n.id === "add");
      if (addNode) {
        newNodePosition = { x: addNode.position.x - 55, y: addNode.position.y };
        // Find what was connected to "add"
        const edgeToAdd = edges.find(e => e.target === "add");
        effectiveSourceId = edgeToAdd?.source || "step1";
      }
    }

    // Determine node data based on action type - include onSelectAction for integrated "+" button
    let nodeData: Record<string, unknown> = {
      label: actionId,
      hasOutgoingEdge: false,
      onSelectAction: (actionId: string, sourceNodeId?: string) => handleSelectActionRef.current(actionId, sourceNodeId),
    };
    if (actionId === "observe-messages") {
      nodeData = { label: "Observe messages", variant: "observe", hasOutgoingEdge: false, onSelectAction: (actionId: string, sourceNodeId?: string) => handleSelectActionRef.current(actionId, sourceNodeId) };
    } else if (actionId === "send-message") {
      // Send message has hasOutgoingEdge: true because it always connects to outcome nodes
      nodeData = { label: "Send message", variant: "send", hasOutgoingEdge: true, onSelectAction: (actionId: string, sourceNodeId?: string) => handleSelectActionRef.current(actionId, sourceNodeId) };
    } else if (actionId === "people-data") {
      nodeData = { label: "Search for leads", hasOutgoingEdge: false, onSelectAction: (actionId: string, sourceNodeId?: string) => handleSelectActionRef.current(actionId, sourceNodeId) };
    } else if (actionId.startsWith("pdl-")) {
      // People Data Labs sub-actions
      const pdlLabels: Record<string, string> = {
        "pdl-find-by-email": "Find person by email",
        "pdl-find-by-full-name": "Find person by full name",
        "pdl-find-by-partial-name": "Find person by partial name",
        "pdl-find-by-phone": "Find person by phone",
        "pdl-find-by-social": "Find Person by Social Network",
        "pdl-search-companies": "Search for Companies",
        "pdl-search-people": "Search for People",
      };
      nodeData = {
        label: pdlLabels[actionId] || "People Data Labs",
        actionType: actionId,
        hasOutgoingEdge: false,
        onSelectAction: (actionId: string, sourceNodeId?: string) => handleSelectActionRef.current(actionId, sourceNodeId)
      };
    } else if (actionId.startsWith("gs-")) {
      // Google Sheets sub-actions
      const gsLabels: Record<string, string> = {
        "gs-append-row": "Append row",
        "gs-append-rows": "Append rows",
        "gs-clear-range": "Clear range",
        "gs-copy-sheet": "Copy sheet",
        "gs-create-spreadsheet": "Create spreadsheet",
        "gs-delete-rows": "Delete rows",
        "gs-delete-sheet": "Delete sheet",
        "gs-find-row": "Find row",
        "gs-find-rows": "Find rows",
        "gs-get-cell": "Get cell",
        "gs-get-range": "Get range",
        "gs-get-row": "Get row",
        "gs-get-sheet-names": "Get sheet names",
        "gs-get-values": "Get values",
        "gs-insert-column": "Insert column",
        "gs-insert-row": "Insert row",
        "gs-insert-rows": "Insert rows",
        "gs-lookup": "Lookup",
        "gs-move-row": "Move row",
        "gs-read-sheet": "Read sheet",
        "gs-rename-sheet": "Rename sheet",
        "gs-set-cell": "Set cell",
        "gs-set-range": "Set range",
        "gs-sort-range": "Sort range",
        "gs-update-row": "Update row",
        "gs-update-rows": "Update rows",
      };
      nodeData = {
        label: gsLabels[actionId] || "Google Sheets",
        actionId: actionId,
        hasOutgoingEdge: false,
        onSelectAction: (actionId: string, sourceNodeId?: string) => handleSelectActionRef.current(actionId, sourceNodeId)
      };
    } else if (nodeType === "action") {
      // For action nodes from AddActionModal, include the icon and format the label
      const labelMap: Record<string, string> = {
        "google-sheets": "Google Sheets",
        "google-drive": "Google Drive",
        "google-calendar": "Google Calendar",
        "gmail": "Gmail",
        "slack": "Slack",
        "discord": "Discord",
        "hubspot": "HubSpot",
        "notion": "Notion",
        "airtable": "Airtable",
        "zapier": "Zapier",
        "stripe": "Stripe",
        "twilio": "Twilio",
        "sendgrid": "SendGrid",
        "mailchimp": "Mailchimp",
        "salesforce": "Salesforce",
        "zendesk": "Zendesk",
        "intercom": "Intercom",
        "jira": "Jira",
        "asana": "Asana",
        "trello": "Trello",
        "monday": "Monday.com",
        "linear": "Linear",
        "github": "GitHub",
        "gitlab": "GitLab",
        "bitbucket": "Bitbucket",
        "aws": "AWS",
        "azure": "Azure",
        "gcp": "Google Cloud",
        "dropbox": "Dropbox",
        "box": "Box",
        "onedrive": "OneDrive",
        "typeform": "Typeform",
        "surveymonkey": "SurveyMonkey",
        "calendly": "Calendly",
        "zoom": "Zoom",
        "teams": "Microsoft Teams",
        "webex": "Webex",
        "telegram": "Telegram",
        "whatsapp": "WhatsApp",
        "twitter": "Twitter",
        "facebook": "Facebook",
        "instagram": "Instagram",
        "linkedin": "LinkedIn",
        "youtube": "YouTube",
        "tiktok": "TikTok",
        "reddit": "Reddit",
        "pinterest": "Pinterest",
        "shopify": "Shopify",
        "woocommerce": "WooCommerce",
        "magento": "Magento",
        "bigcommerce": "BigCommerce",
        "quickbooks": "QuickBooks",
        "xero": "Xero",
        "freshbooks": "FreshBooks",
        "wave": "Wave",
        "web-browser": "Web browser",
        "http": "HTTP Request",
        "ai": "AI",
        "generate-media": "Generate media",
        "meeting-recorder": "Meeting recorder",
        "nodebase-phone": "Nodebase phone",
        "utilities": "Utilities",
        "perplexity": "Perplexity",
        "people-data-labs": "People Data Labs",
        "outlook": "Microsoft Outlook",
        "apollo": "Apollo",
        "clearbit": "Clearbit",
        "clay": "Clay",
        "hunter": "Hunter",
        "lemlist": "Lemlist",
        "snov": "Snov.io",
        "crunchbase": "Crunchbase",
      };
      nodeData = {
        label: labelMap[actionId] || actionId.charAt(0).toUpperCase() + actionId.slice(1).replace(/-/g, ' '),
        icon: actionId,
        hasOutgoingEdge: false,
        onSelectAction: (actionId: string, sourceNodeId?: string) => handleSelectActionRef.current(actionId, sourceNodeId),
      };
    }

    // Create new node
    const newNode: Node = {
      id: newNodeId,
      type: nodeType,
      position: newNodePosition,
      data: nodeData,
    };

    // For send-message, also create the two outcome nodes
    const isSendMessage = actionId === "send-message";
    const outcomeNodes: Node[] = [];
    if (isSendMessage) {
      const outcomeY = newNodePosition.y + 60;
      const leftOutcomeId = `${newNodeId}-outcome-sent`;
      const rightOutcomeId = `${newNodeId}-outcome-reply`;

      outcomeNodes.push({
        id: leftOutcomeId,
        type: "chatOutcome",
        position: { x: newNodePosition.x - 60, y: outcomeY },
        data: {
          label: "After message sent",
          hasOutgoingEdge: false,
          onSelectAction: (actionId: string, sourceNodeId?: string) => handleSelectActionRef.current(actionId, sourceNodeId),
        },
      });
      outcomeNodes.push({
        id: rightOutcomeId,
        type: "chatOutcome",
        position: { x: newNodePosition.x + 60, y: outcomeY },
        data: {
          label: "After reply received",
          hasOutgoingEdge: false,
          onSelectAction: (actionId: string, sourceNodeId?: string) => handleSelectActionRef.current(actionId, sourceNodeId),
        },
      });
    }

    // Update nodes
    setNodes((nds) => {
      const nodesToAdd = [newNode, ...outcomeNodes];
      if (sourceNodeId) {
        // Add the new node(s) and mark the source node as having an outgoing edge
        return nds.map((n) => {
          if (n.id === sourceNodeId) {
            return {
              ...n,
              data: { ...n.data, hasOutgoingEdge: true },
            };
          }
          return n;
        }).concat(nodesToAdd);
      } else {
        // Move the "add" button down (extra space for outcome nodes if send-message)
        const yOffset = isSendMessage ? 140 : 70;
        return nds.map((n) => {
          if (n.id === "add") {
            return {
              ...n,
              position: { x: n.position.x, y: n.position.y + yOffset },
            };
          }
          return n;
        }).concat(nodesToAdd);
      }
    });

    // Add edges (workflow edges - show "+" on hover)
    setEdges((eds) => {
      // For send-message, we don't add edges from the chatAgent to "add" node
      // because the outcome nodes have their own "+" buttons

      // Dashed edge style for outcome connections
      const dashedEdgeStyle = {
        stroke: "#94A3B8",
        strokeWidth: 1.5,
        strokeDasharray: "4,4",
      };

      if (sourceNodeId) {
        // Add edge from source to new node
        const newEdges: Edge[] = [{
          id: `e-${sourceNodeId}-${newNodeId}`,
          source: sourceNodeId,
          target: newNodeId,
          type: "addButton",
          style: edgeStyle,
          data: { onInsertNode: handleInsertNodeRef.current },
        }];

        // For send-message, add dashed edges to outcome nodes
        if (isSendMessage) {
          const leftOutcomeId = `${newNodeId}-outcome-sent`;
          const rightOutcomeId = `${newNodeId}-outcome-reply`;
          newEdges.push({
            id: `e-${newNodeId}-${leftOutcomeId}`,
            source: newNodeId,
            target: leftOutcomeId,
            style: dashedEdgeStyle,
          });
          newEdges.push({
            id: `e-${newNodeId}-${rightOutcomeId}`,
            source: newNodeId,
            target: rightOutcomeId,
            style: dashedEdgeStyle,
          });
        }

        return eds.concat(newEdges);
      } else {
        // Reconnect edges through new node
        const newEdges: Edge[] = [
          {
            id: `e-${effectiveSourceId}-${newNodeId}`,
            source: effectiveSourceId || "step1",
            target: newNodeId,
            type: "addButton",
            style: edgeStyle,
            data: { onInsertNode: handleInsertNodeRef.current },
          },
        ];

        // For send-message, add dashed edges to outcome nodes
        if (isSendMessage) {
          const leftOutcomeId = `${newNodeId}-outcome-sent`;
          const rightOutcomeId = `${newNodeId}-outcome-reply`;
          newEdges.push({
            id: `e-${newNodeId}-${leftOutcomeId}`,
            source: newNodeId,
            target: leftOutcomeId,
            style: dashedEdgeStyle,
          });
          newEdges.push({
            id: `e-${newNodeId}-${rightOutcomeId}`,
            source: newNodeId,
            target: rightOutcomeId,
            style: dashedEdgeStyle,
          });
        } else {
          // For non-send-message nodes, add the placeholder edge to "add" node
          newEdges.push({
            id: `e-${newNodeId}-add`,
            source: newNodeId,
            target: "add",
            type: "addButton",
            style: edgeStyle,
            data: { isPlaceholder: true },
          });
        }

        return eds
          .filter(e => e.target !== "add")
          .concat(newEdges);
      }
    });

    // Select the new node visually and pass the initial data to parent
    setSelectedNodeId(newNodeId);
    onNodeSelectRef.current?.(newNodeId, nodeType, nodeData);

    // Notify parent of flow change
    onFlowChangeRef.current?.();
  }, [nodes, edges, setNodes, setEdges]);

  // Handle adding a new condition branch to a condition node
  const handleAddCondition = useCallback((conditionNodeId: string) => {
    // Extract timestamp from condition node ID
    const timestamp = conditionNodeId.replace('condition-', '');

    // Find the condition node
    const conditionNode = nodes.find(n => n.id === conditionNodeId);
    if (!conditionNode) return;

    // Get current conditions
    const currentConditions = (conditionNode.data?.conditions as Array<{id: string; text: string}>) || [];
    const newIndex = currentConditions.length;
    const newBranchId = `branch-${timestamp}-${newIndex}`;

    // Calculate centered positioning for all branches (including the new one)
    const newTotalCount = currentConditions.length + 1;
    const branchSpacing = 160;
    const totalBranchWidth = (newTotalCount - 1) * branchSpacing;
    const branchY = conditionNode.position.y + 80;

    // Create new branch node at its centered position
    const newBranchOffsetX = -totalBranchWidth / 2 + newIndex * branchSpacing;
    const newBranchNode: Node = {
      id: newBranchId,
      type: "conditionBranch",
      position: { x: conditionNode.position.x + newBranchOffsetX, y: branchY },
      data: {
        conditionText: "",
        conditionIndex: newIndex + 1,
        onSelectAction: (actionId: string, sourceNodeId?: string) => handleSelectActionRef.current(actionId, sourceNodeId),
      },
    };

    // Update nodes: add new branch, update condition's data, and reposition existing branches
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === conditionNodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              conditions: [...currentConditions, { id: newBranchId, text: "" }],
            },
          };
        }
        // Reposition existing branches to stay centered
        if (node.type === "conditionBranch" && node.id.startsWith(`branch-${timestamp}-`)) {
          const branchIdxMatch = node.id.match(/branch-\d+-(\d+)/);
          if (branchIdxMatch) {
            const existingIdx = parseInt(branchIdxMatch[1], 10);
            const repositionedOffsetX = -totalBranchWidth / 2 + existingIdx * branchSpacing;
            return {
              ...node,
              position: { x: conditionNode.position.x + repositionedOffsetX, y: branchY },
            };
          }
        }
        return node;
      }).concat(newBranchNode)
    );

    // Add edge from condition to new branch (structural - no "+" on hover)
    // Filter out any existing edge with the same ID to avoid duplicates
    const newEdgeId = `e-${conditionNodeId}-${newBranchId}`;
    setEdges((eds) => [
      ...eds.filter(e => e.id !== newEdgeId),
      {
        id: newEdgeId,
        source: conditionNodeId,
        sourceHandle: `branch-${newIndex}`,
        target: newBranchId,
        type: "addButton",
        style: edgeStyle,
        data: { isStructural: true },
      },
    ]);

    // Notify parent of the new conditions (for right panel sync)
    const newConditions = [...currentConditions, { id: newBranchId, text: "" }];
    onConditionAddedRef.current?.(conditionNodeId, newConditions);

    // Select the condition node visually and open the right panel with all conditions
    setSelectedNodeId(conditionNodeId);
    onNodeSelectRef.current?.(conditionNodeId, "condition");

    // Notify parent of flow change
    onFlowChangeRef.current?.();
  }, [nodes, setNodes, setEdges, edgeStyle]);

  // Handle inserting a node in the middle of an edge
  const handleInsertNode = useCallback((edgeId: string, actionId: string) => {
    // Find the edge
    const edge = edges.find(e => e.id === edgeId);
    if (!edge) return;

    // Find source and target nodes
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return;

    // For special actions, delegate to existing handlers
    if (actionId === "action") {
      setShowActionModal(true);
      return;
    }
    if (actionId === "knowledge-base") {
      setShowKBModal(true);
      return;
    }

    const nodeType = actionId === "condition" ? "condition" :
                     actionId === "knowledge-base" ? "searchKnowledgeBase" :
                     actionId === "loop" ? "loop" :
                     actionId === "agent-step" ? "agentStep" : "agentStep";

    const newNodeId = `node-${Date.now()}`;

    // Calculate position (midpoint between source and target)
    const newNodePosition = {
      x: (sourceNode.position.x + targetNode.position.x) / 2,
      y: (sourceNode.position.y + targetNode.position.y) / 2,
    };

    // Create new node
    const newNode: Node = {
      id: newNodeId,
      type: nodeType,
      position: newNodePosition,
      data: { label: actionId },
    };

    // Add the new node
    setNodes((nds) => nds.concat(newNode));

    // Update edges: remove old edge, add two new edges
    setEdges((eds) => {
      const filteredEdges = eds.filter(e => e.id !== edgeId);
      return filteredEdges.concat([
        {
          id: `e-${edge.source}-${newNodeId}`,
          source: edge.source,
          sourceHandle: edge.sourceHandle,
          target: newNodeId,
          type: "addButton",
          data: { onInsertNode: handleInsertNodeRef.current },
          style: edgeStyle,
        },
        {
          id: `e-${newNodeId}-${edge.target}`,
          source: newNodeId,
          target: edge.target,
          targetHandle: edge.targetHandle,
          type: "addButton",
          data: { onInsertNode: handleInsertNodeRef.current },
          style: edgeStyle,
        },
      ]);
    });

    // Select the new node visually and notify parent
    setSelectedNodeId(newNodeId);
    onNodeSelectRef.current?.(newNodeId, nodeType);

    // Notify parent of flow change
    onFlowChangeRef.current?.();
  }, [nodes, edges, setNodes, setEdges, edgeStyle]);

  // Update the refs so nodes can use the latest handlers
  handleSelectActionRef.current = handleSelectAction;
  handleAddConditionRef.current = handleAddCondition;
  handleInsertNodeRef.current = handleInsertNode;

  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes }) => {
      if (selectedNodes.length > 0) {
        const node = selectedNodes[0];
        setSelectedNodeId(node.id);
        // Filter out functions from node.data before passing to panel
        // This ensures variant, label, and other serializable data is passed correctly
        const nodeData = node.data as Record<string, unknown>;
        const dataForPanel = nodeData ? Object.fromEntries(
          Object.entries(nodeData).filter(([_, v]) => typeof v !== 'function')
        ) : {};
        onNodeSelectRef.current?.(node.id, node.type || null, dataForPanel);
      } else {
        setSelectedNodeId(null);
        onNodeSelectRef.current?.(null, null);
      }
    },
    []
  );

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    flowPosition: { x: number; y: number };
  } | null>(null);

  // Handle right-click on canvas
  const onPaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();

    // Get the position in the flow coordinate system
    const target = event.currentTarget as Element;
    const reactFlowBounds = target?.getBoundingClientRect?.() || { left: 0, top: 0 };
    const flowX = event.clientX - reactFlowBounds.left;
    const flowY = event.clientY - reactFlowBounds.top;

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      flowPosition: { x: flowX, y: flowY },
    });
  }, []);

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Handle context menu item click
  const handleContextMenuAction = useCallback((actionType: string) => {
    if (!contextMenu) return;

    const newNodeId = `node-${Date.now()}`;
    const position = contextMenu.flowPosition;

    let newNode: Node | null = null;

    switch (actionType) {
      case "trigger":
        newNode = {
          id: newNodeId,
          type: "messageReceived",
          position,
          data: {},
        };
        break;
      case "action":
        setShowActionModal(true);
        closeContextMenu();
        return;
      case "agent-step":
        newNode = {
          id: newNodeId,
          type: "agentStep",
          position,
          data: { rolePreview: "New agent step...", integrations: [] },
        };
        break;
      case "note":
        // TODO: Implement note node type
        console.log("Add note at", position);
        closeContextMenu();
        return;
    }

    if (newNode) {
      setNodes((nds) => [...nds, newNode!]);
    }

    closeContextMenu();
  }, [contextMenu, setNodes, closeContextMenu]);

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => closeContextMenu();
    if (contextMenu) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [contextMenu, closeContextMenu]);

  // Handle node deletion from keyboard (Delete/Backspace) - update all source nodes' hasOutgoingEdge
  const onNodesDelete = useCallback((deletedNodes: Node[]) => {
    // Don't allow deleting the trigger node
    const nodesToDelete = deletedNodes.filter(n => n.type !== "messageReceived");
    if (nodesToDelete.length === 0) return;

    const deletedNodeIds = new Set(nodesToDelete.map(n => n.id));

    // Find ALL nodes that have edges pointing to any deleted node (not just branches)
    const nodesToUpdate = edges
      .filter(e => deletedNodeIds.has(e.target))
      .map(e => e.source);

    // Update source nodes to reset hasOutgoingEdge
    if (nodesToUpdate.length > 0) {
      setNodes((nds) =>
        nds.map((node) => {
          if (nodesToUpdate.includes(node.id)) {
            return {
              ...node,
              data: { ...node.data, hasOutgoingEdge: false },
            };
          }
          return node;
        })
      );
    }

    // Notify parent of flow change
    onFlowChangeRef.current?.();
  }, [nodes, edges, setNodes]);

  return (
    <>
      <div className="w-full h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodesDelete={onNodesDelete}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          onPaneContextMenu={onPaneContextMenu}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: "addButton" }}
          fitView
          fitViewOptions={{ padding: 0.4, maxZoom: 0.65 }}
          minZoom={0.3}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          // Pan with scroll wheel / trackpad, drag to select
          panOnScroll={true}
          panOnDrag={[1, 2]} // Only pan with middle (1) or right (2) mouse button
          selectionOnDrag={true} // Enable selection box with left-click drag
          selectionMode={SelectionMode.Full} // Only fully enclosed nodes are selected
        >
          <Background
            variant={BackgroundVariant.Dots}
            color="#B0BEC5"
            gap={17}
            size={1.2}
          />
        </ReactFlow>

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => handleContextMenuAction("trigger")}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <CaretUp className="size-4 text-gray-400" />
              Add trigger
            </button>
            <button
              onClick={() => handleContextMenuAction("action")}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Sparkle className="size-4 text-gray-400" />
              Add action
            </button>
            <button
              onClick={() => handleContextMenuAction("agent-step")}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Robot className="size-4 text-gray-400" />
              Add agent step
            </button>
            <button
              onClick={() => handleContextMenuAction("note")}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Note className="size-4 text-gray-400" />
              Add note
            </button>
          </div>
        )}
      </div>

      <AddActionModal
        open={showActionModal}
        onOpenChange={(open) => {
          setShowActionModal(open);
          if (!open) {
            pendingSourceNodeRef.current = undefined; // Clear when modal closes
          }
        }}
        onSelectAction={(actionId) => {
          // Use the pending source node if available
          handleSelectAction(actionId, pendingSourceNodeRef.current);
          pendingSourceNodeRef.current = undefined; // Clear after use
        }}
      />

      <SelectKnowledgeBaseModal
        open={showKBModal}
        onOpenChange={(open) => {
          setShowKBModal(open);
          if (!open) {
            pendingSourceNodeRef.current = undefined; // Clear when modal closes
          }
        }}
        onSelectSource={(sourceId) => {
          // Create a searchKnowledgeBase node with the selected source
          const newNodeId = `node-${Date.now()}`;
          const pendingSource = pendingSourceNodeRef.current;

          // Determine position based on pending source or "add" node
          let newNodePosition = { x: 250, y: 300 };
          let effectiveSourceId: string | undefined;

          if (pendingSource) {
            const sourceNode = nodes.find(n => n.id === pendingSource);
            if (sourceNode) {
              newNodePosition = {
                x: sourceNode.position.x,
                y: sourceNode.position.y + 100,
              };
              effectiveSourceId = pendingSource;
            }
          } else {
            const addNode = nodes.find(n => n.id === "add");
            if (addNode) {
              newNodePosition = { x: addNode.position.x - 55, y: addNode.position.y };
            }
          }

          const newNode: Node = {
            id: newNodeId,
            type: "searchKnowledgeBase",
            position: newNodePosition,
            data: { label: `Search ${sourceId}`, source: sourceId },
          };

          if (pendingSource) {
            // Adding from a specific source node - just add the new node
            setNodes((nds) => nds.concat(newNode));

            setEdges((eds) => eds.concat({
              id: `e-${effectiveSourceId}-${newNodeId}`,
              source: effectiveSourceId || "trigger",
              target: newNodeId,
              type: "addButton",
              style: edgeStyle,
              data: { onInsertNode: handleInsertNodeRef.current },
            }));
          } else {
            // Adding via global "add" node
            setNodes((nds) =>
              nds.map((n) => {
                if (n.id === "add") {
                  return {
                    ...n,
                    position: { x: n.position.x, y: n.position.y + 70 },
                  };
                }
                return n;
              }).concat(newNode)
            );

            setEdges((eds) => {
              const edgeToAdd = eds.find(e => e.target === "add");
              const sourceNodeId = edgeToAdd?.source || "trigger";

              return eds
                .filter(e => e.target !== "add")
                .concat([
                  {
                    id: `e-${sourceNodeId}-${newNodeId}`,
                    source: sourceNodeId,
                    target: newNodeId,
                    type: "addButton",
                    style: edgeStyle,
                    data: { onInsertNode: handleInsertNodeRef.current },
                  },
                  {
                    id: `e-${newNodeId}-add`,
                    source: newNodeId,
                    target: "add",
                    type: "addButton",
                    style: edgeStyle,
                    data: { isPlaceholder: true }, // Placeholder edge - dashed, no hover "+"
                  },
                ]);
            });
          }

          pendingSourceNodeRef.current = undefined; // Clear after use
          setSelectedNodeId(newNodeId);
          onNodeSelectRef.current?.(newNodeId, "searchKnowledgeBase");
        }}
      />
    </>
  );
});
