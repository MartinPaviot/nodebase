"use server";

import { getRealtimeToken, type RealtimeToken } from "@/queue/realtime-stub";

export type HttpRequestToken = RealtimeToken;

export async function fetchHttpRequestRealtimeToken() {
    return getRealtimeToken({ channel: "http-request", topics: ["status"] });
}
