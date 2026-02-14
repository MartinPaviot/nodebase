"use server";

import { getRealtimeToken, type RealtimeToken } from "@/queue/realtime-stub";

export type DiscordToken = RealtimeToken;

export async function fetchDiscordRealtimeToken() {
    return getRealtimeToken({ channel: "discord", topics: ["status"] });
}
