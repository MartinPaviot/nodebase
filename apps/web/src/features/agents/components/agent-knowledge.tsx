"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  useSuspenseKnowledge,
  useSuspenseKnowledgeSettings,
  useUploadKnowledge,
  useAddKnowledgeFromUrl,
  useDeleteKnowledge,
  useResyncKnowledge,
  useUpdateKnowledgeSettings,
} from "../hooks/use-agents";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Plus,
  Trash,
  CircleNotch,
  MagnifyingGlass,
  FileText,
  Hash,
  Upload,
  Globe,
  Cloud,
  ArrowsClockwise,
  WarningCircle,
  CheckCircle,
  Gear,
} from "@phosphor-icons/react";
import { formatDistanceToNow } from "date-fns";
import type { KnowledgeSourceType, KnowledgeSyncStatus } from "@prisma/client";

interface AgentKnowledgeProps {
  agentId: string;
}

// Source type icons
const sourceIcons: Record<KnowledgeSourceType, React.ReactNode> = {
  TEXT: <FileText className="size-4 text-blue-500" />,
  FILE_UPLOAD: <Upload className="size-4 text-green-500" />,
  WEBSITE: <Globe className="size-4 text-purple-500" />,
  WEBSITE_CRAWL: <Globe className="size-4 text-purple-600" />,
  GOOGLE_DRIVE: <Cloud className="size-4 text-yellow-500" />,
  NOTION: <FileText className="size-4 text-gray-700" />,
  DROPBOX: <Cloud className="size-4 text-blue-600" />,
  ONEDRIVE: <Cloud className="size-4 text-sky-500" />,
};

// Sync status icons
const syncStatusIcons: Record<KnowledgeSyncStatus, React.ReactNode> = {
  PENDING: <CircleNotch className="size-4 animate-spin text-yellow-500" />,
  SYNCING: <CircleNotch className="size-4 animate-spin text-blue-500" />,
  SYNCED: <CheckCircle className="size-4 text-green-500" />,
  ERROR: <WarningCircle className="size-4 text-red-500" />,
};

// Format bytes to human readable
function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function AgentKnowledge({ agentId }: AgentKnowledgeProps) {
  const documents = useSuspenseKnowledge(agentId);
  const settings = useSuspenseKnowledgeSettings(agentId);
  const uploadDocument = useUploadKnowledge();
  const addFromUrl = useAddKnowledgeFromUrl();
  const deleteDocument = useDeleteKnowledge();
  const resyncDocument = useResyncKnowledge();
  const updateSettings = useUpdateKnowledgeSettings();
  const trpc = useTRPC();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("text");

  // Text form state
  const [textForm, setTextForm] = useState({
    title: "",
    content: "",
  });

  // Website form state
  const [websiteForm, setWebsiteForm] = useState({
    url: "",
    crawlType: "single" as "single" | "full",
  });

  // File upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Settings state
  const currentSettings = settings.data || {
    searchFuzziness: 100,
    maxResults: 4,
    autoRefresh: true,
    refreshInterval: 24,
  };

  // Search query with debounce
  const searchResults = useQuery({
    ...trpc.agents.searchKnowledge.queryOptions({
      agentId,
      query: searchQuery,
      topK: currentSettings.maxResults,
    }),
    enabled: searchQuery.length > 2 && isSearching,
  });

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    uploadDocument.mutate(
      {
        agentId,
        title: textForm.title,
        content: textForm.content,
        sourceType: "TEXT",
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setTextForm({ title: "", content: "" });
        },
      }
    );
  };

  const handleWebsiteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addFromUrl.mutate(
      {
        agentId,
        url: websiteForm.url,
        crawlFullSite: websiteForm.crawlType === "full",
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setWebsiteForm({ url: "", crawlType: "single" });
        },
      }
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);

    for (const file of selectedFiles) {
      const content = await file.text();
      await uploadDocument.mutateAsync({
        agentId,
        title: file.name,
        content,
        sourceType: "FILE_UPLOAD",
        fileSize: file.size,
        mimeType: file.type || "text/plain",
      });
    }

    setIsUploading(false);
    setSelectedFiles([]);
    setIsDialogOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteDocument.mutate({ id });
    }
  };

  const handleResync = (id: string) => {
    resyncDocument.mutate({ id });
  };

  const handleSearch = () => {
    if (searchQuery.length > 2) {
      setIsSearching(true);
    }
  };

  const handleSettingsChange = (updates: Partial<typeof currentSettings>) => {
    updateSettings.mutate({
      agentId,
      ...updates,
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="size-5" />
            Knowledge Base
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-4 mr-2" />
                Add Source
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Knowledge Source</DialogTitle>
              </DialogHeader>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="text">Text</TabsTrigger>
                  <TabsTrigger value="file">File Upload</TabsTrigger>
                  <TabsTrigger value="website">Website</TabsTrigger>
                  <TabsTrigger value="cloud">Cloud Storage</TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="space-y-4 mt-4">
                  <form onSubmit={handleTextSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="text-title">Title</Label>
                      <Input
                        id="text-title"
                        value={textForm.title}
                        onChange={(e) =>
                          setTextForm({ ...textForm, title: e.target.value })
                        }
                        placeholder="FAQ, Product Info, etc."
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="text-content">Content</Label>
                      <Textarea
                        id="text-content"
                        value={textForm.content}
                        onChange={(e) =>
                          setTextForm({ ...textForm, content: e.target.value })
                        }
                        rows={10}
                        placeholder="Enter your knowledge content..."
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        {textForm.content.length.toLocaleString()} characters
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={uploadDocument.isPending}>
                        {uploadDocument.isPending && (
                          <CircleNotch className="size-4 mr-2 animate-spin" />
                        )}
                        Add Text
                      </Button>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="file" className="space-y-4 mt-4">
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <Upload className="size-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Drag & drop files here, or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supported: PDF, DOCX, TXT, CSV, XLSX, HTML (max 20MB)
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.txt,.csv,.xlsx,.html,.md"
                      multiple
                      onChange={handleFileSelect}
                    />
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Browse Files
                    </Button>
                  </div>
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2">
                      <Label>Selected Files</Label>
                      <div className="space-y-1">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                          >
                            <span className="truncate">{file.name}</span>
                            <span className="text-muted-foreground">
                              {formatBytes(file.size)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleFileUpload}
                      disabled={selectedFiles.length === 0 || isUploading}
                    >
                      {isUploading && (
                        <CircleNotch className="size-4 mr-2 animate-spin" />
                      )}
                      Upload {selectedFiles.length > 0 && `(${selectedFiles.length})`}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="website" className="space-y-4 mt-4">
                  <form onSubmit={handleWebsiteSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="website-url">Website URL</Label>
                      <Input
                        id="website-url"
                        value={websiteForm.url}
                        onChange={(e) =>
                          setWebsiteForm({ ...websiteForm, url: e.target.value })
                        }
                        placeholder="https://example.com/docs"
                        type="url"
                        required
                      />
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="crawl"
                          value="single"
                          id="single"
                          checked={websiteForm.crawlType === "single"}
                          onChange={() =>
                            setWebsiteForm({ ...websiteForm, crawlType: "single" })
                          }
                        />
                        <Label htmlFor="single" className="cursor-pointer">
                          Single Page
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="crawl"
                          value="full"
                          id="full"
                          checked={websiteForm.crawlType === "full"}
                          onChange={() =>
                            setWebsiteForm({ ...websiteForm, crawlType: "full" })
                          }
                        />
                        <Label htmlFor="full" className="cursor-pointer">
                          Crawl Entire Site
                        </Label>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {websiteForm.crawlType === "single"
                        ? "Only the specified page will be indexed."
                        : "All linked pages from the same domain will be crawled and indexed."}
                    </p>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={addFromUrl.isPending}>
                        {addFromUrl.isPending && (
                          <CircleNotch className="size-4 mr-2 animate-spin" />
                        )}
                        Add Website
                      </Button>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="cloud" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col gap-2"
                      onClick={() => {
                        // TODO: Implement Google Drive OAuth
                        alert("Google Drive integration coming soon!");
                      }}
                    >
                      <Cloud className="size-6 text-yellow-500" />
                      Google Drive
                    </Button>
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col gap-2"
                      onClick={() => {
                        // TODO: Implement Notion OAuth
                        alert("Notion integration coming soon!");
                      }}
                    >
                      <FileText className="size-6 text-gray-700" />
                      Notion
                    </Button>
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col gap-2"
                      onClick={() => {
                        // TODO: Implement Dropbox OAuth
                        alert("Dropbox integration coming soon!");
                      }}
                    >
                      <Cloud className="size-6 text-blue-600" />
                      Dropbox
                    </Button>
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col gap-2"
                      onClick={() => {
                        // TODO: Implement OneDrive OAuth
                        alert("OneDrive integration coming soon!");
                      }}
                    >
                      <Cloud className="size-6 text-sky-500" />
                      OneDrive
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Connect your cloud storage to automatically sync documents.
                  </p>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {documents.data.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="size-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">
                No documents in knowledge base.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Add documents to enable RAG (Retrieval Augmented Generation) for
                your agent.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {documents.data.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      {sourceIcons[doc.sourceType]}
                      <div>
                        <p className="font-medium">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc._count.chunks} chunks
                          {doc.fileSize && ` - ${formatBytes(doc.fileSize)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.syncStatus === "SYNCING" && (
                        <CircleNotch className="size-4 animate-spin text-blue-500" />
                      )}
                      {doc.syncStatus === "ERROR" && (
                        <Badge variant="destructive" className="text-xs">
                          {doc.syncError || "Sync error"}
                        </Badge>
                      )}
                      {doc.syncStatus === "SYNCED" && doc.lastSyncedAt && (
                        <Badge variant="outline" className="text-xs">
                          Synced{" "}
                          {formatDistanceToNow(new Date(doc.lastSyncedAt), {
                            addSuffix: true,
                          })}
                        </Badge>
                      )}
                      {doc.syncStatus === "PENDING" && (
                        <Badge variant="secondary" className="text-xs">
                          Pending
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleResync(doc.id)}
                        disabled={resyncDocument.isPending}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Resync document"
                      >
                        <ArrowsClockwise className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(doc.id, doc.title)}
                        disabled={deleteDocument.isPending}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Search Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Gear className="size-4" />
            Search Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <Label>Search Fuzziness</Label>
              <span className="text-sm text-muted-foreground">
                {currentSettings.searchFuzziness}%
              </span>
            </div>
            <Slider
              value={[currentSettings.searchFuzziness]}
              onValueChange={([v]) =>
                handleSettingsChange({ searchFuzziness: v })
              }
              min={0}
              max={100}
              step={10}
            />
            <p className="text-xs text-muted-foreground mt-1">
              0 = Exact keyword match, 100 = Semantic search
            </p>
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <Label>Max Results</Label>
              <span className="text-sm text-muted-foreground">
                {currentSettings.maxResults}
              </span>
            </div>
            <Slider
              value={[currentSettings.maxResults]}
              onValueChange={([v]) => handleSettingsChange({ maxResults: v })}
              min={1}
              max={10}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto Refresh</Label>
              <p className="text-xs text-muted-foreground">
                Sync sources every {currentSettings.refreshInterval}h
              </p>
            </div>
            <Switch
              checked={currentSettings.autoRefresh}
              onCheckedChange={(checked) =>
                handleSettingsChange({ autoRefresh: checked })
              }
            />
          </div>
          {currentSettings.autoRefresh && (
            <div>
              <div className="flex justify-between mb-2">
                <Label>Refresh Interval (hours)</Label>
                <span className="text-sm text-muted-foreground">
                  {currentSettings.refreshInterval}h
                </span>
              </div>
              <Slider
                value={[currentSettings.refreshInterval]}
                onValueChange={([v]) =>
                  handleSettingsChange({ refreshInterval: v })
                }
                min={1}
                max={168}
                step={1}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Semantic Search Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MagnifyingGlass className="size-4" />
            Test Semantic Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter a query to test RAG search..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearching(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />
            <Button
              onClick={handleSearch}
              disabled={searchQuery.length < 3 || searchResults.isFetching}
            >
              {searchResults.isFetching ? (
                <CircleNotch className="size-4 animate-spin" />
              ) : (
                <MagnifyingGlass className="size-4" />
              )}
            </Button>
          </div>

          {isSearching && searchResults.data && (
            <div className="space-y-2">
              {searchResults.data.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No relevant results found (minimum score: 0.7)
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Found {searchResults.data.length} relevant chunk(s):
                  </p>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {searchResults.data.map((result, index) => (
                        <div
                          key={result.id}
                          className="p-3 rounded-lg border bg-muted/30"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium">
                              [{index + 1}] {result.documentTitle}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              Score: {(result.score * 100).toFixed(1)}%
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {result.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
