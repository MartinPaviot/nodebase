import type { NodeExecutor } from "@/features/executions/types";
import { Anthropic } from "@anthropic-ai/sdk";
import prisma from "@/lib/db";
import { ActivityType } from "@prisma/client";

type GmailData = {
  requireConfirmation?: boolean;
  toSource?: "external_attendee" | "manual";
  bccSource?: "user_email" | "none";
  subjectTemplate?: string;
  bodyPrompt?: string;
  saveDraft?: boolean;
};

/**
 * Gmail Draft Executor
 *
 * Uses Claude to draft a follow-up email to the prospect based on
 * the meeting transcript and notes. When requireConfirmation is true,
 * creates an approval activity instead of sending directly.
 */
export const gmailExecutor: NodeExecutor<GmailData> = async ({
  data,
  context,
  userId,
}) => {
  const calendarEvent = context.calendarEvent as {
    title?: string;
    attendees?: Array<{ email: string; displayName?: string; organizer?: boolean }>;
    organizer?: { email: string };
  } | undefined;

  // Resolve recipient email
  let recipientEmail: string | undefined;

  if (data.toSource === "external_attendee" || !data.toSource) {
    const organizerDomain = calendarEvent?.organizer?.email?.split("@")[1] || "";
    const externalAttendee = calendarEvent?.attendees?.find(
      (a) => a.email && organizerDomain && !a.email.endsWith(`@${organizerDomain}`)
    );
    recipientEmail = externalAttendee?.email;
  }

  if (!recipientEmail) {
    throw new Error("Could not determine recipient email for follow-up.");
  }

  // Get user email for BCC
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  const userEmail = user?.email || "";
  const userName = user?.name || "";

  // Generate email using Claude
  const emailData = await generateFollowUpEmail({
    transcript: context.transcript as string | undefined,
    summary: context.summary as string | undefined,
    notesContent: context.notesContent as string | undefined,
    meetingTitle: calendarEvent?.title || "our meeting",
    recipientName: calendarEvent?.attendees?.find(
      (a) => a.email === recipientEmail
    )?.displayName || recipientEmail.split("@")[0],
    senderName: userName,
    subjectTemplate: data.subjectTemplate,
    bodyPrompt: data.bodyPrompt,
  });

  const requireConfirmation = data.requireConfirmation ?? true;

  if (requireConfirmation) {
    // Create approval activity - email won't be sent until user confirms
    const agentId = context.agentId as string;

    // Find or create a conversation for this agent run
    let conversationId = context.conversationId as string | undefined;

    if (!conversationId) {
      const conversation = await prisma.conversation.create({
        data: {
          agentId,
          title: `Meeting follow-up: ${calendarEvent?.title || "Sales Meeting"}`,
          source: "WEBHOOK",
        },
      });
      conversationId = conversation.id;
    }

    await prisma.conversationActivity.create({
      data: {
        conversationId,
        type: ActivityType.CONFIRMATION_REQUESTED,
        title: `Draft follow-up email to ${recipientEmail}`,
        details: {
          actionType: "send_email",
          actionArgs: {
            to: recipientEmail,
            subject: emailData.subject,
            body: emailData.body,
            bcc: data.bccSource === "user_email" ? userEmail : undefined,
          },
          meetingTitle: calendarEvent?.title,
          recipientName: emailData.recipientName,
        },
        requiresConfirmation: true,
      },
    });

    return {
      ...context,
      emailDrafted: true,
      emailTo: recipientEmail,
      emailSubject: emailData.subject,
      conversationId,
    };
  }

  // Auto-send (not used in the Sales Meeting Recorder, but supported)
  const { sendEmail } = await import("@/lib/integrations/google");
  await sendEmail(userId, recipientEmail, emailData.subject, emailData.body);

  return {
    ...context,
    emailSent: true,
    emailTo: recipientEmail,
    emailSubject: emailData.subject,
  };
};

async function generateFollowUpEmail(params: {
  transcript?: string;
  summary?: string;
  notesContent?: string;
  meetingTitle: string;
  recipientName: string;
  senderName: string;
  subjectTemplate?: string;
  bodyPrompt?: string;
}): Promise<{ subject: string; body: string; recipientName: string }> {
  const anthropic = new Anthropic();

  const bodyPrompt =
    params.bodyPrompt ||
    `Your task is to draft a concise follow-up email to your prospect, based on the context of their call.

The email should be succinct and highly relevant to the prospect.

Here is an example email:

"Hey $FIRSTNAME, awesome to catch up just now!

Glad we could review your current outbound process and identify where LinkedIn messaging is falling short. Reply rates are dropping these days, and you're not the only company feeling that!

Excited for you to trial Kondo this week—I look forward to touching base on Thursday, the 12th at 9:00 AM PST, to debrief on how the trial went.

As promised, I'll have our CTO send over our SOC2 Compliance and will check in on Tuesday to ensure your team has everything they need.

Thanks again and looking forward to hearing from you."

Note: next steps should always be mentioned in the email. Personalize the email where you see fit.`;

  const contextStr = [
    params.summary ? `Meeting summary:\n${params.summary}` : "",
    params.notesContent ? `Notes:\n${params.notesContent.slice(0, 3000)}` : "",
    params.transcript ? `Transcript excerpt:\n${params.transcript.slice(0, 3000)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: `You are a sales follow-up email writer. ${bodyPrompt}

Output as JSON: { "subject": "...", "body": "..." }
The subject should be a 2-3 word summary of the call followed by " - Follow Up".
The body should be the email text only (no subject line, no "Subject:" prefix).
Address the recipient as ${params.recipientName}.
Sign off as ${params.senderName}.`,
    messages: [
      {
        role: "user",
        content: `Write a follow-up email for this meeting:\n\nMeeting: ${params.meetingTitle}\nRecipient: ${params.recipientName}\n\n${contextStr}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "{}";

  try {
    const parsed = JSON.parse(text);
    return {
      subject: parsed.subject || `${params.meetingTitle} - Follow Up`,
      body: parsed.body || text,
      recipientName: params.recipientName,
    };
  } catch {
    // Fallback if JSON parsing fails
    return {
      subject: `${params.meetingTitle} - Follow Up`,
      body: text,
      recipientName: params.recipientName,
    };
  }
}
