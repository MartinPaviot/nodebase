"use server";

import { getRealtimeToken, type RealtimeToken } from "@/queue/realtime-stub";

export type SlackToken = RealtimeToken;

export async function fetchSlackRealtimeToken() {
    return getRealtimeToken({ channel: "slack", topics: ["status"] });
}
