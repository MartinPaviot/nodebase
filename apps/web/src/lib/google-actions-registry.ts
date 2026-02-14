/**
 * Google Suite Actions Registry
 *
 * Static registry of Google apps and their available actions.
 * Used by the Add Action modal (frontend) and tool filtering (backend).
 */

export interface GoogleAction {
  /** Internal key used for tool name, e.g., "send_email" */
  key: string;
  /** Human-readable name, e.g., "Send Email" */
  name: string;
  /** Description for both UI and LLM */
  description: string;
  /** Whether this action has side effects (requires confirmation in safe mode) */
  hasSideEffects: boolean;
}

export interface GoogleApp {
  /** Internal key, e.g., "google_gmail" */
  key: string;
  /** Human-readable name */
  name: string;
  /** Phosphor icon name */
  icon: string;
  /** The IntegrationType required for this app */
  integrationType: string;
  /** Actions available for this app */
  actions: GoogleAction[];
}

export const GOOGLE_APPS: GoogleApp[] = [
  {
    key: "google_gmail",
    name: "Gmail",
    icon: "ph:envelope",
    integrationType: "GMAIL",
    actions: [
      { key: "send_email", name: "Send Email", description: "Send an email through the user's connected Gmail account", hasSideEffects: true },
      { key: "list_emails", name: "List Emails", description: "List recent emails from the user's Gmail inbox", hasSideEffects: false },
      { key: "search_emails", name: "Search Emails", description: "Search emails in the user's Gmail account using a query", hasSideEffects: false },
    ],
  },
  {
    key: "google_calendar",
    name: "Google Calendar",
    icon: "ph:calendar",
    integrationType: "GOOGLE_CALENDAR",
    actions: [
      { key: "list_calendar_events", name: "List Events", description: "List upcoming events from the user's Google Calendar", hasSideEffects: false },
      { key: "create_calendar_event", name: "Create Event", description: "Create a new event in the user's Google Calendar", hasSideEffects: true },
    ],
  },
  {
    key: "google_sheets",
    name: "Google Sheets",
    icon: "ph:table",
    integrationType: "GOOGLE_SHEETS",
    actions: [
      { key: "read_sheet", name: "Read Sheet", description: "Read data from a Google Sheets spreadsheet", hasSideEffects: false },
      { key: "append_to_sheet", name: "Append to Sheet", description: "Append rows of data to a Google Sheets spreadsheet", hasSideEffects: true },
      { key: "update_sheet", name: "Update Sheet", description: "Update existing data in a Google Sheets spreadsheet", hasSideEffects: true },
      { key: "create_spreadsheet", name: "Create Spreadsheet", description: "Create a new Google Sheets spreadsheet", hasSideEffects: true },
    ],
  },
  {
    key: "google_drive",
    name: "Google Drive",
    icon: "ph:folder-open",
    integrationType: "GOOGLE_DRIVE",
    actions: [
      { key: "list_drive_files", name: "List Files", description: "List files in the user's Google Drive", hasSideEffects: false },
      { key: "get_drive_file", name: "Get File", description: "Get details of a specific file in Google Drive", hasSideEffects: false },
      { key: "upload_drive_file", name: "Upload File", description: "Upload a file to Google Drive", hasSideEffects: true },
      { key: "delete_drive_file", name: "Delete File", description: "Delete a file from Google Drive", hasSideEffects: true },
    ],
  },
  {
    key: "google_docs",
    name: "Google Docs",
    icon: "ph:file-text",
    integrationType: "GOOGLE_DOCS",
    actions: [
      { key: "create_doc", name: "Create Document", description: "Create a new Google Docs document", hasSideEffects: true },
      { key: "get_doc", name: "Get Document", description: "Get the content of a Google Docs document", hasSideEffects: false },
      { key: "append_to_doc", name: "Append to Document", description: "Append text content to an existing Google Docs document", hasSideEffects: true },
    ],
  },
];

export function getGoogleApp(key: string): GoogleApp | undefined {
  return GOOGLE_APPS.find((app) => app.key === key);
}

export function getGoogleAction(actionKey: string): { app: GoogleApp; action: GoogleAction } | undefined {
  for (const app of GOOGLE_APPS) {
    const action = app.actions.find((a) => a.key === actionKey);
    if (action) return { app, action };
  }
  return undefined;
}

export function isGoogleAction(actionKey: string): boolean {
  return !!getGoogleAction(actionKey);
}

export function getGoogleSideEffectActions(): string[] {
  return GOOGLE_APPS.flatMap((app) =>
    app.actions.filter((a) => a.hasSideEffects).map((a) => a.key)
  );
}
