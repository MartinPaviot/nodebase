"use server";

import { getRealtimeToken, type RealtimeToken } from "@/queue/realtime-stub";

export type AnthropicToken = RealtimeToken;

export async function fetchAnthropicRealtimeToken() {
    return getRealtimeToken({ channel: "anthropic", topics: ["status"] });
}
