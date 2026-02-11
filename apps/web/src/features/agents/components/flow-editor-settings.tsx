"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Chats,
  FileText,
  Brain,
  Sparkle,
  ShieldCheck,
  Info,
  Robot,
  Target,
  Headset,
  ChatDots,
  EnvelopeOpen,
  PhoneCall,
  CalendarCheck,
  Microphone,
  Newspaper,
  Palette,
  Megaphone,
  UserPlus,
  Books,
  Globe,
  ChatText,
  Kanban,
  type Icon,
} from "@phosphor-icons/react";

// Agent icon config based on name
type AgentConfig = { icon: Icon; gradient: string };

const agentConfigs: Record<string, AgentConfig> = {
  "lead generator": { icon: Target, gradient: "from-amber-400 to-orange-500" },
  "lead outreacher": { icon: EnvelopeOpen, gradient: "from-violet-400 to-purple-500" },
  "customer support": { icon: Headset, gradient: "from-pink-400 to-rose-500" },
  "support chatbot": { icon: ChatDots, gradient: "from-pink-400 to-rose-500" },
  "email assistant": { icon: EnvelopeOpen, gradient: "from-indigo-400 to-blue-600" },
  "meeting scheduler": { icon: CalendarCheck, gradient: "from-sky-400 to-blue-600" },
  "meeting notetaker": { icon: Microphone, gradient: "from-indigo-400 to-violet-600" },
  "newsletter writer": { icon: Newspaper, gradient: "from-green-400 to-emerald-600" },
  "content creator": { icon: Palette, gradient: "from-fuchsia-400 to-pink-600" },
  "resume screener": { icon: FileText, gradient: "from-amber-400 to-yellow-600" },
  "recruiting agent": { icon: UserPlus, gradient: "from-indigo-400 to-blue-600" },
  "web researcher": { icon: Globe, gradient: "from-emerald-400 to-teal-600" },
  "voice of customer": { icon: ChatText, gradient: "from-blue-400 to-indigo-500" },
  "phone support": { icon: PhoneCall, gradient: "from-indigo-400 to-violet-500" },
};

const keywordGradients: Record<string, string> = {
  sales: "from-amber-400 to-orange-500",
  lead: "from-amber-400 to-orange-500",
  support: "from-pink-400 to-rose-500",
  chat: "from-pink-400 to-rose-500",
  email: "from-indigo-400 to-blue-600",
  phone: "from-cyan-400 to-teal-600",
  call: "from-cyan-400 to-teal-600",
  meeting: "from-sky-400 to-blue-600",
  newsletter: "from-green-400 to-emerald-600",
  content: "from-fuchsia-400 to-pink-600",
  recruit: "from-indigo-400 to-blue-600",
  resume: "from-amber-400 to-yellow-600",
  research: "from-emerald-400 to-teal-600",
  web: "from-emerald-400 to-teal-600",
  voice: "from-blue-400 to-indigo-500",
  project: "from-blue-400 to-indigo-500",
  task: "from-violet-400 to-purple-500",
};

function getAgentConfig(agentName: string): AgentConfig {
  const normalizedName = agentName.toLowerCase();

  for (const [key, config] of Object.entries(agentConfigs)) {
    if (normalizedName.includes(key)) {
      return config;
    }
  }

  let icon: Icon = Robot;
  let gradient = "from-blue-400 to-blue-600";

  if (normalizedName.includes("sales") || normalizedName.includes("lead")) icon = Target;
  else if (normalizedName.includes("support") || normalizedName.includes("help")) icon = Headset;
  else if (normalizedName.includes("chat") || normalizedName.includes("bot")) icon = ChatDots;
  else if (normalizedName.includes("email") || normalizedName.includes("inbox")) icon = EnvelopeOpen;
  else if (normalizedName.includes("phone") || normalizedName.includes("call")) icon = PhoneCall;
  else if (normalizedName.includes("meeting") || normalizedName.includes("calendar")) icon = CalendarCheck;
  else if (normalizedName.includes("record") || normalizedName.includes("note")) icon = Microphone;
  else if (normalizedName.includes("newsletter") || normalizedName.includes("blog")) icon = Newspaper;
  else if (normalizedName.includes("content") || normalizedName.includes("creative")) icon = Palette;
  else if (normalizedName.includes("marketing")) icon = Megaphone;
  else if (normalizedName.includes("recruit") || normalizedName.includes("hiring")) icon = UserPlus;
  else if (normalizedName.includes("resume") || normalizedName.includes("cv")) icon = FileText;
  else if (normalizedName.includes("knowledge") || normalizedName.includes("wiki")) icon = Books;
  else if (normalizedName.includes("research") || normalizedName.includes("web")) icon = Globe;
  else if (normalizedName.includes("voice") || normalizedName.includes("customer")) icon = ChatText;
  else if (normalizedName.includes("project") || normalizedName.includes("kanban")) icon = Kanban;

  for (const [keyword, grad] of Object.entries(keywordGradients)) {
    if (normalizedName.includes(keyword)) {
      gradient = grad;
      break;
    }
  }

  return { icon, gradient };
}

interface FlowEditorSettingsProps {
  agentId: string;
  agentName: string;
  agentAvatar?: string | null;
  greetingMessage?: string;
  context?: string;
  memories?: string[];
  model?: string;
  safeMode?: boolean;
  onUpdate?: (data: {
    greetingMessage?: string;
    context?: string;
    model?: string;
    safeMode?: boolean;
  }) => void;
}

// Model options matching Lindy's interface
const MODEL_OPTIONS = [
  {
    category: "Recommended",
    models: [
      {
        value: "fastest",
        label: "Fastest",
        description: "Fast and cheap. Best used for real-time tasks like phone calls and long-context tasks like summarizing large documents.",
        icon: "◇",
      },
      {
        value: "balanced",
        label: "Balanced",
        description: "Best overall balance of speed, cost, and intelligence.",
        icon: "◇",
        current: "Currently Claude 4.5 Haiku",
      },
      {
        value: "smartest",
        label: "Smartest",
        description: "Best reasoning and decision making, at a reasonable cost.",
        icon: "◇",
      },
    ],
  },
  {
    category: "OpenAI",
    models: [
      {
        value: "gpt-4o-nov-2024",
        label: "GPT-4o November 2024",
        description: "Middling intelligence, fast and well priced, good for tasks that require 16k output context",
        icon: "◎",
      },
      {
        value: "gpt-5.2",
        label: "GPT-5.2",
        description: "Most advanced flagship model for coding and agentic tasks with configurable reasoning. 400K context, 128K output.",
        icon: "◎",
      },
      {
        value: "gpt-5.1",
        label: "GPT-5.1",
        description: "Previous flagship model for coding and agentic tasks with configurable reasoning. 400K context, 128K output.",
        icon: "◎",
      },
      {
        value: "gpt-5-mini",
        label: "GPT-5 Mini",
        description: "Fast, affordable small model for lightweight tasks.",
        icon: "◎",
      },
    ],
  },
  {
    category: "Anthropic",
    models: [
      {
        value: "claude-4.5-sonnet",
        label: "Claude 4.5 Sonnet",
        description: "Anthropic's newest model with intelligence across most tasks and reduced cost, great for complex agents.",
        icon: "A",
      },
      {
        value: "claude-4.5-sonnet-thinking",
        label: "Claude 4.5 Sonnet (Extended Thinking)",
        description: "Anthropic's newest model with extended thinking for complex reasoning tasks.",
        icon: "A",
      },
      {
        value: "claude-4.5-opus",
        label: "Claude 4.5 Opus",
        description: "Anthropic's flagship Opus model, best for coding, agents, and computer use with superior reasoning.",
        icon: "A",
      },
      {
        value: "claude-4.5-opus-thinking",
        label: "Claude 4.5 Opus (Extended Thinking)",
        description: "Anthropic's flagship Opus model with extended thinking for the most complex reasoning tasks.",
        icon: "A",
      },
    ],
  },
  {
    category: "Google",
    models: [
      {
        value: "gemini-3.0-pro",
        label: "Gemini 3.0 Pro",
        description: "Google's next-generation advanced reasoning model for multimodal understanding, coding, and world knowledge.",
        icon: "●",
        iconColor: "#4285F4",
      },
      {
        value: "gemini-3.0-flash-high",
        label: "Gemini 3.0 Flash (High Thinking)",
        description: "Google's fast model combining Gemini 3's Pro-grade reasoning with Flash-level latency and efficiency.",
        icon: "●",
        iconColor: "#4285F4",
      },
      {
        value: "gemini-3.0-flash-medium",
        label: "Gemini 3.0 Flash (Medium Thinking)",
        description: "Google's fast model with medium-level thinking for balanced reasoning.",
        icon: "●",
        iconColor: "#4285F4",
      },
    ],
  },
];

export function FlowEditorSettings({
  agentName,
  greetingMessage = "",
  context = "",
  model = "balanced",
  safeMode = false,
}: FlowEditorSettingsProps) {
  const [localGreeting, setLocalGreeting] = useState(greetingMessage);
  const [localContext, setLocalContext] = useState(context);
  const [localMemory, setLocalMemory] = useState("");
  const [localModel, setLocalModel] = useState(model);
  const [localSafeMode, setLocalSafeMode] = useState(safeMode);

  const config = getAgentConfig(agentName);
  const IconComponent = config.icon;

  const handleGenerateGreeting = () => {
    // TODO: Call AI to generate greeting
    setLocalGreeting("Hello! I'm your newsletter assistant. How can I help you create engaging content today?");
  };

  // Find selected model info
  const selectedModelInfo = MODEL_OPTIONS.flatMap((cat) => cat.models).find(
    (m) => m.value === localModel
  );

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-auto bg-[#FAF9F6]">
        <div className="max-w-3xl mx-auto py-12 px-6">
          {/* Agent Icon & Name */}
          <div className="flex items-center gap-4 mb-10">
            <div className={`size-14 rounded-2xl bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
              <IconComponent className="size-7 text-white" weight="fill" />
            </div>
            <h1 className="text-[28px] font-semibold text-[#1a1a1a]">{agentName}</h1>
          </div>

          {/* Greeting Message */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Chats className="size-5 text-[#6B7280]" />
                <span className="font-medium text-[15px] text-[#374151]">Greeting message</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-[#9CA3AF] hover:text-[#6B7280]">
                      <Info className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[280px] p-3 bg-white border border-[#E5E7EB] shadow-lg rounded-lg">
                    <p className="text-[13px] text-[#374151]">
                      This is the introductory message users see on an empty task.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <button
                onClick={handleGenerateGreeting}
                className="flex items-center gap-1.5 text-[#D97706] hover:text-[#B45309] text-sm font-medium"
              >
                <Sparkle className="size-4" />
                Generate
              </button>
            </div>
            <Textarea
              value={localGreeting}
              onChange={(e) => setLocalGreeting(e.target.value)}
              placeholder="This is the introductory message users see on an empty task."
              className="min-h-[120px] bg-white border-[#E5E7EB] rounded-xl text-[14px] text-[#374151] placeholder:text-[#9CA3AF] resize-none focus-visible:ring-1 focus-visible:ring-[#D97706]"
            />
          </div>

          {/* Context */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="size-5 text-[#6B7280]" />
              <span className="font-medium text-[15px] text-[#374151]">Context</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-[#9CA3AF] hover:text-[#6B7280]">
                    <Info className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[280px] p-3 bg-white border border-[#E5E7EB] shadow-lg rounded-lg">
                  <p className="text-[13px] text-[#374151]">
                    Provide background information for this agent to keep in mind at all times.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Textarea
              value={localContext}
              onChange={(e) => setLocalContext(e.target.value)}
              placeholder="You are a newsletter creation assistant with access to research and content tools. Help users by researching topics, gathering content, and drafting engaging newsletters. Be helpful, accurate, and professional throughout the process."
              className="min-h-[160px] bg-white border-[#E5E7EB] rounded-xl text-[14px] text-[#374151] placeholder:text-[#9CA3AF] resize-none focus-visible:ring-1 focus-visible:ring-[#D97706]"
            />
          </div>

          {/* Memories */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="size-5 text-[#6B7280]" />
              <span className="font-medium text-[15px] text-[#374151]">Memories</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-[#9CA3AF] hover:text-[#6B7280]">
                    <Info className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[280px] p-3 bg-white border border-[#E5E7EB] shadow-lg rounded-lg">
                  <p className="text-[13px] text-[#374151]">
                    Memories are evolving details that agents learn and retain across tasks. In contrast, Context is fixed. Manage them below or in the Flow Editor.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              value={localMemory}
              onChange={(e) => setLocalMemory(e.target.value)}
              placeholder="Add a new Memory (E.g. My working hours are 9am-6pm)"
              className="h-12 bg-white border-[#E5E7EB] rounded-xl text-[14px] text-[#374151] placeholder:text-[#9CA3AF] focus-visible:ring-1 focus-visible:ring-[#D97706]"
            />
          </div>

          {/* Default Model */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Sparkle className="size-5 text-[#6B7280]" />
              <span className="font-medium text-[15px] text-[#374151]">Default model</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-[#9CA3AF] hover:text-[#6B7280]">
                    <Info className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[280px] p-3 bg-white border border-[#E5E7EB] shadow-lg rounded-lg">
                  <p className="text-[13px] text-[#374151]">
                    The default language model you want this agent to use. Can be overridden in each node in the Flow Editor.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="mb-2">
              <span className="text-[13px] text-[#6B7280]">Model</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-[#9CA3AF] hover:text-[#6B7280] ml-1">
                    <Info className="size-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[280px] p-3 bg-white border border-[#E5E7EB] shadow-lg rounded-lg">
                  <p className="text-[13px] text-[#374151]">
                    Choose the AI model that best fits your needs.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Select value={localModel} onValueChange={setLocalModel}>
              <SelectTrigger className="h-12 bg-white border-[#E5E7EB] rounded-xl text-[14px] focus:ring-1 focus:ring-[#D97706]">
                <SelectValue>
                  {selectedModelInfo && (
                    <div className="flex items-center gap-2">
                      <span className="text-[#6B7280]">{selectedModelInfo.icon}</span>
                      <span>{selectedModelInfo.label}</span>
                      {selectedModelInfo.current && (
                        <span className="text-[#9CA3AF]">· {selectedModelInfo.current}</span>
                      )}
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-[400px] overflow-auto">
                {MODEL_OPTIONS.map((category) => (
                  <div key={category.category}>
                    {category.category !== "Recommended" && (
                      <div className="px-2 py-1.5 text-xs font-medium text-[#9CA3AF] uppercase tracking-wide">
                        {category.category}
                      </div>
                    )}
                    {category.models.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="py-3">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-[#6B7280]"
                              style={{ color: "iconColor" in m ? m.iconColor : undefined }}
                            >
                              {m.icon}
                            </span>
                            <span className="font-medium">{m.label}</span>
                          </div>
                          <p className="text-[12px] text-[#9CA3AF] pl-5 max-w-[400px]">
                            {m.description}
                          </p>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Safe Mode */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="size-5 text-[#6B7280]" />
              <span className="font-medium text-[15px] text-[#374151]">Safe mode</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-[#9CA3AF] hover:text-[#6B7280]">
                    <Info className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[280px] p-3 bg-white border border-[#E5E7EB] shadow-lg rounded-lg">
                  <p className="text-[13px] text-[#374151]">
                    Require this agent to ask for confirmation before performing any action with side effects.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Switch
              checked={localSafeMode}
              onCheckedChange={setLocalSafeMode}
              className="data-[state=checked]:bg-[#10b981]"
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
