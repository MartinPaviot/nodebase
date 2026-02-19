"use client";

import { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Button } from "@/components/ui/button";
import {
  Chats,
  DotsThree,
  Robot,
  Plus,
  Gear,
  X,
  Info,
  Check,
  TextT,
  ArrowsClockwise,
  Trash,
  CaretRight,
  MagnifyingGlass,
  CaretDown,
  ListBullets,
  GitBranch,
} from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@iconify/react";

// Skill type definition
interface Skill {
  id: string;
  name: string;
  service: string;
  icon: string;
  isPremium?: boolean;
}

// Default skills for demo
const DEFAULT_SKILLS: Skill[] = [
  { id: "1", name: "Append rows", service: "Google Sheets", icon: "logos:google-sheets" },
  { id: "2", name: "Find row", service: "Google Sheets", icon: "logos:google-sheets" },
  { id: "3", name: "Update column", service: "Google Sheets", icon: "logos:google-sheets" },
  { id: "4", name: "Update row", service: "Google Sheets", icon: "logos:google-sheets" },
  { id: "5", name: "Search for Co...", service: "People Data Labs", icon: "noto:busts-in-silhouette", isPremium: true },
  { id: "6", name: "Search for Pe...", service: "People Data Labs", icon: "noto:busts-in-silhouette", isPremium: true },
];

// Conversation starter type
interface ConversationStarter {
  id: string;
  text: string;
  enabled: boolean;
}

// Previous step for data injection
interface PreviousStep {
  id: string;
  label: string;
  type: string;
  icon?: string;
  fields?: { id: string; label: string }[];
}

interface FlowNodePanelProps {
  nodeType: "messageReceived" | "agentStep" | "chatAgent";
  nodeId: string;
  nodeName?: string;
  greetingMessage?: string;
  conversationStarters?: ConversationStarter[];
  prompt?: string;
  model?: string;
  askForConfirmation?: string;
  skills?: Skill[];
  variant?: "observe" | "send";
  message?: string;
  previousSteps?: PreviousStep[];
  onClose?: () => void;
  onDelete?: () => void;
  onRename?: (newName: string) => void;
  onReplace?: () => void;
  onUpdate?: (data: {
    greetingMessage?: string;
    conversationStarters?: ConversationStarter[];
    prompt?: string;
    model?: string;
    askForConfirmation?: string;
    skills?: Skill[];
    variant?: "observe" | "send";
    message?: string;
  }) => void;
}

// Default previous steps for demo
const DEFAULT_PREVIOUS_STEPS: PreviousStep[] = [
  {
    id: "message-received",
    label: "Message Received",
    type: "messageReceived",
    icon: "ph:chats-fill",
    fields: [
      { id: "message", label: "Message content" },
      { id: "sender", label: "Sender name" },
      { id: "timestamp", label: "Timestamp" },
    ],
  },
];

export function FlowNodePanel({
  nodeType,
  nodeName = "",
  greetingMessage = "",
  conversationStarters = [],
  prompt = "",
  model = "",
  askForConfirmation = "never",
  skills = DEFAULT_SKILLS,
  variant = "observe",
  message = "",
  previousSteps = DEFAULT_PREVIOUS_STEPS,
  onUpdate,
  onDelete,
  onRename,
  onReplace,
}: FlowNodePanelProps) {
  const [localGreeting, setLocalGreeting] = useState(greetingMessage);
  const [localMessage, setLocalMessage] = useState(message);
  const [localPrompt, setLocalPrompt] = useState(prompt);
  const [localModel, setLocalModel] = useState(model);
  const [localConfirmation, setLocalConfirmation] = useState(askForConfirmation);
  const [localSkills, setLocalSkills] = useState<Skill[]>(skills);

  // Rename dialog state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Open rename dialog with current name
  const openRenameDialog = () => {
    setRenameValue(nodeName || getDefaultLabel());
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

  // Inject data sidebar state (for send message panel)
  const [expandedSteps, setExpandedSteps] = useState<string[]>([]);
  const [injectSearch, setInjectSearch] = useState("");
  const [isMessageFocused, setIsMessageFocused] = useState(false);

  // Thread selector state
  const [isThreadExpanded, setIsThreadExpanded] = useState(false);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);

  // Handle injecting data from previous steps into the message textarea
  const handleInjectData = (stepId: string, fieldId: string) => {
    const placeholder = `{{${stepId}.${fieldId}}}`;
    const textarea = messageTextareaRef.current;

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = localMessage.slice(0, start) + placeholder + localMessage.slice(end);
      setLocalMessage(newValue);
      onUpdate?.({ message: newValue });

      // Restore focus and cursor position after the injected text
      setTimeout(() => {
        textarea.focus();
        const newPos = start + placeholder.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    } else {
      // Fallback: append to end
      const newValue = localMessage + placeholder;
      setLocalMessage(newValue);
      onUpdate?.({ message: newValue });
    }
  };


  // Get default label based on node type
  const getDefaultLabel = () => {
    if (nodeType === "agentStep") return "Agent Step";
    if (nodeType === "chatAgent") return variant === "observe" ? "Observe messages" : "Send message";
    if (nodeType === "messageReceived") return "Message Received";
    return "Node";
  };

  // Toggle step expansion in inject sidebar
  const toggleStepExpanded = (stepId: string) => {
    setExpandedSteps((prev) =>
      prev.includes(stepId)
        ? prev.filter((id) => id !== stepId)
        : [...prev, stepId]
    );
  };

  const [newStarter, setNewStarter] = useState("");

  const handleAddStarter = () => {
    if (newStarter.trim()) {
      const newItem: ConversationStarter = {
        id: `starter-${Date.now()}`,
        text: newStarter.trim(),
        enabled: true,
      };
      onUpdate?.({
        conversationStarters: [...conversationStarters, newItem],
      });
      setNewStarter("");
    }
  };

  const handleToggleStarter = (id: string) => {
    const updated = conversationStarters.map((s) =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    onUpdate?.({ conversationStarters: updated });
  };

  const handleRemoveStarter = (id: string) => {
    const updated = conversationStarters.filter((s) => s.id !== id);
    onUpdate?.({ conversationStarters: updated });
  };

  const handleRemoveSkill = (skillId: string) => {
    const updated = localSkills.filter(s => s.id !== skillId);
    setLocalSkills(updated);
    onUpdate?.({ skills: updated });
  };

  // Agent Step Panel
  if (nodeType === "agentStep") {
    const displayLabel = nodeName || "Agent Step";
    return (
      <div className="h-full overflow-auto">
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                <Robot className="size-4 text-white" weight="fill" />
              </div>
              <span
                className="font-semibold text-[16px] text-[#1a1a1a] cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded -mx-1"
                onClick={openRenameDialog}
              >
                {displayLabel}
              </span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-[#9CA3AF] hover:text-[#6B7280] p-1">
                  <DotsThree className="size-5" weight="bold" />
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
                <DropdownMenuItem className="gap-2 cursor-pointer" variant="destructive" onSelect={onDelete}>
                  <Trash className="size-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Description */}
          <p className="text-[11px] text-[#9CA3AF] mb-5 text-justify">
            Let AI decide what to do, until an exit condition is met.
          </p>

          {/* Prompt */}
          <div className="mb-5">
            <label className="text-[13px] font-medium text-[#374151] mb-2 block">
              Prompt <span className="text-[#9CA3AF] font-normal">(required)</span>
            </label>
            <Textarea
              value={localPrompt}
              onChange={(e) => {
                setLocalPrompt(e.target.value);
                onUpdate?.({ prompt: e.target.value });
              }}
              placeholder="Handle the user's follow-ups and lead requests..."
              className="min-h-[180px] bg-white border-[#E5E7EB] rounded-lg text-[13px] text-[#374151] placeholder:text-[#9CA3AF] resize-none focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>

          {/* Model */}
          <div className="mb-5">
            <label className="text-[13px] font-medium text-[#374151] mb-2 block">
              Model <span className="text-[#9CA3AF] font-normal">(required)</span>
            </label>
            <Select value={localModel} onValueChange={(v) => {
              setLocalModel(v);
              onUpdate?.({ model: v });
            }}>
              <SelectTrigger className="h-10 bg-white border-[#E5E7EB] rounded-lg text-[13px]">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                <SelectItem value="claude-4-5-sonnet">Claude 4.5 Sonnet</SelectItem>
                <SelectItem value="claude-4-5-haiku">Claude 4.5 Haiku</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ask for Confirmation */}
          <div className="mb-5">
            <div className="flex items-center gap-1 mb-1">
              <label className="text-[13px] font-medium text-[#374151]">
                Ask for Confirmation
              </label>
              <Info className="size-3.5 text-[#9CA3AF]" />
              <span className="text-[#9CA3AF] text-[13px] font-normal">(required)</span>
            </div>
            <p className="text-[12px] text-[#9CA3AF] mb-2 text-justify">
              Require this agent step to ask for confirmation before using any skills with side effects
            </p>
            <Select value={localConfirmation} onValueChange={(v) => {
              setLocalConfirmation(v);
              onUpdate?.({ askForConfirmation: v });
            }}>
              <SelectTrigger className="h-10 bg-white border-[#E5E7EB] rounded-lg text-[13px]">
                <SelectValue placeholder="Select option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="always">Always</SelectItem>
                <SelectItem value="side-effects">Only for side effects</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Skills */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-medium text-[#374151]">Skills</label>
              <button className="size-6 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors">
                <Plus className="size-3.5 text-white" weight="bold" />
              </button>
            </div>
            <p className="text-[12px] text-[#9CA3AF] mb-3 text-justify">
              Add actions for this agent to access when needed.
            </p>

            {/* Skills list */}
            <div className="space-y-1">
              {localSkills.map((skill) => (
                <div
                  key={skill.id}
                  className="flex items-center justify-between py-2 px-1 hover:bg-gray-50 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="size-6 rounded flex items-center justify-center bg-slate-50">
                      <Icon icon={skill.icon} className="size-4" />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-medium text-[#374151]">{skill.name}</span>
                        {skill.isPremium && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                            Premium
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#9CA3AF]">{skill.service}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {skill.isPremium && (
                      <button className="size-6 rounded flex items-center justify-center text-[#9CA3AF] hover:text-[#6B7280] hover:bg-gray-100">
                        <Info className="size-3.5" />
                      </button>
                    )}
                    <button className="size-6 rounded flex items-center justify-center text-[#9CA3AF] hover:text-[#6B7280] hover:bg-gray-100">
                      <Gear className="size-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemoveSkill(skill.id)}
                      className="size-6 rounded flex items-center justify-center text-[#9CA3AF] hover:text-[#6B7280] hover:bg-gray-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add exit condition */}
          <button className="flex items-center gap-2 text-[13px] text-[#6B7280] hover:text-[#374151] transition-colors">
            <Plus className="size-4" />
            <span>Add exit condition</span>
          </button>
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

  // Chat Agent Panel (Observe messages / Send message)
  if (nodeType === "chatAgent") {
    const defaultLabel = variant === "observe" ? "Observe messages" : "Send message";
    const displayLabel = nodeName || defaultLabel;
    const description = variant === "observe"
      ? "Observe messages from user chat"
      : "Sends a message to the user chat.";

    // For Send message variant - show with inject sidebar overlay on focus
    if (variant === "send") {
      return (
        <div className="relative h-full overflow-visible">
          {/* Inject data sidebar - positioned to the left of the panel */}
          {isMessageFocused && (
            <div
              className="absolute right-full top-[200px] w-[240px] min-h-[280px] border border-[#E5E7EB] rounded-xl bg-white shadow-xl z-50 flex flex-col animate-in slide-in-from-right-2 duration-200 mr-3"
              onMouseDown={(e) => e.preventDefault()}
            >
              {/* Search */}
              <div className="p-3">
                <div className="relative">
                  <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#9CA3AF]" />
                  <input
                    value={injectSearch}
                    onChange={(e) => setInjectSearch(e.target.value)}
                    placeholder="Search"
                    className="w-full h-9 pl-9 pr-3 text-[13px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {/* Inject data header */}
              <div className="px-4 py-2 border-t border-[#E5E7EB]">
                <span className="text-[12px] font-medium text-[#6B7280]">
                  Inject data from previous steps
                </span>
              </div>

              {/* Previous steps list */}
              <div className="flex-1 overflow-y-auto px-3 pb-3">
                {previousSteps.map((step) => (
                  <div key={step.id}>
                    <button
                      onClick={() => toggleStepExpanded(step.id)}
                      className="flex items-center gap-2.5 w-full px-2 py-2.5 hover:bg-[#F3F4F6] rounded-lg transition-colors text-left"
                    >
                      <CaretRight
                        className={`size-3.5 text-[#9CA3AF] transition-transform ${
                          expandedSteps.includes(step.id) ? "rotate-90" : ""
                        }`}
                        weight="bold"
                      />
                      <div className={`size-6 rounded-md flex items-center justify-center ${
                        step.type === "messageReceived" ? "bg-blue-100" :
                        step.type === "chatAgent" ? "bg-blue-100" :
                        step.type === "agentStep" ? "bg-indigo-100" :
                        step.type === "condition" || step.type === "conditionBranch" ? "bg-violet-100" :
                        "bg-gray-100"
                      }`}>
                        {step.type === "messageReceived" ? (
                          <Chats className="size-3.5 text-blue-600" weight="fill" />
                        ) : step.type === "chatAgent" ? (
                          <Chats className="size-3.5 text-blue-600" weight="fill" />
                        ) : step.type === "agentStep" ? (
                          <Robot className="size-3.5 text-indigo-600" weight="fill" />
                        ) : step.type === "condition" || step.type === "conditionBranch" ? (
                          <GitBranch className="size-3.5 text-violet-600" weight="bold" />
                        ) : (
                          <Gear className="size-3.5 text-gray-600" />
                        )}
                      </div>
                      <span className="text-[13px] font-medium text-[#374151]">
                        {step.label}
                      </span>
                    </button>

                    {/* Expanded fields */}
                    {expandedSteps.includes(step.id) && step.fields && (
                      <div className="ml-8 pl-3 border-l-2 border-[#E5E7EB] space-y-1 mt-1 mb-2">
                        {step.fields.map((field) => (
                          <button
                            key={field.id}
                            onClick={() => handleInjectData(step.id, field.id)}
                            className="flex items-center gap-2 w-full px-2 py-2 hover:bg-blue-50 rounded-lg text-left text-[12px] text-[#6B7280] hover:text-blue-600 transition-colors"
                          >
                            <span>{field.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main panel content */}
          <div className="h-full bg-white overflow-auto">
            {/* Compact header */}
            <div className="px-5 py-3 border-b border-[#E5E7EB]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
                    <Chats className="size-3.5 text-white" weight="fill" />
                  </div>
                  <div className="min-w-0">
                    <span
                      className="font-semibold text-[14px] text-[#1a1a1a] cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded -mx-1 block truncate"
                      onClick={openRenameDialog}
                    >
                      {displayLabel}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-[#9CA3AF]">
                      <span>Message Received</span>
                      <CaretRight className="size-2.5" weight="bold" />
                      <span className="text-[#6B7280]">Send message</span>
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="text-[#9CA3AF] hover:text-[#6B7280] p-1 shrink-0">
                      <DotsThree className="size-5" weight="bold" />
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
                    <DropdownMenuItem className="gap-2 cursor-pointer" variant="destructive" onSelect={onDelete}>
                      <Trash className="size-4" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="p-5">
              {/* Description */}
              <p className="text-[12px] text-[#9CA3AF] mb-5 text-justify">{description}</p>

              {/* Model Selection */}
              <div className="mb-5">
                <div className="flex items-center gap-1 mb-2">
                  <label className="text-[13px] font-medium text-[#374151]">Model (unused)</label>
                  <Info className="size-3.5 text-[#9CA3AF]" />
                  <span className="text-[12px] text-[#9CA3AF]">(required)</span>
                </div>
                <Select value={localModel} onValueChange={(v) => {
                  setLocalModel(v);
                  onUpdate?.({ model: v });
                }}>
                  <SelectTrigger className="h-10 bg-white border-[#E5E7EB] rounded-lg text-[13px]">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                    <SelectItem value="claude-4-5-sonnet">Claude 4.5 Sonnet</SelectItem>
                    <SelectItem value="claude-4-5-haiku">Claude 4.5 Haiku</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conversation Thread - Collapsible dropdown */}
              <div className="mb-5">
                <div className="flex items-center gap-1 mb-2">
                  <label className="text-[13px] font-medium text-[#374151]">Conversation thread</label>
                  <Info className="size-3.5 text-[#9CA3AF]" />
                </div>
                {/* Collapsible thread selector */}
                <div className={`rounded-lg ${selectedThread ? "border-2 border-blue-400" : "border border-[#E5E7EB]"}`}>
                  {/* Header - clickable to expand/collapse */}
                  <button
                    onClick={() => setIsThreadExpanded(!isThreadExpanded)}
                    className={`flex items-center gap-2 w-full h-10 px-3 rounded-lg transition-colors ${
                      selectedThread ? "bg-blue-50 hover:bg-blue-100" : "bg-white hover:bg-[#F9FAFB]"
                    }`}
                  >
                    <div className="size-5 rounded flex items-center justify-center shrink-0 bg-blue-100">
                      <Chats className="size-3 text-blue-600" weight="fill" />
                    </div>
                    <span className={`text-[13px] flex-1 text-left truncate ${selectedThread ? "text-blue-700 font-medium" : "text-[#374151]"}`}>
                      {selectedThread || "Select Thread"}
                    </span>
                    {selectedThread && (
                      <span className="text-[11px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                        {previousSteps.filter(s => s.type === "chatAgent" || s.type === "messageReceived").length}
                      </span>
                    )}
                    <CaretDown
                      className={`size-4 shrink-0 transition-transform ${selectedThread ? "text-blue-500" : "text-[#9CA3AF]"} ${isThreadExpanded ? "rotate-180" : ""}`}
                      weight="bold"
                    />
                  </button>

                  {/* Expanded content - thread options */}
                  {isThreadExpanded && (
                    <div className="border-t border-[#E5E7EB] bg-[#F9FAFB] rounded-b-lg">
                      {/* Chat with this Agent option - based on previous chat nodes */}
                      {previousSteps.some(s => s.type === "chatAgent" || s.type === "messageReceived") && (
                        <button
                          onClick={() => {
                            setSelectedThread("Chat with this Agent");
                            setIsThreadExpanded(false);
                          }}
                          className={`flex items-center gap-2 w-full px-3 py-2.5 hover:bg-blue-50 transition-colors rounded-b-lg ${
                            selectedThread === "Chat with this Agent" ? "bg-blue-50" : ""
                          }`}
                        >
                          <div className="size-5 rounded flex items-center justify-center shrink-0 bg-blue-100">
                            <Chats className="size-3 text-blue-600" weight="fill" />
                          </div>
                          <span className={`text-[13px] flex-1 text-left truncate ${selectedThread === "Chat with this Agent" ? "text-blue-700 font-medium" : "text-[#374151]"}`}>Chat with this Agent</span>
                          <span className="text-[11px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                            {previousSteps.filter(s => s.type === "chatAgent" || s.type === "messageReceived").length}
                          </span>
                        </button>
                      )}
                      {/* Fallback if no chat nodes */}
                      {!previousSteps.some(s => s.type === "chatAgent" || s.type === "messageReceived") && (
                        <div className="px-3 py-3 text-[12px] text-[#9CA3AF] text-center">
                          No conversation threads available
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Message field */}
              <div className="mb-5 relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1">
                    <label className="text-[13px] font-medium text-[#374151]">Message</label>
                    <span className="text-[12px] text-[#9CA3AF]">(required)</span>
                  </div>
                  <button className="flex items-center gap-1 text-[11px] text-[#6B7280] hover:text-[#374151] transition-colors">
                    <ListBullets className="size-3.5" />
                    <span>Set Manually</span>
                    <CaretDown className="size-3" />
                  </button>
                </div>
                <Textarea
                  ref={messageTextareaRef}
                  value={localMessage}
                  onChange={(e) => {
                    setLocalMessage(e.target.value);
                    onUpdate?.({ message: e.target.value });
                  }}
                  onFocus={() => setIsMessageFocused(true)}
                  onBlur={() => setIsMessageFocused(false)}
                  placeholder="Enter the message to send..."
                  className="min-h-[180px] bg-[#FAFAFA] border-[#E5E7EB] rounded-lg text-[13px] text-[#374151] placeholder:text-[#9CA3AF] resize-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                />
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

    // Observe messages variant - simpler layout
    return (
      <div className="w-[340px] border-l border-[#E5E7EB] bg-white h-full overflow-auto">
        {/* Compact header */}
        <div className="px-5 py-3 border-b border-[#E5E7EB]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
                <Chats className="size-3.5 text-white" weight="fill" />
              </div>
              <div className="min-w-0">
                <span
                  className="font-semibold text-[14px] text-[#1a1a1a] cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded -mx-1 block truncate"
                  onClick={openRenameDialog}
                >
                  {displayLabel}
                </span>
                <div className="flex items-center gap-1 text-[11px] text-[#9CA3AF]">
                  <span>Message Received</span>
                  <CaretRight className="size-2.5" weight="bold" />
                  <span className="text-[#6B7280]">Observe messages</span>
                </div>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-[#9CA3AF] hover:text-[#6B7280] p-1 shrink-0">
                  <DotsThree className="size-5" weight="bold" />
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
                <DropdownMenuItem className="gap-2 cursor-pointer" variant="destructive" onSelect={onDelete}>
                  <Trash className="size-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="p-5">
          {/* Description */}
          <p className="text-[12px] text-[#9CA3AF] mb-5 text-justify">{description}</p>

          {/* Model Selection */}
          <div className="mb-5">
            <div className="flex items-center gap-1 mb-2">
              <label className="text-[13px] font-medium text-[#374151]">Model</label>
              <Info className="size-3.5 text-[#9CA3AF]" />
            </div>
            <Select value={localModel} onValueChange={(v) => {
              setLocalModel(v);
              onUpdate?.({ model: v });
            }}>
              <SelectTrigger className="h-10 bg-white border-[#E5E7EB] rounded-lg text-[13px]">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                <SelectItem value="claude-4-5-sonnet">Claude 4.5 Sonnet</SelectItem>
                <SelectItem value="claude-4-5-haiku">Claude 4.5 Haiku</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Conversation Thread */}
          <div className="mb-5">
            <div className="flex items-center gap-1 mb-2">
              <label className="text-[13px] font-medium text-[#374151]">Conversation thread</label>
              <Info className="size-3.5 text-[#9CA3AF]" />
            </div>
            <Select defaultValue="current">
              <SelectTrigger className="h-10 bg-white border-[#E5E7EB] rounded-lg text-[13px]">
                <SelectValue placeholder="Select thread" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current conversation</SelectItem>
                <SelectItem value="new">New conversation</SelectItem>
              </SelectContent>
            </Select>
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

  if (nodeType === "messageReceived") {
    const displayLabel = nodeName || "Message Received";
    return (
      <div className="w-[340px] border-l border-[#E5E7EB] bg-white h-full overflow-auto">
        {/* Compact header */}
        <div className="px-5 py-3 border-b border-[#E5E7EB]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
                <Chats className="size-3.5 text-white" weight="fill" />
              </div>
              <div className="min-w-0">
                <span
                  className="font-semibold text-[14px] text-[#1a1a1a] cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded -mx-1 block truncate"
                  onClick={openRenameDialog}
                >
                  {displayLabel}
                </span>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-[#9CA3AF] hover:text-[#6B7280] p-1 shrink-0">
                  <DotsThree className="size-5" weight="bold" />
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
                <DropdownMenuItem className="gap-2 cursor-pointer" variant="destructive" onSelect={onDelete}>
                  <Trash className="size-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="p-5">
          {/* Greeting Message */}
          <div className="mb-6">
            <h3 className="font-medium text-[14px] text-[#374151] mb-2">Greeting message</h3>
            <p className="text-[13px] text-[#9CA3AF] mb-3 text-justify">
              This is the introductory message users see when they create a new task.
            </p>
            <Textarea
              value={localGreeting}
              onChange={(e) => {
                setLocalGreeting(e.target.value);
                onUpdate?.({ greetingMessage: e.target.value });
              }}
              placeholder="Hello! How can I help you today?"
              className="min-h-[100px] max-h-40 overflow-y-auto bg-[#FAFAFA] border-[#E5E7EB] rounded-xl text-[14px] text-[#374151] placeholder:text-[#9CA3AF] resize-none focus-visible:ring-1 focus-visible:ring-[#22D3EE]"
            />
          </div>

          {/* Conversation Starters */}
          <div>
            <h3 className="font-medium text-[14px] text-[#374151] mb-2">Conversation starters</h3>
            <p className="text-[13px] text-[#9CA3AF] mb-3 text-justify">
              These are pre-set prompts that users can click to start a conversation.
            </p>

            {/* Existing starters */}
            {conversationStarters.length > 0 && (
              <div className="space-y-2 mb-3">
                {conversationStarters.map((starter) => (
                  <div
                    key={starter.id}
                    className="flex items-center gap-3 py-2.5 px-3 bg-[#FAFAFA] rounded-xl group hover:bg-[#F3F4F6] transition-colors"
                  >
                    <span className={`flex-1 text-[13px] ${starter.enabled ? "text-[#374151]" : "text-[#9CA3AF]"}`}>
                      {starter.text}
                    </span>
                    <Switch
                      checked={starter.enabled}
                      onCheckedChange={() => handleToggleStarter(starter.id)}
                      className="data-[state=checked]:bg-primary h-5 w-9"
                    />
                    <button
                      onClick={() => handleRemoveStarter(starter.id)}
                      className="size-6 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#EF4444] hover:bg-red-50 transition-colors"
                    >
                      <X className="size-3.5" weight="bold" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new starter */}
            <div className="flex items-center gap-3 py-2.5 px-3 bg-[#FAFAFA] rounded-xl border border-[#E5E7EB] focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors">
              <input
                value={newStarter}
                onChange={(e) => setNewStarter(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddStarter()}
                placeholder="Add a conversation starter"
                className="flex-1 bg-transparent text-[13px] text-[#374151] placeholder:text-[#9CA3AF] outline-none"
              />
              {newStarter.trim() && (
                <>
                  <button
                    onClick={handleAddStarter}
                    className="size-6 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#10B981] hover:bg-green-50 transition-colors"
                  >
                    <Check className="size-3.5" weight="bold" />
                  </button>
                  <button
                    onClick={() => setNewStarter("")}
                    className="size-6 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#EF4444] hover:bg-red-50 transition-colors"
                  >
                    <X className="size-3.5" weight="bold" />
                  </button>
                </>
              )}
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

  // Agent Step panel would go here
  return null;
}
