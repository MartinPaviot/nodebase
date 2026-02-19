"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Icon } from "@iconify/react";
import { MagnifyingGlass, CaretLeft, ArrowsClockwise, ShieldCheck } from "@phosphor-icons/react";

// Knowledge base source types with descriptions
const KNOWLEDGE_SOURCES = [
  {
    id: "files",
    label: "Files",
    icon: "ph:file-text-duotone",
    color: "#6B7280",
    description: "Upload files to this Agent's knowledge base.",
    requiresAuth: false,
  },
  {
    id: "text",
    label: "Text",
    icon: "ph:text-aa-duotone",
    color: "#6B7280",
    description: "Add text content to this Agent's knowledge base.",
    requiresAuth: false,
  },
  {
    id: "website",
    label: "Website",
    icon: "ph:globe-duotone",
    color: "#6B7280",
    description: "Crawl a website to add to this Agent's knowledge base.",
    requiresAuth: false,
  },
  {
    id: "google-drive",
    label: "Google Drive",
    icon: "logos:google-drive",
    color: undefined,
    description: "Add Google Docs or Sheet to this Agent's knowledge base.",
    requiresAuth: true,
  },
  {
    id: "onedrive",
    label: "OneDrive",
    icon: "logos:microsoft-onedrive",
    color: undefined,
    description: "Add files from OneDrive to this Agent's knowledge base.",
    requiresAuth: true,
  },
  {
    id: "dropbox",
    label: "Dropbox",
    icon: "logos:dropbox",
    color: undefined,
    description: "Add files from Dropbox to this Agent's knowledge base.",
    requiresAuth: true,
  },
  {
    id: "notion",
    label: "Notion",
    icon: "simple-icons:notion",
    color: "#000000",
    description: "Add Notion pages to this Agent's knowledge base.",
    requiresAuth: true,
  },
  {
    id: "freshdesk",
    label: "Freshdesk",
    icon: "mdi:headset",
    color: "#25C16F",
    description: "Add Freshdesk articles to this Agent's knowledge base.",
    requiresAuth: true,
  },
];

interface SelectKnowledgeBaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSource: (sourceId: string) => void;
}

export function SelectKnowledgeBaseModal({
  open,
  onOpenChange,
  onSelectSource,
}: SelectKnowledgeBaseModalProps) {
  const [selectedSource, setSelectedSource] = useState<typeof KNOWLEDGE_SOURCES[0] | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const handleSelectSource = (source: typeof KNOWLEDGE_SOURCES[0]) => {
    if (source.requiresAuth) {
      setSelectedSource(source);
    } else {
      // For non-auth sources, directly proceed
      onSelectSource(source.id);
      onOpenChange(false);
    }
  };

  const handleBack = () => {
    setSelectedSource(null);
    setIsConnected(false);
  };

  const handleClose = () => {
    setSelectedSource(null);
    setIsConnected(false);
    onOpenChange(false);
  };

  const handleConnect = () => {
    // TODO: Implement OAuth flow for the selected source
    console.log("Connecting to:", selectedSource?.id);
    setIsConnected(true);
  };

  const handleSave = () => {
    if (selectedSource) {
      onSelectSource(selectedSource.id);
      handleClose();
    }
  };

  // Connect account view
  if (selectedSource) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-[480px] p-0 gap-0 overflow-hidden">
          {/* Header with back button */}
          <div className="px-5 pt-4 pb-3">
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors mb-4"
            >
              <CaretLeft className="size-4" weight="bold" />
            </button>

            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xl font-semibold">{selectedSource.label}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {selectedSource.description}
              </p>
            </DialogHeader>
          </div>

          {/* Connect account section */}
          <div className="px-5 py-4 space-y-4">
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="size-8 flex items-center justify-center">
                  <Icon
                    icon={selectedSource.icon}
                    className="size-6"
                    style={selectedSource.color ? { color: selectedSource.color } : undefined}
                  />
                </div>
                <span className="text-sm text-gray-700">Connect account</span>
              </div>
              <Button
                onClick={handleConnect}
                className={cn(
                  "px-4 h-8 text-sm font-medium",
                  isConnected
                    ? "bg-green-500 hover:bg-green-600"
                    : "bg-orange-500 hover:bg-orange-600"
                )}
              >
                {isConnected ? "Connected" : "Connect"}
              </Button>
            </div>

            {/* Security notice */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <ShieldCheck className="size-4 text-cyan-500" weight="fill" />
              <span>
                Your data is secure. You can remove and manage connected accounts{" "}
                <a href="/settings/connections" className="text-gray-700 underline hover:text-gray-900">
                  here
                </a>
                .
              </span>
            </div>

            {/* Documents section */}
            <div className="pt-2">
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <span className="text-sm font-medium text-gray-700">No documents added yet</span>
                <button className="text-gray-400 hover:text-gray-600">
                  <ArrowsClockwise className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Footer with Cancel / Save */}
          <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              className="px-4"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!isConnected}
              className="px-4 bg-gray-200 text-gray-500 hover:bg-gray-300 disabled:opacity-50"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Source selection view
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[480px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <MagnifyingGlass className="size-4 text-gray-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Select knowledge base</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Add data to this agent&apos;s knowledge base.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Grid of sources */}
        <div className="px-5 pb-5">
          <div className="grid grid-cols-3 gap-3">
            {KNOWLEDGE_SOURCES.map((source) => (
              <button
                key={source.id}
                onClick={() => handleSelectSource(source)}
                className={cn(
                  "flex flex-col items-start gap-2 p-4 rounded-xl border border-gray-200",
                  "hover:border-gray-300 hover:bg-gray-50 transition-all",
                  "text-left"
                )}
              >
                <div className="size-8 flex items-center justify-center">
                  <Icon
                    icon={source.icon}
                    className="size-6"
                    style={source.color ? { color: source.color } : undefined}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700">{source.label}</span>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
