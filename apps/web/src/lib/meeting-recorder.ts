import prisma from "./db";
import { Anthropic } from "@anthropic-ai/sdk";

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

  const participants = (recording.participants as string[]) || [];

  // Generate MEDDPICC-structured analysis + summary + action items
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: `You are a sales meeting analyst using the MEDDPICC framework.

Analyze the transcript and provide a structured JSON response:

{
  "summary": "2-3 paragraph summary of the meeting",
  "meddpicc": {
    "metrics": "Quantifiable measures of success mentioned",
    "economicBuyer": "Who has budget authority",
    "decisionCriteria": "What factors drive their decision",
    "decisionProcess": "Steps/timeline to close",
    "paperProcess": "Legal/procurement steps",
    "identifiedPain": "Core problems they're solving",
    "champion": "Internal advocate",
    "competition": "Other solutions mentioned"
  },
  "keyMoments": {
    "objections": ["List of objections raised"],
    "buyingSignals": ["Positive signals detected"],
    "commitments": ["Commitments made by either side"],
    "concerns": ["Red flags or concerns"]
  },
  "decisions": ["Key decisions made"],
  "actionItems": [{"task": "...", "assignee": "...", "dueDate": "..."}],
  "followUps": ["Follow-up items"],
  "nextSteps": "Agreed-upon next steps"
}

Only include information actually discussed in the meeting. Do not fabricate details.
If a MEDDPICC field was not discussed, set it to null.`,
    messages: [{
      role: "user",
      content: `Meeting: ${recording.title}\nParticipants: ${participants.join(", ")}\n\nTranscript:\n${transcript.slice(0, 30000)}`,
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
