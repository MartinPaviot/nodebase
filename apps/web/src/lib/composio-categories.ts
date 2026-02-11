/**
 * Catégories du modal "Add Action"
 */
export type ActionCategory = "apps" | "chat" | "ai" | "logic" | "scrapers" | "nodebase";

/**
 * Map des apps Composio vers les catégories du modal
 */
export const COMPOSIO_CATEGORY_MAP: Record<string, ActionCategory[]> = {
  // Apps
  "googlesheets": ["apps"],
  "googledrive": ["apps"],
  "googlecalendar": ["apps"],
  "hubspot": ["apps"],
  "salesforce": ["apps"],
  "notion": ["apps"],
  "airtable": ["apps"],
  "asana": ["apps"],
  "dropbox": ["apps"],
  "calendly": ["apps"],
  "zendesk": ["apps", "chat"],
  "freshdesk": ["apps", "chat"],
  "pipedrive": ["apps"],
  "monday": ["apps"],
  "trello": ["apps"],
  "clickup": ["apps"],

  // Chat
  "gmail": ["chat", "apps"],
  "slack": ["chat", "apps"],
  "discord": ["chat"],
  "telegram": ["chat"],
  "outlook": ["chat", "apps"],
  "microsoftteams": ["chat", "apps"],
  "whatsapp": ["chat"],
  "intercom": ["chat"],
  "drift": ["chat"],

  // Scrapers
  "linkedin": ["scrapers"],
  "twitter": ["scrapers"],
  "x": ["scrapers"],
  "youtube": ["scrapers"],
  "tiktok": ["scrapers"],
  "reddit": ["scrapers"],
  "github": ["scrapers"],
  "productphone": ["scrapers"],
  "crunchbase": ["scrapers"],
  "glassdoor": ["scrapers"],
  "indeed": ["scrapers"],
  "yelp": ["scrapers"],
  "zillow": ["scrapers"],
  "booking": ["scrapers"],
  "amazon": ["scrapers"],

  // AI (custom actions, pas vraiment d'apps Composio pour ça)
  // Logic (idem)
  // Nodebase (actions custom Nodebase)

  // Default fallback
  "default": ["apps"],
};

/**
 * Retourne les catégories pour une app Composio
 */
export function getCategoriesForApp(appKey: string): ActionCategory[] {
  const normalized = appKey.toLowerCase().replace(/[_-]/g, "");
  return COMPOSIO_CATEGORY_MAP[normalized] || COMPOSIO_CATEGORY_MAP.default;
}

/**
 * Filtre les apps Composio par catégorie
 */
export function filterAppsByCategory(
  apps: Array<{ key: string; name: string }>,
  category: ActionCategory
): Array<{ key: string; name: string }> {
  return apps.filter((app) => {
    const categories = getCategoriesForApp(app.key);
    return categories.includes(category);
  });
}
