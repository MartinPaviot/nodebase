"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSuspenseEmbed, useUpsertEmbed } from "../hooks/use-agents";
import {
  Code,
  CircleNotch,
  Copy,
  Plus,
  Trash,
  ChatCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { EmbedPosition } from "@prisma/client";

interface AgentEmbedProps {
  agentId: string;
}

type EmbedConfig = {
  enabled: boolean;
  displayName: string;
  welcomeMessage: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  userBubbleColor: string;
  botBubbleColor: string;
  position: EmbedPosition;
  buttonSize: number;
  windowWidth: number;
  windowHeight: number;
  autoOpen: boolean;
  autoOpenDelay: number;
  showBranding: boolean;
  collectEmail: boolean;
  requireEmail: boolean;
  customCss: string;
  logo: string;
  allowedDomains: string[];
  conversationStarters: string[];
};

const defaultConfig: EmbedConfig = {
  enabled: false,
  displayName: "",
  welcomeMessage: "",
  accentColor: "#6366f1",
  backgroundColor: "#ffffff",
  textColor: "#1f2937",
  userBubbleColor: "#6366f1",
  botBubbleColor: "#f3f4f6",
  position: "BOTTOM_RIGHT",
  buttonSize: 56,
  windowWidth: 400,
  windowHeight: 600,
  autoOpen: false,
  autoOpenDelay: 0,
  showBranding: true,
  collectEmail: false,
  requireEmail: false,
  customCss: "",
  logo: "",
  allowedDomains: [],
  conversationStarters: [],
};

export function AgentEmbed({ agentId }: AgentEmbedProps) {
  const embed = useSuspenseEmbed(agentId);
  const upsertEmbed = useUpsertEmbed();

  const [config, setConfig] = useState<EmbedConfig>(defaultConfig);
  const [newDomain, setNewDomain] = useState("");
  const [newStarter, setNewStarter] = useState("");
  const [showPreviewWindow, setShowPreviewWindow] = useState(false);

  useEffect(() => {
    if (embed.data) {
      setConfig({
        enabled: embed.data.enabled,
        displayName: embed.data.displayName || "",
        welcomeMessage: embed.data.welcomeMessage || "",
        accentColor: embed.data.accentColor || "#6366f1",
        backgroundColor: embed.data.backgroundColor || "#ffffff",
        textColor: embed.data.textColor || "#1f2937",
        userBubbleColor: embed.data.userBubbleColor || "#6366f1",
        botBubbleColor: embed.data.botBubbleColor || "#f3f4f6",
        position: embed.data.position || "BOTTOM_RIGHT",
        buttonSize: embed.data.buttonSize || 56,
        windowWidth: embed.data.windowWidth || 400,
        windowHeight: embed.data.windowHeight || 600,
        autoOpen: embed.data.autoOpen || false,
        autoOpenDelay: embed.data.autoOpenDelay || 0,
        showBranding: embed.data.showBranding ?? true,
        collectEmail: embed.data.collectEmail || false,
        requireEmail: embed.data.requireEmail || false,
        customCss: embed.data.customCss || "",
        logo: embed.data.logo || "",
        allowedDomains: (embed.data.allowedDomains as string[]) || [],
        conversationStarters:
          (embed.data.conversationStarters as string[]) || [],
      });
    }
  }, [embed.data]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertEmbed.mutate({
      agentId,
      ...config,
    });
  };

  const updateConfig = <K extends keyof EmbedConfig>(
    key: K,
    value: EmbedConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const addDomain = () => {
    if (newDomain && !config.allowedDomains.includes(newDomain)) {
      updateConfig("allowedDomains", [...config.allowedDomains, newDomain]);
      setNewDomain("");
    }
  };

  const removeDomain = (domain: string) => {
    updateConfig(
      "allowedDomains",
      config.allowedDomains.filter((d) => d !== domain)
    );
  };

  const addStarter = () => {
    if (
      newStarter &&
      !config.conversationStarters.includes(newStarter) &&
      config.conversationStarters.length < 4
    ) {
      updateConfig("conversationStarters", [
        ...config.conversationStarters,
        newStarter,
      ]);
      setNewStarter("");
    }
  };

  const removeStarter = (starter: string) => {
    updateConfig(
      "conversationStarters",
      config.conversationStarters.filter((s) => s !== starter)
    );
  };

  const copyEmbedCode = () => {
    const code = `<script src="${window.location.origin}/api/embed/${agentId}" async></script>`;
    navigator.clipboard.writeText(code);
    toast.success("Embed code copied to clipboard");
  };

  const getPositionStyles = () => {
    const base: React.CSSProperties = {
      position: "absolute",
    };
    switch (config.position) {
      case "BOTTOM_RIGHT":
        return { ...base, bottom: 16, right: 16 };
      case "BOTTOM_LEFT":
        return { ...base, bottom: 16, left: 16 };
      case "TOP_RIGHT":
        return { ...base, top: 16, right: 16 };
      case "TOP_LEFT":
        return { ...base, top: 16, left: 16 };
      default:
        return { ...base, bottom: 16, right: 16 };
    }
  };

  const getWindowPositionStyles = () => {
    const base: React.CSSProperties = {
      position: "absolute",
    };
    switch (config.position) {
      case "BOTTOM_RIGHT":
        return { ...base, bottom: config.buttonSize + 24, right: 0 };
      case "BOTTOM_LEFT":
        return { ...base, bottom: config.buttonSize + 24, left: 0 };
      case "TOP_RIGHT":
        return { ...base, top: config.buttonSize + 24, right: 0 };
      case "TOP_LEFT":
        return { ...base, top: config.buttonSize + 24, left: 0 };
      default:
        return { ...base, bottom: config.buttonSize + 24, right: 0 };
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Configuration Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="size-5" />
            Embed Widget
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Enable Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Embed</Label>
                <p className="text-sm text-muted-foreground">
                  Allow this agent to be embedded on external websites
                </p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => updateConfig("enabled", checked)}
              />
            </div>

            {/* Embed Code */}
            {config.enabled && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Label>Embed Code</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={copyEmbedCode}
                  >
                    <Copy className="size-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <code className="text-xs break-all">
                  {`<script src="${typeof window !== "undefined" ? window.location.origin : ""}/api/embed/${agentId}" async></script>`}
                </code>
              </div>
            )}

            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={config.displayName}
                onChange={(e) => updateConfig("displayName", e.target.value)}
                placeholder="My AI Assistant"
              />
              <p className="text-xs text-muted-foreground">
                Name shown in the chat widget header
              </p>
            </div>

            {/* Welcome Message */}
            <div className="space-y-2">
              <Label htmlFor="welcomeMessage">Welcome Message</Label>
              <Textarea
                id="welcomeMessage"
                value={config.welcomeMessage}
                onChange={(e) => updateConfig("welcomeMessage", e.target.value)}
                placeholder="Hi! How can I help you today?"
                rows={2}
              />
            </div>

            {/* Logo URL */}
            <div className="space-y-2">
              <Label htmlFor="logo">Logo URL (optional)</Label>
              <Input
                id="logo"
                value={config.logo}
                onChange={(e) => updateConfig("logo", e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </div>

            {/* Colors Section */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Colors</h4>
              <div className="grid grid-cols-2 gap-4">
                {/* Accent Color */}
                <div className="space-y-2">
                  <Label>Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={config.accentColor}
                      onChange={(e) =>
                        updateConfig("accentColor", e.target.value)
                      }
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={config.accentColor}
                      onChange={(e) =>
                        updateConfig("accentColor", e.target.value)
                      }
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Background Color */}
                <div className="space-y-2">
                  <Label>Background Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={config.backgroundColor}
                      onChange={(e) =>
                        updateConfig("backgroundColor", e.target.value)
                      }
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={config.backgroundColor}
                      onChange={(e) =>
                        updateConfig("backgroundColor", e.target.value)
                      }
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Text Color */}
                <div className="space-y-2">
                  <Label>Text Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={config.textColor}
                      onChange={(e) =>
                        updateConfig("textColor", e.target.value)
                      }
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={config.textColor}
                      onChange={(e) =>
                        updateConfig("textColor", e.target.value)
                      }
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* User Bubble Color */}
                <div className="space-y-2">
                  <Label>User Bubble Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={config.userBubbleColor}
                      onChange={(e) =>
                        updateConfig("userBubbleColor", e.target.value)
                      }
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={config.userBubbleColor}
                      onChange={(e) =>
                        updateConfig("userBubbleColor", e.target.value)
                      }
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Bot Bubble Color */}
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <Label>Bot Bubble Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={config.botBubbleColor}
                      onChange={(e) =>
                        updateConfig("botBubbleColor", e.target.value)
                      }
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={config.botBubbleColor}
                      onChange={(e) =>
                        updateConfig("botBubbleColor", e.target.value)
                      }
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Position & Size Section */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Position & Size</h4>
              <div className="grid grid-cols-2 gap-4">
                {/* Position */}
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Select
                    value={config.position}
                    onValueChange={(value: EmbedPosition) =>
                      updateConfig("position", value)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BOTTOM_RIGHT">Bottom Right</SelectItem>
                      <SelectItem value="BOTTOM_LEFT">Bottom Left</SelectItem>
                      <SelectItem value="TOP_RIGHT">Top Right</SelectItem>
                      <SelectItem value="TOP_LEFT">Top Left</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Button Size */}
                <div className="space-y-2">
                  <Label>Button Size: {config.buttonSize}px</Label>
                  <Slider
                    value={[config.buttonSize]}
                    onValueChange={(value) =>
                      updateConfig("buttonSize", value[0])
                    }
                    min={40}
                    max={80}
                    step={1}
                  />
                </div>

                {/* Window Width */}
                <div className="space-y-2">
                  <Label>Window Width: {config.windowWidth}px</Label>
                  <Slider
                    value={[config.windowWidth]}
                    onValueChange={(value) =>
                      updateConfig("windowWidth", value[0])
                    }
                    min={300}
                    max={500}
                    step={10}
                  />
                </div>

                {/* Window Height */}
                <div className="space-y-2">
                  <Label>Window Height: {config.windowHeight}px</Label>
                  <Slider
                    value={[config.windowHeight]}
                    onValueChange={(value) =>
                      updateConfig("windowHeight", value[0])
                    }
                    min={400}
                    max={800}
                    step={10}
                  />
                </div>
              </div>
            </div>

            {/* Behavior Section */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Behavior</h4>
              <div className="space-y-3">
                {/* Auto Open */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto Open</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically open chat on page load
                    </p>
                  </div>
                  <Switch
                    checked={config.autoOpen}
                    onCheckedChange={(checked) =>
                      updateConfig("autoOpen", checked)
                    }
                  />
                </div>

                {config.autoOpen && (
                  <div className="pl-4 border-l-2 border-muted">
                    <Label>Delay: {config.autoOpenDelay}s</Label>
                    <Slider
                      value={[config.autoOpenDelay]}
                      onValueChange={(value) =>
                        updateConfig("autoOpenDelay", value[0])
                      }
                      min={0}
                      max={30}
                      step={1}
                      className="mt-2"
                    />
                  </div>
                )}

                {/* Show Branding */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Branding</Label>
                    <p className="text-xs text-muted-foreground">
                      Show &quot;Powered by Nodebase&quot;
                    </p>
                  </div>
                  <Switch
                    checked={config.showBranding}
                    onCheckedChange={(checked) =>
                      updateConfig("showBranding", checked)
                    }
                  />
                </div>

                {/* Collect Email */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Collect Email</Label>
                    <p className="text-xs text-muted-foreground">
                      Ask for email before chat
                    </p>
                  </div>
                  <Switch
                    checked={config.collectEmail}
                    onCheckedChange={(checked) =>
                      updateConfig("collectEmail", checked)
                    }
                  />
                </div>

                {config.collectEmail && (
                  <div className="flex items-center justify-between pl-4 border-l-2 border-muted">
                    <Label>Require Email</Label>
                    <Switch
                      checked={config.requireEmail}
                      onCheckedChange={(checked) =>
                        updateConfig("requireEmail", checked)
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Allowed Domains */}
            <div className="space-y-2">
              <Label>Allowed Domains</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Leave empty to allow all domains. Add domains to restrict where
                the widget can be embedded.
              </p>
              <div className="flex gap-2">
                <Input
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="example.com"
                  onKeyDown={(e) =>
                    e.key === "Enter" && (e.preventDefault(), addDomain())
                  }
                />
                <Button type="button" variant="outline" onClick={addDomain}>
                  <Plus className="size-4" />
                </Button>
              </div>
              {config.allowedDomains.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {config.allowedDomains.map((domain) => (
                    <div
                      key={domain}
                      className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm"
                    >
                      {domain}
                      <button
                        type="button"
                        onClick={() => removeDomain(domain)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Conversation Starters */}
            <div className="space-y-2">
              <Label>Conversation Starters (max 4)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Suggested prompts shown to users when they open the chat.
              </p>
              <div className="flex gap-2">
                <Input
                  value={newStarter}
                  onChange={(e) => setNewStarter(e.target.value)}
                  placeholder="How can you help me?"
                  disabled={config.conversationStarters.length >= 4}
                  onKeyDown={(e) =>
                    e.key === "Enter" && (e.preventDefault(), addStarter())
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addStarter}
                  disabled={config.conversationStarters.length >= 4}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              {config.conversationStarters.length > 0 && (
                <div className="space-y-2 mt-2">
                  {config.conversationStarters.map((starter, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-muted px-3 py-2 rounded text-sm"
                    >
                      <span className="flex-1">{starter}</span>
                      <button
                        type="button"
                        onClick={() => removeStarter(starter)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Custom CSS Section */}
            <div className="space-y-2">
              <Label htmlFor="customCss">Custom CSS (Advanced)</Label>
              <Textarea
                id="customCss"
                value={config.customCss}
                onChange={(e) => updateConfig("customCss", e.target.value)}
                placeholder={`.nodebase-chat { /* your styles */ }`}
                className="font-mono text-sm"
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                Add custom CSS to further customize the widget appearance.
              </p>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              disabled={upsertEmbed.isPending}
            >
              {upsertEmbed.isPending && (
                <CircleNotch className="size-4 mr-2 animate-spin" />
              )}
              Save Settings
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Preview Panel */}
      <Card className="lg:sticky lg:top-4 h-fit">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Preview</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreviewWindow(!showPreviewWindow)}
            >
              {showPreviewWindow ? "Hide Window" : "Show Window"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="relative border rounded-lg overflow-hidden"
            style={{
              width: "100%",
              height: 450,
              backgroundColor: "#f5f5f5",
            }}
          >
            {/* Preview chat window */}
            {showPreviewWindow && (
              <div
                className="rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                style={{
                  ...getWindowPositionStyles(),
                  width: Math.min(config.windowWidth, 340),
                  height: Math.min(config.windowHeight, 380),
                  backgroundColor: config.backgroundColor,
                }}
              >
                {/* Header */}
                <div
                  className="p-3 flex items-center gap-3"
                  style={{ backgroundColor: config.accentColor }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                  >
                    {config.logo ? (
                      <img
                        src={config.logo}
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <ChatCircle className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <span
                    className="font-semibold text-sm text-white truncate"
                    style={{ flex: 1 }}
                  >
                    {config.displayName || "AI Assistant"}
                  </span>
                  <button className="text-white opacity-70 hover:opacity-100">
                    x
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 p-3 overflow-hidden">
                  {/* Bot message */}
                  <div className="mb-2">
                    <div
                      className="inline-block px-3 py-2 rounded-2xl text-xs max-w-[80%]"
                      style={{
                        backgroundColor: config.botBubbleColor,
                        color: config.textColor,
                      }}
                    >
                      {config.welcomeMessage || "Hi! How can I help you today?"}
                    </div>
                  </div>

                  {/* User message sample */}
                  <div className="mb-2 text-right">
                    <div
                      className="inline-block px-3 py-2 rounded-2xl text-xs max-w-[80%] text-white"
                      style={{ backgroundColor: config.userBubbleColor }}
                    >
                      Hello! I have a question.
                    </div>
                  </div>

                  {/* Conversation starters */}
                  {config.conversationStarters.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {config.conversationStarters.slice(0, 2).map((starter, i) => (
                        <button
                          key={i}
                          className="px-2 py-1 text-[10px] rounded-full border bg-white hover:bg-gray-50"
                          style={{ color: config.textColor }}
                        >
                          {starter.length > 20
                            ? starter.substring(0, 20) + "..."
                            : starter}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Input */}
                <div
                  className="p-2 border-t flex gap-2"
                  style={{ borderColor: "#e5e7eb" }}
                >
                  <input
                    type="text"
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-1.5 text-xs border rounded-full outline-none"
                    style={{ borderColor: "#e5e7eb" }}
                    disabled
                  />
                  <button
                    className="px-3 py-1.5 rounded-full text-xs text-white font-medium"
                    style={{ backgroundColor: config.accentColor }}
                    disabled
                  >
                    Send
                  </button>
                </div>

                {/* Branding */}
                {config.showBranding && (
                  <div
                    className="text-center py-1 text-[10px] opacity-50"
                    style={{ color: config.textColor }}
                  >
                    Powered by Nodebase
                  </div>
                )}
              </div>
            )}

            {/* Chat button */}
            <div
              className="rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-transform hover:scale-105"
              style={{
                ...getPositionStyles(),
                width: config.buttonSize,
                height: config.buttonSize,
                backgroundColor: config.accentColor,
              }}
              onClick={() => setShowPreviewWindow(!showPreviewWindow)}
            >
              <ChatCircle
                className="text-white"
                style={{ width: config.buttonSize * 0.4, height: config.buttonSize * 0.4 }}
              />
            </div>

            {/* Position indicator */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-2 left-2 text-xs text-muted-foreground bg-white/80 px-2 py-1 rounded">
                Position: {config.position.replace("_", " ").toLowerCase()}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-3 text-center">
            Click the button to toggle the chat window preview
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
