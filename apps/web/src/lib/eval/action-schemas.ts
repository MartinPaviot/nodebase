/**
 * Action Output Schemas — Structured validation for side-effect actions
 *
 * Validates action arguments against Zod schemas BEFORE L1/L2/L3 evaluation.
 * Zero cost, < 1ms. If schema fails → hard block (malformed data never reaches eval).
 */

import { z } from "zod";

// ============================================
// SCHEMAS PER ACTION TYPE
// ============================================

export const actionSchemas: Record<string, z.ZodType> = {
  send_email: z.object({
    to: z.union([z.string().email(), z.string().min(1)]),
    subject: z.string().min(1, "Subject cannot be empty"),
    body: z.string().min(1, "Body cannot be empty"),
  }),

  create_calendar_event: z.object({
    summary: z.string().min(1, "Event title is required"),
    startDateTime: z.string().min(1, "Start date/time is required"),
    endDateTime: z.string().min(1, "End date/time is required"),
  }),

  send_slack_message: z.object({
    channel: z.string().min(1, "Channel is required"),
    text: z.string().min(1, "Message text is required"),
  }),

  create_notion_page: z.object({
    title: z.string().min(1, "Page title is required"),
    content: z.string().min(1, "Content is required"),
  }),

  append_to_notion: z.object({
    pageId: z.string().min(1, "Page ID is required"),
    content: z.string().min(1, "Content is required"),
  }),

  append_to_sheet: z.object({
    spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
    values: z.unknown(),
  }),

  update_sheet: z.object({
    spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
    range: z.string().min(1, "Range is required"),
    values: z.unknown(),
  }),

  create_spreadsheet: z.object({
    title: z.string().min(1, "Spreadsheet title is required"),
  }),

  upload_drive_file: z.object({
    name: z.string().min(1, "File name is required"),
    content: z.string().min(1, "File content is required"),
  }),

  delete_drive_file: z.object({
    fileId: z.string().min(1, "File ID is required"),
  }),

  create_doc: z.object({
    title: z.string().min(1, "Document title is required"),
    content: z.string().min(1, "Content is required"),
  }),

  append_to_doc: z.object({
    documentId: z.string().min(1, "Document ID is required"),
    content: z.string().min(1, "Content is required"),
  }),

  send_outlook_email: z.object({
    to: z.union([z.string().email(), z.string().min(1)]),
    subject: z.string().min(1, "Subject cannot be empty"),
    body: z.string().min(1, "Body cannot be empty"),
  }),

  send_teams_message: z.object({
    channel: z.string().min(1, "Channel is required"),
    text: z.string().min(1, "Message text is required"),
  }),
};

// ============================================
// VALIDATION FUNCTION
// ============================================

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate action arguments against the schema for that action type.
 * Returns { valid: true } if no schema exists for the action (pass-through).
 */
export function validateActionOutput(
  actionName: string,
  args: Record<string, unknown>,
): SchemaValidationResult {
  const schema = actionSchemas[actionName];
  if (!schema) {
    return { valid: true, errors: [] };
  }

  const result = schema.safeParse(args);
  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    ),
  };
}
