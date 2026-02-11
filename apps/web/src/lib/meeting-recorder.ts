import prisma from "./db";
import { Anthropic } from "@anthropic-ai/sdk";

// Note: In production, you'd use Recall.ai, Assembly AI, or similar
// For now, we'll create the infrastructure that can be connected later

export async function scheduleMeetingRecording(agentId: string, data: {
  title: string;
  meetingUrl: string;
  scheduledAt: Date;
  platform?: string;
}) {
  // Detect platform from URL
  let platform: "ZOOM" | "GOOGLE_MEET" | "MICROSOFT_TEAMS" | "OTHER" = "OTHER";
  if (data.meetingUrl.includes("zoom.us")) platform = "ZOOM";
  else if (data.meetingUrl.includes("meet.google.com")) platform = "GOOGLE_MEET";
  else if (data.meetingUrl.includes("teams.microsoft.com")) platform = "MICROSOFT_TEAMS";

  return prisma.meetingRecording.create({
    data: {
      agentId,
      title: data.title,
      meetingUrl: data.meetingUrl,
      meetingPlatform: platform,
      scheduledAt: data.scheduledAt,
    },
  });
}

export async function processTranscript(recordingId: string, transcript: string) {
  const recording = await prisma.meetingRecording.findUnique({
    where: { id: recordingId },
    include: { agent: true },
  });

  if (!recording) throw new Error("Recording not found");

  const anthropic = new Anthropic();

  // Generate summary and action items
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: `You are a meeting summarizer. Analyze the transcript and provide:
1. A concise summary (2-3 paragraphs)
2. Key decisions made
3. Action items with assignees if mentioned
4. Follow-up items

Output as JSON:
{
  "summary": "...",
  "decisions": ["..."],
  "actionItems": [{"task": "...", "assignee": "...", "dueDate": "..."}],
  "followUps": ["..."]
}`,
    messages: [{
      role: "user",
      content: `Meeting: ${recording.title}\n\nTranscript:\n${transcript}`,
    }],
  });

  const resultText = response.content[0].type === "text"
    ? response.content[0].text
    : "{}";

  let parsed;
  try {
    parsed = JSON.parse(resultText);
  } catch {
    parsed = { summary: resultText, actionItems: [] };
  }

  await prisma.meetingRecording.update({
    where: { id: recordingId },
    data: {
      transcript,
      summary: parsed.summary,
      actionItems: parsed.actionItems || [],
      status: "COMPLETED",
      endedAt: new Date(),
    },
  });

  return parsed;
}

export async function syncCalendarMeetings(agentId: string, userId: string) {
  // Get upcoming calendar events
  const { listEvents } = await import("./integrations/google");

  try {
    const events = await listEvents(userId, new Date(), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    if (!events) return [];

    const meetings = [];
    for (const event of events) {
      // Check if it has a video conference link
      const meetingUrl = event.hangoutLink ||
        event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri;

      if (meetingUrl && event.start?.dateTime) {
        // Check if already scheduled
        const existing = await prisma.meetingRecording.findFirst({
          where: {
            agentId,
            calendarEventId: event.id,
          },
        });

        if (!existing) {
          // Extract valid email addresses from attendees
          const participantEmails = event.attendees
            ?.map((a) => a.email)
            .filter((email): email is string => typeof email === "string") || [];

          const recording = await prisma.meetingRecording.create({
            data: {
              agentId,
              title: event.summary || "Untitled Meeting",
              meetingUrl,
              meetingPlatform: meetingUrl.includes("meet.google") ? "GOOGLE_MEET" : "OTHER",
              calendarEventId: event.id,
              scheduledAt: new Date(event.start.dateTime),
              participants: participantEmails,
            },
          });
          meetings.push(recording);
        }
      }
    }
    return meetings;
  } catch (error) {
    console.error("Failed to sync calendar:", error);
    return [];
  }
}

export async function getMeetingRecordings(agentId: string) {
  return prisma.meetingRecording.findMany({
    where: { agentId },
    orderBy: { scheduledAt: "desc" },
  });
}

export async function getMeetingRecording(id: string) {
  return prisma.meetingRecording.findUnique({
    where: { id },
  });
}

export async function deleteMeetingRecording(id: string) {
  return prisma.meetingRecording.delete({
    where: { id },
  });
}

export async function updateMeetingRecordingStatus(
  id: string,
  status: "SCHEDULED" | "JOINING" | "RECORDING" | "PROCESSING" | "COMPLETED" | "FAILED",
  additionalData?: {
    startedAt?: Date;
    endedAt?: Date;
    recordingUrl?: string;
    duration?: number;
  }
) {
  return prisma.meetingRecording.update({
    where: { id },
    data: {
      status,
      ...additionalData,
    },
  });
}
