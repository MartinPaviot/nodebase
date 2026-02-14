"use server";

import { getRealtimeToken, type RealtimeToken } from "@/queue/realtime-stub";

export type GeminiToken = RealtimeToken;

export async function fetchGeminiRealtimeToken() {
    return getRealtimeToken({ channel: "gemini", topics: ["status"] });
}
