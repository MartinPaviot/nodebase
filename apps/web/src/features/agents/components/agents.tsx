"use client";

import { memo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useRemoveAgent,
  useSuspenseAgents,
  useUpdateAgent,
} from "../hooks/use-agents";
import { useRouter } from "next/navigation";
import { useAgentsParams } from "../hooks/use-agents-params";
import { useEntitySearch } from "../hooks/use-entity-search";
import type { Agent } from "@prisma/client";
import {
  Robot,
  Plus,
  FolderPlus,
  MagnifyingGlass,
  CaretDown,
  Folder,
  Envelope,
  Calendar,
  ChatCircle,
  Phone,
} from "@phosphor-icons/react";
import Link from "next/link";

// Lindy-style color palette for agents
const AGENT_COLORS = [
  "#E6C147", // Gold (Lindy primary)
  "#7C3AED", // Purple
  "#059669", // Emerald
  "#DC2626", // Red
  "#2563EB", // Blue
  "#D97706", // Amber
  "#DB2777", // Pink
  "#0891B2", // Cyan
];

function getAgentColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

// Integration icons (placeholder - would map to actual integrations)
const integrationIcons: Record<string, { icon: typeof Envelope; color: string }> = {
  email: { icon: Envelope, color: "#EA4335" },
  calendar: { icon: Calendar, color: "#4285F4" },
  slack: { icon: ChatCircle, color: "#4A154B" },
  phone: { icon: Phone, color: "#25D366" },
};

export const AgentsSearch = () => {
  const [params, setParams] = useAgentsParams();
  const { searchValue, onSearchChange } = useEntitySearch({
    params,
    setParams,
  });

  return (
    <div className="relative">
      <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search"
        className="pl-9 h-9 w-48"
      />
    </div>
  );
};

export const AgentsList = () => {
  const agents = useSuspenseAgents();

  if (agents.data.items.length === 0) {
    return <AgentsEmpty />;
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Table Header */}
      <div className="grid grid-cols-[1fr_150px_150px_100px] gap-4 px-4 py-3 border-b bg-muted/30 text-sm font-medium text-muted-foreground">
        <div className="flex items-center gap-1">
          Name
          <CaretDown className="size-4" />
        </div>
        <div>Last Run</div>
        <div>Integrations</div>
        <div>Enabled</div>
      </div>

      {/* Table Body */}
      <div className="divide-y">
        {agents.data.items.map((agent) => (
          <AgentRow key={agent.id} data={agent} />
        ))}
      </div>
    </div>
  );
};

type AgentWithCount = Agent & {
  _count: {
    conversations: number;
  };
};

const AgentRow = memo(
  function AgentRow({ data }: { data: AgentWithCount }) {
    const updateAgent = useUpdateAgent();
    const color = getAgentColor(data.id);

    // Mock integrations based on agent (in real app, would come from agentTools)
    const mockIntegrations = ["email", "calendar"].slice(0, Math.floor(Math.random() * 3) + 1);

    const handleToggle = (checked: boolean) => {
      updateAgent.mutate({
        id: data.id,
        isEnabled: checked,
      });
    };

    return (
      <Link
        href={`/agents/${data.id}`}
        className="grid grid-cols-[1fr_150px_150px_100px] gap-4 px-4 py-3 hover:bg-muted/30 transition-colors items-center"
      >
        {/* Name */}
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="size-8 shrink-0">
            {data.avatar ? (
              <AvatarImage src={data.avatar} alt={data.name} />
            ) : null}
            <AvatarFallback
              className="text-sm text-white"
              style={{ backgroundColor: color }}
            >
              {data.name[0]}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium truncate">{data.name}</span>
        </div>

        {/* Last Run */}
        <div className="text-sm text-muted-foreground">
          {data._count.conversations > 0
            ? formatDistanceToNow(data.updatedAt, { addSuffix: true })
            : "Never"}
        </div>

        {/* Integrations */}
        <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
          {mockIntegrations.map((integration) => {
            const config = integrationIcons[integration];
            if (!config) return null;
            const Icon = config.icon;
            return (
              <div
                key={integration}
                className="size-6 rounded flex items-center justify-center"
                style={{ backgroundColor: `${config.color}15` }}
              >
                <Icon className="size-3.5" style={{ color: config.color }} />
              </div>
            );
          })}
          {mockIntegrations.length > 2 && (
            <span className="text-xs text-muted-foreground ml-1">
              +{mockIntegrations.length - 2}
            </span>
          )}
        </div>

        {/* Enabled Toggle */}
        <div onClick={(e) => e.preventDefault()}>
          <Switch
            checked={data.isEnabled ?? false}
            onCheckedChange={handleToggle}
            disabled={updateAgent.isPending}
          />
        </div>
      </Link>
    );
  },
  (prev, next) =>
    prev.data.id === next.data.id &&
    prev.data.updatedAt.getTime() === next.data.updatedAt.getTime() &&
    prev.data.isEnabled === next.data.isEnabled
);

export const AgentsHeader = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("created");

  return (
    <div className="flex items-center justify-between mb-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="created" className="rounded-full">
            Created by me
          </TabsTrigger>
          <TabsTrigger value="shared" className="rounded-full">
            Shared with me
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm">
          <FolderPlus className="size-4 mr-2" />
          New Folder
        </Button>
        <Button size="sm" onClick={() => router.push("/agents/new")}>
          <Plus className="size-4 mr-2" />
          New Agent
        </Button>
      </div>
    </div>
  );
};

export const AgentsContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="h-full">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-lg font-semibold">My Agents</h1>
        <AgentsSearch />
      </div>

      {/* Content */}
      <div className="p-6">
        <AgentsHeader />

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <Folder className="size-4" />
          <span>...</span>
        </div>

        {children}
      </div>
    </div>
  );
};

export const AgentsLoading = () => {
  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="grid grid-cols-[1fr_150px_150px_100px] gap-4 px-4 py-3 border-b bg-muted/30">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-14" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="grid grid-cols-[1fr_150px_150px_100px] gap-4 px-4 py-3 border-b">
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-1">
            <Skeleton className="size-6 rounded" />
            <Skeleton className="size-6 rounded" />
          </div>
          <Skeleton className="h-5 w-10 rounded-full" />
        </div>
      ))}
    </div>
  );
};

export const AgentsError = () => {
  return (
    <div className="border rounded-lg p-8 text-center bg-card">
      <p className="text-destructive">Error loading agents</p>
    </div>
  );
};

export const AgentsEmpty = () => {
  const router = useRouter();

  return (
    <div className="border rounded-lg border-dashed p-12 text-center bg-card">
      <div className="size-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
        <Robot className="size-6 text-muted-foreground" />
      </div>
      <h3 className="font-semibold mb-2">No agents yet</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
        You haven't created any agents yet.
        <br />
        Get started by creating your first AI agent with our guided setup.
      </p>
      <Button onClick={() => router.push("/agents/new")}>
        Create your first agent
      </Button>
    </div>
  );
};

// Keep for backwards compatibility but not used in new design
export const AgentsPagination = () => {
  return null;
};

export const AgentGridCard = AgentRow;
