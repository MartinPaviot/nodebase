"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MagnifyingGlass, Star, AppWindow, ChatCircle, Sparkle, GitBranch, Globe, DiamondsFour, CaretLeft } from "@phosphor-icons/react";
import { Icon } from "@iconify/react";
import { useComposioApps, useComposioActions, useAddAgentTool } from "@/hooks/use-composio";
import { filterAppsByCategory, type ActionCategory } from "@/lib/composio-categories";
import { formatComposioActionName } from "@/lib/composio-action-names";
import { AppWithActionsPreview } from "./app-with-actions-preview";

const TABS = [
  { id: "top", label: "Top", icon: Star },
  { id: "apps", label: "Apps", icon: AppWindow },
  { id: "chat", label: "Chat", icon: ChatCircle },
  { id: "ai", label: "AI", icon: Sparkle },
  { id: "logic", label: "Logic", icon: GitBranch },
  { id: "scrapers", label: "Scrapers", icon: Globe },
  { id: "nodebase", label: "By Nodebase", icon: DiamondsFour },
];

// Structural nodes for workflow logic (not Composio)
const STRUCTURAL_NODES: Record<string, StructuralNode[]> = {
  logic: [
    { id: "condition", label: "Condition", icon: "noto:shuffle-tracks-button", description: "Branch workflow based on conditions" },
    { id: "loop", label: "Enter loop", icon: "noto:counterclockwise-arrows-button", description: "Repeat actions in a loop" },
  ],
  ai: [
    { id: "agent-step", label: "Agent step", icon: "noto:robot", description: "Let AI decide next action" },
    { id: "knowledge-base", label: "Knowledge base", icon: "noto:books", description: "Search knowledge base" },
  ],
  nodebase: [
    { id: "people-data", label: "People Data Labs", icon: "ph:users-three-fill", description: "Search for people and companies" },
  ],
};

// Structural node item (for flow editor workflow nodes)
interface StructuralNode {
  id: string;
  label: string;
  icon: string;
  description?: string;
}

interface AddActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Optional agentId - if provided, actions will be saved to database automatically
  agentId?: string;
  // Callback for Composio actions (legacy - used when agentId not provided)
  onSelectAction?: (composioAppKey: string, composioActionName: string, actionData: { name: string; description: string }) => void;
  // Callback for structural nodes (backward compatibility with flow editor)
  onSelectStructuralNode?: (nodeId: string) => void;
}

export function AddActionModal({ open, onOpenChange, agentId, onSelectAction, onSelectStructuralNode }: AddActionModalProps) {
  const [activeTab, setActiveTab] = useState<ActionCategory | "top">("top");
  const [search, setSearch] = useState("");
  const [selectedAppKey, setSelectedAppKey] = useState<string | null>(null);

  // Mutation for saving agent tools
  const addAgentTool = useAddAgentTool();

  // Only fetch Composio apps for tabs that need them
  const shouldFetchComposio = ["top", "apps", "chat", "scrapers"].includes(activeTab);
  const appsQuery = useComposioApps(shouldFetchComposio ? (search || undefined) : undefined);
  const apps = appsQuery.data || [];

  const actionsQuery = useComposioActions(selectedAppKey);
  const actions = actionsQuery.data || [];

  // Filter actions based on search
  const filteredActions = search
    ? actions.filter((action) => {
        const formattedName = formatComposioActionName(action.name);
        const searchLower = search.toLowerCase();
        return (
          formattedName.toLowerCase().includes(searchLower) ||
          action.name.toLowerCase().includes(searchLower) ||
          action.description?.toLowerCase().includes(searchLower)
        );
      })
    : actions;

  // Get structural nodes for current tab
  const structuralNodes = STRUCTURAL_NODES[activeTab] || [];

  // Filter Composio apps by category
  const filteredApps = shouldFetchComposio
    ? (activeTab === "top" ? apps.slice(0, 10) : filterAppsByCategory(apps, activeTab as ActionCategory))
    : [];

  // Group items for display
  const groupedItems: Record<string, Array<{ type: 'structural' | 'composio'; id?: string; key?: string; name: string; logo?: string; icon?: string; description?: string }>> = {};

  // Add structural nodes first
  if (structuralNodes.length > 0) {
    const category = activeTab === "top" ? "Workflow" : "Available";
    groupedItems[category] = structuralNodes.map(node => ({
      type: 'structural' as const,
      id: node.id,
      name: node.label,
      icon: node.icon,
      description: node.description,
    }));
  }

  // Add Composio apps
  if (filteredApps.length > 0) {
    const category = "Integrations";
    if (!groupedItems[category]) groupedItems[category] = [];
    filteredApps.forEach((app) => {
      groupedItems[category].push({
        type: 'composio' as const,
        key: app.key,
        name: app.name,
        logo: app.logo,
      });
    });
  }

  const handleItemClick = (item: { type: 'structural' | 'composio'; id?: string; key?: string }) => {
    if (item.type === 'structural' && item.id) {
      // Structural node - use legacy callback
      onSelectStructuralNode?.(item.id);
      onOpenChange(false);
      setSearch("");
    } else if (item.type === 'composio' && item.key) {
      // Composio app - show actions
      setSelectedAppKey(item.key);
    }
  };

  const handleBackClick = () => setSelectedAppKey(null);

  const handleActionSelect = async (action: { name: string; description: string }) => {
    if (!selectedAppKey) return;

    // If agentId provided, save to database
    if (agentId) {
      await addAgentTool.mutateAsync({
        agentId,
        appKey: selectedAppKey,
        actionName: action.name,
        description: action.description,
      });
    }

    // Call legacy callback if provided
    onSelectAction?.(selectedAppKey, action.name, { name: action.name, description: action.description });

    onOpenChange(false);
    setSelectedAppKey(null);
    setSearch("");
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedAppKey(null);
      setSearch("");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[680px] p-0 gap-0 overflow-hidden">
        {selectedAppKey ? (
          <>
            <div className="px-6 pt-5 pb-4 flex items-center gap-2">
              <button onClick={handleBackClick} className="text-muted-foreground hover:text-foreground transition-colors">
                <CaretLeft className="size-5" weight="bold" />
              </button>
              <h2 className="text-xl font-semibold">{apps.find((a) => a.key === selectedAppKey)?.name || selectedAppKey}</h2>
            </div>

            <div className="px-6 pb-3">
              <div className="relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search actions..."
                  className="pl-9 h-9 text-sm border-primary/30 focus-visible:ring-primary/20"
                />
              </div>
            </div>

            <div className="px-6 pb-2">
              <span className="text-sm text-muted-foreground">
                {search ? `Found ${filteredActions.length} action${filteredActions.length !== 1 ? 's' : ''}` : 'Actions'}
              </span>
            </div>

            <div className="px-6 pb-5 space-y-4 max-h-[400px] overflow-y-auto">
              {actionsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)
              ) : filteredActions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  {search ? `No actions found for "${search}"` : "No actions available for this app"}
                </div>
              ) : (
                filteredActions.map((action) => (
                  <button
                    key={action.name}
                    onClick={() => handleActionSelect(action)}
                    disabled={addAgentTool.isPending}
                    className="w-full text-left hover:bg-gray-50 rounded-lg p-2 -mx-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="size-[18px] flex items-center justify-center shrink-0">
                        {apps.find((a) => a.key === selectedAppKey)?.logo ? (
                          <img src={apps.find((a) => a.key === selectedAppKey)?.logo} alt="" className="size-[18px] object-contain" />
                        ) : (
                          <Icon icon="ph:app-window" className="size-[18px]" />
                        )}
                      </div>
                      <span className="font-medium text-[15px] text-foreground">{formatComposioActionName(action.name)}</span>
                      {addAgentTool.isPending && (
                        <Icon icon="ph:spinner" className="size-3.5 animate-spin ml-auto" />
                      )}
                    </div>
                    <p className="text-[13px] text-muted-foreground leading-relaxed pl-[26px]">{action.description || "No description available"}</p>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-lg font-semibold">Add action</h2>
              <p className="text-sm text-muted-foreground">Select an action to add to your agent.</p>
            </div>

            <div className="px-5 pb-3">
              <div className="relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search apps and actions..." className="pl-9 h-10 border-primary/30 focus-visible:ring-primary/20" />
              </div>
            </div>

            <div className="px-5 pb-2 border-b">
              <div className="flex items-center gap-0">
                {TABS.map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as ActionCategory | "top")} className={cn("flex items-center gap-1 px-2 py-1.5 text-xs whitespace-nowrap transition-colors", activeTab === tab.id ? "text-foreground font-medium border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}>
                    <tab.icon className="size-3.5" weight={activeTab === tab.id ? "fill" : "regular"} />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-5 py-3 max-h-[280px] overflow-y-auto">
              {shouldFetchComposio && appsQuery.isLoading ? (
                <div className="grid grid-cols-2 gap-x-6">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 mb-2" />)}</div>
              ) : Object.keys(groupedItems).length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">No items found{search && ` for "${search}"`}</div>
              ) : (
                <div>
                  {Object.entries(groupedItems).map(([category, items]) => (
                    <div key={category} className="mb-4">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[11px] font-medium text-muted-foreground">{category}</span>
                        <span className="text-[11px] text-muted-foreground/50">&gt;</span>
                      </div>
                      <div className={cn(
                        // Use single column when search is active to show actions
                        search ? "grid grid-cols-1 gap-y-2" : "grid grid-cols-2 gap-x-6"
                      )}>
                        {items.map((item, idx) => (
                          item.type === 'composio' && item.key && search ? (
                            // Show app with actions preview when searching
                            <AppWithActionsPreview
                              key={item.key}
                              appKey={item.key}
                              appName={item.name}
                              appLogo={item.logo}
                              autoExpand={true}
                              maxActions={5}
                              onSelectAction={async (actionName, actionData) => {
                                // If agentId provided, save to database
                                if (agentId && item.key) {
                                  await addAgentTool.mutateAsync({
                                    agentId,
                                    appKey: item.key,
                                    actionName,
                                    description: actionData.description,
                                  });
                                }

                                // Call legacy callback if provided
                                onSelectAction?.(item.key!, actionName, actionData);
                                onOpenChange(false);
                                setSearch("");
                              }}
                              onViewAllActions={() => {
                                setSelectedAppKey(item.key!);
                              }}
                            />
                          ) : (
                            // Show normal button when not searching
                            <button
                              key={item.key || item.id || idx}
                              onClick={() => handleItemClick(item)}
                              className="flex items-center gap-2 w-full px-1 py-1 rounded-md hover:bg-muted/50 transition-colors text-left"
                            >
                              <div className="size-4 flex items-center justify-center shrink-0">
                                {item.logo ? (
                                  <img src={item.logo} alt={item.name} className="size-4 object-contain" />
                                ) : item.icon ? (
                                  <Icon icon={item.icon} className="size-4" />
                                ) : (
                                  <Icon icon="ph:app-window" className="size-4" />
                                )}
                              </div>
                              <span className="text-sm text-foreground">{item.name}</span>
                            </button>
                          )
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
