import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";
import { z } from "zod";
import { MessageRole } from "@prisma/client";
import { ClaudeClient, type ClaudeTool, type ClaudeToolResult, type StreamEvent, type ModelTier } from "@/lib/ai/claude-client";
import { type ToolDef, zodToInputSchema, toolMapToClaudeTools } from "@/lib/llm-tools";
import { AgentTracer } from "@elevay/core";
import { calculateCost, getPlatformApiKey } from "@/lib/config";
import {
  createFlowBuildingTools,
  createFlowDebugTools,
  createFlowPerformanceTools,
} from "./tools";
import type { FlowCommand, FlowStateSnapshot } from "@/features/agents/types/flow-builder-types";
import { generateSpecsForPrompt } from "@/features/agents/lib/node-type-specs";

export const maxDuration = 300;

// ============================================
// REQUEST SCHEMA
// ============================================

const FlowBuilderRequestSchema = z.object({
  conversationId: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
  agentId: z.string(),
  flowState: z.object({
    nodes: z.array(
      z.object({
        id: z.string(),
        type: z.string(),
        label: z.string(),
        position: z.object({ x: z.number(), y: z.number() }),
        data: z.record(z.unknown()).optional(),
      })
    ),
    edges: z.array(
      z.object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
        sourceHandle: z.string().optional(),
      })
    ),
    summary: z.string(),
  }),
});

// ============================================
// SYSTEM PROMPT BUILDER
// ============================================

interface BuilderContext {
  agent: { name: string; systemPrompt: string; description?: string | null; templateId?: string | null };
  flowState: FlowStateSnapshot;
  connectedIntegrations: string[];
  templateName?: string | null;
}

function buildFlowBuilderSystemPrompt(ctx: BuilderContext): string {
  const { agent, flowState, connectedIntegrations, templateName } = ctx;

  // Build integrations section
  const allIntegrations = [
    { type: "GMAIL", label: "Gmail" },
    { type: "GOOGLE_CALENDAR", label: "Google Calendar" },
    { type: "GOOGLE_SHEETS", label: "Google Sheets" },
    { type: "GOOGLE_DRIVE", label: "Google Drive" },
    { type: "GOOGLE_DOCS", label: "Google Docs" },
    { type: "OUTLOOK", label: "Outlook" },
    { type: "OUTLOOK_CALENDAR", label: "Outlook Calendar" },
    { type: "MICROSOFT_TEAMS", label: "Microsoft Teams" },
    { type: "SLACK", label: "Slack" },
    { type: "NOTION", label: "Notion" },
  ];

  const connected = allIntegrations.filter((i) => connectedIntegrations.includes(i.type));
  const notConnected = allIntegrations.filter((i) => !connectedIntegrations.includes(i.type));

  const integrationsSection = `## Connected Integrations
${connected.length > 0 ? connected.map((i) => `- ${i.label} (connected, ready to use)`).join("\n") : "- None connected yet"}
${notConnected.length > 0 ? `\n## Not Connected\n${notConnected.map((i) => `- ${i.label} (user must connect at /integrations)`).join("\n")}` : ""}`;

  // Generate node type specs dynamically from the registry
  const nodeTypeReference = generateSpecsForPrompt();

  return `You are the workflow builder for "${agent.name}". You build agent workflows visually by adding nodes to a canvas.

## How You Work
The user describes what they want in natural language. You build it step by step on the canvas.
Each tool call (add_node, connect_nodes, etc.) instantly updates the visual canvas — the user sees nodes appear in real time.

## Behavior Rules
1. **Mirror the user's language** — if they write in French, reply in French. If English, reply in English.
2. **Confirm before building** — briefly summarize what you'll create (2-3 bullet points), then build it.
3. **Build step by step** — add nodes one at a time with clear explanations. The user watches them appear.
4. **Suggest improvements** — after building, suggest 1-2 concrete next steps (e.g., "Want to add a validation step before sending?" or "Should I add error handling?").
5. **Check integrations** — if a node requires an integration that isn't connected, mention it: "This step needs Gmail. You can connect it at /integrations."
6. **Be concise** — use bullet points, not paragraphs. No filler text.
7. **Never delete the trigger** — the messageReceived node is required.
8. **Use get_flow_state first** — always check the current flow before making changes.
9. **For edits** — when the user says "change X", "update X", or "modify X", use update_node or replace_node. Don't rebuild from scratch.
10. **Always configure nodes fully** — when adding a node, ALWAYS set all required fields in the \`data\` parameter. Never leave a node empty.
11. **Validate after building** — after completing a workflow, call validate_flow to check for issues. Fix any errors before declaring the flow ready.

## Variable References
Use \`{{nodeId.output}}\` to reference the output of a previous node.
- \`{{trigger.message}}\` — the user's message that triggered the flow
- \`{{trigger.senderEmail}}\` — email sender (for email triggers)
- \`{{nodeId.output}}\` — the full output of any previous node (use the node's ID)

## Field Modes (for integration nodes)
Integration nodes (Gmail, Slack, etc.) support 3 modes per field via \`fieldModes\`:
- \`"manual"\` — use the value exactly as-is (fixed text, template variable)
- \`"prompt"\` — prefix the value with \`prompt:\` and the AI generates the content at runtime
- \`"auto"\` — the AI extracts the value from conversation context automatically

Example: \`{ to: "user@example.com", body: "prompt:Write a follow-up email", fieldModes: { to: "manual", body: "prompt" } }\`

## Node Type Reference

${nodeTypeReference}

## Workflow Patterns

### Email Processing Pattern
trigger → gmail (list/search) → agentStep (analyze) → condition (route) → gmail (send) / slack (notify)

### Lead Enrichment Pattern
trigger → peopleDataLabs (find person) → agentStep (analyze fit) → condition (qualified?) → gmail (send outreach) / slack (notify team)

### Customer Support Pattern
trigger → searchKnowledgeBase → agentStep (generate answer) → condition (confident?) → chatAgent (reply) / slack (escalate)

### Data Processing Pattern
trigger → googleSheets (read data) → loop (for each row) → agentStep (process) → googleSheets (update)

### Content Generation Pattern
trigger → agentStep (research/analyze) → agentStep (generate draft) → gmail (send) or googleDocs (create)

### Notification Pipeline Pattern
trigger → agentStep (summarize) → slack (send) + gmail (send)

## Current Flow
${flowState.summary}

${integrationsSection}
${templateName ? `\n## Template\nThis agent is based on the "${templateName}" template.` : ""}

## Agent Context
Name: ${agent.name}
${agent.description ? `Description: ${agent.description}` : ""}
${agent.systemPrompt ? `System prompt (excerpt): ${agent.systemPrompt.slice(0, 300)}${agent.systemPrompt.length > 300 ? "..." : ""}` : ""}`;
}

// ============================================
// POST HANDLER
// ============================================

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const parsed = FlowBuilderRequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: parsed.error.issues }),
        { status: 400 }
      );
    }

    const { conversationId, messages: incomingMessages, agentId, flowState } = parsed.data;

    // Get last user message
    const lastMessage = incomingMessages[incomingMessages.length - 1];
    if (!lastMessage || lastMessage.role !== "user") {
      return new Response("No user message found", { status: 400 });
    }
    const userMessage = lastMessage.content;

    // Load agent + user integrations + template in parallel
    const [agent, integrations, template] = await Promise.all([
      prisma.agent.findFirst({
        where: { id: agentId, userId: session.user.id },
      }),
      prisma.integration.findMany({
        where: { userId: session.user.id },
        select: { type: true },
      }),
      // Load template if agent has one
      prisma.agent.findFirst({
        where: { id: agentId },
        select: { templateId: true },
      }).then(async (a) => {
        if (!a?.templateId) return null;
        return prisma.agentTemplate.findUnique({
          where: { id: a.templateId },
          select: { name: true },
        });
      }),
    ]);

    if (!agent) {
      return new Response("Agent not found", { status: 404 });
    }

    const connectedIntegrations = integrations.map((i) => i.type);

    // Get platform API key
    const apiKey = getPlatformApiKey();

    // Save user message to DB
    await prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.USER,
        content: userMessage,
      },
    });

    // Load conversation history
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 50,
        },
      },
    });

    const messageHistory = (conversation?.messages || [])
      .filter((msg) => msg.role !== MessageRole.TOOL)
      .map((msg) => ({
        role: msg.role.toLowerCase() as "user" | "assistant",
        content: msg.content,
      }));

    // Build system prompt
    const systemPrompt = buildFlowBuilderSystemPrompt({
      agent,
      flowState,
      connectedIntegrations,
      templateName: template?.name,
    });

    // Initialize tracer
    const tracer = new AgentTracer(
      {
        agentId,
        userId: session.user.id,
        workspaceId: session.user.id,
        triggeredBy: "chat",
        conversationId,
        userMessage,
      },
      async (trace) => {
        try {
          await prisma.agentTrace.create({ data: trace });
        } catch (err) {
          console.warn("Failed to persist trace:", err);
        }
      }
    );

    // Build tools
    const encoder = new TextEncoder();
    let emitToController: ((event: unknown) => void) | null = null;

    const emitFlowCommand = (cmd: FlowCommand) => {
      if (emitToController) {
        emitToController({ type: "flow-command", command: cmd });
      }
    };

    const flowBuildingTools = createFlowBuildingTools(flowState, emitFlowCommand, connectedIntegrations);
    const flowDebugTools = createFlowDebugTools(agentId, session.user.id);
    const flowPerformanceTools = createFlowPerformanceTools(agentId, session.user.id, flowState);

    const toolMap: Record<string, ToolDef> = {
      ...flowBuildingTools,
      ...flowDebugTools,
      ...flowPerformanceTools,
    };

    const claudeTools: ClaudeTool[] = toolMapToClaudeTools(toolMap);

    // Initialize ClaudeClient
    const claudeClient = new ClaudeClient(apiKey);
    const llmTier: ModelTier = "smart";

    let assistantContent = "";

    // Create SSE stream
    const readable = new ReadableStream({
      async start(controller) {
        emitToController = (event: unknown) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            // Stream closed
          }
        };

        try {
          const streamGen = claudeClient.chatStream({
            model: llmTier,
            messages: messageHistory,
            systemPrompt,
            temperature: 0.3,
            maxSteps: 10,
            tools: claudeTools.length > 0 ? claudeTools : undefined,
            userId: session.user.id,
            agentId,
            conversationId,

            onStepComplete: async (aiEvent) => {
              try {
                tracer.logLLMCall({
                  model: aiEvent.model,
                  input: `Step ${aiEvent.stepNumber}`,
                  output: aiEvent.action,
                  tokensIn: aiEvent.tokensIn,
                  tokensOut: aiEvent.tokensOut,
                  cost: aiEvent.cost,
                  durationMs: aiEvent.latency,
                });
              } catch {
                // Ignore trace errors
              }
            },

            onToolCall: async (toolCall) => {
              const tool = toolMap[toolCall.name];
              if (!tool) {
                return {
                  tool_use_id: toolCall.id,
                  content: JSON.stringify({ error: true, message: `Unknown tool: ${toolCall.name}` }),
                  is_error: true,
                } satisfies ClaudeToolResult;
              }

              // Emit tool input to frontend
              emitToController?.({
                type: "tool-input-start",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
              });
              emitToController?.({
                type: "tool-input-available",
                toolCallId: toolCall.id,
                input: toolCall.input,
              });

              const startTime = Date.now();
              try {
                const result = await tool.execute(toolCall.input);

                tracer.logToolCall({
                  toolName: toolCall.name,
                  input: toolCall.input,
                  output: result,
                  durationMs: Date.now() - startTime,
                  success: !result.error,
                });

                // Emit tool output to frontend
                emitToController?.({
                  type: "tool-output-available",
                  toolCallId: toolCall.id,
                  output: result,
                });

                return {
                  tool_use_id: toolCall.id,
                  content: JSON.stringify(result),
                } satisfies ClaudeToolResult;
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : "Tool execution failed";

                tracer.logToolCall({
                  toolName: toolCall.name,
                  input: toolCall.input,
                  output: { error: errorMsg },
                  durationMs: Date.now() - startTime,
                  success: false,
                  error: errorMsg,
                });

                emitToController?.({
                  type: "tool-output-available",
                  toolCallId: toolCall.id,
                  output: { error: true, message: errorMsg },
                });

                return {
                  tool_use_id: toolCall.id,
                  content: JSON.stringify({ error: true, message: errorMsg }),
                  is_error: true,
                } satisfies ClaudeToolResult;
              }
            },
          });

          // Process stream events
          for await (const event of streamGen) {
            const streamEvent = event as StreamEvent;
            if (streamEvent.type === "text-delta" && streamEvent.delta) {
              assistantContent += streamEvent.delta;
              emitToController?.({ type: "text-delta", delta: streamEvent.delta });
            }
          }

          // Save assistant message
          await prisma.message.create({
            data: {
              conversationId,
              role: MessageRole.ASSISTANT,
              content: assistantContent,
            },
          });

          // Complete trace
          tracer.complete({ output: assistantContent, status: "completed" });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          console.error("Flow builder stream error:", errorMsg);
          tracer.logError(error instanceof Error ? error : new Error(errorMsg));
          tracer.complete({ status: "failed" });

          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", message: errorMsg })}\n\n`)
            );
          } catch {
            // Stream closed
          }
        } finally {
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Flow builder error:", error);
    return new Response(
      error instanceof Error ? error.message : "Internal server error",
      { status: 500 }
    );
  }
}
