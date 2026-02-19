/**
 * Agent Flow Executor API Route
 *
 * POST /api/agents/flow/execute
 *
 * Executes an agent's flow graph (nodes + edges) sequentially,
 * following the edges to determine execution order.
 * Streams execution state via SSE for real-time animation.
 *
 * Delegates to the flow-executor module for all execution logic.
 */

import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { MessageRole } from "@prisma/client";
import { headers } from "next/headers";
import { z } from "zod";
import { executeFlow, type FlowSSEEvent, type NodeOutput } from "@/lib/flow-executor";
import type { ConversationContext, AgentMemoryEntry } from "@/lib/flow-executor/types";

export const maxDuration = 300; // 5 minutes

// ============================================
// REQUEST VALIDATION
// ============================================

const RequestSchema = z.object({
  agentId: z.string(),
  flowData: z.object({
    nodes: z.array(
      z.object({
        id: z.string(),
        type: z.string(),
        position: z.object({ x: z.number(), y: z.number() }),
        data: z.record(z.unknown()).optional(),
      }),
    ),
    edges: z.array(
      z.object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
        sourceHandle: z.string().optional().nullable(),
        targetHandle: z.string().optional().nullable(),
      }),
    ),
  }),
  userMessage: z.string().optional().default(""),
  conversationId: z.string().optional(),
  retryFromNodeId: z.string().optional(),
  previousNodeOutputs: z.record(z.unknown()).optional(),
});

// ============================================
// POST HANDLER
// ============================================

export async function POST(request: Request) {
  try {
    // Authenticate
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { agentId, flowData, userMessage, conversationId, retryFromNodeId, previousNodeOutputs } =
      RequestSchema.parse(body);

    // Load agent
    const agent = await prisma.agent.findUnique({
      where: { id: agentId, userId: session.user.id },
    });

    if (!agent) {
      return new Response("Agent not found", { status: 404 });
    }

    // Save user message to conversation (skip on retry — already saved)
    if (conversationId && userMessage && !retryFromNodeId) {
      await prisma.message.create({
        data: {
          conversationId,
          role: MessageRole.USER,
          content: userMessage,
        },
      });
    }

    // Load conversation context and agent memories for flow nodes
    let conversationContext: ConversationContext | undefined;
    let agentMemories: AgentMemoryEntry[] | undefined;

    if (conversationId) {
      const [conversationMessages, memories] = await Promise.all([
        prisma.message.findMany({
          where: { conversationId },
          orderBy: { createdAt: "asc" },
          take: 20,
          select: { role: true, content: true, toolName: true },
        }),
        prisma.agentMemory.findMany({
          where: { agentId },
          select: { key: true, value: true, category: true },
        }),
      ]);

      if (conversationMessages.length > 0) {
        conversationContext = {
          recentMessages: conversationMessages.map(m => ({
            role: m.role.toLowerCase() as "user" | "assistant" | "tool",
            content: m.content,
            toolName: m.toolName ?? undefined,
          })),
        };
      }

      if (memories.length > 0) {
        agentMemories = memories;
      }
    }

    // Create SSE stream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        // Collect results for persistence
        let completedNodes = 0;
        let errorNodes = 0;
        let skippedNodes = 0;
        let aiContent = "";
        let flowError: string | null = null;

        const emit = (event: FlowSSEEvent) => {
          // Track results
          if (event.type === "node-complete") {
            completedNodes++;
            if (event.output && "kind" in event.output && event.output.kind === "ai-response") {
              aiContent = (event.output as { content: string }).content;
            }
          } else if (event.type === "node-reused") {
            completedNodes++;
            if (event.output && "kind" in event.output && event.output.kind === "ai-response") {
              aiContent = (event.output as { content: string }).content;
            }
          } else if (event.type === "node-error") {
            errorNodes++;
          } else if (event.type === "node-skipped") {
            skippedNodes++;
          } else if (event.type === "flow-error") {
            flowError = event.error;
          }

          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
            );
          } catch {
            // Controller may be closed
          }
        };

        try {
          await executeFlow(flowData, {
            agent: {
              id: agent.id,
              systemPrompt: agent.systemPrompt,
              temperature: agent.temperature,
              evalRules: agent.evalRules,
              userId: session.user.id,
              workspaceId: agent.workspaceId,
            },
            userMessage,
            conversationId: conversationId ?? null,
            userId: session.user.id,
            conversationContext,
            agentMemories,
            ...(retryFromNodeId && previousNodeOutputs
              ? {
                  retryConfig: {
                    retryFromNodeId,
                    previousNodeOutputs: previousNodeOutputs as Record<string, NodeOutput>,
                  },
                }
              : {}),
          }, emit);
        } catch (error) {
          console.error("Flow execution error:", error);
          flowError = error instanceof Error ? error.message : "Flow execution failed";
          emit({
            type: "flow-error",
            error: flowError,
          });
        } finally {
          // Persist flow result as assistant message
          if (conversationId) {
            try {
              const summary = flowError
                ? `Flow failed: ${flowError}`
                : aiContent || `Flow completed. ${completedNodes} steps executed${errorNodes > 0 ? `, ${errorNodes} failed` : ""}${skippedNodes > 0 ? `, ${skippedNodes} skipped` : ""}.`;

              await prisma.message.create({
                data: {
                  conversationId,
                  role: MessageRole.ASSISTANT,
                  content: summary,
                },
              });
            } catch (saveErr) {
              console.warn("Failed to persist flow result message:", saveErr);
            }
          }

          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Flow execute route error:", error);

    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: error.errors }),
        { status: 400 },
      );
    }

    return new Response(
      error instanceof Error ? error.message : "Internal server error",
      { status: 500 },
    );
  }
}
