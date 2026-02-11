"use client";

import { Suspense, useState, useEffect } from "react";
import {
    Check,
    Folder,
    Gift,
    House,
    SignOut,
    ChatCircle,
    ChatText,
    SidebarSimple,
    Plus,
    Gear,
    UserPlus,
    Users,
    PencilSimple,
    CaretDown,
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
    Eye,
    Article,
    Megaphone,
    PenNib,
    FileText,
    Books,
    UsersThree,
    Handshake,
    Globe,
    Binoculars,
    ChartBar,
    Kanban,
    ListChecks,
    CheckSquare,
    Receipt,
    Files,
    Database,
    Lightning,
    type Icon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    SidebarSeparator,
    useSidebar,
} from "@/components/ui/sidebar";
import { authClient, useSession } from "@/lib/auth-client";
import { useHasActiveSubscription } from "@/features/subscriptions/hooks/use-subscription";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { InviteMembersDialog } from "@/components/invite-members-dialog";
import { NewWorkspaceDialog } from "@/components/new-workspace-dialog";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

// Mock credits data - replace with actual data from your backend
const CREDITS_USED = 49;
const CREDITS_TOTAL = 400;

// Blue-themed color palette for agents
const AGENT_COLORS = [
    "#6366F1", // Indigo (primary)
    "#3B82F6", // Blue
    "#8B5CF6", // Violet
    "#06B6D4", // Cyan
    "#0EA5E9", // Sky
    "#7C3AED", // Purple
    "#2563EB", // Blue-600
    "#4F46E5", // Indigo-600
];

function getAgentColor(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = ((hash << 5) - hash) + id.charCodeAt(i);
        hash |= 0;
    }
    return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

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

// Recent agents component with data fetching
function RecentAgents() {
    const trpc = useTRPC();
    const pathname = usePathname();
    const agents = useSuspenseQuery(
        trpc.agents.getMany.queryOptions({ page: 1, pageSize: 5 })
    );

    if (agents.data.items.length === 0) {
        return null;
    }

    return (
        <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 mb-1">
                Recents
            </SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {agents.data.items.slice(0, 5).map((agent) => {
                        const config = getAgentConfig(agent.name);
                        const isActive = pathname.startsWith(`/agents/${agent.id}`);
                        const IconComponent = config.icon;

                        return (
                            <SidebarMenuItem key={agent.id}>
                                <SidebarMenuButton
                                    tooltip={agent.name}
                                    isActive={isActive}
                                    asChild
                                    className="gap-x-3 h-9 px-3 rounded-lg"
                                >
                                    <Link href={`/agents/${agent.id}`} prefetch>
                                        <div className={`size-4 rounded-[3px] flex items-center justify-center bg-gradient-to-br shrink-0 ${config.gradient}`}>
                                            <IconComponent className="size-3 text-white" weight="fill" />
                                        </div>
                                        <span className="truncate text-sm">{agent.name}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    })}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

function RecentAgentsSkeleton() {
    return (
        <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 mb-1">
                Recents
            </SidebarGroupLabel>
            <SidebarGroupContent>
                <div className="space-y-1 px-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3 h-9">
                            <Skeleton className="size-5 rounded-full" />
                            <Skeleton className="h-4 flex-1" />
                        </div>
                    ))}
                </div>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

export const AppSidebar = () => {
    const router = useRouter();
    const pathname = usePathname();
    const { hasActiveSubscription, isLoading } = useHasActiveSubscription();
    const { data: session } = useSession();
    const { toggleSidebar, open } = useSidebar();

    // Modal states
    const [inviteOpen, setInviteOpen] = useState(false);
    const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);
    const [editWorkspaceOpen, setEditWorkspaceOpen] = useState(false);

    // Workspace name state with localStorage persistence
    const [workspaceName, setWorkspaceName] = useState("Workspace");
    const [editingWorkspaceName, setEditingWorkspaceName] = useState("");

    // Load workspace name from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("workspaceName");
        if (saved) {
            setWorkspaceName(saved);
        }
    }, []);

    const handleSaveWorkspaceName = () => {
        const trimmed = editingWorkspaceName.trim();
        if (trimmed) {
            setWorkspaceName(trimmed);
            localStorage.setItem("workspaceName", trimmed);
        }
        setEditWorkspaceOpen(false);
    };

    const openEditWorkspace = () => {
        setEditingWorkspaceName(workspaceName);
        setEditWorkspaceOpen(true);
    };

    // Get user info from session
    const userName = session?.user?.name || "User";
    const userEmail = session?.user?.email || "";
    const firstName = userName.split(" ")[0];
    const creditsRemaining = CREDITS_TOTAL - CREDITS_USED;
    const creditsPercentage = (creditsRemaining / CREDITS_TOTAL) * 100;

    return (
        <Sidebar collapsible="offcanvas" className="overflow-hidden">
            <SidebarHeader className="p-3">
                <div className="flex items-center justify-between">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-2 hover:bg-accent rounded-lg p-1.5 -m-1 transition-colors outline-none">
                                <Avatar className="size-7 rounded-lg">
                                    {session?.user?.image ? (
                                        <AvatarImage src={session.user.image} alt={userName} className="rounded-lg" />
                                    ) : null}
                                    <AvatarFallback className="bg-indigo-500 text-white text-xs rounded-lg">
                                        {firstName[0]?.toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-sm truncate max-w-[120px]">
                                    {firstName}'s Workspace
                                </span>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64">
                            {/* User Info */}
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex items-center gap-3">
                                    <Avatar className="size-9">
                                        {session?.user?.image ? (
                                            <AvatarImage src={session.user.image} alt={userName} />
                                        ) : null}
                                        <AvatarFallback className="bg-indigo-500 text-white text-sm">
                                            {firstName[0]?.toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm">{userName}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {hasActiveSubscription ? "Pro" : "Free"} • {userEmail}
                                        </span>
                                    </div>
                                </div>
                            </DropdownMenuLabel>

                            <DropdownMenuSeparator />

                            {/* Workspaces */}
                            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                                Workspaces
                            </DropdownMenuLabel>
                            <DropdownMenuItem className="gap-3 group">
                                <Avatar className="size-5">
                                    <AvatarFallback className="bg-indigo-500 text-white text-[10px]">
                                        {workspaceName[0]?.toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="flex-1">{workspaceName}</span>
                                <Check className="size-4 text-primary" />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openEditWorkspace();
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-opacity"
                                >
                                    <PencilSimple className="size-3" />
                                </button>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="gap-3 text-muted-foreground"
                                onClick={() => setNewWorkspaceOpen(true)}
                            >
                                <div className="size-5 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center">
                                    <Plus className="size-3" />
                                </div>
                                <span>New workspace</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {/* Actions */}
                            <DropdownMenuItem
                                className="gap-3"
                                onClick={() => setInviteOpen(true)}
                            >
                                <UserPlus className="size-4" />
                                <span>Invite members</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="gap-3"
                                onClick={() => router.push("/settings")}
                            >
                                <Gear className="size-4" />
                                <span>Settings</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-3">
                                <Gift className="size-4" />
                                <span>Refer & Earn</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-3">
                                <ChatText className="size-4" />
                                <span>Send Feedback</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                                className="gap-3 text-destructive focus:text-destructive"
                                onClick={() => authClient.signOut({
                                    fetchOptions: {
                                        onSuccess: () => router.push("/login"),
                                    },
                                })}
                            >
                                <SignOut className="size-4" />
                                <span>Logout</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={toggleSidebar}
                    >
                        <SidebarSimple className="size-4" />
                    </Button>
                </div>
            </SidebarHeader>

            <SidebarContent className="px-2">
                {/* Main Navigation */}
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    tooltip="Home"
                                    isActive={pathname === "/" || pathname === "/home" || pathname === "/agents/new"}
                                    asChild
                                    className="gap-x-3 h-9 px-3 rounded-lg"
                                >
                                    <Link href="/home" prefetch>
                                        <House className="size-4" />
                                        <span>Home</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    tooltip="Chat"
                                    isActive={pathname === "/chat" || pathname.includes("/chat/")}
                                    asChild
                                    className="gap-x-3 h-9 px-3 rounded-lg"
                                >
                                    <Link href="/chat" prefetch>
                                        <ChatCircle className="size-4" />
                                        <span>Chat</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    tooltip="My Agents"
                                    isActive={pathname === "/agents"}
                                    asChild
                                    className="gap-x-3 h-9 px-3 rounded-lg"
                                >
                                    <Link href="/agents" prefetch>
                                        <Folder className="size-4" />
                                        <span>My agents</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    tooltip="New Agent"
                                    asChild
                                    className="gap-x-3 h-9 px-3 rounded-lg text-primary"
                                >
                                    <Link href="/agents/new" prefetch>
                                        <Plus className="size-4" />
                                        <span>New agent</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    tooltip="Scan"
                                    isActive={pathname === "/scan"}
                                    asChild
                                    className="gap-x-3 h-9 px-3 rounded-lg"
                                >
                                    <Link href="/scan" prefetch>
                                        <Binoculars className="size-4" />
                                        <span>Scan</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    tooltip="Approvals"
                                    isActive={pathname === "/approvals"}
                                    asChild
                                    className="gap-x-3 h-9 px-3 rounded-lg"
                                >
                                    <Link href="/approvals" prefetch>
                                        <CheckSquare className="size-4" />
                                        <span>Approvals</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    tooltip="Automations"
                                    isActive={pathname === "/automations"}
                                    asChild
                                    className="gap-x-3 h-9 px-3 rounded-lg"
                                >
                                    <Link href="/automations" prefetch>
                                        <Lightning className="size-4" />
                                        <span>Automations</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Recent Agents */}
                <Suspense fallback={<RecentAgentsSkeleton />}>
                    <RecentAgents />
                </Suspense>
            </SidebarContent>

            <SidebarFooter className="p-3 ">
                {/* Credits remaining */}
                <div className="space-y-2  overflow-hidden min-w-0">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Credits remaining</span>
                        <span className="text-muted-foreground font-medium">{creditsRemaining} / {CREDITS_TOTAL}</span>
                    </div>
                    <Progress
                        value={creditsPercentage}
                        className="h-1.5 bg-muted w-full max-w-full"
                    />
                </div>

                {/* Upgrade button - shown for free users */}
                {!hasActiveSubscription && !isLoading && (
                    <Button
                        className="w-full mt-3 bg-primary hover:bg-primary/90 text-primary-foreground "
                        onClick={() => authClient.checkout({ slug: "Pro" })}
                    >
                        Upgrade
                    </Button>
                )}
            </SidebarFooter>
            <SidebarRail />

            {/* Dialogs */}
            <InviteMembersDialog open={inviteOpen} onOpenChange={setInviteOpen} />
            <NewWorkspaceDialog open={newWorkspaceOpen} onOpenChange={setNewWorkspaceOpen} />

            {/* Edit Workspace Name Dialog */}
            <Dialog open={editWorkspaceOpen} onOpenChange={setEditWorkspaceOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Rename workspace</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={editingWorkspaceName}
                            onChange={(e) => setEditingWorkspaceName(e.target.value)}
                            placeholder="Workspace name"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    handleSaveWorkspaceName();
                                }
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditWorkspaceOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveWorkspaceName}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Sidebar>
    );
};