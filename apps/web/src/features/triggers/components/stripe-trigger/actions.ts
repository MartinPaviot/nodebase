"use server";

import { getRealtimeToken, type RealtimeToken } from "@/queue/realtime-stub";

export type StripeTriggerToken = RealtimeToken;

export async function fetchstripeTriggerRealtimeToken():
Promise<StripeTriggerToken> {
    const token = await getRealtimeToken({
        channel: "stripe-trigger",
        topics: ["status"]
    });

    return token;
}