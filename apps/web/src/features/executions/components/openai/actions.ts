"use server";

import { getRealtimeToken, type RealtimeToken } from "@/queue/realtime-stub";

export type OpenAiToken = RealtimeToken;

export async function fetchOpenAiRealtimeToken() {
    return getRealtimeToken({ channel: "openai", topics: ["status"] });
}
