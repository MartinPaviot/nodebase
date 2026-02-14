import type { NodeExecutor } from "@/features/executions/types";
import { sendSlackDM } from "@/lib/integrations/slack";
import prisma from "@/lib/db";

type SlackDMData = {
  target?: "user_dm" | "channel";
  channelId?: string;
  messageTemplate?: "auto" | "custom";
  customMessage?: string;
};

/**
 * Slack DM Executor
 *
 * Sends the meeting notes and Google Doc link to the user via Slack DM.
 * Used in the Sales Meeting Recorder workflow after generating notes.
 */
export const slackDMExecutor: NodeExecutor<SlackDMData> = async ({
  data,
  context,
  userId,
}) => {
  // Get user email for Slack lookup
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (!user?.email) {
    throw new Error("User email not found. Cannot send Slack DM.");
  }

  const calendarEvent = context.calendarEvent as {
    title?: string;
  } | undefined;

  const documentUrl = context.documentUrl as string | undefined;
  const meetingTitle = calendarEvent?.title || "Sales Meeting";

  // Build message
  let message: string;

  if (data.messageTemplate === "custom" && data.customMessage) {
    message = data.customMessage;
  } else {
    // Auto-generate message
    const parts = [
      `📝 *Sales Notes Ready: ${meetingTitle}*`,
      "",
    ];

    if (context.summary) {
      parts.push(`*Summary:*`);
      parts.push(String(context.summary).slice(0, 500));
      parts.push("");
    }

    if (documentUrl) {
      parts.push(`📄 <${documentUrl}|View Full Notes in Google Docs>`);
      parts.push("");
    }

    // Add action items if available
    const actionItems = context.actionItems as Array<{ task: string; assignee?: string }> | undefined;
    if (actionItems && actionItems.length > 0) {
      parts.push("*Action Items:*");
      for (const item of actionItems.slice(0, 5)) {
        const assignee = item.assignee ? ` (${item.assignee})` : "";
        parts.push(`• ${item.task}${assignee}`);
      }
      if (actionItems.length > 5) {
        parts.push(`_...and ${actionItems.length - 5} more_`);
      }
    }

    message = parts.join("\n");
  }

  // Send DM to user
  await sendSlackDM(userId, user.email, message);

  return {
    ...context,
    slackNotificationSent: true,
  };
};
