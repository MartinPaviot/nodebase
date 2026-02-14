/**
 * Calendar Trigger Worker
 *
 * Polls Google Calendar for upcoming events and triggers
 * workflows that have CALENDAR_TRIGGER nodes.
 * Runs as a BullMQ repeatable job every 60 seconds.
 */

import { Queue, Worker } from "bullmq";
import { getRedisConnection } from "./bullmq/config";
import prisma from "@/lib/db";
import { listEvents } from "@/lib/integrations/google";
import { executeWorkflowV2 } from "@/lib/workflow-executor-v2";

const QUEUE_NAME = "calendar-triggers";
const JOB_NAME = "check-calendar-events";
const POLL_INTERVAL_MS = 60000; // 60 seconds

// Track processed events to avoid duplicates (in-memory, resets on restart)
const processedEvents = new Set<string>();

let calendarQueue: Queue | null = null;

function getCalendarQueue(): Queue {
  if (!calendarQueue) {
    calendarQueue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return calendarQueue;
}

/**
 * Schedule the repeatable calendar check job.
 * Call this once at app startup.
 */
export async function scheduleCalendarTrigger(): Promise<void> {
  const queue = getCalendarQueue();

  // Remove old repeatable job if exists
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === JOB_NAME) {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  // Add new repeatable job
  await queue.add(
    JOB_NAME,
    {},
    {
      repeat: {
        every: POLL_INTERVAL_MS,
      },
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 50 },
    }
  );

  console.log(`[CalendarTrigger] Scheduled polling every ${POLL_INTERVAL_MS / 1000}s`);
}

/**
 * Calendar trigger worker - processes the repeatable job.
 */
export const calendarTriggerWorker = new Worker(
  QUEUE_NAME,
  async () => {
    await checkCalendarEvents();
  },
  {
    connection: getRedisConnection(),
    concurrency: 1, // Only one calendar check at a time
  }
);

/**
 * Check all agents with calendar triggers for upcoming events.
 */
async function checkCalendarEvents(): Promise<void> {
  // Find all agents that have workflows with CALENDAR_TRIGGER nodes
  const agentsWithCalendarTrigger = await prisma.agent.findMany({
    where: {
      agentTools: {
        some: {
          workflow: {
            nodes: {
              some: { type: "CALENDAR_TRIGGER" },
            },
          },
        },
      },
    },
    include: {
      agentTools: {
        include: {
          workflow: {
            include: {
              nodes: true,
            },
          },
        },
      },
    },
  });

  // Also find workflows that directly have calendar triggers
  const workflowsWithCalendarTrigger = await prisma.workflow.findMany({
    where: {
      nodes: {
        some: { type: "CALENDAR_TRIGGER" },
      },
    },
    include: {
      nodes: {
        where: { type: "CALENDAR_TRIGGER" },
      },
    },
  });

  for (const workflow of workflowsWithCalendarTrigger) {
    const triggerNode = workflow.nodes[0];
    if (!triggerNode) continue;

    const nodeData = triggerNode.data as Record<string, unknown>;
    const minutesOffset = (nodeData.minutesOffset as number) ?? -1;

    try {
      // Fetch upcoming events for the next 2 minutes
      const now = new Date();
      const windowStart = new Date(now.getTime() + minutesOffset * 60000);
      const windowEnd = new Date(windowStart.getTime() + 2 * 60000);

      const events = await listEvents(workflow.userId, windowStart, windowEnd);

      if (!events || events.length === 0) continue;

      for (const event of events) {
        if (!event.id || !event.start?.dateTime) continue;

        // Deduplication key
        const dedupeKey = `${workflow.id}:${event.id}`;
        if (processedEvents.has(dedupeKey)) continue;

        // Check if event starts within our window
        const eventStart = new Date(event.start.dateTime);
        if (eventStart < windowStart || eventStart > windowEnd) continue;

        // Extract meeting URL
        const meetingUrl =
          event.hangoutLink ||
          event.conferenceData?.entryPoints?.find(
            (e) => e.entryPointType === "video"
          )?.uri;

        // Build calendar event context
        const calendarEvent = {
          id: event.id,
          title: event.summary || "Untitled Meeting",
          start: event.start.dateTime,
          end: event.end?.dateTime || event.start.dateTime,
          meetingUrl,
          attendees:
            event.attendees?.map((a) => ({
              email: a.email || "",
              displayName: a.displayName,
              organizer: a.organizer,
            })) || [],
          organizer: event.organizer
            ? { email: event.organizer.email || "" }
            : undefined,
        };

        // Mark as processed
        processedEvents.add(dedupeKey);

        console.log(
          `[CalendarTrigger] Triggering workflow ${workflow.id} for event "${calendarEvent.title}" (${event.id})`
        );

        // Execute the workflow with calendar event data
        executeWorkflowV2({
          workflowId: workflow.id,
          userId: workflow.userId,
          initialData: {
            calendarEvent,
            agentId: agentsWithCalendarTrigger.find(
              (a) => a.agentTools.some((t) => t.workflowId === workflow.id)
            )?.id,
          },
        }).catch((error) => {
          console.error(
            `[CalendarTrigger] Workflow ${workflow.id} execution failed:`,
            error
          );
        });
      }
    } catch (error) {
      console.error(
        `[CalendarTrigger] Failed to check events for workflow ${workflow.id}:`,
        error
      );
    }
  }

  // Clean up old dedup keys (keep last 1000)
  if (processedEvents.size > 1000) {
    const entries = [...processedEvents];
    const toRemove = entries.slice(0, entries.length - 1000);
    for (const key of toRemove) {
      processedEvents.delete(key);
    }
  }
}

/**
 * Remove the repeatable job and close the queue.
 */
export async function removeCalendarTrigger(): Promise<void> {
  const queue = getCalendarQueue();
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === JOB_NAME) {
      await queue.removeRepeatableByKey(job.key);
    }
  }
  await calendarTriggerWorker.close();
  await queue.close();
}
