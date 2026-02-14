"use server";

import { getRealtimeToken, type RealtimeToken } from "@/queue/realtime-stub";

export type MeetingRecorderToken = RealtimeToken;

export async function fetchMeetingRecorderRealtimeToken() {
    return getRealtimeToken({ channel: "meeting-recorder", topics: ["status"] });
}
