import type { NodeExecutor } from "@/features/executions/types";
import { Anthropic } from "@anthropic-ai/sdk";
import { createDocInFolder } from "@/lib/integrations/google";

type GoogleDocsData = {
  template?: "meddpicc" | "generic";
  sharingPreference?: "private" | "anyone_with_link";
  folderId?: string;
};

/**
 * Google Docs Executor
 *
 * Generates structured sales notes from meeting transcript using Claude,
 * then creates a Google Doc with the content in the user's specified folder.
 */
export const googleDocsExecutor: NodeExecutor<GoogleDocsData> = async ({
  data,
  context,
  userId,
}) => {
  const transcript = context.transcript as string | undefined;
  const summary = context.summary as string | undefined;
  const calendarEvent = context.calendarEvent as {
    title?: string;
    start?: string;
    attendees?: Array<{ email: string; displayName?: string }>;
  } | undefined;

  if (!transcript && !summary) {
    throw new Error("No transcript or summary available to generate notes.");
  }

  // Generate MEDDPICC notes using Claude
  const template = data.template || "meddpicc";
  const notesContent = await generateNotes(template, {
    transcript: transcript || "",
    summary: summary || "",
    title: calendarEvent?.title || "Sales Meeting",
    date: calendarEvent?.start || new Date().toISOString(),
    attendees: calendarEvent?.attendees || [],
  });

  // Create document title
  const dateStr = new Date(calendarEvent?.start || Date.now()).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const docTitle = `${calendarEvent?.title || "Sales Meeting"} - Notes (${dateStr})`;

  // Get folder from node data or agent config
  const folderId = data.folderId || (context.notesFolderId as string | undefined);

  // Create Google Doc with content in folder
  const { documentId, documentUrl } = await createDocInFolder(
    userId,
    docTitle,
    notesContent,
    folderId
  );

  return {
    ...context,
    documentId,
    documentUrl,
    notesContent,
  };
};

async function generateNotes(
  template: string,
  data: {
    transcript: string;
    summary: string;
    title: string;
    date: string;
    attendees: Array<{ email: string; displayName?: string }>;
  }
): Promise<string> {
  const anthropic = new Anthropic();

  const attendeeList = data.attendees
    .map((a) => a.displayName || a.email)
    .join(", ");

  const systemPrompt =
    template === "meddpicc"
      ? getMEDDPICCPrompt()
      : getGenericPrompt();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Meeting: ${data.title}
Date: ${data.date}
Attendees: ${attendeeList}

${data.summary ? `Summary:\n${data.summary}\n\n` : ""}Transcript:
${data.transcript.slice(0, 30000)}`,
      },
    ],
  });

  return response.content[0].type === "text"
    ? response.content[0].text
    : "Failed to generate notes.";
}

function getMEDDPICCPrompt(): string {
  return `You are a sales meeting note-taker. Analyze the meeting transcript and generate structured notes using the MEDDPICC framework.

Output the notes in clean Markdown format with the following sections:

# [Meeting Title] - Sales Notes

## Meeting Details
- **Date:** [date]
- **Attendees:** [list]
- **Duration:** [estimated from transcript]

## MEDDPICC Analysis

### Metrics
Quantifiable measures of success the prospect mentioned. ROI expectations, KPIs, benchmarks.

### Economic Buyer
Who has the budget authority? Were they present? What's their role?

### Decision Criteria
What factors will drive their decision? Technical requirements, pricing, timeline, features.

### Decision Process
Steps and timeline to close. Who else needs to be involved? What approvals are needed?

### Paper Process
Legal, procurement, security review steps. Contract requirements.

### Identified Pain
Core problems they're trying to solve. Business impact of the status quo.

### Champion
Internal advocate. Who is pushing for this solution? Their influence level.

### Competition
Other solutions mentioned. Incumbent tools. Evaluation criteria.

## Key Moments
- Objections raised and how they were handled
- Buying signals detected
- Commitments made by both sides
- Red flags or concerns

## Action Items
List each action item with assignee and due date (if mentioned):
- [ ] [Assignee] - [Task] (Due: [date if mentioned])

## Next Steps
Agreed-upon next steps and follow-up plan.

Be thorough but concise. Use bullet points. Only include information that was actually discussed in the meeting - do not fabricate details.`;
}

function getGenericPrompt(): string {
  return `You are a meeting note-taker. Analyze the transcript and generate structured meeting notes in Markdown format.

Include:
# [Meeting Title] - Notes
## Summary (2-3 paragraphs)
## Key Discussion Points
## Decisions Made
## Action Items (with assignees)
## Next Steps

Be thorough but concise.`;
}
