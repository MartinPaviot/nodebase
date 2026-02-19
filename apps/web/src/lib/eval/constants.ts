/**
 * Shared constants for the eval system.
 * Centralizes ACTION_LABELS and SIDE_EFFECT_ACTIONS used across
 * route.ts, eval-wrapper.ts, and approval UI components.
 */

/** Actions that have real-world side effects and require evaluation */
export const SIDE_EFFECT_ACTIONS = new Set([
  "send_email",
  "send_outlook_email",
  "create_calendar_event",
  "send_slack_message",
  "send_teams_message",
  "create_notion_page",
  "append_to_notion",
  "append_to_sheet",
  "update_sheet",
  "create_spreadsheet",
  "upload_drive_file",
  "delete_drive_file",
  "create_doc",
  "append_to_doc",
]);

/** Human-readable labels for each action type */
export const ACTION_LABELS: Record<string, string> = {
  send_email: "Send Email",
  send_outlook_email: "Send Email (Outlook)",
  create_calendar_event: "Create Calendar Event",
  send_slack_message: "Send Slack Message",
  send_teams_message: "Send Teams Message",
  create_notion_page: "Create Notion Page",
  append_to_notion: "Append to Notion",
  append_to_sheet: "Append to Sheet",
  update_sheet: "Update Sheet",
  create_spreadsheet: "Create Spreadsheet",
  upload_drive_file: "Upload to Drive",
  delete_drive_file: "Delete from Drive",
  create_doc: "Create Doc",
  append_to_doc: "Append to Doc",
};

/** Actions where the output is textual prose (vs structured data).
 *  Only these actions undergo claim extraction + grounding verification. */
export const TEXT_CONTENT_ACTIONS = new Set([
  "send_email",
  "send_outlook_email",
  "send_slack_message",
  "send_teams_message",
  "create_notion_page",
  "append_to_notion",
  "create_doc",
  "append_to_doc",
]);
