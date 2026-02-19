"use client";

import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  PaperPlaneTilt,
  Paperclip,
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
  getTemplateConfig,
  triggerIcons,
  type TriggerSuggestion,
} from "@/lib/template-display";
import { useIntegrationIcons } from "@/hooks/use-integration-icons";
import { VoiceInputButton } from "@/components/ui/voice-input-button";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { IntegrationIcon } from "@/components/integration-icon";
import {
  useSuspenseTemplates,
  useCreateAgentFromTemplate,
} from "@/features/templates/hooks/use-templates";


// Template categories
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
      { id: "website-support", name: "Website Customer Support", description: "Embed on your website. Give your users instant answers and...", icon: Globe, color: "text-blue-500", bgColor: "bg-blue-100" },
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
      { id: "scheduler", name: "Meeting Scheduler", description: "CC your agent to your emails, just like a real EA, and have it schedule...", icon: Calendar, color: "text-indigo-500", bgColor: "bg-indigo-100" },
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


export function HomeContent() {
  const router = useRouter();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);

  const [prompt, setPrompt] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Close search when clicking outside (both input and results area)
  useEffect(() => {
    if (!isSearchOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideSearchInput = searchContainerRef.current?.contains(target);
      const isInsideSearchResults = searchResultsRef.current?.contains(target);
      if (!isInsideSearchInput && !isInsideSearchResults) {
        setIsSearchOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSearchOpen]);

  // File upload state
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  const baseTextRef = useRef("");
  const { isListening, isTranscribing, startListening } = useVoiceInput({
    onTranscriptChange: (text) => setPrompt(text),
    onListeningEnd: () => { baseTextRef.current = prompt; },
    baseText: baseTextRef.current,
  });
  const handleMicClick = () => { baseTextRef.current = prompt; startListening(); };

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
    if (!files) return;

    const newFiles = Array.from(files);
    const maxFiles = 5;
    const maxImageSize = 10 * 1024 * 1024; // 10MB
    const maxTextSize = 5 * 1024 * 1024; // 5MB
    const imageTypes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
    const docxTypes = new Set([
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ]);

    if (attachedFiles.length + newFiles.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const accepted: File[] = [];
    for (const file of newFiles) {
      if (docxTypes.has(file.type)) {
        toast.warning(`${file.name}: DOCX not supported. Please convert to PDF.`);
        continue;
      }
      const isImage = imageTypes.has(file.type);
      const maxSize = isImage ? maxImageSize : maxTextSize;
      if (file.size > maxSize) {
        toast.error(`${file.name}: Too large (max ${isImage ? "10MB" : "5MB"})`);
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length > 0) {
      setAttachedFiles(prev => [...prev, ...accepted]);
    }

    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isUploading) return;

    // If files attached, upload and process them first
    if (attachedFiles.length > 0) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        attachedFiles.forEach((file) => formData.append("files", file));

        const res = await fetch("/api/files/process", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          toast.error(err.errors?.[0] || err.error || "Failed to process files");
          setIsUploading(false);
          return;
        }

        const { files } = await res.json();
        sessionStorage.setItem("builder-files", JSON.stringify(files));
      } catch {
        toast.error("Failed to upload files");
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

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
      {/* Inner wrapper - gradient positioned relative to this, fills viewport */}
      <div className="relative min-h-full">
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href="/templates">
              See templates
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href="/agents/new">
              <Plus className="size-4" />
              New Agent
            </Link>
          </Button>
        </div>
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
              className="w-full bg-transparent resize-none overflow-hidden outline-none text-base placeholder:text-muted-foreground"
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
                <VoiceInputButton
                  isListening={isListening}
                  isTranscribing={isTranscribing}
                  onClick={handleMicClick}
                  className="size-8"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="size-8 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-700"
                  disabled={!prompt.trim() || isUploading}
                >
                  <PaperPlaneTilt className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </form>

        {/* Quick suggestions */}
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

        {/* Hidden sections - category tabs, template grid, bottom CTA */}
        <div className="hidden">
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
          <div ref={searchResultsRef} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &quot;{searchQuery}&quot;
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
            Our Elevay store has over 100+ templates for you.
          </p>
          <Button variant="outline" className="rounded-full gap-1" asChild>
            <Link href="/templates">
              <span className="-mt-[3px]">See all templates</span>
              <CaretRight className="size-4" />
            </Link>
          </Button>
        </div>
        </div>{/* End hidden sections */}
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

// Template card component
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
  const { getIcon } = useIntegrationIcons();
  const config = getTemplateConfig(template.name);
  const integrations = template.suggestedIntegrations || [];
  const triggers = (template.suggestedTriggers || []) as TriggerSuggestion[];

  // Always show "Chat with this Agent" first
  const allIntegrations = ["chat", ...integrations.filter((i) => i !== "chat")];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 max-h-[85vh] overflow-y-auto" showCloseButton={false}>
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
                const iconData = getIcon(integration);
                return (
                  <span
                    key={integration}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm"
                  >
                    <IntegrationIcon data={iconData} className="size-4" />
                    {iconData.label}
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

