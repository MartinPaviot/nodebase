import type { NodeExecutor } from "@/features/executions/types";

type CalendarTriggerData = {
  minutesOffset?: number;
  restrictByAttendee?: "all" | "external_only" | "internal_only";
};

/**
 * Calendar Trigger Executor
 *
 * Receives calendar event data as initialData from the trigger system.
 * Extracts event details and passes them to the workflow context.
 */
export const calendarTriggerExecutor: NodeExecutor<CalendarTriggerData> = async ({
  context,
}) => {
  // Calendar event data is passed via initialData -> context
  // by the calendar trigger worker when it dispatches the workflow
  const calendarEvent = context.calendarEvent as {
    id: string;
    title: string;
    start: string;
    end: string;
    meetingUrl?: string;
    attendees: Array<{ email: string; displayName?: string; organizer?: boolean }>;
    organizer?: { email: string };
  } | undefined;

  if (!calendarEvent) {
    return {
      ...context,
      calendarEvent: {
        id: "manual",
        title: "Manual trigger",
        start: new Date().toISOString(),
        end: new Date().toISOString(),
        meetingUrl: context.meetingUrl as string | undefined,
        attendees: [],
      },
    };
  }

  return {
    ...context,
    calendarEvent,
  };
};
