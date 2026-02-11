/**
 * Realtime Stub
 *
 * Temporary replacement for Inngest realtime tokens.
 * TODO: Implement proper SSE via Redis PubSub according to Pattern #7.
 */

export type RealtimeToken = {
  token: string;
  endpoint: string;
};

/**
 * Temporary stub for realtime tokens.
 * Returns a dummy token until we implement Redis PubSub + SSE.
 */
export async function getRealtimeToken(_config: {
  channel: string;
  topics: string[];
}): Promise<RealtimeToken> {
  // TODO: Implement Redis PubSub + SSE
  console.warn("[RealtimeStub] Realtime tokens not yet implemented - returning stub");

  return {
    token: "stub-token-" + Date.now(),
    endpoint: "/api/realtime/sse", // Will be implemented later
  };
}
