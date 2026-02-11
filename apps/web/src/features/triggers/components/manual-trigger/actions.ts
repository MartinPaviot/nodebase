"use server";

import { getRealtimeToken, type RealtimeToken } from "@/queue/realtime-stub";

export type ManualTriggerToken = RealtimeToken;

export async function fetchManualTriggerRealtimeToken():
Promise<ManualTriggerToken> {
    const token = await getRealtimeToken({
        channel: "manual-trigger",
        topics: ["status"]
    });

    return token;
}