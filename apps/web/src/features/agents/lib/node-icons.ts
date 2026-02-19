/**
 * Shared node icon configuration for flow editor nodes.
 * Used by both the canvas (flow-editor-canvas.tsx) and the chat panel header (flow-editor.tsx).
 */

// Core node types → Phosphor icon name + Tailwind bg color class
// The Phosphor icon names here are used as lookup keys; the actual rendering
// imports the Phosphor component in the consuming file.
export const CORE_NODE_ICONS: Record<string, { phosphorIcon: string; bgColor: string }> = {
  messageReceived: { phosphorIcon: "Chats", bgColor: "bg-blue-500" },
  chatAgent: { phosphorIcon: "Chats", bgColor: "bg-blue-500" },
  agentStep: { phosphorIcon: "Robot", bgColor: "bg-indigo-500" },
  condition: { phosphorIcon: "GitBranch", bgColor: "bg-violet-500" },
  conditionBranch: { phosphorIcon: "GitBranch", bgColor: "bg-violet-500" },
  searchKnowledgeBase: { phosphorIcon: "MagnifyingGlass", bgColor: "bg-blue-500" },
  enterLoop: { phosphorIcon: "ArrowsClockwise", bgColor: "bg-teal-500" },
  exitLoop: { phosphorIcon: "ArrowsClockwise", bgColor: "bg-teal-500" },
  loop: { phosphorIcon: "ArrowsClockwise", bgColor: "bg-teal-500" },
  chatOutcome: { phosphorIcon: "ChatCircle", bgColor: "bg-blue-500" },
  sendEmail: { phosphorIcon: "Envelope", bgColor: "bg-blue-500" },
  peopleDataLabs: { phosphorIcon: "MagnifyingGlass", bgColor: "bg-purple-500" },
};

// Icon mapping for action nodes based on integration/type (Iconify icons)
export const ACTION_ICONS: Record<string, { icon: string; color: string }> = {
  // Google
  "google-sheets": { icon: "logos:google-sheets", color: "bg-green-500" },
  "google-drive": { icon: "logos:google-drive", color: "bg-blue-500" },
  "google-calendar": { icon: "logos:google-calendar", color: "bg-blue-500" },
  "gmail": { icon: "logos:google-gmail", color: "bg-red-500" },
  "google": { icon: "logos:google-icon", color: "bg-white border border-gray-200" },
  // Communication
  "slack": { icon: "logos:slack-icon", color: "bg-purple-500" },
  "discord": { icon: "logos:discord-icon", color: "bg-indigo-500" },
  "telegram": { icon: "logos:telegram", color: "bg-blue-500" },
  "whatsapp": { icon: "logos:whatsapp-icon", color: "bg-green-500" },
  "teams": { icon: "logos:microsoft-teams", color: "bg-purple-500" },
  "zoom": { icon: "logos:zoom-icon", color: "bg-blue-500" },
  "outlook": { icon: "logos:microsoft-icon", color: "bg-blue-500" },
  // CRM & Sales
  "hubspot": { icon: "logos:hubspot", color: "bg-orange-500" },
  "salesforce": { icon: "logos:salesforce", color: "bg-blue-500" },
  "pipedrive": { icon: "simple-icons:pipedrive", color: "bg-green-500" },
  "apollo": { icon: "ph:rocket-fill", color: "bg-purple-500" },
  "clearbit": { icon: "simple-icons:clearbit", color: "bg-blue-500" },
  "clay": { icon: "ph:cube-fill", color: "bg-indigo-500" },
  "hunter": { icon: "ph:envelope-simple-fill", color: "bg-orange-500" },
  "lemlist": { icon: "ph:paper-plane-tilt-fill", color: "bg-purple-500" },
  "snov": { icon: "ph:envelope-fill", color: "bg-blue-500" },
  "crunchbase": { icon: "simple-icons:crunchbase", color: "bg-blue-500" },
  // Project Management
  "notion": { icon: "logos:notion-icon", color: "bg-slate-800" },
  "airtable": { icon: "logos:airtable", color: "bg-blue-500" },
  "jira": { icon: "logos:jira", color: "bg-blue-500" },
  "asana": { icon: "logos:asana-icon", color: "bg-red-500" },
  "trello": { icon: "logos:trello", color: "bg-blue-500" },
  "monday": { icon: "logos:monday-icon", color: "bg-yellow-500" },
  "linear": { icon: "logos:linear-icon", color: "bg-indigo-500" },
  // Development
  "github": { icon: "logos:github-icon", color: "bg-slate-800" },
  "gitlab": { icon: "logos:gitlab", color: "bg-orange-500" },
  "bitbucket": { icon: "logos:bitbucket", color: "bg-blue-500" },
  // Cloud
  "aws": { icon: "logos:aws", color: "bg-orange-500" },
  "azure": { icon: "logos:azure-icon", color: "bg-blue-500" },
  "gcp": { icon: "logos:google-cloud", color: "bg-blue-500" },
  // Storage
  "dropbox": { icon: "logos:dropbox", color: "bg-blue-500" },
  "box": { icon: "simple-icons:box", color: "bg-blue-500" },
  "onedrive": { icon: "logos:microsoft-onedrive", color: "bg-blue-500" },
  // Marketing & Email
  "mailchimp": { icon: "logos:mailchimp", color: "bg-yellow-500" },
  "sendgrid": { icon: "logos:sendgrid-icon", color: "bg-blue-500" },
  // Payments
  "stripe": { icon: "logos:stripe", color: "bg-purple-500" },
  // Support
  "zendesk": { icon: "logos:zendesk-icon", color: "bg-green-500" },
  "intercom": { icon: "logos:intercom-icon", color: "bg-blue-500" },
  // Social Media
  "twitter": { icon: "logos:twitter", color: "bg-blue-500" },
  "facebook": { icon: "logos:facebook", color: "bg-blue-500" },
  "instagram": { icon: "logos:instagram-icon", color: "bg-pink-500" },
  "linkedin": { icon: "logos:linkedin-icon", color: "bg-white border border-gray-200" },
  "youtube": { icon: "logos:youtube-icon", color: "bg-white border border-gray-200" },
  "tiktok": { icon: "logos:tiktok-icon", color: "bg-slate-800" },
  "reddit": { icon: "logos:reddit-icon", color: "bg-orange-500" },
  "pinterest": { icon: "logos:pinterest", color: "bg-red-500" },
  // E-commerce
  "shopify": { icon: "logos:shopify", color: "bg-green-500" },
  "woocommerce": { icon: "logos:woocommerce-icon", color: "bg-purple-500" },
  // Forms
  "typeform": { icon: "simple-icons:typeform", color: "bg-slate-800" },
  "calendly": { icon: "simple-icons:calendly", color: "bg-blue-500" },
  // AI & Research
  "perplexity": { icon: "simple-icons:perplexity", color: "bg-teal-600" },
  "people-data-labs": { icon: "mdi:account-search", color: "bg-[#7F35FD]" },
  "ai": { icon: "ph:sparkle-fill", color: "bg-violet-500" },
  // Utilities
  "web-browser": { icon: "ph:globe-fill", color: "bg-blue-500" },
  "http": { icon: "ph:globe-fill", color: "bg-blue-500" },
  "generate-media": { icon: "ph:image-fill", color: "bg-pink-500" },
  "meeting-recorder": { icon: "ph:microphone-fill", color: "bg-red-500" },
  "elevay-phone": { icon: "ph:phone-fill", color: "bg-green-500" },
  "utilities": { icon: "ph:wrench-fill", color: "bg-slate-500" },
  // Generic
  "table": { icon: "ph:table-fill", color: "bg-emerald-500" },
  "send": { icon: "ph:paper-plane-tilt-fill", color: "bg-cyan-500" },
  "search": { icon: "ph:magnifying-glass-bold", color: "bg-blue-500" },
  "message": { icon: "ph:chat-circle-text-fill", color: "bg-indigo-500" },
  // Automation
  "zapier": { icon: "logos:zapier-icon", color: "bg-orange-500" },
  "twilio": { icon: "logos:twilio-icon", color: "bg-red-500" },
};

// Integration node configuration (Iconify icons with hex colors)
export const INTEGRATION_NODE_CONFIG: Record<string, { icon: string; color: string; borderColor: string }> = {
  gmail: { icon: "logos:google-gmail", color: "#EA4335", borderColor: "#EA4335" },
  googleDrive: { icon: "logos:google-drive", color: "#4285F4", borderColor: "#4285F4" },
  googleDocs: { icon: "simple-icons:googledocs", color: "#4285F4", borderColor: "#4285F4" },
  googleCalendar: { icon: "logos:google-calendar", color: "#4285F4", borderColor: "#4285F4" },
  outlook: { icon: "vscode-icons:file-type-outlook", color: "#0078D4", borderColor: "#0078D4" },
  outlookCalendar: { icon: "vscode-icons:file-type-outlook", color: "#0078D4", borderColor: "#0078D4" },
  microsoftTeams: { icon: "logos:microsoft-teams", color: "#6264A7", borderColor: "#6264A7" },
  slack: { icon: "logos:slack-icon", color: "#4A154B", borderColor: "#4A154B" },
  notion: { icon: "simple-icons:notion", color: "#000000", borderColor: "#000000" },
};

/**
 * Returns the icon config for a given flow node.
 * - Core nodes (messageReceived, agentStep, etc.) → { type: 'phosphor', phosphorIcon, bgColor }
 * - Integration nodes (gmail, slack, etc.)        → { type: 'iconify', icon, bgColor }
 * - Action nodes (action with data.icon)          → { type: 'iconify', icon, bgColor }
 */
export type NodeIconResult =
  | { type: "phosphor"; phosphorIcon: string; bgColor: string }
  | { type: "iconify"; icon: string; bgColor: string };

export function getNodeIconConfig(
  nodeType: string,
  nodeData?: { icon?: string; [key: string]: unknown },
): NodeIconResult {
  // 1. Core nodes
  const coreConfig = CORE_NODE_ICONS[nodeType];
  if (coreConfig) {
    return { type: "phosphor", ...coreConfig };
  }

  // 2. Integration nodes
  const integrationConfig = INTEGRATION_NODE_CONFIG[nodeType];
  if (integrationConfig) {
    return { type: "iconify", icon: integrationConfig.icon, bgColor: `bg-[${integrationConfig.color}]` };
  }

  // 3. Action nodes (type === "action" with data.icon)
  if (nodeType === "action" && nodeData?.icon) {
    const actionConfig = ACTION_ICONS[nodeData.icon as string];
    if (actionConfig) {
      return { type: "iconify", icon: actionConfig.icon, bgColor: actionConfig.color };
    }
  }

  // 4. Try data.icon directly (composioAction and similar)
  if (nodeData?.icon) {
    const actionConfig = ACTION_ICONS[nodeData.icon as string];
    if (actionConfig) {
      return { type: "iconify", icon: actionConfig.icon, bgColor: actionConfig.color };
    }
  }

  // 5. Fallback
  return { type: "phosphor", phosphorIcon: "Sparkle", bgColor: "bg-emerald-500" };
}
