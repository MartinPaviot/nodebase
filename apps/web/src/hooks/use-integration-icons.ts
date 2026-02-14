import { useMemo, useCallback } from "react";
import { useComposioApps, type ComposioApp } from "./use-composio";

// Fallback ONLY for internal Nodebase features (no Composio app equivalent)
const INTERNAL_ICONS: Record<string, { icon: string; label: string; color: string }> = {
  ai:                       { icon: "mdi:robot",             label: "AI",                     color: "#8B5CF6" },
  chat:                     { icon: "mdi:chat",              label: "Chat with this Agent",   color: "#6366F1" },
  "enter-loop":             { icon: "mdi:sync",              label: "Enter loop",             color: "#10B981" },
  "lindy-utilities":        { icon: "mdi:tools",             label: "Nodebase utilities",     color: "#6366F1" },
  "lindy-mail":             { icon: "mdi:email-outline",     label: "Nodebase mail",          color: "#F59E0B" },
  "lindy-embed":            { icon: "mdi:code-tags",         label: "Embed",                  color: "#6366F1" },
  "lindy-phone":            { icon: "mdi:phone",             label: "Nodebase phone",         color: "#10B981" },
  "meeting-recorder":       { icon: "mdi:microphone",        label: "Meeting recorder",       color: "#F59E0B" },
  "lindy-meeting-recorder": { icon: "mdi:microphone",        label: "Meeting recorder",       color: "#F59E0B" },
  timer:                    { icon: "mdi:timer",             label: "Timer",                  color: "#F59E0B" },
  "web-browser":            { icon: "mdi:web",               label: "Web browser",            color: "#4285F4" },
  "knowledge-base":         { icon: "mdi:book-open-variant", label: "Knowledge base",         color: "#6366F1" },
  embed:                    { icon: "mdi:code-tags",         label: "Embed",                  color: "#6366F1" },
  webhook:                  { icon: "mdi:webhook",           label: "Webhook",                color: "#6B7280" },
  "talk-with-agents":       { icon: "mdi:robot-outline",     label: "Talk with other agents", color: "#8B5CF6" },
  "generate-media":         { icon: "mdi:image-auto-adjust", label: "Generate media",         color: "#EC4899" },
  "video-utilities":        { icon: "mdi:video",             label: "Video utilities",        color: "#EF4444" },
  email:                    { icon: "mdi:email",             label: "Email",                  color: "#6366F1" },
  phone:                    { icon: "mdi:phone",             label: "Phone",                  color: "#10B981" },
  calendar:                 { icon: "mdi:calendar",          label: "Calendar",               color: "#4285F4" },
};

/** Normalize a Composio app key (GOOGLE_SHEETS → google-sheets) */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/_/g, "-");
}

export type IntegrationIconData =
  | { type: "img"; src: string; label: string }
  | { type: "iconify"; icon: string; label: string; color?: string };

export function useIntegrationIcons() {
  const { data: apps, isLoading } = useComposioApps();

  // Build normalized lookup map from Composio apps
  const composioMap = useMemo(() => {
    const map = new Map<string, ComposioApp>();
    if (!apps) return map;
    for (const app of apps) {
      // Index by normalized key (e.g., "gmail", "google-sheets")
      map.set(normalizeKey(app.key), app);
      // Also index by normalized name (e.g., "google sheets" → "google-sheets")
      map.set(app.name.toLowerCase().replace(/\s+/g, "-"), app);
    }
    return map;
  }, [apps]);

  const getIcon = useCallback(
    (integrationKey: string): IntegrationIconData => {
      // 1. Check internal features first (not in Composio)
      const internal = INTERNAL_ICONS[integrationKey];
      if (internal) {
        return { type: "iconify", ...internal };
      }

      // 2. Check Composio apps
      const normalized = normalizeKey(integrationKey);
      const composioApp = composioMap.get(normalized);
      if (composioApp?.logo) {
        return { type: "img", src: composioApp.logo, label: composioApp.name };
      }

      // 3. Generic fallback
      return {
        type: "iconify",
        icon: "mdi:apps",
        label: integrationKey
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        color: "#6B7280",
      };
    },
    [composioMap],
  );

  return { getIcon, isLoading };
}
