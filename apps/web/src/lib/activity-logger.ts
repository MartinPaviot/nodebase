import prisma from "./db";
import { ActivityType, Prisma } from "@/generated/prisma";

/**
 * Log an activity for a conversation
 * @param conversationId - The ID of the conversation
 * @param type - The type of activity (from ActivityType enum)
 * @param title - A short description of the activity
 * @param details - Optional JSON details about the activity
 * @param requiresConfirmation - Whether this activity requires user confirmation (Safe Mode)
 */
export async function logActivity(
  conversationId: string,
  type: ActivityType,
  title: string,
  details?: Record<string, unknown>,
  requiresConfirmation = false
) {
  return prisma.conversationActivity.create({
    data: {
      conversationId,
      type,
      title,
      details: details as Prisma.InputJsonValue | undefined,
      requiresConfirmation,
    },
  });
}

/**
 * Log a tool call activity
 */
export async function logToolCall(
  conversationId: string,
  toolName: string,
  args?: Record<string, unknown>
) {
  return logActivity(
    conversationId,
    "TOOL_CALLED",
    `Called: ${toolName}`,
    args ? { args } : undefined
  );
}

/**
 * Log a successful tool completion
 */
export async function logToolCompleted(
  conversationId: string,
  toolName: string,
  result?: Record<string, unknown>
) {
  return logActivity(
    conversationId,
    "TOOL_COMPLETED",
    `Completed: ${toolName}`,
    result ? { result } : undefined
  );
}

/**
 * Log a failed tool execution
 */
export async function logToolFailed(
  conversationId: string,
  toolName: string,
  error: string
) {
  return logActivity(
    conversationId,
    "TOOL_FAILED",
    `Failed: ${toolName}`,
    { error }
  );
}

/**
 * Log a message sent by the assistant
 */
export async function logMessageSent(
  conversationId: string,
  preview?: string
) {
  return logActivity(
    conversationId,
    "MESSAGE_SENT",
    "Assistant sent a message",
    preview ? { preview: preview.slice(0, 100) } : undefined
  );
}

/**
 * Log a message received from the user
 */
export async function logMessageReceived(
  conversationId: string,
  preview?: string
) {
  return logActivity(
    conversationId,
    "MESSAGE_RECEIVED",
    "User sent a message",
    preview ? { preview: preview.slice(0, 100) } : undefined
  );
}

/**
 * Log an email sent
 */
export async function logEmailSent(
  conversationId: string,
  to: string,
  subject: string
) {
  return logActivity(
    conversationId,
    "EMAIL_SENT",
    `Email sent to ${to}`,
    { to, subject }
  );
}

/**
 * Log a calendar event created
 */
export async function logCalendarEventCreated(
  conversationId: string,
  title: string,
  start: string
) {
  return logActivity(
    conversationId,
    "CALENDAR_EVENT_CREATED",
    `Created event: ${title}`,
    { title, start }
  );
}

/**
 * Log a Slack message sent
 */
export async function logSlackMessageSent(
  conversationId: string,
  channel: string
) {
  return logActivity(
    conversationId,
    "SLACK_MESSAGE_SENT",
    `Message sent to Slack`,
    { channel }
  );
}

/**
 * Log a knowledge base search
 */
export async function logKnowledgeSearched(
  conversationId: string,
  query: string,
  resultsCount: number
) {
  return logActivity(
    conversationId,
    "KNOWLEDGE_SEARCHED",
    `Searched knowledge base`,
    { query: query.slice(0, 100), resultsCount }
  );
}

/**
 * Log agent delegation
 */
export async function logAgentDelegated(
  conversationId: string,
  targetAgentName: string
) {
  return logActivity(
    conversationId,
    "AGENT_DELEGATED",
    `Delegated to ${targetAgentName}`,
    { targetAgent: targetAgentName }
  );
}

/**
 * Log an error
 */
export async function logError(
  conversationId: string,
  error: string
) {
  return logActivity(
    conversationId,
    "ERROR_OCCURRED",
    "An error occurred",
    { error }
  );
}

/**
 * Log a memory update
 */
export async function logMemoryUpdated(
  conversationId: string,
  key: string,
  category?: string
) {
  return logActivity(
    conversationId,
    "MEMORY_UPDATED",
    `Memory updated: ${key}`,
    { key, category }
  );
}
