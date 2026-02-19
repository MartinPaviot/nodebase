"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DotsThree, Sparkle, TextT, ArrowsClockwise, Trash, Info, PencilSimple, Lightning, CaretDown, CaretRight, MagnifyingGlass, Chats } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { PDLIcon } from "@/components/icons/pdl-icon";

interface PeopleDataLabsSettingsProps {
  nodeId: string;
  nodeName?: string;
  actionType?: string;
  onUpdate?: (settings: PeopleDataLabsSettingsData) => void;
  onDelete?: () => void;
  onRename?: (newName: string) => void;
  onReplace?: () => void;
}

// Action type labels, descriptions, and credits
const PDL_ACTION_INFO: Record<string, { label: string; description: string; credits: number }> = {
  "pdl-find-by-email": {
    label: "Find person by email",
    description: "Find a person by an email. An email exactly identifies one person.",
    credits: 15,
  },
  "pdl-find-by-full-name": {
    label: "Find person by full name",
    description: "Find a person by full name. A full name may match multiple people. The most relevant people are returned first. Use metadata fields to narrow results.",
    credits: 15,
  },
  "pdl-find-by-partial-name": {
    label: "Find person by partial name",
    description: "Find a person by first, middle, and/or last name. A partial name may match multiple people. The most relevant people are returned first.",
    credits: 15,
  },
  "pdl-find-by-phone": {
    label: "Find person by phone",
    description: "Find a person by a phone number. Ex: +1 555-234-1234. A phone number exactly identifies one person.",
    credits: 15,
  },
  "pdl-find-by-social": {
    label: "Find Person by Social Network",
    description: "Find a person by a social network URL. A social network URL may match multiple people. The most relevant people are returned first.\nValid social networks: facebook, linkedin, twitter, xing, indeed, github, meetup, instagram, quora, gravatar, klout,...",
    credits: 50,
  },
  "pdl-search-companies": {
    label: "Search for Companies",
    description: 'Find companies by broad criteria like "tech startups in San Francisco" or "companies with over 1000 employees". Use supported fields to define your search criteria.',
    credits: 10,
  },
  "pdl-search-people": {
    label: "Search for People",
    description: 'Find people by broad criteria like "data scientists in San Francisco" or "people with @company.com email". Default to 5 results unless the user specifies otherwise.',
    credits: 15,
  },
  "default": {
    label: "Search for People",
    description: 'Find people by broad criteria like "data scientists in San Francisco" or "people with @company.com email". Default to 5 results unless the user specifies otherwise.',
    credits: 15,
  },
};

// Field mode types
type FieldMode = "manual" | "prompt" | "auto";

export interface PeopleDataLabsSettingsData {
  model: string;
  askForConfirmation: boolean;
  // Generic fields
  searchQuery: string;
  searchQueryMode: FieldMode;
  searchQueryPrompt: string;
  limit: number;
  limitMode: FieldMode;
  limitPrompt: string;
  scrollToken: string;
  scrollTokenMode: FieldMode;
  // Find by email
  email: string;
  emailMode: FieldMode;
  // Find by full name
  fullName: string;
  fullNameMode: FieldMode;
  // Find by partial name
  firstName: string;
  firstNameMode: FieldMode;
  lastName: string;
  lastNameMode: FieldMode;
  middleName: string;
  middleNameMode: FieldMode;
  // Find by phone
  phone: string;
  phoneMode: FieldMode;
  // Find by social
  socialNetworkUrl: string;
  socialNetworkUrlMode: FieldMode;
  // Metadata fields
  location: string;
  locationMode: FieldMode;
  streetAddress: string;
  streetAddressMode: FieldMode;
  locality: string;
  localityMode: FieldMode;
  region: string;
  regionMode: FieldMode;
  country: string;
  countryMode: FieldMode;
  postalCode: string;
  postalCodeMode: FieldMode;
  company: string;
  companyMode: FieldMode;
  school: string;
  schoolMode: FieldMode;
}

// Available data sources from previous steps
interface DataSource {
  id: string;
  label: string;
  icon: React.ReactNode;
  fields: { id: string; label: string }[];
}

const PREVIOUS_STEP_DATA: DataSource[] = [
  {
    id: "messageReceived",
    label: "messageReceived",
    icon: (
      <div className="size-5 rounded bg-blue-500 flex items-center justify-center">
        <Chats className="size-3 text-white" weight="fill" />
      </div>
    ),
    fields: [
      { id: "message.content", label: "Message content" },
      { id: "message.sender", label: "Sender" },
      { id: "message.timestamp", label: "Timestamp" },
      { id: "conversation.id", label: "Conversation ID" },
    ],
  },
];

const MODELS = [
  { id: "default", label: "Claude 4.5 Haiku", provider: "Anthropic", isDefault: true },
  { id: "claude-sonnet", label: "Claude 4.5 Sonnet", provider: "Anthropic" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
  { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
];

const DEFAULT_SEARCH_QUERY_PROMPT = `You're a lead generator. The user will send you the characteristics of the people they're trying to find.

The bare minimum fields you should return is Full Name, Job Title, Company Name, Location, Personal Email, LinkedIn URL. The user might ask for other fields too. If the fields do not exist or you can't find anything for a given individual, write N/A.

The filters you support are location, company name & size, company industry, job title, gender.

If the user asks for a particular city, use \`location_name\`.

If he gives you company names, don't use a "like" operator — look for exact matches (just capitalize it)`;

const DEFAULT_LIMIT_PROMPT = "Use 3 by default, but if the user requests a specific number, go with that instead.";

// Field Mode Selector Component
function FieldModeSelector({
  mode,
  onModeChange,
  showPromptOption = true,
  autoOnly = false,
}: {
  mode: FieldMode;
  onModeChange: (mode: FieldMode) => void;
  showPromptOption?: boolean;
  autoOnly?: boolean;
}) {
  const getModeLabel = () => {
    switch (mode) {
      case "manual":
        return "Set Manually";
      case "prompt":
        return "Prompt AI";
      case "auto":
        return "Auto";
    }
  };

  const getModeIcon = () => {
    switch (mode) {
      case "manual":
        return <PencilSimple className="size-3" weight="bold" />;
      case "prompt":
        return <Sparkle className="size-3" weight="fill" />;
      case "auto":
        return <Lightning className="size-3" weight="fill" />;
    }
  };

  const getModeColor = () => {
    switch (mode) {
      case "manual":
        return "text-blue-600 bg-blue-50 hover:bg-blue-100";
      case "prompt":
        return "text-violet-600 bg-violet-50 hover:bg-violet-100";
      case "auto":
        return "text-emerald-600 bg-emerald-50 hover:bg-emerald-100";
    }
  };

  if (autoOnly) {
    return (
      <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md text-emerald-600 bg-emerald-50 cursor-default">
        <Lightning className="size-3" weight="fill" />
        <span>Auto</span>
        <CaretDown className="size-3 opacity-60" weight="bold" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors",
            getModeColor()
          )}
        >
          {getModeIcon()}
          <span>{getModeLabel()}</span>
          <CaretDown className="size-3 opacity-60" weight="bold" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[280px]">
        <DropdownMenuItem
          className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
          onSelect={() => onModeChange("manual")}
        >
          <div className="flex items-center gap-2">
            <PencilSimple className="size-4 text-blue-600" weight="bold" />
            <span className="font-medium text-blue-600">Set Manually</span>
          </div>
          <span className="text-xs text-muted-foreground ml-6">
            Enter the value for this field manually
          </span>
        </DropdownMenuItem>
        {showPromptOption && (
          <DropdownMenuItem
            className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
            onSelect={() => onModeChange("prompt")}
          >
            <div className="flex items-center gap-2">
              <Sparkle className="size-4 text-violet-500" weight="fill" />
              <span className="font-medium text-violet-600">Prompt AI</span>
            </div>
            <span className="text-xs text-muted-foreground ml-6">
              AI will fill out the field using the prompt and context of the previous steps
            </span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
          onSelect={() => onModeChange("auto")}
        >
          <div className="flex items-center gap-2">
            <Lightning className="size-4 text-emerald-500" weight="fill" />
            <span className="font-medium text-emerald-600">Auto</span>
          </div>
          <span className="text-xs text-muted-foreground ml-6">
            AI will fill out the field using the context of the previous steps
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Data Injection Popover Content
function DataInjectionPopoverContent({
  onInject,
  onClose,
}: {
  onInject: (variable: string) => void;
  onClose: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSources, setExpandedSources] = useState<string[]>([]);

  const toggleSource = (sourceId: string) => {
    setExpandedSources((prev) =>
      prev.includes(sourceId)
        ? prev.filter((id) => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  const filteredSources = PREVIOUS_STEP_DATA.map((source) => ({
    ...source,
    fields: source.fields.filter(
      (field) =>
        field.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        field.id.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((source) => source.fields.length > 0 || searchQuery === "");

  const handleInject = (variable: string) => {
    onInject(variable);
    onClose();
  };

  return (
    <div className="w-[220px] rounded-xl overflow-hidden">
      <div className="p-3">
        <div className="relative">
          <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="w-full pl-8 pr-2 py-2 text-[13px] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/50"
            autoFocus
          />
        </div>
      </div>
      <div className="px-3 pb-2 text-[11px] text-gray-500">
        Inject data from previous steps
      </div>
      <div className="max-h-[250px] overflow-y-auto px-2 pb-2">
        {filteredSources.map((source) => (
          <div key={source.id}>
            <button
              onClick={() => toggleSource(source.id)}
              className="flex items-center gap-2.5 w-full px-2 py-2 text-left hover:bg-gray-50 rounded-lg transition-colors"
            >
              <CaretRight
                className={cn(
                  "size-3.5 text-gray-400 transition-transform",
                  expandedSources.includes(source.id) && "rotate-90"
                )}
                weight="bold"
              />
              {source.icon}
              <span className="text-[13px] font-medium text-gray-700">
                {source.label}
              </span>
            </button>
            {expandedSources.includes(source.id) && (
              <div className="ml-8 pl-3 border-l border-gray-200">
                {source.fields.map((field) => (
                  <button
                    key={field.id}
                    onClick={() => handleInject(`{{${source.id}.${field.id}}}`)}
                    className="flex items-center w-full px-2 py-1.5 text-left hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors group"
                  >
                    <span className="text-[12px] text-gray-600 group-hover:text-blue-600">
                      {field.label}
                    </span>
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

// Textarea with injection panel on the left (using portal)
function TextareaWithInjection({
  value,
  onChange,
  placeholder,
  className,
  minHeight = "200px",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isFocused && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPanelPosition({
        top: rect.top,
        left: rect.left - 230,
      });
    }
  }, [isFocused]);

  const handleInject = (variable: string) => {
    const newValue = value.slice(0, cursorPosition) + variable + value.slice(cursorPosition);
    onChange(newValue);
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        const newPosition = cursorPosition + variable.length;
        textarea.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  const handleTextareaFocus = () => {
    setIsFocused(true);
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  };

  const handleTextareaBlur = (e: React.FocusEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget?.closest('[data-injection-panel]')) {
      return;
    }
    setIsFocused(false);
  };

  const handleTextareaClick = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  };

  const handleTextareaKeyUp = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {isFocused && typeof document !== 'undefined' && createPortal(
        <div
          data-injection-panel
          tabIndex={-1}
          style={{
            position: 'fixed',
            top: panelPosition.top,
            left: panelPosition.left,
            zIndex: 9999,
          }}
          className="w-[220px] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
        >
          <DataInjectionPopoverContent
            onInject={handleInject}
            onClose={() => {}}
          />
        </div>,
        document.body
      )}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleTextareaFocus}
        onBlur={handleTextareaBlur}
        onClick={handleTextareaClick}
        onKeyUp={handleTextareaKeyUp}
        placeholder={placeholder}
        className={cn("resize-none", className)}
        style={{ minHeight }}
      />
    </div>
  );
}

// Reusable auto field component
function AutoField({
  label,
  description,
  required,
  mode,
  onModeChange,
  value,
  onValueChange,
  placeholder,
  type = "text",
}: {
  label: string;
  description?: string;
  required?: boolean;
  mode: FieldMode;
  onModeChange: (mode: FieldMode) => void;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          {label} {required && <span className="text-muted-foreground">(required)</span>}
        </Label>
        <FieldModeSelector mode={mode} onModeChange={onModeChange} />
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {mode === "manual" && (
        <Input
          type={type}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
        />
      )}
      {mode === "prompt" && (
        <TextareaWithInjection
          value={value}
          onChange={onValueChange}
          placeholder={`Enter AI prompt for ${label.toLowerCase()}...`}
          className="bg-amber-50/50 border-amber-200"
          minHeight="80px"
        />
      )}
      {mode === "auto" && (
        <div className="text-xs text-muted-foreground italic bg-violet-50 border border-violet-100 px-3 py-2 rounded-md">
          AI will automatically fill this field
        </div>
      )}
    </div>
  );
}

export function PeopleDataLabsSettings({
  nodeName = "Search for leads",
  actionType,
  onUpdate,
  onDelete,
  onRename,
  onReplace,
}: PeopleDataLabsSettingsProps) {
  const actionInfo = PDL_ACTION_INFO[actionType || "default"] || PDL_ACTION_INFO["default"];

  const [settings, setSettings] = useState<PeopleDataLabsSettingsData>({
    model: "default",
    askForConfirmation: false,
    searchQuery: "",
    searchQueryMode: "auto",
    searchQueryPrompt: DEFAULT_SEARCH_QUERY_PROMPT,
    limit: actionType === "pdl-search-companies" ? 5 : 1,
    limitMode: "manual",
    limitPrompt: DEFAULT_LIMIT_PROMPT,
    scrollToken: "",
    scrollTokenMode: "auto",
    email: "",
    emailMode: "auto",
    fullName: "",
    fullNameMode: "auto",
    firstName: "",
    firstNameMode: "auto",
    lastName: "",
    lastNameMode: "auto",
    middleName: "",
    middleNameMode: "auto",
    phone: "",
    phoneMode: "auto",
    socialNetworkUrl: "",
    socialNetworkUrlMode: "auto",
    location: "",
    locationMode: "auto",
    streetAddress: "",
    streetAddressMode: "auto",
    locality: "",
    localityMode: "auto",
    region: "",
    regionMode: "auto",
    country: "",
    countryMode: "auto",
    postalCode: "",
    postalCodeMode: "auto",
    company: "",
    companyMode: "auto",
    school: "",
    schoolMode: "auto",
  });

  const [showMore, setShowMore] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [partialNameOpen, setPartialNameOpen] = useState(true);

  const updateSetting = <K extends keyof PeopleDataLabsSettingsData>(
    key: K,
    value: PeopleDataLabsSettingsData[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onUpdate?.(newSettings);
  };

  // Render field content based on mode
  const renderFieldContent = (
    mode: FieldMode,
    manualContent: React.ReactNode,
    promptContent: React.ReactNode,
    autoMessage: string = "AI will automatically fill this field"
  ) => {
    switch (mode) {
      case "manual":
        return manualContent;
      case "prompt":
        return promptContent;
      case "auto":
        return (
          <div className="text-xs text-muted-foreground italic bg-violet-50 border border-violet-100 px-3 py-2 rounded-md">
            {autoMessage}
          </div>
        );
    }
  };

  // Determine which fields to show based on action type
  const isSearchAction = actionType === "pdl-search-people" || actionType === "pdl-search-companies" || !actionType;
  const hasMetadata = actionType === "pdl-find-by-full-name" || actionType === "pdl-find-by-partial-name";
  const hasLimit = actionType === "pdl-find-by-full-name" || actionType === "pdl-find-by-partial-name" || actionType === "pdl-search-companies" || actionType === "pdl-search-people" || !actionType;
  const hasScrollToken = actionType === "pdl-find-by-full-name" || actionType === "pdl-find-by-partial-name" || actionType === "pdl-search-people" || !actionType;
  const maxLimit = actionType === "pdl-search-companies" || actionType === "pdl-search-people" || !actionType ? 100 : 50;
  const defaultLimit = actionType === "pdl-search-companies" || actionType === "pdl-search-people" || !actionType ? 5 : 1;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
              <PDLIcon size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-[15px]">{nodeName}</h3>
              <p className="text-xs text-muted-foreground">People Data Labs</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-[#9CA3AF] hover:text-[#6B7280] p-1">
                <DotsThree className="size-5" weight="bold" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => onRename?.(nodeName)}>
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
        <Collapsible open={showMore} onOpenChange={setShowMore}>
          <p className={cn(
            "text-sm text-muted-foreground mt-3",
            !showMore && "line-clamp-2"
          )}>
            {actionInfo.description}
          </p>
          {actionInfo.description.length > 100 && (
            <CollapsibleTrigger className="text-xs text-primary hover:underline mt-1">
              {showMore ? "Less" : "More"}
            </CollapsibleTrigger>
          )}
          <CollapsibleContent />
        </Collapsible>

        {/* Credits */}
        <div className="flex items-center gap-1.5 mt-2">
          <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
            <span>◎</span> {actionInfo.credits}
          </span>
        </div>
      </div>

      {/* Settings */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Model */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Model <span className="text-muted-foreground">(required)</span>
          </Label>
          <Select
            value={settings.model}
            onValueChange={(value) => updateSetting("model", value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a model">
                {settings.model && (() => {
                  const selectedModel = MODELS.find(m => m.id === settings.model);
                  return (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">◇</span>
                      <span>{selectedModel?.provider}</span>
                      <span className="text-muted-foreground">·</span>
                      <span>{selectedModel?.isDefault ? `Currently ${selectedModel.label}` : selectedModel?.label}</span>
                    </div>
                  );
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">◇</span>
                    <span>{model.provider}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{model.isDefault ? `Currently ${model.label}` : model.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ask for Confirmation */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Ask for Confirmation <span className="text-muted-foreground">(required)</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            Require the agent to ask for confirmation before performing this action
          </p>
          <Switch
            checked={settings.askForConfirmation}
            onCheckedChange={(checked) => updateSetting("askForConfirmation", checked)}
          />
        </div>

        {/* ===== Find by Email ===== */}
        {actionType === "pdl-find-by-email" && (
          <AutoField
            label="Email"
            required
            mode={settings.emailMode}
            onModeChange={(mode) => updateSetting("emailMode", mode)}
            value={settings.email}
            onValueChange={(value) => updateSetting("email", value)}
            placeholder="Enter email address..."
          />
        )}

        {/* ===== Find by Full Name ===== */}
        {actionType === "pdl-find-by-full-name" && (
          <AutoField
            label="Full Name"
            required
            description="The person's full name, at least first and last. Ex: Jennifer C. Jackson."
            mode={settings.fullNameMode}
            onModeChange={(mode) => updateSetting("fullNameMode", mode)}
            value={settings.fullName}
            onValueChange={(value) => updateSetting("fullName", value)}
            placeholder="Enter full name..."
          />
        )}

        {/* ===== Find by Partial Name ===== */}
        {actionType === "pdl-find-by-partial-name" && (
          <Collapsible open={partialNameOpen} onOpenChange={setPartialNameOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-1">
              <CaretRight
                className={cn(
                  "size-3.5 text-gray-500 transition-transform",
                  partialNameOpen && "rotate-90"
                )}
                weight="bold"
              />
              <span className="text-sm font-semibold">Partial Name</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-5 pt-3 space-y-4 border-l border-gray-200 ml-1.5">
              <AutoField
                label="First Name"
                description="The person's first name. Ex: Jennifer."
                mode={settings.firstNameMode}
                onModeChange={(mode) => updateSetting("firstNameMode", mode)}
                value={settings.firstName}
                onValueChange={(value) => updateSetting("firstName", value)}
              />
              <AutoField
                label="Last Name"
                description="The person's last name. Ex: Jackson."
                mode={settings.lastNameMode}
                onModeChange={(mode) => updateSetting("lastNameMode", mode)}
                value={settings.lastName}
                onValueChange={(value) => updateSetting("lastName", value)}
              />
              <AutoField
                label="Middle Name"
                description="The person's middle name. Ex: Cassandra."
                mode={settings.middleNameMode}
                onModeChange={(mode) => updateSetting("middleNameMode", mode)}
                value={settings.middleName}
                onValueChange={(value) => updateSetting("middleName", value)}
              />
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* ===== Find by Phone ===== */}
        {actionType === "pdl-find-by-phone" && (
          <AutoField
            label="Phone"
            required
            mode={settings.phoneMode}
            onModeChange={(mode) => updateSetting("phoneMode", mode)}
            value={settings.phone}
            onValueChange={(value) => updateSetting("phone", value)}
            placeholder="Enter phone number..."
          />
        )}

        {/* ===== Find by Social Network ===== */}
        {actionType === "pdl-find-by-social" && (
          <AutoField
            label="Social Network Url"
            required
            description="Valid social networks: facebook, linkedin, twitter, xing, indeed, github, meetup, instagram, quora, gravatar, klout,..."
            mode={settings.socialNetworkUrlMode}
            onModeChange={(mode) => updateSetting("socialNetworkUrlMode", mode)}
            value={settings.socialNetworkUrl}
            onValueChange={(value) => updateSetting("socialNetworkUrl", value)}
            placeholder="Enter social network URL..."
          />
        )}

        {/* ===== Search Query (for search actions) ===== */}
        {isSearchAction && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Search query <span className="text-muted-foreground">(required)</span>
              </Label>
              <FieldModeSelector
                mode={settings.searchQueryMode}
                onModeChange={(mode) => updateSetting("searchQueryMode", mode)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Define your search criteria. Use an AI Prompt for easier searching of{" "}
              <a href="#" className="text-primary hover:underline">supported fields</a>.
              Alternatively, you can manually...
            </p>
            <Collapsible>
              <CollapsibleTrigger className="text-xs text-primary hover:underline">
                More
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <p className="text-xs text-muted-foreground">
                  You can use filters like location, company name, company size, industry, job title, and gender.
                  The API supports both exact matches and fuzzy searches depending on the field.
                </p>
              </CollapsibleContent>
            </Collapsible>
            {renderFieldContent(
              settings.searchQueryMode,
              <TextareaWithInjection
                value={settings.searchQuery}
                onChange={(value) => updateSetting("searchQuery", value)}
                placeholder="Enter search query..."
                minHeight="120px"
              />,
              <TextareaWithInjection
                value={settings.searchQueryPrompt}
                onChange={(value) => updateSetting("searchQueryPrompt", value)}
                placeholder="Enter AI prompt..."
                className="bg-amber-50/50 border-amber-200"
                minHeight="200px"
              />,
              "AI will determine the search query based on conversation context"
            )}
          </div>
        )}

        {/* ===== Limit ===== */}
        {hasLimit && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Limit</Label>
              <FieldModeSelector
                mode={settings.limitMode}
                onModeChange={(mode) => updateSetting("limitMode", mode)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Max {maxLimit}. Defaults to {defaultLimit}.
            </p>
            {renderFieldContent(
              settings.limitMode,
              <Input
                type="number"
                min={1}
                max={maxLimit}
                value={settings.limit}
                onChange={(e) => updateSetting("limit", parseInt(e.target.value) || defaultLimit)}
                className="w-full"
              />,
              <TextareaWithInjection
                value={settings.limitPrompt}
                onChange={(value) => updateSetting("limitPrompt", value)}
                placeholder="Enter AI prompt for limit..."
                className="bg-amber-50/50 border-amber-200"
                minHeight="80px"
              />,
              "AI will determine the appropriate limit based on context"
            )}
          </div>
        )}

        {/* ===== Metadata Section (for find-by-full-name and find-by-partial-name) ===== */}
        {hasMetadata && (
          <Collapsible open={metadataOpen} onOpenChange={setMetadataOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-1">
              <CaretRight
                className={cn(
                  "size-3.5 text-gray-500 transition-transform",
                  metadataOpen && "rotate-90"
                )}
                weight="bold"
              />
              <span className="text-sm font-semibold">Metadata</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-5 pt-3 space-y-4 border-l border-gray-200 ml-1.5">
              <AutoField
                label="Location"
                description="A location in which a person lives."
                mode={settings.locationMode}
                onModeChange={(mode) => updateSetting("locationMode", mode)}
                value={settings.location}
                onValueChange={(value) => updateSetting("location", value)}
              />
              <AutoField
                label="Street Address"
                description="A street address in which the person lives. Ex: 1234 Main Street."
                mode={settings.streetAddressMode}
                onModeChange={(mode) => updateSetting("streetAddressMode", mode)}
                value={settings.streetAddress}
                onValueChange={(value) => updateSetting("streetAddress", value)}
              />
              <AutoField
                label="Locality"
                description="A locality in which the person lives. Ex: Boise."
                mode={settings.localityMode}
                onModeChange={(mode) => updateSetting("localityMode", mode)}
                value={settings.locality}
                onValueChange={(value) => updateSetting("locality", value)}
              />
              <AutoField
                label="Region"
                description="A state or region in which the person lives. Ex: Idaho."
                mode={settings.regionMode}
                onModeChange={(mode) => updateSetting("regionMode", mode)}
                value={settings.region}
                onValueChange={(value) => updateSetting("region", value)}
              />
              <AutoField
                label="Country"
                description="A country in which the person lives. Ex: United States."
                mode={settings.countryMode}
                onModeChange={(mode) => updateSetting("countryMode", mode)}
                value={settings.country}
                onValueChange={(value) => updateSetting("country", value)}
              />
              <AutoField
                label="Postal Code"
                description="The postal code in which the person lives. Ex: 83701."
                mode={settings.postalCodeMode}
                onModeChange={(mode) => updateSetting("postalCodeMode", mode)}
                value={settings.postalCode}
                onValueChange={(value) => updateSetting("postalCode", value)}
              />
              <AutoField
                label="Company"
                description="A name, website, or social url of a company where the person has worked. Ex: Amazon."
                mode={settings.companyMode}
                onModeChange={(mode) => updateSetting("companyMode", mode)}
                value={settings.company}
                onValueChange={(value) => updateSetting("company", value)}
              />
              <AutoField
                label="School"
                description="A name, website, or social url of a university or college the person has attended. Ex: University of Iowa"
                mode={settings.schoolMode}
                onModeChange={(mode) => updateSetting("schoolMode", mode)}
                value={settings.school}
                onValueChange={(value) => updateSetting("school", value)}
              />
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* ===== Scroll Token ===== */}
        {hasScrollToken && (
          <AutoField
            label="Scroll token"
            description="The token used to reference the page of results to return."
            mode={settings.scrollTokenMode}
            onModeChange={(mode) => updateSetting("scrollTokenMode", mode)}
            value={settings.scrollToken}
            onValueChange={(value) => updateSetting("scrollToken", value)}
          />
        )}
      </div>
    </div>
  );
}
