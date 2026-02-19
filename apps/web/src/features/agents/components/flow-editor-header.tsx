"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CaretDown,
  Star,
  SlidersHorizontal,
  FlowArrow,
  ChatCircle,
  Play,
  Pencil,
  ClockCounterClockwise,
  Copy,
  BellSlash,
  Checks,
  Trash,
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
  FileText,
  Books,
  Globe,
  ChatText,
  Kanban,
  type Icon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// Agent icon config based on name
export type AgentConfig = { icon: Icon; gradient: string };

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

export function getAgentConfig(agentName: string): AgentConfig {
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

type TabType = "settings" | "flow" | "tasks";

interface FlowEditorHeaderProps {
  agentId: string;
  agentName: string;
  isEnabled: boolean;
  isDraft: boolean;
  activeTab: TabType;
  hasChanges?: boolean;
  isSaving?: boolean;
  onTabChange: (tab: TabType) => void;
  onToggleEnabled: (enabled: boolean) => void;
  onPublish: () => void;
  onTest: () => void;
  onShare: () => void;
}

export function FlowEditorHeader({
  agentName,
  isEnabled,
  activeTab,
  hasChanges = false,
  isSaving = false,
  onTabChange,
  onToggleEnabled,
  onPublish,
  onTest,
  onShare,
}: FlowEditorHeaderProps) {
  const { open } = useSidebar();
  const config = getAgentConfig(agentName);
  const IconComponent = config.icon;

  return (
    <header className="h-14 border-b border-[#e5e7eb] flex items-center px-4 bg-white z-20 shrink-0">
      {/* Left side */}
      <div className="flex-1 min-w-0 flex items-center gap-2 lg:gap-3 overflow-hidden">
        {!open && <SidebarTrigger />}

        {/* Agent icon - square with rounded corners and gradient */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-[#F3F4F6] rounded-lg px-2 py-1.5 transition-colors outline-none">
              <div className={`size-6 rounded-[4px] bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                <IconComponent className="size-4 text-white" weight="fill" />
              </div>
              <span className="font-semibold text-[15px] text-[#1a1a1a] truncate max-w-[100px] sm:max-w-[120px] md:max-w-[150px] lg:max-w-[200px]">{agentName}</span>
              <CaretDown className="size-4 text-[#9CA3AF]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem className="gap-3">
              <Pencil className="size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3">
              <ClockCounterClockwise className="size-4" />
              Version history
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3">
              <Copy className="size-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-3">
              <BellSlash className="size-4" />
              Mute notifications
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3">
              <Checks className="size-4" />
              Mark all as read
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-3 text-destructive focus:text-destructive">
              <Trash className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Favorite star */}
        <button className="p-1.5 hover:bg-[#F3F4F6] rounded-lg transition-colors hidden xl:block">
          <Star className="size-5 text-[#D1D5DB]" />
        </button>

        {/* Enable/Disable toggle */}
        <Switch
          checked={isEnabled}
          onCheckedChange={onToggleEnabled}
          className="data-[state=checked]:bg-[#10b981] h-5 w-9 hidden md:inline-flex"
        />
      </div>

      {/* Center - Tabs */}
      <div className="shrink min-w-0 flex items-center gap-1">
        <TabButton
          icon={<SlidersHorizontal className="size-4" />}
          label="Settings"
          isActive={activeTab === "settings"}
          onClick={() => onTabChange("settings")}
        />
        <TabButton
          icon={<FlowArrow className="size-4" />}
          label="Flow editor"
          isActive={activeTab === "flow"}
          onClick={() => onTabChange("flow")}
        />
        <TabButton
          icon={<ChatCircle className="size-4" />}
          label="Agent"
          isActive={activeTab === "tasks"}
          onClick={() => onTabChange("tasks")}
        />
      </div>

      {/* Right side */}
      <div className="flex-1 min-w-0 flex items-center justify-end gap-2 overflow-hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={onShare}
          className="text-[#374151] font-medium hover:bg-[#F3F4F6] h-9 px-4 hidden sm:flex"
        >
          Share
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-[#10b981] text-[#10b981] hover:bg-[#10b981]/10 hover:text-[#059669] font-medium h-9 px-4"
          onClick={onTest}
        >
          <Play className="size-3.5" weight="fill" />
          <span className="hidden sm:inline">Test</span>
        </Button>
        <Button
          size="sm"
          onClick={onPublish}
          disabled={!hasChanges || isSaving}
          className={
            hasChanges
              ? "bg-primary hover:bg-primary/90 text-white font-medium shadow-none h-9 px-4"
              : "bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#9CA3AF] font-medium shadow-none h-9 px-4"
          }
        >
          {isSaving ? "Saving..." : (
            <>
              <span className="hidden sm:inline">Publish Changes</span>
              <span className="sm:hidden">Publish</span>
            </>
          )}
        </Button>
      </div>
    </header>
  );
}

interface TabButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function TabButton({ icon, label, isActive, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-sm transition-colors rounded-lg",
        isActive
          ? "text-[#1a1a1a] font-medium"
          : "text-[#6B7280] hover:text-[#374151]"
      )}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
