"use server";

import { getRealtimeToken, type RealtimeToken } from "@/queue/realtime-stub";

export type CalendarTriggerToken = RealtimeToken;

export async function fetchCalendarTriggerRealtimeToken() {
    return getRealtimeToken({ channel: "calendar-trigger", topics: ["status"] });
}
