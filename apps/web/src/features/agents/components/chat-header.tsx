"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  CaretDown,
  ShareNetwork,
  House,
  ChatCircle,
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
  ListChecks,
  type Icon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

  // Check exact match first
  for (const [key, config] of Object.entries(agentConfigs)) {
    if (normalizedName.includes(key)) {
      return config;
    }
  }

  // Find icon by keywords
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
  else if (normalizedName.includes("task") || normalizedName.includes("todo")) icon = ListChecks;

  // Find gradient by keyword
  for (const [keyword, grad] of Object.entries(keywordGradients)) {
    if (normalizedName.includes(keyword)) {
      gradient = grad;
      break;
    }
  }

  return { icon, gradient };
}

interface ChatHeaderProps {
  agentName?: string;
  onShare?: () => void;
}

export function ChatHeader({
  agentName,
  onShare,
}: ChatHeaderProps) {
  const pathname = usePathname();
  const { open } = useSidebar();
  const isGlobalChat = pathname === "/chat" || pathname.startsWith("/chat/");

  const config = agentName ? getAgentConfig(agentName) : null;
  const IconComponent = config?.icon || ChatCircle;

  return (
    <header className="h-14 border-b flex items-center justify-between px-4 bg-background">
      <div className="flex items-center gap-3">
        {!open && <SidebarTrigger />}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-accent rounded-lg px-2 py-1.5 transition-colors outline-none">
              <div
                className={`size-6 rounded-[4px] flex items-center justify-center bg-gradient-to-br shrink-0 ${config?.gradient || "from-blue-400 to-blue-600"}`}
              >
                <IconComponent className="size-4 text-white" weight="fill" />
              </div>
              <span className="font-medium text-sm">
                {agentName || "Chat"}
              </span>
              <CaretDown className="size-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/home" className="gap-2">
                <House className="size-4" />
                Home
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/chat" className="gap-2">
                <ChatCircle className="size-4" />
                All Chats
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/agents" className="gap-2">
                <Robot className="size-4" />
                My Agents
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Button variant="ghost" size="sm" className="gap-2" onClick={onShare}>
        <ShareNetwork className="size-4" />
        Share
      </Button>
    </header>
  );
}
