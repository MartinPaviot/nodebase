/**
 * Maps template suggestedIntegrations keys to connectable OAuth integrations vs internal features.
 */

/** Internal features that don't require OAuth connection */
const INTERNAL_INTEGRATIONS = new Set([
  "ai",
  "chat",
  "enter-loop",
  "elevay-utilities",
  "elevay-mail",
  "elevay-embed",
  "elevay-phone",
  "meeting-recorder",
  "timer",
  "web-browser",
  "knowledge-base",
  "embed",
  "webhook",
  "talk-with-agents",
  "generate-media",
  "video-utilities",
  "email",
  "phone",
  "calendar",
  "google-forms",
]);

/** Map template integration keys → Composio appNames (only for those that differ) */
const TEMPLATE_TO_COMPOSIO: Record<string, string> = {
  "google-calendar": "googlecalendar",
  "google-sheets": "googlesheets",
  "google-docs": "googledocs",
  "google-drive": "googledrive",
  "outlook-calendar": "outlookcalendar",
  "microsoft-teams": "microsoftteams",
  "people-data-labs": "peopledatalabs",
};

/** Check if an integration key requires OAuth connection */
export function isConnectable(key: string): boolean {
  return !INTERNAL_INTEGRATIONS.has(key);
}

/** Filter suggestedIntegrations to only those that need OAuth */
export function getConnectableIntegrations(
  suggestedIntegrations: string[],
): string[] {
  return suggestedIntegrations.filter((key) => isConnectable(key));
}

/** Convert a template integration key to a Composio appName */
export function getComposioAppName(integrationKey: string): string {
  return TEMPLATE_TO_COMPOSIO[integrationKey] ?? integrationKey;
}
