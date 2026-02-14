import type { NodeExecutor } from "@/features/executions/types";
import prisma from "@/lib/db";
import { createBot } from "@/lib/recall-ai";
import { updateMeetingRecordingStatus } from "@/lib/meeting-recorder";

type MeetingRecorderData = {
  botName?: string;
  meetingUrlSource?: "calendarEvent" | "context" | "manual";
  joinMessage?: string;
};

/**
 * Meeting Recorder Executor (Recall.ai)
 *
 * Joins a meeting via Recall.ai, records and transcribes it.
 * Returns __pause: true to pause the workflow until the transcript
 * webhook fires and resumes execution.
 */
export const meetingRecorderExecutor: NodeExecutor<MeetingRecorderData> = async ({
  data,
  context,
  userId,
}) => {
  // Resolve meeting URL from context
  let meetingUrl: string | undefined;

  if (data.meetingUrlSource === "calendarEvent" || !data.meetingUrlSource) {
    const calendarEvent = context.calendarEvent as {
      meetingUrl?: string;
      id?: string;
      title?: string;
      attendees?: Array<{ email: string }>;
    } | undefined;
    meetingUrl = calendarEvent?.meetingUrl;
  } else if (data.meetingUrlSource === "context") {
    meetingUrl = context.meetingUrl as string | undefined;
  }

  if (!meetingUrl) {
    throw new Error("Meeting URL not found. Cannot record meeting without a valid URL.");
  }

  // Detect platform from URL
  let platform: "ZOOM" | "GOOGLE_MEET" | "MICROSOFT_TEAMS" | "OTHER" = "OTHER";
  if (meetingUrl.includes("zoom.us")) platform = "ZOOM";
  else if (meetingUrl.includes("meet.google.com")) platform = "GOOGLE_MEET";
  else if (meetingUrl.includes("teams.microsoft.com")) platform = "MICROSOFT_TEAMS";

  const calendarEvent = context.calendarEvent as {
    id?: string;
    title?: string;
    attendees?: Array<{ email: string; displayName?: string }>;
  } | undefined;

  const agentId = context.agentId as string;

  // Create MeetingRecording record
  const recording = await prisma.meetingRecording.create({
    data: {
      agentId,
      title: calendarEvent?.title || "Untitled Meeting",
      meetingUrl,
      meetingPlatform: platform,
      calendarEventId: calendarEvent?.id,
      scheduledAt: new Date(),
      participants: calendarEvent?.attendees?.map((a) => a.email) || [],
      status: "JOINING",
      workflowExecutionId: context.__executionId as string | undefined,
    },
  });

  // Create Recall.ai bot to join the meeting
  const botName = data.botName || "Nodebase Notetaker";
  const joinMessage =
    data.joinMessage ||
    "Nodebase is recording this meeting for notes and follow-up.";

  const bot = await createBot({
    meetingUrl,
    botName,
    joinMessage,
    metadata: {
      recordingId: recording.id,
      agentId,
      userId,
      workflowExecutionId: context.__executionId,
    },
  });

  // Store bot ID in recording
  await prisma.meetingRecording.update({
    where: { id: recording.id },
    data: {
      externalBotId: bot.id,
      status: "JOINING",
    },
  });

  await updateMeetingRecordingStatus(recording.id, "JOINING");

  console.log(
    `Recall.ai bot ${bot.id} joining meeting ${meetingUrl} for recording ${recording.id}`
  );

  // Return __pause to pause workflow until transcript is ready
  return {
    ...context,
    recordingId: recording.id,
    recallBotId: bot.id,
    meetingUrl,
    meetingPlatform: platform,
    __pause: true,
  };
};
