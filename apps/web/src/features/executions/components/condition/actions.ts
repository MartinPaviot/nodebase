"use server";

import { getRealtimeToken, type RealtimeToken } from "@/queue/realtime-stub";

export type ConditionToken = RealtimeToken;

export async function fetchConditionRealtimeToken() {
    return getRealtimeToken({ channel: "condition", topics: ["status"] });
}
