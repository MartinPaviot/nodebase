import { useState } from "react";
import type { NodeStatus } from "@/components/react-flow/node-status-indicator";

interface UseNodeStatusOptions {
    nodeId: string;
    channel: string;
    topic: string;
    refreshToken: () => Promise<unknown>;
}

/**
 * Stub: will be replaced with Redis PubSub + SSE.
 * For now returns "initial" — no live status updates.
 */
export function useNodeStatus(_options: UseNodeStatusOptions) {
    const [status] = useState<NodeStatus>("initial");
    return status;
}