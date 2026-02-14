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
import {
  getTemplateConfig,
  triggerIcons,
  type TriggerSuggestion,
} from "@/lib/template-display";
import { useIntegrationIcons } from "@/hooks/use-integration-icons";
import { IntegrationIcon } from "@/components/integration-icon";

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

// Full template type from API

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
  const { getIcon } = useIntegrationIcons();

  if (!template) return null;

  const config = getTemplateConfig(template.name);
  const integrations = template.suggestedIntegrations || [];
  const triggers = (template.suggestedTriggers || []) as TriggerSuggestion[];

  // Always show "Chat with this Agent" first
  const allIntegrations = ["chat", ...integrations.filter((i) => i !== "chat")];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 max-h-[85vh] overflow-y-auto" showCloseButton={false}>
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
