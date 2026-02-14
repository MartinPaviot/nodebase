import {
  Microphone,
  Envelope,
  EnvelopeOpen,
  PhoneCall,
  PhoneOutgoing,
  ChatCircle,
  ChatText,
  ChatDots,
  Globe,
  UserPlus,
  UsersThree,
  Calendar,
  CalendarCheck,
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

// ── Types ──────────────────────────────────────────────

export type TemplateConfig = { icon: Icon; gradient: string };

export interface TriggerSuggestion {
  type: string;
  label: string;
}

// ── Template configs (icon + gradient by name) ─────────

export const templateConfigs: Record<string, TemplateConfig> = {
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

// ── Keyword gradients (fallback) ───────────────────────

const keywordGradients: Record<string, string> = {
  sales: "from-amber-400 to-orange-500",
  lead: "from-amber-400 to-orange-500",
  deal: "from-emerald-400 to-green-600",
  crm: "from-blue-400 to-indigo-600",
  support: "from-pink-400 to-rose-500",
  help: "from-indigo-400 to-purple-600",
  ticket: "from-purple-400 to-violet-600",
  chat: "from-pink-400 to-rose-500",
  bot: "from-pink-400 to-rose-500",
  email: "from-indigo-400 to-blue-600",
  inbox: "from-blue-400 to-indigo-500",
  outreach: "from-violet-400 to-purple-500",
  phone: "from-cyan-400 to-teal-600",
  call: "from-cyan-400 to-teal-600",
  meeting: "from-sky-400 to-blue-600",
  calendar: "from-sky-400 to-blue-600",
  schedule: "from-sky-400 to-cyan-500",
  record: "from-rose-400 to-pink-600",
  notetaker: "from-indigo-400 to-violet-600",
  newsletter: "from-green-400 to-emerald-600",
  blog: "from-emerald-400 to-teal-500",
  content: "from-fuchsia-400 to-pink-600",
  creative: "from-violet-400 to-purple-600",
  brand: "from-red-400 to-rose-600",
  seo: "from-emerald-400 to-teal-500",
  marketing: "from-amber-400 to-orange-500",
  write: "from-green-400 to-emerald-600",
  copy: "from-amber-400 to-orange-500",
  hr: "from-slate-400 to-slate-600",
  recruit: "from-indigo-400 to-blue-600",
  resume: "from-amber-400 to-yellow-600",
  knowledge: "from-violet-400 to-purple-600",
  employee: "from-slate-400 to-slate-600",
  onboard: "from-green-400 to-emerald-500",
  research: "from-emerald-400 to-teal-600",
  web: "from-emerald-400 to-teal-600",
  competition: "from-orange-400 to-red-500",
  tracker: "from-orange-400 to-red-500",
  feedback: "from-green-400 to-emerald-500",
  voice: "from-blue-400 to-indigo-500",
  analytics: "from-purple-400 to-violet-600",
  project: "from-blue-400 to-indigo-500",
  task: "from-violet-400 to-purple-500",
  status: "from-green-400 to-emerald-500",
  invoice: "from-emerald-400 to-teal-500",
  document: "from-slate-400 to-gray-600",
  data: "from-blue-400 to-indigo-500",
  productivity: "from-amber-400 to-yellow-500",
  automat: "from-violet-400 to-purple-500",
};

// ── getTemplateConfig ──────────────────────────────────

export function getTemplateConfig(templateName: string): TemplateConfig {
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

  if (normalizedName.includes("sales") || normalizedName.includes("lead") || normalizedName.includes("deal")) icon = Target;
  else if (normalizedName.includes("support") || normalizedName.includes("help") || normalizedName.includes("ticket")) icon = Headset;
  else if (normalizedName.includes("chat") || normalizedName.includes("bot")) icon = ChatDots;
  else if (normalizedName.includes("email") || normalizedName.includes("inbox") || normalizedName.includes("outreach")) icon = EnvelopeOpen;
  else if (normalizedName.includes("phone") || normalizedName.includes("call")) icon = PhoneCall;
  else if (normalizedName.includes("meeting") || normalizedName.includes("calendar") || normalizedName.includes("schedule")) icon = CalendarCheck;
  else if (normalizedName.includes("record") || normalizedName.includes("notetaker")) icon = Microphone;
  else if (normalizedName.includes("newsletter") || normalizedName.includes("blog")) icon = Newspaper;
  else if (normalizedName.includes("content") || normalizedName.includes("creative")) icon = Palette;
  else if (normalizedName.includes("brand") || normalizedName.includes("monitor")) icon = Eye;
  else if (normalizedName.includes("seo") || normalizedName.includes("article")) icon = Article;
  else if (normalizedName.includes("marketing")) icon = Megaphone;
  else if (normalizedName.includes("write") || normalizedName.includes("copy")) icon = PenNib;
  else if (normalizedName.includes("recruit") || normalizedName.includes("hiring")) icon = UserPlus;
  else if (normalizedName.includes("resume") || normalizedName.includes("cv")) icon = FileText;
  else if (normalizedName.includes("knowledge") || normalizedName.includes("wiki")) icon = Books;
  else if (normalizedName.includes("hr") || normalizedName.includes("employee")) icon = UsersThree;
  else if (normalizedName.includes("onboard")) icon = Handshake;
  else if (normalizedName.includes("research") || normalizedName.includes("web")) icon = Globe;
  else if (normalizedName.includes("competition") || normalizedName.includes("tracker")) icon = Binoculars;
  else if (normalizedName.includes("feedback") || normalizedName.includes("voice")) icon = ChatText;
  else if (normalizedName.includes("analytics") || normalizedName.includes("chart")) icon = ChartBar;
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

// ── Trigger icons ──────────────────────────────────────

export const triggerIcons: Record<string, { icon: string; color: string }> = {
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
