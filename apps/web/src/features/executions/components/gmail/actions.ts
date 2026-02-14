"use server";

import { getRealtimeToken, type RealtimeToken } from "@/queue/realtime-stub";

export type GmailToken = RealtimeToken;

export async function fetchGmailRealtimeToken() {
    return getRealtimeToken({ channel: "gmail", topics: ["status"] });
}
