import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getBotTranscript, formatTranscript } from "@/lib/recall-ai";
import { processTranscript, updateMeetingRecordingStatus } from "@/lib/meeting-recorder";
import { resumeWorkflow } from "@/lib/workflow-executor-v2";

/**
 * Recall.ai Webhook Handler
 *
 * Receives bot status change events from Recall.ai.
 * When a bot finishes recording, fetches the transcript,
 * processes it, and resumes the paused workflow.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verify webhook secret
    const secret = request.headers.get("x-recall-webhook-secret");
    if (secret !== process.env.RECALL_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
    }

    const { event, data: eventData } = body;

    switch (event) {
      case "bot.status_change": {
        const { bot_id, status } = eventData;

        // Find the recording by external bot ID
        const recording = await prisma.meetingRecording.findFirst({
          where: { externalBotId: bot_id },
        });

        if (!recording) {
          console.warn(`Recall.ai webhook: No recording found for bot ${bot_id}`);
          return NextResponse.json({ ok: true, message: "No recording found" });
        }

        switch (status.code) {
          case "joining_call":
            await updateMeetingRecordingStatus(recording.id, "JOINING");
            break;

          case "in_call_recording":
            await updateMeetingRecordingStatus(recording.id, "RECORDING", {
              startedAt: new Date(),
            });
            break;

          case "call_ended":
          case "done":
            // Bot finished - fetch transcript and process
            await updateMeetingRecordingStatus(recording.id, "PROCESSING");

            try {
              // Fetch transcript from Recall.ai
              const segments = await getBotTranscript(bot_id);
              const transcript = formatTranscript(segments);

              // Process transcript with MEDDPICC analysis
              const result = await processTranscript(recording.id, transcript);

              // Calculate duration
              const duration = recording.startedAt
                ? Math.round((Date.now() - recording.startedAt.getTime()) / 60000)
                : undefined;

              await updateMeetingRecordingStatus(recording.id, "COMPLETED", {
                endedAt: new Date(),
                duration,
              });

              // Resume paused workflow if one is linked
              if (recording.workflowExecutionId) {
                console.log(
                  `Resuming workflow execution ${recording.workflowExecutionId} after recording ${recording.id}`
                );

                // Inject transcript data into the execution context before resume
                const execution = await prisma.execution.findUnique({
                  where: { id: recording.workflowExecutionId },
                });

                if (execution) {
                  const output = execution.output as Record<string, unknown> || {};
                  const currentContext = (output.currentContext as Record<string, unknown>) || {};

                  // Merge transcript data into context
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

                  await resumeWorkflow({
                    executionId: recording.workflowExecutionId,
                  });
                }
              }
            } catch (error) {
              console.error(`Failed to process recording ${recording.id}:`, error);
              await updateMeetingRecordingStatus(recording.id, "FAILED");
            }
            break;

          case "fatal":
            await updateMeetingRecordingStatus(recording.id, "FAILED");
            break;

          default:
            console.log(`Recall.ai webhook: Unhandled status ${status.code} for bot ${bot_id}`);
        }

        break;
      }

      default:
        console.log(`Recall.ai webhook: Unhandled event type ${event}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Recall.ai webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
