"use server";

import { getRealtimeToken, type RealtimeToken } from "@/queue/realtime-stub";

export type GoogleFormTriggerToken = RealtimeToken;

export async function fetchGoogleFormTriggerRealtimeToken():
Promise<GoogleFormTriggerToken> {
    const token = await getRealtimeToken({
        channel: "google-form-trigger",
        topics: ["status"]
    });

    return token;
}