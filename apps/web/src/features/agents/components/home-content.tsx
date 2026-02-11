"use client";

import { useState, useRef, useCallback, useEffect, type FormEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  PaperPlaneTilt,
  Paperclip,
  Microphone,
  MicrophoneSlash,
  MagnifyingGlass,
  CaretRight,
  Globe,
  Envelope,
  Phone,
  Calendar,
  ChatCircle,
  Users,
  Briefcase,
  Headset,
  Code,
  Megaphone,
  Clock,
  TrendUp,
  PenNib,
  BookOpen,
  Crosshair,
  X,
  File,
  Plus,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { CircleNotch } from "@phosphor-icons/react";
import { Icon as IconifyIcon } from "@iconify/react";
import {
  useSuspenseTemplates,
  useCreateAgentFromTemplate,
} from "@/features/templates/hooks/use-templates";
import {
  Robot,
  Target,
  EnvelopeOpen,
  PhoneCall,
  PhoneOutgoing,
  CalendarCheck,
  Newspaper,
  Palette,
  Eye,
  Article,
  UserPlus,
  FileText,
  Books,
  UsersThree,
  Handshake,
  Binoculars,
  ChatText,
  ChartBar,
  Kanban,
  ListChecks,
  CheckSquare,
  Receipt,
  Files,
  Database,
  Lightning,
  ChatDots,
  Tag,
  Question,
  ShieldCheck,
  Repeat,
  Bell,
  Sparkle,
  Smiley,
  type Icon,
} from "@phosphor-icons/react";

// Template categories matching Lindy's structure
const CATEGORIES = [
  { id: "sales", label: "Sales", icon: TrendUp },
  { id: "marketing", label: "Marketing", icon: Megaphone },
  { id: "support", label: "Support", icon: Headset },
  { id: "hr", label: "Human Resources", icon: Users },
  { id: "meetings", label: "Meetings", icon: Calendar },
  { id: "productivity", label: "Productivity", icon: Clock },
  { id: "product", label: "Product", icon: Globe },
] as const;

// Quick suggestions shown below the input
const QUICK_SUGGESTIONS = [
  { label: "Personal website", icon: Globe, color: "text-emerald-600" },
  { label: "Customer support email", icon: Envelope, color: "text-indigo-600" },
  { label: "Outbound sales calls", icon: Phone, color: "text-cyan-600" },
  { label: "Lead gen", icon: Crosshair, color: "text-emerald-600" },
  { label: "Meeting recorder", icon: Calendar, color: "text-violet-600" },
  { label: "LinkedIn outreach", icon: Users, color: "text-emerald-600" },
  { label: "Support chatbot", icon: ChatCircle, color: "text-pink-600" },
];

// Template data structure
interface Template {
  id: string;
  name: string;
  description: string;
  subtitle?: string;
  icon: typeof Globe;
  color: string;
  bgColor: string;
}

interface CategorySection {
  id: string;
  title: string;
  tagline: string;
  taglineColor: string;
  bgGradient: string;
  illustration?: string;
  templates: Template[];
}

// Category sections with their templates - Blue-themed color scheme
const CATEGORY_SECTIONS: CategorySection[] = [
  {
    id: "sales",
    title: "Sales",
    tagline: "Close more deals than ever with your AI SDR.",
    taglineColor: "text-indigo-600",
    bgGradient: "from-indigo-50/80 to-blue-100/60",
    illustration: "/illustrations/sales-consulting-animate.svg",
    templates: [
      { id: "lead-gen", name: "Lead Generator", description: "Find and organize leads instantly", icon: Crosshair, color: "text-indigo-500", bgColor: "bg-indigo-100" },
      { id: "outreacher", name: "Lead Outreacher", description: "Automated sales outreach and lead engagement", icon: Envelope, color: "text-blue-500", bgColor: "bg-blue-100" },
      { id: "phone-call", name: "Outbound Phone Call Agent", description: "Book consultations with qualified leads instantly", icon: Phone, color: "text-sky-500", bgColor: "bg-sky-100" },
      { id: "phone-agent", name: "Outbound Phone Agent", description: "Automated calling and lead management", icon: Phone, color: "text-indigo-500", bgColor: "bg-indigo-100" },
    ],
  },
  {
    id: "marketing",
    title: "Marketing",
    tagline: "Smarter marketing starts here.",
    taglineColor: "text-violet-600",
    bgGradient: "from-violet-50/80 to-purple-100/60",
    illustration: "/illustrations/paper-map-animate.svg",
    templates: [
      { id: "newsletter", name: "Newsletter Writer", description: "Create engaging newsletters in minutes", icon: PenNib, color: "text-violet-500", bgColor: "bg-violet-100" },
      { id: "creative", name: "AI CMO | Creative Agent", description: "Generates ad copy, images, and video assets for campaigns.", icon: Megaphone, color: "text-purple-500", bgColor: "bg-purple-100" },
      { id: "research-agent", name: "AI CMO | Research Agent", description: "Studies competitors and builds clear messaging frameworks.", icon: MagnifyingGlass, color: "text-indigo-500", bgColor: "bg-indigo-100" },
      { id: "seo", name: "SEO Blog Writer", description: "Create optimized blog posts tailored to your brand effortlessly", icon: PenNib, color: "text-violet-500", bgColor: "bg-violet-100" },
    ],
  },
  {
    id: "support",
    title: "Support",
    tagline: "Faster answers, happier customers.",
    taglineColor: "text-cyan-600",
    bgGradient: "from-cyan-50/80 to-sky-100/60",
    illustration: "/illustrations/live-collaboration-animate.svg",
    templates: [
      { id: "sms-support", name: "SMS Support Bot", description: "Automated customer support via text", icon: ChatCircle, color: "text-cyan-500", bgColor: "bg-cyan-100" },
      { id: "whatsapp", name: "WhatsApp Support Agent", description: "Smart messaging bot for WhatsApp", icon: ChatCircle, color: "text-teal-500", bgColor: "bg-teal-100" },
      { id: "phone-support", name: "Phone Support Agent", description: "Phone support made simple", icon: Phone, color: "text-sky-500", bgColor: "bg-sky-100" },
      { id: "website-support", name: "Website Customer Support", description: "Embed Lindy on your website. Give your users instant answers and...", icon: Globe, color: "text-blue-500", bgColor: "bg-blue-100" },
    ],
  },
  {
    id: "hr",
    title: "Human Resources",
    tagline: "Automate sourcing, screening, and outreach.",
    taglineColor: "text-teal-600",
    bgGradient: "from-teal-50/80 to-emerald-100/60",
    illustration: "/illustrations/live-collaboration-animate.svg",
    templates: [
      { id: "resume", name: "Resume Screening Agent", description: "Smart resume ranking and candidate insights", icon: Users, color: "text-teal-500", bgColor: "bg-teal-100" },
      { id: "knowledge", name: "Company Knowledge Base", description: "Respond to team questions using a knowledge base", icon: BookOpen, color: "text-emerald-500", bgColor: "bg-emerald-100" },
      { id: "enrich", name: "Enrich New Leads", description: "Research and enrich new leads automatically", icon: Crosshair, color: "text-cyan-500", bgColor: "bg-cyan-100" },
      { id: "onboarding", name: "Employee Onboarding Assistant", description: "Seamlessly welcome new team members onboard", icon: Users, color: "text-teal-500", bgColor: "bg-teal-100" },
    ],
  },
  {
    id: "meetings",
    title: "Meetings",
    tagline: "Book, reschedule, and follow up, automatically.",
    taglineColor: "text-purple-600",
    bgGradient: "from-purple-50/80 to-violet-100/60",
    illustration: "/illustrations/calendar-animate.svg",
    templates: [
      { id: "notetaker", name: "Meeting Notetaker", description: "Captures key meeting details, sends follow-ups, and answers questions...", icon: BookOpen, color: "text-purple-500", bgColor: "bg-purple-100" },
      { id: "scheduler", name: "Meeting Scheduler", description: "CC Lindy to your emails, just like a real EA, and have her schedule...", icon: Calendar, color: "text-indigo-500", bgColor: "bg-indigo-100" },
      { id: "prep", name: "Meeting Prep Assistant", description: "Get ready for meetings in minutes", icon: Briefcase, color: "text-violet-500", bgColor: "bg-violet-100" },
      { id: "coach", name: "Meeting Coach", description: "Enhance your meeting skills effortlessly.", icon: Users, color: "text-purple-500", bgColor: "bg-purple-100" },
    ],
  },
  {
    id: "productivity",
    title: "Productivity",
    tagline: "Automate repetitive tasks and boost your daily output.",
    taglineColor: "text-sky-600",
    bgGradient: "from-sky-50/80 to-blue-100/60",
    illustration: "/illustrations/timeline-animate.svg",
    templates: [
      { id: "email-responder", name: "Email Responder", description: "Automate email replies", icon: Envelope, color: "text-sky-500", bgColor: "bg-sky-100" },
      { id: "email-triager", name: "Email Triager", description: "Smart email labels, done for you using AI.", icon: Envelope, color: "text-blue-500", bgColor: "bg-blue-100" },
      { id: "summarizer", name: "AI Website Summarizer", description: "Quick website summaries in seconds", icon: Globe, color: "text-cyan-500", bgColor: "bg-cyan-100" },
      { id: "followup", name: "Email Follow-up Reminder", description: "Never forget to follow up on emails.", icon: Clock, color: "text-indigo-500", bgColor: "bg-indigo-100" },
    ],
  },
  {
    id: "product",
    title: "Product",
    tagline: "From specs to shipping, get it done.",
    taglineColor: "text-blue-600",
    bgGradient: "from-blue-50/80 to-indigo-100/60",
    illustration: "/illustrations/paper-map-animate.svg",
    templates: [
      { id: "voc", name: "Voice of the Customer", description: "Extract Customer insights and share them to your team.", icon: ChatCircle, color: "text-blue-500", bgColor: "bg-blue-100" },
      { id: "competition", name: "Competition Tracker", description: "Monitor competitors with real-time insights", icon: Crosshair, color: "text-indigo-500", bgColor: "bg-indigo-100" },
      { id: "researcher", name: "Web Researcher", description: "Performs advanced research based on your request.", icon: MagnifyingGlass, color: "text-sky-500", bgColor: "bg-sky-100" },
      { id: "monitoring", name: "Web Monitoring", description: "Stay updated with real-time alerts.", icon: Globe, color: "text-blue-500", bgColor: "bg-blue-100" },
    ],
  },
];

// Database template interface
interface DBTemplate {
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

interface TriggerSuggestion {
  type: string;
  label: string;
}

// Template config: icon + gradient (same as templates page)
type TemplateConfig = { icon: Icon; gradient: string };

const templateConfigs: Record<string, TemplateConfig> = {
  "sales meeting recorder": { icon: Microphone, gradient: "from-rose-400 to-red-600" },
  "lead generator": { icon: Target, gradient: "from-amber-400 to-orange-500" },
  "lead outreacher": { icon: PaperPlaneTilt, gradient: "from-violet-400 to-purple-500" },
  "outbound phone call agent": { icon: PhoneOutgoing, gradient: "from-cyan-400 to-teal-600" },
  "customer support email": { icon: EnvelopeOpen, gradient: "from-emerald-400 to-teal-500" },
  "website customer support": { icon: Globe, gradient: "from-emerald-400 to-green-500" },
  "support chatbot": { icon: ChatDots, gradient: "from-pink-400 to-rose-500" },
  "email assistant": { icon: EnvelopeOpen, gradient: "from-indigo-400 to-blue-600" },
  "email responder": { icon: Repeat, gradient: "from-blue-400 to-indigo-500" },
  "email triager": { icon: Tag, gradient: "from-violet-400 to-purple-500" },
  "meeting scheduler": { icon: CalendarCheck, gradient: "from-sky-400 to-blue-600" },
  "meeting notetaker": { icon: BookOpen, gradient: "from-indigo-400 to-violet-600" },
  "meeting recorder": { icon: Microphone, gradient: "from-rose-400 to-pink-600" },
  "newsletter writer": { icon: Newspaper, gradient: "from-green-400 to-emerald-600" },
  "content creator": { icon: Palette, gradient: "from-fuchsia-400 to-pink-600" },
  "seo blog writer": { icon: Article, gradient: "from-emerald-400 to-teal-500" },
  "resume screener": { icon: FileText, gradient: "from-amber-400 to-yellow-600" },
  "resume screening agent": { icon: FileText, gradient: "from-amber-400 to-yellow-600" },
  "company knowledge base": { icon: Books, gradient: "from-violet-400 to-purple-600" },
  "employee onboarding": { icon: Handshake, gradient: "from-green-400 to-emerald-500" },
  "web researcher": { icon: Globe, gradient: "from-emerald-400 to-teal-600" },
  "competition tracker": { icon: Binoculars, gradient: "from-orange-400 to-red-500" },
  "voice of the customer": { icon: ChatText, gradient: "from-blue-400 to-indigo-500" },
  "web monitoring": { icon: Bell, gradient: "from-amber-400 to-orange-500" },
  "productivity assistant": { icon: Lightning, gradient: "from-amber-400 to-yellow-500" },
  "phone support agent": { icon: PhoneCall, gradient: "from-indigo-400 to-violet-500" },
  "sms support bot": { icon: ChatText, gradient: "from-blue-400 to-indigo-500" },
  "whatsapp support agent": { icon: ChatCircle, gradient: "from-green-400 to-emerald-500" },
};

function getTemplateConfig(templateName: string): TemplateConfig {
  const normalizedName = templateName.toLowerCase();
  for (const [key, config] of Object.entries(templateConfigs)) {
    if (normalizedName.includes(key)) {
      return config;
    }
  }
  // Default fallback
  let icon: Icon = Robot;
  let gradient = "from-blue-400 to-blue-600";
  if (normalizedName.includes("sales") || normalizedName.includes("lead")) icon = Target;
  else if (normalizedName.includes("support") || normalizedName.includes("help")) icon = Headset;
  else if (normalizedName.includes("email")) icon = EnvelopeOpen;
  else if (normalizedName.includes("phone") || normalizedName.includes("call")) icon = PhoneCall;
  else if (normalizedName.includes("meeting") || normalizedName.includes("calendar")) icon = CalendarCheck;
  else if (normalizedName.includes("research") || normalizedName.includes("web")) icon = Globe;
  return { icon, gradient };
}

// Integration icons mapping (same as templates page)
const integrationIcons: Record<string, { icon: string; label: string; color?: string }> = {
  gmail: { icon: "logos:google-gmail", label: "Gmail" },
  "google-sheets": { icon: "simple-icons:googlesheets", label: "Google Sheets", color: "#34A853" },
  "google-calendar": { icon: "logos:google-calendar", label: "Google Calendar" },
  "google-drive": { icon: "logos:google-drive", label: "Google Drive" },
  slack: { icon: "logos:slack-icon", label: "Slack" },
  email: { icon: "mdi:email", label: "Email", color: "#6366F1" },
  phone: { icon: "mdi:phone", label: "Phone", color: "#10B981" },
  hubspot: { icon: "simple-icons:hubspot", label: "HubSpot", color: "#FF7A59" },
  salesforce: { icon: "simple-icons:salesforce", label: "Salesforce", color: "#00A1E0" },
  linkedin: { icon: "logos:linkedin-icon", label: "LinkedIn" },
  notion: { icon: "simple-icons:notion", label: "Notion", color: "#000000" },
  chat: { icon: "mdi:chat", label: "Chat with this Agent", color: "#6366F1" },
  webhook: { icon: "mdi:webhook", label: "Webhook", color: "#6B7280" },
  embed: { icon: "mdi:code-tags", label: "Embed", color: "#6366F1" },
  "web-browser": { icon: "mdi:web", label: "Web browser", color: "#4285F4" },
  "knowledge-base": { icon: "mdi:book-open-variant", label: "Knowledge base", color: "#6366F1" },
  timer: { icon: "mdi:timer", label: "Timer", color: "#F59E0B" },
  "meeting-recorder": { icon: "mdi:microphone", label: "Meeting recorder", color: "#F59E0B" },
  ai: { icon: "mdi:robot", label: "AI", color: "#8B5CF6" },
  github: { icon: "logos:github-icon", label: "GitHub" },
  linear: { icon: "logos:linear-icon", label: "Linear" },
  calendar: { icon: "mdi:calendar", label: "Calendar", color: "#4285F4" },
  twilio: { icon: "logos:twilio-icon", label: "Twilio" },
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

export function HomeContent() {
  const router = useRouter();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [prompt, setPrompt] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Close search when clicking outside
  useEffect(() => {
    if (!isSearchOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSearchOpen]);

  // File upload state
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Template preview modal state - now using DB template
  const [selectedDBTemplate, setSelectedDBTemplate] = useState<DBTemplate | null>(null);

  // Fetch all templates from database
  const templates = useSuspenseTemplates();
  const createFromTemplate = useCreateAgentFromTemplate();

  const { open: sidebarOpen } = useSidebar();

  // File upload handlers
  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAttachedFiles(prev => [...prev, ...Array.from(files)]);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Voice recording handlers
  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      // Append audio blob directly with filename
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch("/api/speech/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Transcription failed");
      }

      if (data.text) {
        setPrompt(prev => prev + (prev ? " " : "") + data.text);
      }
    } catch (error) {
      console.error("Transcription error:", error);
      // Fallback to placeholder if transcription fails
      setPrompt(prev => prev + (prev ? " " : "") + "[Voice recording - transcription failed]");
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());

        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        console.log("Recording complete:", audioBlob.size, "bytes");

        // Send to transcription API
        if (audioBlob.size > 0) {
          await transcribeAudio(audioBlob);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check your permissions.");
    }
  }, [transcribeAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    // Redirect to the builder chat with the prompt
    const encodedPrompt = encodeURIComponent(prompt.trim());
    router.push(`/agents/build?prompt=${encodedPrompt}`);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
    inputRef.current?.focus();
  };

  const handleTemplateClick = (template: Template) => {
    // Find the matching template in the database by name
    const dbTemplates = templates.data as DBTemplate[];
    const matchingTemplate = dbTemplates.find(
      (t) => t.name.toLowerCase() === template.name.toLowerCase()
    );

    if (matchingTemplate) {
      setSelectedDBTemplate(matchingTemplate);
    } else {
      // Fallback: navigate to builder if no matching DB template
      const prompt = `Create a ${template.name}: ${template.description}`;
      const encodedPrompt = encodeURIComponent(prompt);
      router.push(`/agents/build?prompt=${encodedPrompt}`);
    }
  };

  const handleUseTemplate = () => {
    if (!selectedDBTemplate) return;
    // Create agent from the real database template
    createFromTemplate.mutate({ templateId: selectedDBTemplate.id });
  };

  // Filter sections based on active category
  const visibleSections = activeCategory
    ? CATEGORY_SECTIONS.filter((s) => s.id === activeCategory)
    : CATEGORY_SECTIONS;

  // Filter database templates based on search query
  const searchResults = searchQuery.trim()
    ? (templates.data as DBTemplate[]).filter((t) => {
        const query = searchQuery.toLowerCase();
        return (
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query)
        );
      })
    : [];

  return (
    <div className="flex-1 overflow-auto">
      {/* Inner wrapper - gradient positioned relative to this, which sizes to content */}
      <div className="relative">
        {/* Cool Blue/Lavender mesh gradient background - extends with content */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {/* Base: soft blue gradient extending very far - same intensity */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg,
              rgba(219, 234, 254, 0.5) 0%,
              rgba(224, 231, 255, 0.45) 10%,
              rgba(224, 231, 255, 0.4) 25%,
              rgba(241, 245, 249, 0.35) 40%,
              rgba(241, 245, 249, 0.3) 55%,
              rgba(248, 250, 252, 0.25) 70%,
              rgba(248, 250, 252, 0.15) 85%,
              rgba(255, 255, 255, 0.05) 95%,
              transparent 100%
            )`
          }}
        />
        {/* Top-left blob: soft lavender/violet */}
        <div
          className="absolute -top-40 -left-40 w-[1000px] h-[1000px] rounded-full blur-[120px]"
          style={{
            background: `radial-gradient(ellipse at center,
              rgba(196, 181, 253, 0.35) 0%,
              rgba(221, 214, 254, 0.2) 40%,
              transparent 70%
            )`
          }}
        />
        {/* Top-right blob: soft sky blue */}
        <div
          className="absolute -top-20 -right-60 w-[900px] h-[900px] rounded-full blur-[120px]"
          style={{
            background: `radial-gradient(ellipse at center,
              rgba(186, 230, 253, 0.35) 0%,
              rgba(207, 250, 254, 0.2) 40%,
              transparent 70%
            )`
          }}
        />
        {/* Upper-center blob: soft indigo */}
        <div
          className="absolute top-60 left-1/2 -translate-x-1/2 w-[1600px] h-[800px] rounded-full blur-[150px]"
          style={{
            background: `radial-gradient(ellipse at center,
              rgba(199, 210, 254, 0.25) 0%,
              rgba(224, 231, 255, 0.15) 50%,
              transparent 80%
            )`
          }}
        />
        {/* Mid-page blob 1: subtle blue */}
        <div
          className="absolute top-[800px] left-1/4 w-[1200px] h-[800px] rounded-full blur-[150px]"
          style={{
            background: `radial-gradient(ellipse at center,
              rgba(186, 230, 253, 0.2) 0%,
              rgba(219, 234, 254, 0.12) 50%,
              transparent 80%
            )`
          }}
        />
        {/* Mid-page blob 2: subtle lavender */}
        <div
          className="absolute top-[1400px] right-1/4 w-[1100px] h-[700px] rounded-full blur-[150px]"
          style={{
            background: `radial-gradient(ellipse at center,
              rgba(196, 181, 253, 0.18) 0%,
              rgba(221, 214, 254, 0.1) 50%,
              transparent 80%
            )`
          }}
        />
        {/* Lower blob 1: subtle sky blue */}
        <div
          className="absolute top-[2000px] left-1/3 w-[1000px] h-[600px] rounded-full blur-[150px]"
          style={{
            background: `radial-gradient(ellipse at center,
              rgba(186, 230, 253, 0.15) 0%,
              rgba(219, 234, 254, 0.08) 50%,
              transparent 80%
            )`
          }}
        />
        {/* Lower blob 2: subtle indigo */}
        <div
          className="absolute top-[2500px] right-1/3 w-[900px] h-[500px] rounded-full blur-[150px]"
          style={{
            background: `radial-gradient(ellipse at center,
              rgba(199, 210, 254, 0.12) 0%,
              rgba(224, 231, 255, 0.06) 50%,
              transparent 80%
            )`
          }}
        />
      </div>

      {/* Header - scrolls with content */}
      <header className="flex items-center justify-between px-4 py-3 relative z-10">
        {!sidebarOpen && <SidebarTrigger />}
        {sidebarOpen && <div />}
        <Button variant="outline" size="sm" className="gap-2" asChild>
          <Link href="/agents/new">
            <Plus className="size-4" />
            New Agent
          </Link>
        </Button>
      </header>

      {/* Spacer for layout */}
      <div className="h-32 relative z-[1]" />

      <div className="max-w-4xl mx-auto px-6 -mt-32 pb-12 relative z-[1]">
        {/* Main title - more spacing above */}
        <h1 className="text-4xl font-bold text-center mb-2 pt-4">Create. Automate. Scale.</h1>
        <p className="text-lg text-muted-foreground text-center mb-10">Describe your workflow, we'll handle the rest.</p>

        {/* Main input area */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="bg-card rounded-2xl border shadow-sm p-4 transition-all duration-300 hover:shadow-xl hover:shadow-primary/15 hover:border-primary/40 focus-within:shadow-2xl focus-within:shadow-primary/20 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json,.xml"
            />

            {/* Attached files display */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b">
                {attachedFiles.map((file, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="gap-1.5 pr-1 py-1"
                  >
                    <File className="size-3" />
                    <span className="max-w-[150px] truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="ml-1 p-0.5 rounded hover:bg-muted-foreground/20"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Build an agent or perform a task"
              rows={2}
              className="w-full bg-transparent resize-none outline-none text-base placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <div className="flex items-center justify-between mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full gap-2 items-center"
                onClick={handleFileClick}
              >
                <Paperclip className="size-4 shrink-0" />
                <span className="-mt-[3px]">Add files</span>
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "size-8",
                    isRecording && "bg-red-100 text-red-600 hover:bg-red-200",
                    isTranscribing && "bg-blue-100 text-blue-600"
                  )}
                  onClick={toggleRecording}
                  disabled={isTranscribing}
                  title={isTranscribing ? "Transcribing..." : isRecording ? "Stop recording" : "Start voice recording"}
                >
                  {isTranscribing ? (
                    <div className="size-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  ) : isRecording ? (
                    <MicrophoneSlash className="size-4 animate-pulse" />
                  ) : (
                    <Microphone className="size-4" />
                  )}
                </Button>
                <Button
                  type="submit"
                  size="icon"
                  className="size-8 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-700"
                  disabled={!prompt.trim()}
                >
                  <PaperPlaneTilt className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </form>

        {/* Quick suggestions - more spacing below */}
        <div className="flex flex-wrap justify-center gap-2 mb-32">
          {QUICK_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.label}
              onClick={() => handleSuggestionClick(suggestion.label)}
              className="h-9 inline-flex items-center justify-center gap-2 px-4 rounded-full border bg-card hover:bg-muted/50 transition-colors text-sm"
            >
              <suggestion.icon className={cn("size-4", suggestion.color)} />
              <span className="-mt-[3px]">{suggestion.label}</span>
            </button>
          ))}
        </div>

        {/* Category tabs - card style */}
        <div className="flex items-center gap-3 mb-6 flex-wrap mt-2">
          {isSearchOpen ? (
            <div ref={searchContainerRef} className="flex-1 flex items-center gap-2 px-4 py-1.5 rounded-xl border bg-white border-primary/30 shadow-sm">
              <MagnifyingGlass className="size-4 text-muted-foreground shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="flex-1 bg-transparent outline-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsSearchOpen(false);
                    setSearchQuery("");
                  }
                }}
                autoFocus
              />
              <button
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery("");
                }}
                className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => {
                  setIsSearchOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 0);
                }}
                className="p-1.5 rounded-xl border bg-white border-white shadow-sm hover:border-primary/20 transition-all text-muted-foreground hover:text-foreground"
              >
                <MagnifyingGlass className="size-4" />
              </button>
              {CATEGORIES.slice(0, 5).map((category) => (
                <button
                  key={category.id}
                  onClick={() =>
                    setActiveCategory(activeCategory === category.id ? null : category.id)
                  }
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl border shadow-sm transition-all text-sm font-medium",
                    activeCategory === category.id
                      ? "bg-white border-primary/30 text-primary"
                      : "bg-white border-white hover:border-primary/20"
                  )}
                >
                  {category.label}
                </button>
              ))}
              <Link
                href={activeCategory ? `/templates?category=${activeCategory}` : "/templates"}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border bg-white border-white shadow-sm hover:border-primary/20 transition-all text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                See all
                <CaretRight className="size-4" />
              </Link>
            </>
          )}
        </div>

        {/* Search results or Category sections */}
        {searchQuery.trim() ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{searchQuery}"
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
                onClick={() => {
                  setSearchQuery("");
                  setIsSearchOpen(false);
                }}
              >
                Clear search
                <X className="size-4" />
              </Button>
            </div>
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {searchResults.map((template) => {
                  const config = getTemplateConfig(template.name);
                  return (
                    <button
                      key={template.id}
                      onClick={() => setSelectedDBTemplate(template)}
                      className="rounded-2xl border bg-card p-4 text-left hover:bg-muted/50 hover:shadow-sm transition-all flex flex-col h-[130px]"
                    >
                      <div className={cn("size-7 rounded-lg inline-flex items-center justify-center mb-2 bg-gradient-to-br shrink-0", config.gradient)}>
                        <config.icon className="size-3.5 shrink-0 text-white" />
                      </div>
                      <h4 className="font-semibold text-sm mb-0.5 shrink-0">{template.name}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-snug min-h-[2.5em]">{template.description}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <MagnifyingGlass className="size-12 mx-auto mb-4 opacity-50" />
                <p>No templates found matching your search.</p>
                <p className="text-sm mt-1">Try different keywords or browse categories below.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-12">
            {visibleSections.map((section) => (
              <section key={section.id}>
                {/* Section header */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">{section.title}</h2>
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" asChild>
                    <Link href={`/templates?category=${section.id}`}>
                      <span className="-mt-[3px]">See all</span>
                      <CaretRight className="size-4" />
                    </Link>
                  </Button>
                </div>

                {/* Templates grid - 3 columns, 2 rows */}
                <div className="space-y-3">
                  {/* Row 1: Hero (2 cols) + 1 template card */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Hero card - compact, fixed height */}
                    <div
                      className={cn(
                        "md:col-span-2 rounded-2xl p-4 bg-gradient-to-br flex items-center justify-between h-[130px] shadow-md",
                        section.bgGradient
                      )}
                    >
                      <p className={cn("text-xl font-semibold leading-snug max-w-[260px]", section.taglineColor)}>
                        {section.tagline}
                      </p>
                      {section.illustration && (
                        <div className="hidden md:flex items-center justify-center">
                          <div className="relative w-28 h-24">
                            <Image
                              src={section.illustration}
                              alt=""
                              fill
                              className="object-contain"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    {/* First template card */}
                    {section.templates[0] && (
                      <TemplateCard
                        template={section.templates[0]}
                        onClick={() => handleTemplateClick(section.templates[0])}
                      />
                    )}
                  </div>

                  {/* Row 2: 3 template cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {section.templates.slice(1, 4).map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onClick={() => handleTemplateClick(template)}
                      />
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-12 rounded-2xl bg-indigo-50 p-8 text-center">
          <p className="text-lg font-semibold mb-1">Do you need more?</p>
          <p className="text-muted-foreground mb-4">
            Our Nodebase store has over 100+ templates for you.
          </p>
          <Button variant="outline" className="rounded-full gap-1" asChild>
            <Link href="/templates">
              <span className="-mt-[3px]">See all templates</span>
              <CaretRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Template Preview Modal - using DB template with full info */}
      {selectedDBTemplate && (
        <DBTemplatePreviewModal
          template={selectedDBTemplate}
          open={!!selectedDBTemplate}
          onOpenChange={(open) => !open && setSelectedDBTemplate(null)}
          onUse={handleUseTemplate}
          isPending={createFromTemplate.isPending}
        />
      )}

      {/* Loading overlay when creating agent */}
      {createFromTemplate.isPending && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-4">
            <CircleNotch className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Creating your agent...</p>
          </div>
        </div>
      )}

      </div>{/* Close inner wrapper */}
    </div>
  );
}

// Icon gradient colors mapping
const iconGradients: Record<string, string> = {
  "text-blue-500": "from-blue-400 to-blue-600",
  "text-sky-500": "from-sky-400 to-cyan-500",
  "text-cyan-500": "from-cyan-400 to-teal-500",
  "text-teal-500": "from-teal-400 to-emerald-500",
  "text-emerald-500": "from-emerald-400 to-green-500",
  "text-indigo-500": "from-indigo-400 to-violet-500",
  "text-violet-500": "from-violet-400 to-purple-500",
  "text-purple-500": "from-purple-400 to-fuchsia-500",
  "text-amber-500": "from-amber-400 to-orange-500",
  "text-rose-500": "from-rose-400 to-pink-500",
  "text-pink-500": "from-pink-400 to-fuchsia-500",
  "text-slate-500": "from-slate-400 to-slate-600",
};

// Template card component - Lindy style
function TemplateCard({
  template,
  onClick,
}: {
  template: Template;
  onClick: () => void;
}) {
  const config = getTemplateConfig(template.name);

  return (
    <button
      onClick={onClick}
      className="rounded-2xl border bg-card p-4 text-left hover:bg-muted/50 hover:shadow-sm transition-all flex flex-col h-[130px]"
    >
      <div className={cn("size-7 rounded-lg inline-flex items-center justify-center mb-2 bg-gradient-to-br shrink-0", config.gradient)}>
        <config.icon className="size-3.5 shrink-0 text-white" />
      </div>
      <h4 className="font-semibold text-sm mb-0.5 shrink-0">{template.name}</h4>
      <p className="text-xs text-muted-foreground line-clamp-2 leading-snug min-h-[2.5em]">{template.subtitle || template.description}</p>
    </button>
  );
}

// Database Template Preview Modal component - same as templates page
function DBTemplatePreviewModal({
  template,
  open,
  onOpenChange,
  onUse,
  isPending,
}: {
  template: DBTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUse: () => void;
  isPending: boolean;
}) {
  const config = getTemplateConfig(template.name);
  const integrations = template.suggestedIntegrations || [];
  const triggers = (template.suggestedTriggers || []) as TriggerSuggestion[];

  // Always show "Chat with this Agent" first
  const allIntegrations = ["chat", ...integrations.filter((i) => i !== "chat")];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6" showCloseButton={false}>
        {/* Icon */}
        <div className={cn("size-12 rounded-lg flex items-center justify-center bg-gradient-to-br", config.gradient)}>
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

