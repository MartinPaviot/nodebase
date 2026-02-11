"use client";

import { Suspense, useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  MagnifyingGlass,
  CaretLeft,
  Plus,
  Star,
  CircleNotch,
  Microphone,
  Crosshair,
  Envelope,
  EnvelopeOpen,
  Phone,
  PhoneCall,
  PhoneOutgoing,
  ChatCircle,
  ChatText,
  ChatDots,
  Globe,
  Users,
  UserPlus,
  UsersThree,
  UserCircle,
  Briefcase,
  Calendar,
  CalendarCheck,
  Clock,
  PenNib,
  Megaphone,
  BookOpen,
  Books,
  Robot,
  Headset,
  FileText,
  Files,
  Tag,
  Bell,
  Eye,
  Binoculars,
  Target,
  Palette,
  Article,
  Newspaper,
  Receipt,
  Kanban,
  CheckSquare,
  ListChecks,
  Question,
  ShieldCheck,
  Handshake,
  ChartBar,
  Smiley,
  PaperPlaneTilt,
  Repeat,
  Database,
  Sparkle,
  Lightning,
  type Icon,
} from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import {
  useSuspenseTemplates,
  useCreateAgentFromTemplate,
} from "@/features/templates/hooks/use-templates";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Icon as IconifyIcon } from "@iconify/react";

// Role filters matching Lindy.ai
const ROLES = [
  { id: "HUMAN_RESOURCES", label: "Human Resources" },
  { id: "MARKETING", label: "Marketing" },
  { id: "OPERATIONS", label: "Operations" },
  { id: "PRODUCT", label: "Product" },
  { id: "SALES", label: "Sales" },
  { id: "SUPPORT", label: "Support" },
] as const;

// Use case filters matching Lindy.ai
const USE_CASES = [
  { id: "AI_ASSISTANT", label: "AI Assistant" },
  { id: "CHATBOT", label: "Chatbot" },
  { id: "COACHING", label: "Coaching" },
  { id: "CONTENT_CREATION", label: "Content creation" },
  { id: "DOCUMENT_PROCESSING", label: "Document processing" },
  { id: "EMAILS", label: "Emails" },
  { id: "MEETINGS", label: "Meetings" },
  { id: "OUTREACH", label: "Outreach" },
  { id: "PHONE", label: "Phone" },
  { id: "PRODUCTIVITY", label: "Productivity" },
  { id: "RESEARCH", label: "Research" },
  { id: "TEAMS", label: "Teams" },
  { id: "WEB_SCRAPER", label: "Web scraper" },
] as const;

// Map old categories to roles for filtering
const CATEGORY_TO_ROLE: Record<string, string> = {
  PRODUCTIVITY: "OPERATIONS",
  SALES: "SALES",
  MARKETING: "MARKETING",
  SUPPORT: "SUPPORT",
  RESEARCH: "PRODUCT",
  PRODUCT: "PRODUCT",
  CREATIVE: "MARKETING",
  OPERATIONS: "OPERATIONS",
  HUMAN_RESOURCES: "HUMAN_RESOURCES",
  CUSTOM: "",
};

function TemplateCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-4 flex flex-col h-[130px] min-w-0">
      <Skeleton className="size-6 rounded-sm mb-2.5 shrink-0" />
      <Skeleton className="h-4 w-3/4 mb-1" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3 mt-1" />
    </div>
  );
}

function TemplateGridSkeleton() {
  return (
    <div className="space-y-8 w-full">
      <div className="space-y-4">
        <Skeleton className="h-7 w-32" />
        {/* Force 3 columns with auto-fill and minimum card width */}
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          }}
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <TemplateCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Template config: icon + gradient
type TemplateConfig = { icon: Icon; gradient: string };

const templateConfigs: Record<string, TemplateConfig> = {
  // Sales templates
  "sales meeting recorder": { icon: Microphone, gradient: "from-rose-400 to-red-600" },
  "sales lead generator": { icon: Target, gradient: "from-amber-400 to-orange-500" },
  "lead generator": { icon: Target, gradient: "from-amber-400 to-orange-500" },
  "lead outreacher": { icon: PaperPlaneTilt, gradient: "from-violet-400 to-purple-500" },
  "outbound phone call agent": { icon: PhoneOutgoing, gradient: "from-cyan-400 to-teal-600" },
  "deal flow manager": { icon: Handshake, gradient: "from-emerald-400 to-green-600" },
  "crm updater": { icon: Database, gradient: "from-blue-400 to-indigo-600" },
  "sales coach": { icon: Sparkle, gradient: "from-amber-400 to-yellow-500" },

  // Support templates
  "customer support email": { icon: EnvelopeOpen, gradient: "from-emerald-400 to-teal-500" },
  "website customer support": { icon: Globe, gradient: "from-emerald-400 to-green-500" },
  "support bot with human": { icon: Handshake, gradient: "from-pink-400 to-rose-500" },
  "customer support": { icon: Headset, gradient: "from-pink-400 to-rose-500" },
  "support chatbot": { icon: ChatDots, gradient: "from-pink-400 to-rose-500" },
  "support agent": { icon: Headset, gradient: "from-pink-400 to-rose-500" },
  "customer service": { icon: Smiley, gradient: "from-green-400 to-emerald-500" },
  "ticket handler": { icon: Tag, gradient: "from-purple-400 to-violet-600" },
  "faq bot": { icon: Question, gradient: "from-sky-400 to-blue-500" },
  "help desk": { icon: Headset, gradient: "from-indigo-400 to-purple-600" },
  "complaint handler": { icon: ShieldCheck, gradient: "from-red-400 to-rose-600" },
  "sms support": { icon: ChatText, gradient: "from-blue-400 to-indigo-500" },
  "whatsapp support": { icon: ChatCircle, gradient: "from-green-400 to-emerald-500" },
  "phone support": { icon: PhoneCall, gradient: "from-indigo-400 to-violet-500" },
  "email responder": { icon: Repeat, gradient: "from-blue-400 to-indigo-500" },
  "email triager": { icon: Tag, gradient: "from-violet-400 to-purple-500" },
  "support slackbot": { icon: Robot, gradient: "from-purple-400 to-violet-600" },
  "ai receptionist": { icon: PhoneCall, gradient: "from-amber-400 to-orange-500" },
  "knowledge retrieval": { icon: Books, gradient: "from-indigo-400 to-blue-500" },
  "telegram": { icon: PaperPlaneTilt, gradient: "from-sky-400 to-blue-500" },
  "query your files": { icon: FileText, gradient: "from-orange-400 to-amber-500" },
  "daily slack digest": { icon: ListChecks, gradient: "from-purple-400 to-violet-500" },
  "urgent ticket": { icon: Bell, gradient: "from-red-400 to-rose-600" },
  "ticket dispatcher": { icon: PaperPlaneTilt, gradient: "from-violet-400 to-purple-500" },
  "feedback survey": { icon: ChartBar, gradient: "from-emerald-400 to-green-500" },
  "sentiment tracker": { icon: Smiley, gradient: "from-indigo-400 to-blue-500" },
  "faq generator": { icon: Question, gradient: "from-amber-400 to-orange-500" },

  // Email templates
  "email assistant": { icon: EnvelopeOpen, gradient: "from-indigo-400 to-blue-600" },
  "email writer": { icon: PaperPlaneTilt, gradient: "from-violet-400 to-purple-500" },
  "inbox manager": { icon: Envelope, gradient: "from-blue-400 to-indigo-500" },

  // Meeting templates
  "meeting scheduler": { icon: CalendarCheck, gradient: "from-sky-400 to-blue-600" },
  "meeting notetaker": { icon: BookOpen, gradient: "from-indigo-400 to-violet-600" },
  "meeting recorder": { icon: Microphone, gradient: "from-rose-400 to-pink-600" },
  "meeting assistant": { icon: Calendar, gradient: "from-sky-400 to-cyan-500" },

  // Marketing templates
  "newsletter writer": { icon: Newspaper, gradient: "from-green-400 to-emerald-600" },
  "content creator": { icon: Palette, gradient: "from-fuchsia-400 to-pink-600" },
  "marketing assistant": { icon: Megaphone, gradient: "from-amber-400 to-orange-500" },
  "brand monitor": { icon: Eye, gradient: "from-red-400 to-rose-600" },
  "seo blog writer": { icon: Article, gradient: "from-emerald-400 to-teal-500" },
  "social media": { icon: ChatText, gradient: "from-pink-400 to-purple-500" },
  "ai cmo": { icon: Sparkle, gradient: "from-violet-400 to-purple-600" },
  "copywriter": { icon: PenNib, gradient: "from-amber-400 to-orange-500" },

  // HR templates
  "hr assistant": { icon: UsersThree, gradient: "from-slate-400 to-slate-600" },
  "resume screener": { icon: FileText, gradient: "from-amber-400 to-yellow-600" },
  "resume screening": { icon: FileText, gradient: "from-amber-400 to-yellow-600" },
  "recruiting agent": { icon: UserPlus, gradient: "from-indigo-400 to-blue-600" },
  "company knowledge base": { icon: Books, gradient: "from-violet-400 to-purple-600" },
  "employee onboarding": { icon: Handshake, gradient: "from-green-400 to-emerald-500" },
  "interview scheduler": { icon: CalendarCheck, gradient: "from-sky-400 to-blue-500" },

  // Product/Research templates
  "web researcher": { icon: Globe, gradient: "from-emerald-400 to-teal-600" },
  "web research": { icon: Globe, gradient: "from-emerald-400 to-teal-600" },
  "competition tracker": { icon: Binoculars, gradient: "from-orange-400 to-red-500" },
  "voice of customer": { icon: ChatText, gradient: "from-blue-400 to-indigo-500" },
  "web monitoring": { icon: Bell, gradient: "from-amber-400 to-orange-500" },
  "market research": { icon: ChartBar, gradient: "from-purple-400 to-violet-600" },
  "user feedback": { icon: Smiley, gradient: "from-green-400 to-emerald-500" },

  // Operations templates
  "productivity assistant": { icon: Lightning, gradient: "from-amber-400 to-yellow-500" },
  "project manager": { icon: Kanban, gradient: "from-blue-400 to-indigo-500" },
  "project status": { icon: CheckSquare, gradient: "from-green-400 to-emerald-500" },
  "task manager": { icon: ListChecks, gradient: "from-violet-400 to-purple-500" },
  "invoice processor": { icon: Receipt, gradient: "from-emerald-400 to-teal-500" },
  "document processor": { icon: Files, gradient: "from-slate-400 to-gray-600" },
  "data entry": { icon: Database, gradient: "from-blue-400 to-indigo-500" },

  // Phone templates
  "phone assistant": { icon: PhoneCall, gradient: "from-cyan-400 to-teal-600" },
  "phone agent": { icon: PhoneOutgoing, gradient: "from-teal-400 to-cyan-500" },
  "inbound call": { icon: PhoneCall, gradient: "from-green-400 to-emerald-500" },
  "outbound call": { icon: PhoneOutgoing, gradient: "from-blue-400 to-indigo-500" },

  // Slack templates
  "slack bot": { icon: ChatCircle, gradient: "from-purple-400 to-violet-600" },
  "slack assistant": { icon: ChatCircle, gradient: "from-purple-400 to-violet-500" },
};

// Default gradients by keyword
const keywordGradients: Record<string, string> = {
  // Sales
  sales: "from-amber-400 to-orange-500",
  lead: "from-amber-400 to-orange-500",
  deal: "from-emerald-400 to-green-600",
  crm: "from-blue-400 to-indigo-600",
  // Support
  support: "from-pink-400 to-rose-500",
  help: "from-indigo-400 to-purple-600",
  ticket: "from-purple-400 to-violet-600",
  chat: "from-pink-400 to-rose-500",
  bot: "from-pink-400 to-rose-500",
  // Email
  email: "from-indigo-400 to-blue-600",
  inbox: "from-blue-400 to-indigo-500",
  outreach: "from-violet-400 to-purple-500",
  // Phone
  phone: "from-cyan-400 to-teal-600",
  call: "from-cyan-400 to-teal-600",
  // Meeting
  meeting: "from-sky-400 to-blue-600",
  calendar: "from-sky-400 to-blue-600",
  schedule: "from-sky-400 to-cyan-500",
  record: "from-rose-400 to-pink-600",
  notetaker: "from-indigo-400 to-violet-600",
  // Marketing
  newsletter: "from-green-400 to-emerald-600",
  blog: "from-emerald-400 to-teal-500",
  content: "from-fuchsia-400 to-pink-600",
  creative: "from-violet-400 to-purple-600",
  brand: "from-red-400 to-rose-600",
  seo: "from-emerald-400 to-teal-500",
  marketing: "from-amber-400 to-orange-500",
  write: "from-green-400 to-emerald-600",
  copy: "from-amber-400 to-orange-500",
  // HR
  hr: "from-slate-400 to-slate-600",
  recruit: "from-indigo-400 to-blue-600",
  resume: "from-amber-400 to-yellow-600",
  knowledge: "from-violet-400 to-purple-600",
  employee: "from-slate-400 to-slate-600",
  onboard: "from-green-400 to-emerald-500",
  // Product/Research
  research: "from-emerald-400 to-teal-600",
  web: "from-emerald-400 to-teal-600",
  competition: "from-orange-400 to-red-500",
  tracker: "from-orange-400 to-red-500",
  feedback: "from-green-400 to-emerald-500",
  voice: "from-blue-400 to-indigo-500",
  analytics: "from-purple-400 to-violet-600",
  // Operations
  project: "from-blue-400 to-indigo-500",
  task: "from-violet-400 to-purple-500",
  status: "from-green-400 to-emerald-500",
  invoice: "from-emerald-400 to-teal-500",
  document: "from-slate-400 to-gray-600",
  data: "from-blue-400 to-indigo-500",
  productivity: "from-amber-400 to-yellow-500",
  automat: "from-violet-400 to-purple-500",
};

function getTemplateConfig(templateName: string): TemplateConfig {
  const normalizedName = templateName.toLowerCase();

  // Check exact match first
  for (const [key, config] of Object.entries(templateConfigs)) {
    if (normalizedName.includes(key)) {
      return config;
    }
  }

  // Find icon and gradient by keywords
  let icon: Icon = Robot;
  let gradient = "from-blue-400 to-blue-600";

  // Sales/Lead
  if (normalizedName.includes("sales") || normalizedName.includes("lead") || normalizedName.includes("deal")) icon = Target;
  // Support
  else if (normalizedName.includes("support") || normalizedName.includes("help") || normalizedName.includes("ticket")) icon = Headset;
  else if (normalizedName.includes("chat") || normalizedName.includes("bot")) icon = ChatDots;
  // Email
  else if (normalizedName.includes("email") || normalizedName.includes("inbox") || normalizedName.includes("outreach")) icon = EnvelopeOpen;
  // Phone
  else if (normalizedName.includes("phone") || normalizedName.includes("call")) icon = PhoneCall;
  // Meeting
  else if (normalizedName.includes("meeting") || normalizedName.includes("calendar") || normalizedName.includes("schedule")) icon = CalendarCheck;
  else if (normalizedName.includes("record") || normalizedName.includes("notetaker")) icon = Microphone;
  // Marketing
  else if (normalizedName.includes("newsletter") || normalizedName.includes("blog")) icon = Newspaper;
  else if (normalizedName.includes("content") || normalizedName.includes("creative")) icon = Palette;
  else if (normalizedName.includes("brand") || normalizedName.includes("monitor")) icon = Eye;
  else if (normalizedName.includes("seo") || normalizedName.includes("article")) icon = Article;
  else if (normalizedName.includes("marketing")) icon = Megaphone;
  else if (normalizedName.includes("write") || normalizedName.includes("copy")) icon = PenNib;
  // HR
  else if (normalizedName.includes("recruit") || normalizedName.includes("hiring")) icon = UserPlus;
  else if (normalizedName.includes("resume") || normalizedName.includes("cv")) icon = FileText;
  else if (normalizedName.includes("knowledge") || normalizedName.includes("wiki")) icon = Books;
  else if (normalizedName.includes("hr") || normalizedName.includes("employee")) icon = UsersThree;
  else if (normalizedName.includes("onboard")) icon = Handshake;
  // Product/Research
  else if (normalizedName.includes("research") || normalizedName.includes("web")) icon = Globe;
  else if (normalizedName.includes("competition") || normalizedName.includes("tracker")) icon = Binoculars;
  else if (normalizedName.includes("feedback") || normalizedName.includes("voice")) icon = ChatText;
  else if (normalizedName.includes("analytics") || normalizedName.includes("chart")) icon = ChartBar;
  // Operations
  else if (normalizedName.includes("project") || normalizedName.includes("kanban")) icon = Kanban;
  else if (normalizedName.includes("task") || normalizedName.includes("todo")) icon = ListChecks;
  else if (normalizedName.includes("status") || normalizedName.includes("update")) icon = CheckSquare;
  else if (normalizedName.includes("invoice") || normalizedName.includes("receipt")) icon = Receipt;
  else if (normalizedName.includes("document") || normalizedName.includes("file")) icon = Files;
  else if (normalizedName.includes("data") || normalizedName.includes("crm")) icon = Database;
  else if (normalizedName.includes("productivity") || normalizedName.includes("automat")) icon = Lightning;

  // Find gradient by keyword
  for (const [keyword, grad] of Object.entries(keywordGradients)) {
    if (normalizedName.includes(keyword)) {
      gradient = grad;
      break;
    }
  }

  return { icon, gradient };
}

// Full template type from API
interface TriggerSuggestion {
  type: string;
  label: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  color: string | null;
  category: string;
  isFeatured: boolean;
  isPublic: boolean;
  suggestedIntegrations: string[];
  suggestedTriggers: unknown;
  createdByName: string | null;
  role: string | null;
  useCase: string | null;
}

interface TemplateCardProps {
  template: Template;
  onClick: () => void;
}

function TemplateCard({ template, onClick }: TemplateCardProps) {
  const config = getTemplateConfig(template.name);

  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl border bg-card p-4 text-left hover:bg-muted/50 hover:shadow-sm transition-all flex flex-col h-[130px]"
    >
      <div className={`size-6 shrink-0 rounded-sm flex items-center justify-center mb-2.5 bg-gradient-to-br ${config.gradient}`}>
        <config.icon className="size-3 text-white" weight="fill" />
      </div>
      <h4 className="font-semibold text-sm mb-1 truncate">{template.name}</h4>
      <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
    </button>
  );
}

// Integration icons mapping with full-color brand logos (using Iconify)
const integrationIcons: Record<string, { icon: string; label: string; color?: string }> = {
  // Google (with brand colors)
  gmail: { icon: "logos:google-gmail", label: "Gmail" },
  "google-sheets": { icon: "simple-icons:googlesheets", label: "Google Sheets", color: "#34A853" },
  "google-calendar": { icon: "logos:google-calendar", label: "Google Calendar" },
  "google-drive": { icon: "logos:google-drive", label: "Google Drive" },
  "google-forms": { icon: "simple-icons:googleforms", label: "Form", color: "#673AB7" },
  "google-docs": { icon: "simple-icons:googledocs", label: "Google Docs", color: "#4285F4" },
  google: { icon: "logos:google-icon", label: "Google" },
  // Communication
  slack: { icon: "logos:slack-icon", label: "Slack" },
  email: { icon: "mdi:email", label: "Email", color: "#6366F1" },
  phone: { icon: "mdi:phone", label: "Phone", color: "#10B981" },
  // CRM & Sales
  hubspot: { icon: "simple-icons:hubspot", label: "HubSpot", color: "#FF7A59" },
  salesforce: { icon: "simple-icons:salesforce", label: "Salesforce", color: "#00A1E0" },
  linkedin: { icon: "logos:linkedin-icon", label: "LinkedIn" },
  // Productivity
  notion: { icon: "simple-icons:notion", label: "Notion", color: "#000000" },
  airtable: { icon: "simple-icons:airtable", label: "Airtable", color: "#18BFFF" },
  zapier: { icon: "simple-icons:zapier", label: "Zapier", color: "#FF4A00" },
  // Social Media
  twitter: { icon: "simple-icons:x", label: "X", color: "#000000" },
  facebook: { icon: "logos:facebook", label: "Facebook" },
  instagram: { icon: "skill-icons:instagram", label: "Instagram" },
  youtube: { icon: "logos:youtube-icon", label: "YouTube" },
  // Agent features
  chat: { icon: "mdi:chat", label: "Chat with this Agent", color: "#6366F1" },
  webhook: { icon: "mdi:webhook", label: "Webhook", color: "#6B7280" },
  embed: { icon: "mdi:code-tags", label: "Embed", color: "#6366F1" },
  // Research & Data
  "web-browser": { icon: "mdi:web", label: "Web browser", color: "#4285F4" },
  perplexity: { icon: "simple-icons:perplexity", label: "Perplexity", color: "#20B2AA" },
  "knowledge-base": { icon: "mdi:book-open-variant", label: "Knowledge base", color: "#6366F1" },
  // Data providers
  "enter-loop": { icon: "mdi:sync", label: "Enter loop", color: "#10B981" },
  "people-data-labs": { icon: "mdi:account-group", label: "People Data Labs", color: "#6366F1" },
  // Utilities
  timer: { icon: "mdi:timer", label: "Timer", color: "#F59E0B" },
  "lindy-utilities": { icon: "mdi:tools", label: "Nodebase utilities", color: "#6366F1" },
  "lindy-mail": { icon: "mdi:email-outline", label: "Nodebase mail", color: "#F59E0B" },
  "lindy-meeting-recorder": { icon: "mdi:microphone", label: "Meeting recorder", color: "#F59E0B" },
  "meeting-recorder": { icon: "mdi:microphone", label: "Meeting recorder", color: "#F59E0B" },
  ai: { icon: "mdi:robot", label: "AI", color: "#8B5CF6" },
  "generate-media": { icon: "mdi:image-auto-adjust", label: "Generate media", color: "#EC4899" },
  "video-utilities": { icon: "mdi:video", label: "Video utilities", color: "#EF4444" },
  // Dev tools
  github: { icon: "logos:github-icon", label: "GitHub" },
  linear: { icon: "logos:linear-icon", label: "Linear" },
  // Embed
  "lindy-embed": { icon: "mdi:code-tags", label: "Embed", color: "#6366F1" },
  // Calendar
  calendar: { icon: "mdi:calendar", label: "Calendar", color: "#4285F4" },
  // Phone
  "lindy-phone": { icon: "mdi:phone", label: "Nodebase phone", color: "#10B981" },
  twilio: { icon: "logos:twilio-icon", label: "Twilio" },
  // Agent communication
  "talk-with-agents": { icon: "mdi:robot-outline", label: "Talk with other agents", color: "#8B5CF6" },
  // Messaging platforms
  whatsapp: { icon: "logos:whatsapp-icon", label: "WhatsApp" },
  telegram: { icon: "logos:telegram", label: "Telegram" },
};

// Trigger icons mapping
const triggerIcons: Record<string, { icon: string; color: string }> = {
  SCHEDULE: { icon: "mdi:clock-outline", color: "#6366F1" },
  WEBHOOK: { icon: "mdi:webhook", color: "#10B981" },
  EMAIL: { icon: "mdi:email-receive-outline", color: "#F59E0B" },
  CHAT: { icon: "mdi:message-text-outline", color: "#3B82F6" },
  AGENT_MESSAGE: { icon: "mdi:robot-outline", color: "#8B5CF6" },
  CALENDAR_EVENT: { icon: "mdi:calendar-clock", color: "#4285F4" },
  NEW_ROW: { icon: "mdi:table-row-plus-after", color: "#34A853" },
  EMBED: { icon: "mdi:code-tags", color: "#6366F1" },
  SMS_RECEIVED: { icon: "mdi:message-processing", color: "#10B981" },
  CALL_RECEIVED: { icon: "mdi:phone-incoming", color: "#10B981" },
  MESSAGE_RECEIVED: { icon: "mdi:message-text", color: "#3B82F6" },
};

interface TemplatePreviewDialogProps {
  template: Template | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUse: () => void;
  isPending: boolean;
}

function TemplatePreviewDialog({
  template,
  open,
  onOpenChange,
  onUse,
  isPending,
}: TemplatePreviewDialogProps) {
  if (!template) return null;

  const config = getTemplateConfig(template.name);
  const integrations = template.suggestedIntegrations || [];
  const triggers = (template.suggestedTriggers || []) as TriggerSuggestion[];

  // Always show "Chat with this Agent" first
  const allIntegrations = ["chat", ...integrations.filter((i) => i !== "chat")];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6" showCloseButton={false}>
        {/* Icon */}
        <div className={`size-12 rounded-lg flex items-center justify-center bg-gradient-to-br ${config.gradient}`}>
          <config.icon className="size-6 text-white" weight="fill" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold mt-2">{template.name}</h2>

        {/* Badge */}
        <span className="text-sm text-amber-600 underline underline-offset-2">
          {template.createdByName ? "Community Template" : "Official Template"}
        </span>

        {/* Description */}
        <div className="mt-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Description</p>
          <p className="text-sm text-foreground">{template.description}</p>
        </div>

        {/* Triggers */}
        {triggers.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Trigger</p>
            <div className="flex flex-wrap gap-2">
              {triggers.map((trigger, idx) => {
                const triggerInfo = triggerIcons[trigger.type] || { icon: "mdi:play", color: "#6B7280" };
                return (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm"
                  >
                    <IconifyIcon icon={triggerInfo.icon} className="size-4" style={{ color: triggerInfo.color }} />
                    {trigger.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Apps used */}
        {allIntegrations.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Apps used</p>
            <div className="flex flex-wrap gap-2">
              {allIntegrations.map((integration) => {
                const info = integrationIcons[integration];
                const iconName = info?.icon || "mdi:cog";
                const label = info?.label || integration.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                const color = info?.color;
                return (
                  <span
                    key={integration}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm"
                  >
                    <IconifyIcon icon={iconName} className="size-4" style={color ? { color } : undefined} />
                    {label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Add button */}
        <Button
          onClick={onUse}
          disabled={isPending}
          className="mt-6 gap-1.5"
        >
          {isPending ? (
            <CircleNotch className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Add
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function TemplatesContent({
  search,
  selectedRoles,
  selectedUseCases,
}: {
  search: string;
  selectedRoles: string[];
  selectedUseCases: string[];
}) {
  // Fetch all templates - filtering is done client-side
  const templates = useSuspenseTemplates({
    search,
  });
  const createFromTemplate = useCreateAgentFromTemplate();

  // State for preview modal
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // Filter templates client-side for roles and use cases
  const filteredTemplates = useMemo(() => {
    let result = templates.data as Template[];

    // Filter by roles
    if (selectedRoles.length > 0) {
      result = result.filter((t) => {
        // Check if template has role field directly
        if (t.role) {
          return selectedRoles.includes(t.role);
        }
        // Fallback to category mapping
        const mappedRole = CATEGORY_TO_ROLE[t.category];
        return selectedRoles.includes(mappedRole);
      });
    }

    // Filter by use cases
    if (selectedUseCases.length > 0) {
      result = result.filter((t) => {
        if (t.useCase) {
          return selectedUseCases.includes(t.useCase);
        }
        return false;
      });
    }

    // Remove duplicates by name (keep the first one encountered, which preserves featured status)
    const seenNames = new Set<string>();
    result = result.filter((t) => {
      const normalizedName = t.name.toLowerCase().trim();
      if (seenNames.has(normalizedName)) {
        return false;
      }
      seenNames.add(normalizedName);
      return true;
    });

    // Sort alphabetically by name (A-Z)
    result = result.sort((a, b) => a.name.localeCompare(b.name));

    return result;
  }, [templates.data, selectedRoles, selectedUseCases]);

  // Get featured templates (first 4)
  const featuredTemplates = filteredTemplates.filter((t) => t.isFeatured).slice(0, 4);
  const hasFilters = selectedRoles.length > 0;
  const activeRoleLabel = selectedRoles.length === 1
    ? ROLES.find(r => r.id === selectedRoles[0])?.label
    : selectedRoles.length > 1
      ? "Selected Roles"
      : "All";

  const handleUseTemplate = () => {
    if (selectedTemplate) {
      createFromTemplate.mutate({ templateId: selectedTemplate.id });
    }
  };

  if (filteredTemplates.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          No templates found{search ? ` for "${search}"` : ""}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Most popular section - only show when role is selected */}
      {selectedRoles.length > 0 && featuredTemplates.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Most popular in {activeRoleLabel}</h2>
          {/* First row: Hero (2 cols) + 1 card */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {/* Hero card - spans 2 columns */}
            <Card className="lg:col-span-2 overflow-hidden border-0 bg-[#FEF3E2] rounded-2xl h-[130px]">
              <CardContent className="p-4 h-full flex items-center justify-between">
                <p className="text-xl font-medium text-amber-600">
                  Our users&apos; favorite agents.
                </p>
                <div className="relative shrink-0">
                  <Star className="size-16 text-amber-400 drop-shadow-lg" weight="fill" />
                </div>
              </CardContent>
            </Card>

            {/* First featured template card */}
            {featuredTemplates[0] && (
              <TemplateCard
                template={featuredTemplates[0]}
                onClick={() => setSelectedTemplate(featuredTemplates[0])}
              />
            )}
          </div>

          {/* Second row: 3 cards */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {featuredTemplates.slice(1, 4).map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onClick={() => setSelectedTemplate(template)}
              />
            ))}
          </div>
        </div>
      )}

      {/* All templates section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          {hasFilters ? `All templates in ${activeRoleLabel}` : "All templates"}
        </h2>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onClick={() => setSelectedTemplate(template)}
            />
          ))}
        </div>
      </div>

      {/* Template preview modal */}
      <TemplatePreviewDialog
        template={selectedTemplate}
        open={!!selectedTemplate}
        onOpenChange={(open) => !open && setSelectedTemplate(null)}
        onUse={handleUseTemplate}
        isPending={createFromTemplate.isPending}
      />

      {/* Loading overlay */}
      {createFromTemplate.isPending && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-4">
            <CircleNotch className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Creating your agent...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { open: sidebarOpen } = useSidebar();
  const roleParam = searchParams.get("role");

  const [search, setSearch] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(() => {
    // Initialize from URL or default to empty (show all)
    if (roleParam && ROLES.some(r => r.id === roleParam)) {
      return [roleParam];
    }
    return [];
  });
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);
  const [roleOpen, setRoleOpen] = useState(true);
  const [useCaseOpen, setUseCaseOpen] = useState(true);

  // Sync URL with selected roles
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (selectedRoles.length === 1) {
      params.set("role", selectedRoles[0]);
    } else {
      params.delete("role");
    }

    const newUrl = params.toString() ? `?${params.toString()}` : "/templates";
    router.replace(newUrl, { scroll: false });
  }, [selectedRoles, router]);

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  };

  const toggleUseCase = (useCaseId: string) => {
    setSelectedUseCases((prev) =>
      prev.includes(useCaseId)
        ? prev.filter((id) => id !== useCaseId)
        : [...prev, useCaseId]
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header unifié - PLEINE LARGEUR */}
      <header className="flex items-center justify-between px-5 pt-2.5 pb-3 border-b bg-white shrink-0">
        <div className="flex items-center gap-2">
          {!sidebarOpen && <SidebarTrigger />}
          <Link href="/home" className="flex items-center gap-2 text-[15px] text-muted-foreground hover:text-foreground p-1 -m-1">
            <CaretLeft className="size-4" />
            Back
          </Link>
        </div>
        <Button size="sm" className="gap-1.5" asChild>
          <Link href="/agents/new">
            <Plus className="size-4" />
            New Agent
          </Link>
        </Button>
      </header>

      {/* Flex sidebar/content - AVEC MARGES à gauche et droite */}
      <div className="flex flex-1 w-full overflow-hidden max-w-6xl mx-auto my-4 px-4">
        {/* Left sidebar with filters */}
        <aside className="w-64 border-r bg-white px-6 py-4 overflow-y-auto shrink-0 hidden md:block">
          {/* Role filter */}
          <Collapsible open={roleOpen} onOpenChange={setRoleOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full mb-4">
              <span className="text-sm font-medium">Role</span>
              <ChevronUp
                className={`size-4 text-muted-foreground transition-transform ${
                  roleOpen ? "" : "rotate-180"
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3">
              {ROLES.map((role) => (
                <label
                  key={role.id}
                  className={cn(
                    "flex items-center gap-3 cursor-pointer py-0.5 -ml-2 pl-2",
                    selectedRoles.includes(role.id) && "border-l-[3px] border-primary"
                  )}
                >
                  <Checkbox
                    checked={selectedRoles.includes(role.id)}
                    onCheckedChange={() => toggleRole(role.id)}
                  />
                  <span className="text-sm text-muted-foreground">{role.label}</span>
                </label>
              ))}
            </CollapsibleContent>
          </Collapsible>

          <div className="border-t my-6" />

          {/* Use case filter */}
          <Collapsible open={useCaseOpen} onOpenChange={setUseCaseOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full mb-4">
              <span className="text-sm font-medium">Use case</span>
              <ChevronUp
                className={`size-4 text-muted-foreground transition-transform ${
                  useCaseOpen ? "" : "rotate-180"
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3">
              {USE_CASES.map((useCase) => (
                <label
                  key={useCase.id}
                  className={cn(
                    "flex items-center gap-3 cursor-pointer py-0.5 -ml-2 pl-2",
                    selectedUseCases.includes(useCase.id) && "border-l-[3px] border-primary"
                  )}
                >
                  <Checkbox
                    checked={selectedUseCases.includes(useCase.id)}
                    onCheckedChange={() => toggleUseCase(useCase.id)}
                  />
                  <span className="text-sm text-muted-foreground">
                    {useCase.label}
                  </span>
                </label>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </aside>

        {/* Main content */}
        <main className="flex-1 w-full overflow-y-auto px-6 py-6">
          <div className="w-full max-w-5xl">
          {/* Search */}
          <div className="relative mb-6 w-full">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search"
              className="pl-10 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Templates grid */}
          <Suspense fallback={<TemplateGridSkeleton />}>
            <TemplatesContent
              search={search}
              selectedRoles={selectedRoles}
              selectedUseCases={selectedUseCases}
            />
          </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
