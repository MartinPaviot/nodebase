"use server";

import { getRealtimeToken, type RealtimeToken } from "@/queue/realtime-stub";

export type GoogleDocsToken = RealtimeToken;

export async function fetchGoogleDocsRealtimeToken() {
    return getRealtimeToken({ channel: "google-docs", topics: ["status"] });
}
