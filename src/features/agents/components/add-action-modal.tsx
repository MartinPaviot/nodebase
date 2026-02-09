"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  MagnifyingGlass,
  Star,
  AppWindow,
  ChatCircle,
  Sparkle,
  GitBranch,
  Globe,
  DiamondsFour,
  CaretLeft,
} from "@phosphor-icons/react";
import { Icon } from "@iconify/react";
import { PDLIcon } from "@/components/icons/pdl-icon";

// Action item type
interface ActionItem {
  id: string;
  label: string;
  icon: string;
  color?: string;
}

// Tab definitions
const TABS = [
  { id: "top", label: "Top", icon: Star },
  { id: "apps", label: "Apps", icon: AppWindow },
  { id: "chat", label: "Chat", icon: ChatCircle },
  { id: "ai", label: "AI", icon: Sparkle },
  { id: "logic", label: "Logic", icon: GitBranch },
  { id: "scrapers", label: "Scrapers", icon: Globe },
  { id: "nodebase", label: "By Nodebase", icon: DiamondsFour },
];

// Action items organized by category - using brand logos and noto emojis
const ACTIONS = {
  top: {
    "Linked actions": [
      { id: "chat-agent", label: "Chat with this Agent", icon: "ph:chats-fill", color: "#3B82F6" },
    ],
    "Apps": [
      { id: "google-sheets", label: "Google Sheets", icon: "mdi:google-spreadsheet", color: "#34A853" },
      { id: "google-drive", label: "Google Drive", icon: "mdi:google-drive", color: "#4285F4" },
      { id: "google-calendar", label: "Google Calendar", icon: "mdi:calendar", color: "#4285F4" },
      { id: "hubspot", label: "HubSpot", icon: "mdi:hubspot", color: "#FF7A59" },
    ],
    "Chat": [
      { id: "slack", label: "Slack", icon: "devicon:slack" },
      { id: "gmail", label: "Gmail", icon: "logos:google-gmail" },
      { id: "outlook", label: "Microsoft Outlook", icon: "vscode-icons:file-type-outlook" },
      { id: "telegram", label: "Telegram", icon: "logos:telegram" },
    ],
    "AI": [
      { id: "agent-step", label: "Agent step", icon: "noto:robot" },
      { id: "knowledge-base", label: "Knowledge base", icon: "noto:books" },
      { id: "ai", label: "AI", icon: "noto:sparkles" },
      { id: "generate-media", label: "Generate media", icon: "noto:artist-palette" },
    ],
    "Logic": [
      { id: "condition", label: "Condition", icon: "noto:shuffle-tracks-button" },
      { id: "loop", label: "Enter loop", icon: "noto:counterclockwise-arrows-button" },
    ],
    "Scrapers": [
      { id: "scrape-creators", label: "Scrape Creators", icon: "noto:busts-in-silhouette" },
      { id: "linkedin", label: "LinkedIn", icon: "devicon:linkedin" },
      { id: "youtube", label: "YouTube", icon: "logos:youtube-icon" },
      { id: "tiktok", label: "TikTok", icon: "logos:tiktok-icon" },
    ],
    "By Nodebase": [
      { id: "nodebase-computer", label: "Nodebase computer", icon: "noto:desktop-computer" },
      { id: "video-utilities", label: "Video utilities", icon: "noto:clapper-board" },
      { id: "nodebase-phone", label: "Nodebase phone", icon: "noto:mobile-phone" },
      { id: "run-code", label: "Run code", icon: "noto:laptop" },
    ],
  },
  apps: {
    "Popular": [
      { id: "ai-app", label: "AI", icon: "noto:sparkles" },
      { id: "airtable", label: "Airtable", icon: "logos:airtable" },
      { id: "asana", label: "Asana", icon: "logos:asana" },
      { id: "calendly", label: "Calendly", icon: "simple-icons:calendly", color: "#006BFF" },
      { id: "dropbox", label: "Dropbox", icon: "logos:dropbox" },
      { id: "gmail", label: "Gmail", icon: "logos:google-gmail" },
      { id: "google-calendar", label: "Google Calendar", icon: "mdi:calendar", color: "#4285F4" },
      { id: "google-docs", label: "Google Docs", icon: "mdi:file-document", color: "#4285F4" },
      { id: "google-drive", label: "Google Drive", icon: "mdi:google-drive", color: "#4285F4" },
      { id: "google-sheets", label: "Google Sheets", icon: "mdi:google-spreadsheet", color: "#34A853" },
      { id: "http", label: "HTTP", icon: "noto:globe-with-meridians" },
      { id: "hubspot", label: "HubSpot", icon: "mdi:hubspot", color: "#FF7A59" },
      { id: "meeting-recorder", label: "Meeting recorder", icon: "noto:studio-microphone" },
      { id: "utilities", label: "Utilities", icon: "noto:wrench" },
      { id: "outlook", label: "Microsoft Outlook", icon: "vscode-icons:file-type-outlook" },
      { id: "outlook-calendar", label: "Microsoft Outlook Calendar", icon: "vscode-icons:file-type-outlook" },
      { id: "teams", label: "Microsoft Teams", icon: "logos:microsoft-teams" },
      { id: "notion", label: "Notion", icon: "simple-icons:notion", color: "#000000" },
      { id: "people-data", label: "People Data Labs", icon: "mdi:account-details", color: "#7F35FD" },
      { id: "salesforce", label: "Salesforce", icon: "logos:salesforce" },
      { id: "slack", label: "Slack", icon: "devicon:slack" },
      { id: "telegram", label: "Telegram", icon: "logos:telegram" },
      { id: "timer", label: "Timer", icon: "noto:timer-clock" },
      { id: "twilio", label: "Twilio", icon: "logos:twilio-icon" },
      { id: "typeform", label: "Typeform", icon: "simple-icons:typeform", color: "#262627" },
      { id: "web-browser", label: "Web browser", icon: "noto:globe-with-meridians" },
      { id: "youtube", label: "YouTube", icon: "simple-icons:youtube", color: "#FF0000" },
      { id: "zendesk", label: "Zendesk", icon: "simple-icons:zendesk", color: "#03363D" },
    ],
  },
  chat: {
    "Linked actions": [
      { id: "chat-agent", label: "Chat with this Agent", icon: "ph:chats-fill", color: "#3B82F6" },
    ],
    "Popular": [
      { id: "discord", label: "Discord", icon: "simple-icons:discord", color: "#5865F2" },
      { id: "gmail", label: "Gmail", icon: "simple-icons:gmail", color: "#EA4335" },
      { id: "nodebase-phone", label: "Nodebase phone", icon: "noto:mobile-phone" },
      { id: "outlook", label: "Microsoft Outlook", icon: "fluent:mail-24-filled", color: "#0078D4" },
      { id: "slack", label: "Slack", icon: "devicon:slack" },
      { id: "telegram", label: "Telegram", icon: "logos:telegram" },
      { id: "twilio", label: "Twilio", icon: "logos:twilio-icon" },
    ],
    "All Chat": [
      { id: "nodebase-mail", label: "Nodebase mail", icon: "noto:envelope" },
      { id: "request-action", label: "Request an Action", icon: "noto:red-question-mark" },
      { id: "talk-agents", label: "Talk with other agents", icon: "noto:busts-in-silhouette" },
    ],
  },
  ai: {
    "Popular": [
      { id: "agent-step", label: "Agent step", icon: "noto:robot" },
      { id: "ai", label: "AI", icon: "noto:sparkles" },
      { id: "generate-media", label: "Generate media", icon: "noto:artist-palette" },
    ],
    "All AI": [
      { id: "knowledge-base", label: "Knowledge base", icon: "noto:books" },
      { id: "request-action", label: "Request an Action", icon: "noto:red-question-mark" },
    ],
  },
  logic: {
    "Popular": [
      { id: "condition", label: "Condition", icon: "noto:shuffle-tracks-button" },
      { id: "loop", label: "Enter loop", icon: "noto:counterclockwise-arrows-button" },
    ],
    "All Logic": [
      { id: "request-action", label: "Request an Action", icon: "noto:red-question-mark" },
    ],
  },
  scrapers: {
    "Popular": [
      { id: "google-search", label: "Google", icon: "logos:google-icon" },
      { id: "scrape-creators", label: "Scrape Creators", icon: "noto:busts-in-silhouette" },
      { id: "web-browser", label: "Web browser", icon: "noto:globe-with-meridians" },
      { id: "youtube", label: "YouTube", icon: "simple-icons:youtube", color: "#FF0000" },
    ],
    "All Scrapers": [
      { id: "amazon", label: "Amazon", icon: "fa-brands:amazon", color: "#FF9900" },
      { id: "apify", label: "Apify", icon: "mdi:api", color: "#00D6A2" },
      { id: "booking", label: "Booking.com", icon: "simple-icons:bookingdotcom", color: "#003580" },
      { id: "bright-data", label: "Bright Data", icon: "noto:card-file-box" },
      { id: "crunchbase", label: "Crunchbase", icon: "simple-icons:crunchbase", color: "#0288D1" },
      { id: "github", label: "GitHub", icon: "mdi:github", color: "#181717" },
      { id: "glassdoor", label: "Glassdoor", icon: "simple-icons:glassdoor", color: "#0CAA41" },
      { id: "indeed", label: "Indeed", icon: "simple-icons:indeed", color: "#003A9B" },
      { id: "linkedin", label: "LinkedIn", icon: "simple-icons:linkedin", color: "#0A66C2" },
      { id: "reddit", label: "Reddit", icon: "logos:reddit-icon" },
      { id: "tiktok", label: "TikTok", icon: "logos:tiktok-icon" },
      { id: "twitter", label: "Twitter", icon: "simple-icons:x", color: "#000000" },
      { id: "yelp", label: "Yelp", icon: "simple-icons:yelp", color: "#D32323" },
      { id: "zillow", label: "Zillow", icon: "simple-icons:zillow", color: "#006AFF" },
    ],
  },
  nodebase: {
    "Linked actions": [
      { id: "chat-agent", label: "Chat with this Agent", icon: "ph:chats-fill", color: "#3B82F6" },
    ],
    "Popular": [
      { id: "ai", label: "AI", icon: "noto:sparkles" },
      { id: "generate-media", label: "Generate media", icon: "noto:artist-palette" },
      { id: "http", label: "HTTP", icon: "noto:globe-with-meridians" },
      { id: "meeting-recorder", label: "Meeting recorder", icon: "noto:studio-microphone" },
      { id: "nodebase-phone", label: "Nodebase phone", icon: "noto:mobile-phone" },
      { id: "utilities", label: "Utilities", icon: "noto:wrench" },
      { id: "run-code", label: "Run code", icon: "noto:laptop" },
      { id: "timer", label: "Timer", icon: "noto:timer-clock" },
      { id: "video-utilities", label: "Video utilities", icon: "noto:clapper-board" },
      { id: "web-browser", label: "Web browser", icon: "noto:globe-with-meridians" },
    ],
    "All By Nodebase": [
      { id: "form", label: "Form", icon: "noto:clipboard" },
      { id: "nodebase-computer", label: "Nodebase computer", icon: "noto:desktop-computer" },
      { id: "nodebase-mail", label: "Nodebase mail", icon: "noto:envelope" },
      { id: "request-action", label: "Request an Action", icon: "noto:red-question-mark" },
      { id: "talk-agents", label: "Talk with other agents", icon: "noto:busts-in-silhouette" },
    ],
  },
};

interface AddActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAction: (actionId: string) => void;
}

// Sub-menu configuration for actions with sub-options
const CHAT_AGENT_SUB_OPTIONS = [
  {
    id: "observe-messages",
    label: "Observe messages",
    description: "Observe messages from user chat",
    icon: "ph:chats-fill",
    color: "#3B82F6"
  },
  {
    id: "send-message",
    label: "Send message",
    description: "Sends a message to user chat",
    icon: "ph:chats-fill",
    color: "#3B82F6"
  },
];

// People Data Labs sub-options - matching Lindy AI descriptions
const PEOPLE_DATA_LABS_SUB_OPTIONS = [
  {
    id: "pdl-find-by-email",
    label: "Find person by email",
    description: "Find a person by an email. An email exactly identifies one person.",
    credits: 15,
  },
  {
    id: "pdl-find-by-full-name",
    label: "Find person by full name",
    description: "Find a person by full name. A full name may match multiple people. The most relevant people are returned first. Optionally specify metadata like location, company, school, birthday, etc to narrow down the search.",
    credits: 15,
  },
  {
    id: "pdl-find-by-partial-name",
    label: "Find person by partial name",
    description: "Find a person by first, middle, and/or last name. A partial name may match multiple people. The most relevant people are returned first. Because a partial name is very broad, metadata like location, company, school, birthday, etc are required to narrow down the search.",
    credits: 15,
  },
  {
    id: "pdl-find-by-phone",
    label: "Find person by phone",
    description: "Find a person by phone number. Ex: +1 555-234-1234. A phone number exactly identifies one person.",
    credits: 15,
  },
  {
    id: "pdl-find-by-social",
    label: "Find Person by Social Network",
    description: "Find a person by a social network URL. A social network URL may match multiple people. The most relevant people are returned first.",
    credits: 50,
  },
  {
    id: "pdl-search-companies",
    label: "Search for Companies",
    description: 'Find companies by broad criteria like "tech startups in San Francisco" or "companies with over 1000 employees". Avoid using to find specific company. Default to 5 results unless the user specify otherwise.',
    credits: 10,
  },
  {
    id: "pdl-search-people",
    label: "Search for People",
    description: 'Find people by broad criteria like "data scientists in San Francisco" or "people with @company.com email". Avoid using to find specific person. Default to 5 results unless the user specify otherwise.',
    credits: 15,
  },
];

// Google Sheets sub-options - matching Lindy AI
const GOOGLE_SHEETS_SUB_OPTIONS = [
  {
    id: "gs-append-row",
    label: "Append row",
    description: "Append a new row to a spreadsheet.",
  },
  {
    id: "gs-append-rows",
    label: "Append rows",
    description: "Appends multiple rows to a spreadsheet.",
  },
  {
    id: "gs-clear-cell",
    label: "Clear Cell",
    description: "Clear the contents of a specific cell in a Google Sheets worksheet.",
    isPremium: true,
  },
  {
    id: "gs-clear-rows",
    label: "Clear Rows",
    description: "Clear cell contents from specified rows in a Google Sheets worksheet.",
    isPremium: true,
  },
  {
    id: "gs-copy-sheet",
    label: "Copy sheet",
    description: "Creates a copy of a Sheet.",
  },
  {
    id: "gs-copy-worksheet",
    label: "Copy Worksheet",
    description: "Copy a worksheet from one spreadsheet to another in Google Sheets.",
    isPremium: true,
  },
  {
    id: "gs-create-column",
    label: "Create Column",
    description: "Insert a new column in a Google Sheets worksheet.",
    isPremium: true,
  },
  {
    id: "gs-create-spreadsheet",
    label: "Create spreadsheet",
    description: "Creates a new spreadsheet.",
  },
  {
    id: "gs-create-worksheet",
    label: "Create Worksheet",
    description: "Create a new worksheet in an existing Google Sheets spreadsheet.",
    isPremium: true,
  },
  {
    id: "gs-delete-row",
    label: "Delete row",
    description: "Deletes a row that matches the specified lookup value in the lookup column.",
  },
  {
    id: "gs-delete-rows",
    label: "Delete Rows",
    description: "Delete rows from a specified range in a Google Sheets worksheet.",
    isPremium: true,
  },
  {
    id: "gs-delete-worksheet",
    label: "Delete Worksheet",
    description: "Delete a worksheet from a Google Sheets spreadsheet.",
    isPremium: true,
  },
  {
    id: "gs-find-row",
    label: "Find row",
    description: "Find a row by lookup value. Returns the first row and row index that matches. If no match found, returns a null row and -1 for row index.",
  },
  {
    id: "gs-get-cell",
    label: "Get Cell",
    description: "Retrieve the value of a specific cell from a Google Sheets spreadsheet.",
    isPremium: true,
  },
  {
    id: "gs-get-current-user",
    label: "Get Current User",
    description: "Retrieve the authenticated user's profile (display name, email, permission ID) and storage quota information from Google Sheets.",
    isPremium: true,
  },
  {
    id: "gs-get-spreadsheet",
    label: "Get spreadsheet",
    description: "Returns the rows of a spreadsheet.",
  },
  {
    id: "gs-get-spreadsheet-by-id",
    label: "Get Spreadsheet By Id",
    description: "Retrieve details about a specific Google Sheets spreadsheet.",
    isPremium: true,
  },
  {
    id: "gs-get-values-in-range",
    label: "Get Values In Range",
    description: "Retrieve values from a specific range within a Google Sheets worksheet.",
    isPremium: true,
  },
  {
    id: "gs-insert-anchored-note",
    label: "Insert An Anchored Note",
    description: "Add a comment to a specific cell in a Google Sheets spreadsheet.",
    isPremium: true,
  },
  {
    id: "gs-insert-comment",
    label: "Insert Comment",
    description: "Add a comment to a Google Sheets spreadsheet.",
    isPremium: true,
  },
  {
    id: "gs-list-worksheets",
    label: "List Worksheets",
    description: "Get a list of all worksheets within a Google Sheets spreadsheet.",
    isPremium: true,
  },
  {
    id: "gs-update-cell",
    label: "Update Cell",
    description: "Update a specific cell's value within a Google Sheets worksheet.",
    isPremium: true,
  },
  {
    id: "gs-update-column",
    label: "Update column",
    description: "Updates a column in a spreadsheet or appends a new column.",
  },
  {
    id: "gs-update-formatting",
    label: "Update Formatting",
    description: "Update the formatting of a cell in a spreadsheet.",
    isPremium: true,
  },
  {
    id: "gs-update-multiple-rows",
    label: "Update Multiple Rows",
    description: "Update multiple rows in a Google Sheets worksheet within a specified range.",
    isPremium: true,
  },
  {
    id: "gs-update-row",
    label: "Update row",
    description: "Update or append a row in a Google Sheets spreadsheet.",
  },
];

// Extended action item type with optional description for search
interface SearchableActionItem extends ActionItem {
  description?: string;
  credits?: number;
  isPremium?: boolean;
  parentId?: string; // For sub-options, reference to parent
  parentLabel?: string; // For display purposes
}

export function AddActionModal({ open, onOpenChange, onSelectAction }: AddActionModalProps) {
  const [activeTab, setActiveTab] = useState("top");
  const [search, setSearch] = useState("");
  const [subMenuFor, setSubMenuFor] = useState<string | null>(null);

  const currentActions = ACTIONS[activeTab as keyof typeof ACTIONS] || {};

  // Build searchable actions including sub-options
  const buildSearchableActions = () => {
    const allSearchableActions: Record<string, SearchableActionItem[]> = {};

    // Go through all tabs
    Object.entries(ACTIONS).forEach(([_tabId, categories]) => {
      Object.entries(categories).forEach(([category, items]) => {
        (items as ActionItem[]).forEach((item) => {
          // Add main action
          if (!allSearchableActions[category]) {
            allSearchableActions[category] = [];
          }

          // Check if item already exists to avoid duplicates
          const exists = allSearchableActions[category].some(existing => existing.id === item.id);
          if (!exists) {
            allSearchableActions[category].push(item);
          }
        });
      });
    });

    // Add People Data Labs sub-options as searchable items
    const pdlCategory = "People Data Labs";
    if (!allSearchableActions[pdlCategory]) {
      allSearchableActions[pdlCategory] = [];
    }
    PEOPLE_DATA_LABS_SUB_OPTIONS.forEach((option) => {
      allSearchableActions[pdlCategory].push({
        id: option.id,
        label: option.label,
        icon: "mdi:account-details",
        color: "#7F35FD",
        description: option.description,
        credits: option.credits,
        parentId: "people-data",
        parentLabel: "People Data Labs",
      });
    });

    // Add Chat Agent sub-options
    const chatCategory = "Chat with this Agent";
    if (!allSearchableActions[chatCategory]) {
      allSearchableActions[chatCategory] = [];
    }
    CHAT_AGENT_SUB_OPTIONS.forEach((option) => {
      allSearchableActions[chatCategory].push({
        id: option.id,
        label: option.label,
        icon: option.icon,
        color: option.color,
        description: option.description,
        parentId: "chat-agent",
        parentLabel: "Chat with this Agent",
      });
    });

    // Add Google Sheets sub-options as searchable items
    const gsCategory = "Google Sheets";
    if (!allSearchableActions[gsCategory]) {
      allSearchableActions[gsCategory] = [];
    }
    GOOGLE_SHEETS_SUB_OPTIONS.forEach((option) => {
      allSearchableActions[gsCategory].push({
        id: option.id,
        label: option.label,
        icon: "mdi:google-spreadsheet",
        color: "#34A853",
        description: option.description,
        isPremium: option.isPremium,
        parentId: "google-sheets",
        parentLabel: "Google Sheets",
      });
    });

    return allSearchableActions;
  };

  // Filter actions by search - search across ALL tabs when there's a search query
  const filteredActions = (() => {
    const searchLower = search.toLowerCase().trim();

    if (!searchLower) {
      // No search - just show current tab's actions
      return Object.entries(currentActions).reduce<Record<string, SearchableActionItem[]>>((acc, [category, items]) => {
        acc[category] = items as SearchableActionItem[];
        return acc;
      }, {});
    }

    // Search is active - search across ALL actions including sub-options
    const allActions = buildSearchableActions();

    return Object.entries(allActions).reduce<Record<string, SearchableActionItem[]>>((acc, [category, items]) => {
      const filtered = items.filter((item) => {
        // Search in label
        if (item.label.toLowerCase().includes(searchLower)) return true;
        // Search in description if available
        if (item.description && item.description.toLowerCase().includes(searchLower)) return true;
        // Search in category name
        if (category.toLowerCase().includes(searchLower)) return true;
        // Search in parent label if available
        if (item.parentLabel && item.parentLabel.toLowerCase().includes(searchLower)) return true;
        return false;
      });

      if (filtered.length > 0) {
        acc[category] = filtered;
      }
      return acc;
    }, {});
  })();

  const handleSelect = (actionId: string, isSubOption?: boolean) => {
    // If it's a sub-option (from search), directly select it
    if (isSubOption) {
      onSelectAction(actionId);
      onOpenChange(false);
      setSubMenuFor(null);
      setSearch("");
      return;
    }

    // If this action has sub-options, show the sub-menu instead of closing
    if (actionId === "chat-agent") {
      setSubMenuFor("chat-agent");
      return;
    }
    if (actionId === "people-data") {
      setSubMenuFor("people-data");
      return;
    }
    if (actionId === "google-sheets") {
      setSubMenuFor("google-sheets");
      return;
    }
    onSelectAction(actionId);
    onOpenChange(false);
    setSubMenuFor(null);
    setSearch("");
  };

  const handleSubOptionSelect = (subOptionId: string) => {
    onSelectAction(subOptionId);
    onOpenChange(false);
    setSubMenuFor(null);
  };

  const handleBackFromSubMenu = () => {
    setSubMenuFor(null);
  };

  // Reset sub-menu when modal closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSubMenuFor(null);
    }
    onOpenChange(isOpen);
  };

  // Render a category with items
  const renderCategory = ([category, items]: [string, SearchableActionItem[]]) => {
    // Check if any item has a description (sub-options from search)
    const hasSubOptions = items.some(item => item.description || item.parentId);

    return (
      <div key={category} className="mb-4">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-[11px] font-medium text-muted-foreground">{category}</span>
          <span className="text-[11px] text-muted-foreground/50">&gt;</span>
        </div>

        {hasSubOptions ? (
          // Render with descriptions (sub-options style)
          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id, !!item.parentId)}
                className="w-full text-left hover:bg-gray-50 rounded-lg p-2 -mx-2 transition-colors"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="size-4 flex items-center justify-center shrink-0">
                    {item.parentId === "people-data" || item.id === "people-data" ? (
                      <PDLIcon size={16} />
                    ) : (
                      <Icon
                        icon={item.icon}
                        className="size-4"
                        style={item.color ? { color: item.color } : undefined}
                      />
                    )}
                  </div>
                  <span className="font-medium text-sm text-foreground">{item.label}</span>
                  {(item.credits || item.isPremium) && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                      Premium
                    </span>
                  )}
                  {item.credits && (
                    <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                      <Icon icon="ph:coins" className="size-3" />
                      {item.credits}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed pl-6 line-clamp-2">
                    {item.description}
                  </p>
                )}
              </button>
            ))}
          </div>
        ) : (
          // Regular 2-column grid
          <div className="grid grid-cols-2 gap-x-6">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className="flex items-center gap-2 w-full px-1 py-1 rounded-md hover:bg-muted/50 transition-colors text-left"
              >
                <div className="size-4 flex items-center justify-center shrink-0">
                  {item.id === "people-data" ? (
                    <PDLIcon size={16} />
                  ) : (
                    <Icon
                      icon={item.icon}
                      className="size-4"
                      style={item.color ? { color: item.color } : undefined}
                    />
                  )}
                </div>
                <span className="text-sm text-foreground">{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[680px] p-0 gap-0 overflow-hidden">
        {/* Sub-menu view for Chat with this Agent */}
        {subMenuFor === "chat-agent" ? (
          <>
            {/* Sub-menu Header */}
            <div className="px-5 pt-5 pb-3">
              <button
                onClick={handleBackFromSubMenu}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors"
              >
                <CaretLeft className="size-4" weight="bold" />
                Back
              </button>
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-blue-500 flex items-center justify-center">
                  <Icon icon="ph:chats-fill" className="size-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Chat with this Agent</h2>
                  <p className="text-sm text-muted-foreground">Select a chat action</p>
                </div>
              </div>
            </div>

            {/* Sub-options */}
            <div className="px-5 pb-5 space-y-2">
              {CHAT_AGENT_SUB_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleSubOptionSelect(option.id)}
                  className="flex items-center gap-3 w-full p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left"
                >
                  <div className="size-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
                    <Icon icon={option.icon} className="size-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-foreground">{option.label}</div>
                    <div className="text-xs text-muted-foreground">{option.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : subMenuFor === "people-data" ? (
          <>
            {/* People Data Labs Sub-menu Header - Lindy AI style */}
            <div className="px-6 pt-5 pb-4 flex items-center gap-2">
              <button
                onClick={handleBackFromSubMenu}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <CaretLeft className="size-5" weight="bold" />
              </button>
              <h2 className="text-xl font-semibold">People Data Labs</h2>
            </div>

            {/* Actions label */}
            <div className="px-6 pb-2">
              <span className="text-sm text-muted-foreground">Actions</span>
            </div>

            {/* People Data Labs Sub-options - Lindy AI style */}
            <div className="px-6 pb-5 space-y-4 max-h-[400px] overflow-y-auto">
              {PEOPLE_DATA_LABS_SUB_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleSubOptionSelect(option.id)}
                  className="w-full text-left hover:bg-gray-50 rounded-lg p-2 -mx-2 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <PDLIcon size={18} />
                    <span className="font-medium text-[15px] text-foreground">{option.label}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                      Premium
                    </span>
                    <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                      <Icon icon="ph:coins" className="size-3" />
                      {option.credits}
                    </span>
                  </div>
                  <p className="text-[13px] text-muted-foreground leading-relaxed pl-[26px]">{option.description}</p>
                </button>
              ))}
            </div>
          </>
        ) : subMenuFor === "google-sheets" ? (
          <>
            {/* Google Sheets Sub-menu Header */}
            <div className="px-6 pt-5 pb-4 flex items-center gap-2">
              <button
                onClick={handleBackFromSubMenu}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <CaretLeft className="size-5" weight="bold" />
              </button>
              <h2 className="text-xl font-semibold">Google Sheets</h2>
            </div>

            {/* Actions label */}
            <div className="px-6 pb-2">
              <span className="text-sm text-muted-foreground">Actions</span>
            </div>

            {/* Google Sheets Sub-options */}
            <div className="px-6 pb-5 space-y-4 max-h-[400px] overflow-y-auto">
              {GOOGLE_SHEETS_SUB_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleSubOptionSelect(option.id)}
                  className="w-full text-left hover:bg-gray-50 rounded-lg p-2 -mx-2 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon icon="mdi:google-spreadsheet" className="size-[18px]" style={{ color: "#34A853" }} />
                    <span className="font-medium text-[15px] text-foreground">{option.label}</span>
                    {option.isPremium && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                        Premium
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-muted-foreground leading-relaxed pl-[26px]">{option.description}</p>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-lg font-semibold">Add action</h2>
              <p className="text-sm text-muted-foreground">Select an action to add to your agent.</p>
            </div>

            {/* Search */}
            <div className="px-5 pb-3">
              <div className="relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  className="pl-9 h-10 border-primary/30 focus-visible:ring-primary/20"
                />
              </div>
            </div>

            {/* Tabs */}
            <div className="px-5 pb-2 border-b">
              <div className="flex items-center gap-0">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1.5 text-xs whitespace-nowrap transition-colors",
                      activeTab === tab.id
                        ? "text-foreground font-medium border-b-2 border-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <tab.icon className="size-3.5" weight={activeTab === tab.id ? "fill" : "regular"} />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content - Categories with 2-column item grids */}
            <div className="px-5 py-3 max-h-[280px] overflow-y-auto">
              {Object.keys(filteredActions).length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No actions found for &quot;{search}&quot;
                </div>
              ) : (
                <div>
                  {Object.entries(filteredActions).map(renderCategory)}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
