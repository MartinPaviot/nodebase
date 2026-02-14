import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { processTranscript } from "@/lib/meeting-recorder";
import { resumeWorkflow } from "@/lib/workflow-executor-v2";

// This webhook receives transcripts from recording services (Recall.ai, etc.)
// It also supports resuming paused workflows after transcript processing.
export async function POST(request: NextRequest) {
  const { recordingId, transcript, secret } = await request.json();

  // Verify webhook secret
  if (secret !== process.env.MEETING_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  try {
    const result = await processTranscript(recordingId, transcript);

    // Check if there's a paused workflow to resume
    const recording = await prisma.meetingRecording.findUnique({
      where: { id: recordingId },
      select: { workflowExecutionId: true },
    });

    if (recording?.workflowExecutionId) {
      // Inject transcript data into context before resuming
      const execution = await prisma.execution.findUnique({
        where: { id: recording.workflowExecutionId },
      });

      if (execution) {
        const output = (execution.output as Record<string, unknown>) || {};
        const currentContext = (output.currentContext as Record<string, unknown>) || {};

        await prisma.execution.update({
          where: { id: recording.workflowExecutionId },
          data: {
            output: {
              ...output,
              currentContext: {
                ...currentContext,
                transcript,
                summary: result.summary,
                actionItems: result.actionItems,
                meddpicc: result.meddpicc,
                keyMoments: result.keyMoments,
                nextSteps: result.nextSteps,
              },
            },
          },
        });

        await resumeWorkflow({ executionId: recording.workflowExecutionId });
      }
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Failed to process transcript:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
