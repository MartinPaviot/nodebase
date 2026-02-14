import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { headers } from "next/headers";
import { z } from "zod";
import { AgentModel, MessageRole, ActivityType, MemoryCategory } from "@prisma/client";
import { executeWorkflowSync } from "@/lib/workflow-executor";
import type { AgentTool, Workflow } from "@prisma/client";
import {
  searchKnowledge,
  formatSearchResultsForContext,
} from "@/lib/knowledge-base";
import {
  sendEmail,
  listEmails,
  searchEmails,
  listEvents,
  createEvent,
  hasIntegration,
  readSheet,
  appendToSheet,
  updateSheet,
  createSpreadsheet,
  listDriveFiles,
  getDriveFile,
  uploadDriveFile,
  deleteDriveFile,
  createDoc,
  getDoc,
  appendToDoc,
} from "@/lib/integrations/google";
import {
  sendSlackMessage,
  listSlackChannels,
  getSlackChannelHistory,
} from "@/lib/integrations/slack";
import {
  searchNotionPages,
  getNotionPage,
  createNotionPage,
  appendToNotionPage,
  listNotionDatabases,
  hasNotionIntegration,
} from "@/lib/integrations/notion";
import { recordMetric } from "@/lib/agent-analytics";
import { logActivity } from "@/lib/activity-logger";
import { AgentTracer } from "@nodebase/core";
import { ClaudeClient, type ClaudeTool, type ClaudeToolResult, type StreamEvent, type ModelTier } from "@/lib/ai/claude-client";
import { calculateCost } from "@/lib/config";
import { EvalEngine, type EvalConfig, type EvalResult, type Assertion } from "@/lib/eval";
import { formatStyleCorrectionsForPrompt } from "@/lib/style-learner";

export const maxDuration = 300; // 5 minutes for Pro plan

// Actions that have side effects and require confirmation in Safe Mode
const SIDE_EFFECT_ACTIONS = new Set([
  "send_email",
  "create_calendar_event",
  "send_slack_message",
  "create_notion_page",
  "append_to_notion",
  "append_to_sheet",
  "update_sheet",
  "create_spreadsheet",
  "upload_drive_file",
  "delete_drive_file",
  "create_doc",
  "append_to_doc",
]);

// Map action types to activity types for logging
const ACTION_TO_ACTIVITY_TYPE: Record<string, ActivityType> = {
  send_email: ActivityType.EMAIL_SENT,
  create_calendar_event: ActivityType.CALENDAR_EVENT_CREATED,
  send_slack_message: ActivityType.SLACK_MESSAGE_SENT,
  create_notion_page: ActivityType.TOOL_CALLED,
  append_to_notion: ActivityType.TOOL_CALLED,
  append_to_sheet: ActivityType.TOOL_CALLED,
  update_sheet: ActivityType.TOOL_CALLED,
  create_spreadsheet: ActivityType.TOOL_CALLED,
  upload_drive_file: ActivityType.TOOL_CALLED,
  delete_drive_file: ActivityType.TOOL_CALLED,
  create_doc: ActivityType.TOOL_CALLED,
  append_to_doc: ActivityType.TOOL_CALLED,
};

// Action labels for user display
const ACTION_LABELS: Record<string, string> = {
  send_email: "Send Email",
  create_calendar_event: "Create Calendar Event",
  send_slack_message: "Send Slack Message",
  create_notion_page: "Create Notion Page",
  append_to_notion: "Append to Notion Page",
  append_to_sheet: "Append to Google Sheet",
  update_sheet: "Update Google Sheet",
  create_spreadsheet: "Create Spreadsheet",
  upload_drive_file: "Upload to Google Drive",
  delete_drive_file: "Delete from Google Drive",
  create_doc: "Create Google Doc",
  append_to_doc: "Append to Google Doc",
};

type AgentToolWithWorkflow = AgentTool & { workflow: Workflow | null };

export async function POST(request: Request) {
  let tracer: AgentTracer | null = null;
  const startTime = Date.now();

  try {
    // Authenticate
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { conversationId, messages: incomingMessages } = body;

    if (!conversationId) {
      return new Response("Missing conversationId", { status: 400 });
    }

    // Frontend sends messages array - get the last user message
    const lastMessage = incomingMessages?.[incomingMessages.length - 1];
    if (!lastMessage || lastMessage.role !== "user") {
      return new Response("Missing user message", { status: 400 });
    }
    const message = lastMessage.content as string;

    // Get conversation with agent and messages
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        agent: {
          include: {
            credential: true,
            agentTools: {
              include: {
                workflow: true,
              },
            },
            connectedTo: {
              where: { enabled: true },
              include: {
                targetAgent: {
                  include: {
                    credential: true,
                  },
                },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      return new Response("Conversation not found", { status: 404 });
    }

    if (conversation.agent.userId !== session.user.id) {
      return new Response("Unauthorized", { status: 403 });
    }

    const agent = conversation.agent;

    // Initialize AgentTracer for observability
    tracer = new AgentTracer(
      {
        agentId: agent.id,
        conversationId,
        userId: session.user.id,
        workspaceId: agent.workspaceId || session.user.id,
        triggeredBy: "user",
        userMessage: message,
      },
      async (trace) => {
        // Persist trace to AgentTrace table
        try {
          await prisma.agentTrace.create({
            data: {
              id: trace.id,
              agentId: trace.agentId,
              conversationId: trace.conversationId || conversationId,
              userId: trace.userId,
              workspaceId: trace.workspaceId,
              status: trace.status === "completed" ? "COMPLETED" : trace.status === "failed" ? "FAILED" : "COMPLETED",
              steps: JSON.parse(JSON.stringify(trace.steps)),
              totalSteps: trace.metrics.stepsCount,
              maxSteps: 5,
              totalTokensIn: trace.metrics.totalTokensIn,
              totalTokensOut: trace.metrics.totalTokensOut,
              totalCost: trace.metrics.totalCost,
              toolCalls: [],
              toolSuccesses: trace.metrics.toolCalls,
              toolFailures: 0,
              latencyMs: trace.durationMs,
              completedAt: trace.completedAt,
            },
          });
        } catch (saveError) {
          console.warn("Failed to persist trace:", saveError);
        }
      }
    );

    // Get API key
    let apiKey: string | undefined;
    if (agent.credential) {
      apiKey = decrypt(agent.credential.value);
    }

    if (!apiKey) {
      return new Response("No API credential configured for this agent", {
        status: 400,
      });
    }

    // Only Anthropic models supported with ClaudeClient streaming
    if (agent.model !== AgentModel.ANTHROPIC) {
      return new Response(
        `Model ${agent.model} is not yet supported. Please use an Anthropic model.`,
        { status: 400 }
      );
    }

    // Save user message to database
    await prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.USER,
        content: message,
      },
    });

    // Build message history (user + assistant messages only)
    const messageHistory = conversation.messages
      .filter((msg) => msg.role !== MessageRole.TOOL)
      .map((msg) => ({
        role: msg.role.toLowerCase() as "user" | "assistant",
        content: msg.content,
      }));

    messageHistory.push({ role: "user" as const, content: message });

    // RAG: Search knowledge base for relevant context
    let ragContext = "";
    try {
      const knowledgeResults = await searchKnowledge(agent.id, message, 5, 0.7);
      if (knowledgeResults.length > 0) {
        ragContext = formatSearchResultsForContext(knowledgeResults);
      }
    } catch (error) {
      console.warn("RAG search failed:", error);
    }

    // Fetch agent memories for context
    const memories = await prisma.agentMemory.findMany({
      where: { agentId: agent.id },
      select: { key: true, value: true, category: true },
    });

    // Build enhanced system prompt
    let enhancedSystemPrompt = agent.systemPrompt;

    if (agent.context) {
      enhancedSystemPrompt += `\n\n## Context (Always keep in mind)\n${agent.context}`;
    }

    if (memories.length > 0) {
      enhancedSystemPrompt += `\n\n## Memories\n${memories.map(m => `- ${m.key}: ${m.value}`).join("\n")}`;
    }

    // Phase 3.4: Inject style corrections
    const styleGuide = await formatStyleCorrectionsForPrompt(agent.id);
    if (styleGuide) {
      enhancedSystemPrompt += `\n\n${styleGuide}`;
    }

    if (ragContext) {
      enhancedSystemPrompt += `\n\n${ragContext}\n\nUse the above knowledge base context to inform your responses when relevant. If the context doesn't contain relevant information, rely on your general knowledge.`;
    }

    enhancedSystemPrompt += `\n\nYou have access to memory tools to save, retrieve, and delete memories. Use these to remember important information across conversations (like user preferences, important facts, or standing instructions).`;

    // Create tools from all sources
    const workflowTools = createToolsFromAgentTools(
      agent.agentTools as AgentToolWithWorkflow[],
      session.user.id
    );

    const agentConnectionTools = createToolsFromAgentConnections(
      agent.connectedTo as AgentConnectionWithTarget[]
    );

    const integrationTools = await createIntegrationTools(
      session.user.id,
      agent.safeMode,
      conversationId,
      { id: agent.id, evalRules: agent.evalRules }
    );

    const memoryTools = createMemoryTools(agent.id);

    // Merge all tools (Zod + execute format)
    const toolMap: Record<string, ToolDef> = {
      ...workflowTools,
      ...agentConnectionTools,
      ...integrationTools,
      ...memoryTools,
    };

    // Convert to Anthropic API format
    const claudeTools: ClaudeTool[] = Object.entries(toolMap).map(([name, tool]) => ({
      name,
      description: tool.description,
      input_schema: zodToInputSchema(tool.parameters),
    }));

    // Initialize ClaudeClient
    const claudeClient = new ClaudeClient(apiKey);
    const llmTier: ModelTier = "smart";

    // Track state for post-processing
    let assistantContent = "";
    let totalToolCallCount = 0;
    const tracerRef = tracer;
    const encoder = new TextEncoder();

    // Track eval results for Phase 2.2
    const evalResults: Array<{
      toolName: string;
      l1Passed: boolean;
      l2Score: number;
      l2Passed: boolean;
      l3Triggered: boolean;
      l3Passed: boolean;
    }> = [];

    // Create SSE stream
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const streamGen = claudeClient.chatStream({
            model: llmTier,
            messages: messageHistory,
            systemPrompt: enhancedSystemPrompt,
            temperature: agent.temperature,
            maxSteps: 5,
            tools: claudeTools.length > 0 ? claudeTools : undefined,
            userId: session.user.id,
            agentId: agent.id,
            conversationId,

            onStepComplete: async (aiEvent) => {
              // Log LLM call in tracer
              try {
                tracerRef.logLLMCall({
                  model: aiEvent.model,
                  input: `Step ${aiEvent.stepNumber}`,
                  output: aiEvent.action,
                  tokensIn: aiEvent.tokensIn,
                  tokensOut: aiEvent.tokensOut,
                  cost: aiEvent.cost,
                  durationMs: aiEvent.latency,
                });
              } catch (traceError) {
                console.warn("Failed to log LLM call in trace:", traceError);
              }
            },

            onToolCall: async (toolCall) => {
              const tool = toolMap[toolCall.name];
              if (!tool) {
                return {
                  tool_use_id: toolCall.id,
                  content: JSON.stringify({ error: true, message: `Unknown tool: ${toolCall.name}` }),
                  is_error: true,
                };
              }

              try {
                const result = await tool.execute(toolCall.input);
                totalToolCallCount++;

                // Collect eval results if present (Phase 2.2)
                const resultWithEval = result as Record<string, unknown> & {
                  evalResult?: {
                    l1Passed?: boolean;
                    l2Score?: number;
                    l2Passed?: boolean;
                    l3Triggered?: boolean;
                    l3Passed?: boolean;
                  };
                };
                if (resultWithEval?.evalResult) {
                  evalResults.push({
                    toolName: toolCall.name,
                    l1Passed: resultWithEval.evalResult.l1Passed ?? true,
                    l2Score: resultWithEval.evalResult.l2Score ?? 100,
                    l2Passed: resultWithEval.evalResult.l2Passed ?? true,
                    l3Triggered: resultWithEval.evalResult.l3Triggered ?? false,
                    l3Passed: resultWithEval.evalResult.l3Passed ?? true,
                  });
                }

                // Save tool message to DB
                await prisma.message.create({
                  data: {
                    conversationId,
                    role: MessageRole.TOOL,
                    content: `Called tool: ${toolCall.name}`,
                    toolName: toolCall.name,
                    toolInput: toolCall.input as Record<string, string | number | boolean | null>,
                    toolOutput: result as Record<string, string | number | boolean | null>,
                  },
                });

                // Log activity
                try {
                  const hasError = result?.error === true;
                  if (hasError) {
                    await logActivity(
                      conversationId,
                      ActivityType.TOOL_FAILED,
                      `Failed: ${toolCall.name}`,
                      { error: result?.message || "Unknown error" }
                    );
                  } else {
                    const activityType = ACTION_TO_ACTIVITY_TYPE[toolCall.name] || ActivityType.TOOL_COMPLETED;
                    await logActivity(
                      conversationId,
                      activityType,
                      `Completed: ${toolCall.name}`,
                      { args: toolCall.input, result }
                    );
                  }
                } catch (e) {
                  console.warn("Failed to log tool activity:", e);
                }

                // Log tool call in tracer
                try {
                  tracerRef.logToolCall({
                    toolName: toolCall.name,
                    input: toolCall.input as Record<string, unknown>,
                    output: (result as Record<string, unknown>) ?? null,
                    success: result?.error !== true,
                    durationMs: 0,
                  });
                } catch (traceError) {
                  console.warn("Failed to log tool call in trace:", traceError);
                }

                return {
                  tool_use_id: toolCall.id,
                  content: JSON.stringify(result),
                } satisfies ClaudeToolResult;
              } catch (error) {
                console.error(`Tool "${toolCall.name}" execution error:`, error);

                await logActivity(
                  conversationId,
                  ActivityType.TOOL_FAILED,
                  `Failed: ${toolCall.name}`,
                  { error: error instanceof Error ? error.message : "Unknown error" }
                ).catch(() => {});

                return {
                  tool_use_id: toolCall.id,
                  content: JSON.stringify({
                    error: true,
                    message: error instanceof Error ? error.message : "Tool execution failed",
                  }),
                  is_error: true,
                } satisfies ClaudeToolResult;
              }
            },
          });

          // Consume stream and emit SSE events
          for await (const event of streamGen) {
            if (event.type === "text-delta") {
              assistantContent += event.delta;
            }

            // Skip internal events that the frontend doesn't need
            if (event.type === "step-complete") continue;

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }

          // Post-processing after stream completes
          // Log user message activity
          try {
            await logActivity(
              conversationId,
              ActivityType.MESSAGE_RECEIVED,
              "User sent a message",
              { preview: message.slice(0, 100) }
            );
          } catch (e) {
            console.warn("Failed to log message activity:", e);
          }

          // Save assistant message
          if (assistantContent) {
            await prisma.message.create({
              data: {
                conversationId,
                role: MessageRole.ASSISTANT,
                content: assistantContent,
              },
            });

            try {
              await logActivity(
                conversationId,
                ActivityType.MESSAGE_SENT,
                "Assistant sent a message",
                { preview: assistantContent.slice(0, 100) }
              );
            } catch (e) {
              console.warn("Failed to log assistant message activity:", e);
            }
          }

          // Update conversation timestamp
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
          });

          // Auto-generate title if first exchange
          if (conversation.messages.length === 0 && !conversation.title) {
            const title = message.slice(0, 50) + (message.length > 50 ? "..." : "");
            await prisma.conversation.update({
              where: { id: conversationId },
              data: { title },
            });
          }

          // Record analytics metrics
          try {
            await recordMetric(agent.id, {
              messages: 2,
              toolCalls: totalToolCallCount > 0 ? totalToolCallCount : undefined,
            });

            if (conversation.messages.length === 0) {
              await recordMetric(agent.id, { conversations: 1 });
            }
          } catch (metricError) {
            console.warn("Failed to record metrics:", metricError);
          }

          // Save eval results to AgentTrace (Phase 2.2)
          if (evalResults.length > 0) {
            try {
              const traceId = tracerRef.getTraceId();

              // Aggregate eval results
              const allL1Passed = evalResults.every((r) => r.l1Passed);
              const avgL2Score = evalResults.reduce((sum, r) => sum + r.l2Score, 0) / evalResults.length;
              const anyL3Triggered = evalResults.some((r) => r.l3Triggered);
              const anyL3Blocked = evalResults.some((r) => !r.l3Passed && r.l3Triggered);

              await prisma.agentTrace.update({
                where: { id: traceId },
                data: {
                  l1Passed: allL1Passed,
                  l2Score: Math.round(avgL2Score),
                  l3Triggered: anyL3Triggered,
                  l3Blocked: anyL3Blocked,
                },
              });

              console.log(`[AgentTracer] Eval results saved for trace ${traceId}: L1=${allL1Passed}, L2=${Math.round(avgL2Score)}, L3Triggered=${anyL3Triggered}`);
            } catch (evalSaveError) {
              console.warn("Failed to save eval results to AgentTrace:", evalSaveError);
            }
          }

          // Complete the trace and persist to DB via onSave callback
          try {
            await tracerRef.complete({ status: "completed" });
          } catch (completeError) {
            console.warn("Failed to complete trace:", completeError);
          }
        } catch (error) {
          console.error("Stream error:", error);

          // Send error event to client
          const errorEvent: StreamEvent = {
            type: "error",
            message: error instanceof Error ? error.message : "Stream error",
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));

          // Log error in trace
          try {
            tracerRef.logError(error instanceof Error ? error : new Error("Unknown error"));
            await tracerRef.complete({ status: "failed" });
          } catch (traceError) {
            console.warn("Failed to log error in trace:", traceError);
          }
        } finally {
          controller.close();
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
    console.error("Chat error:", error);

    // Log error in trace if initialized
    try {
      if (tracer) {
        tracer.logError(error instanceof Error ? error : new Error("Unknown error"));
        await tracer.complete({ status: "failed" });
      }
    } catch (traceError) {
      console.warn("Failed to log error in trace:", traceError);
    }

    return new Response(
      error instanceof Error ? error.message : "Internal server error",
      { status: 500 }
    );
  }
}

// ============================================
// TOOL TYPES & ZOD → JSON SCHEMA CONVERTER
// ============================================

interface ToolDef {
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters: z.ZodObject<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (args: any) => Promise<Record<string, unknown>>;
}

/**
 * Convert a Zod schema to JSON Schema format for Anthropic API
 */
function zodToInputSchema(schema: z.ZodTypeAny): ClaudeTool["input_schema"] {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const { jsonSchema, isOptional } = convertZodType(value as z.ZodTypeAny);
      properties[key] = jsonSchema;
      if (!isOptional) {
        required.push(key);
      }
    }

    return { type: "object", properties, ...(required.length > 0 ? { required } : {}) };
  }

  return { type: "object", properties: {} };
}

function convertZodType(zodType: z.ZodTypeAny): { jsonSchema: Record<string, unknown>; isOptional: boolean } {
  let isOptional = false;
  let current = zodType;

  // Unwrap optional and default wrappers
  while (true) {
    if (current instanceof z.ZodOptional) {
      isOptional = true;
      current = current.unwrap();
    } else if (current instanceof z.ZodDefault) {
      isOptional = true;
      current = current.removeDefault();
    } else {
      break;
    }
  }

  const description = current.description;
  let schema: Record<string, unknown> = {};

  if (current instanceof z.ZodString) {
    schema = { type: "string" };
  } else if (current instanceof z.ZodNumber) {
    schema = { type: "number" };
  } else if (current instanceof z.ZodBoolean) {
    schema = { type: "boolean" };
  } else if (current instanceof z.ZodArray) {
    const itemSchema = convertZodType(current.element);
    schema = { type: "array", items: itemSchema.jsonSchema };
  } else if (current instanceof z.ZodEnum) {
    schema = { type: "string", enum: current.options };
  } else if (current instanceof z.ZodObject) {
    schema = zodToInputSchema(current);
  } else {
    schema = { type: "string" };
  }

  if (description) {
    schema.description = description;
  }

  return { jsonSchema: schema, isOptional };
}

/**
 * Sanitize tool name to match API requirements (alphanumeric + underscores)
 */
function sanitizeToolName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Convert AgentTools (connected workflows) to AI SDK tool format
 */
function createToolsFromAgentTools(
  agentTools: AgentToolWithWorkflow[],
  userId: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  for (const agentTool of agentTools) {
    const toolName = sanitizeToolName(agentTool.name);

    // Create tool with explicit typing to avoid overload issues
    tools[toolName] = {
      description: agentTool.description,
      parameters: z.object({
        input: z
          .string()
          .optional()
          .describe("Optional input data as JSON string to pass to the workflow"),
      }),
      execute: async (args: { input?: string }): Promise<Record<string, unknown>> => {
        try {
          // Parse input if provided
          const initialData = args.input ? JSON.parse(args.input) : {};

          // Workflow-based tool
          if (agentTool.workflowId) {
            const result = await executeWorkflowSync({
              workflowId: agentTool.workflowId,
              userId,
              initialData,
            });

            if (!result.success) {
              return {
                error: true,
                message: result.error || "Workflow execution failed",
              };
            }

            return result.output ?? { success: true };
          }

          // No valid tool configuration
          return {
            error: true,
            message: "Invalid tool configuration: missing workflowId",
          };
        } catch (error) {
          console.error(`Tool "${agentTool.name}" execution error:`, error);
          return {
            error: true,
            message:
              error instanceof Error ? error.message : "Tool execution failed",
          };
        }
      },
    };
  }

  return tools;
}

type AgentConnectionWithTarget = {
  id: string;
  alias: string;
  description: string;
  targetAgent: {
    id: string;
    name: string;
    systemPrompt: string;
    model: AgentModel;
    temperature: number;
    credential: { value: string } | null;
  };
};

/**
 * Convert agent connections to tool format for multi-agent communication
 */
function createToolsFromAgentConnections(
  connections: AgentConnectionWithTarget[]
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  for (const connection of connections) {
    const toolName = `talk_to_${sanitizeToolName(connection.alias)}`;

    tools[toolName] = {
      description: `Send a message to ${connection.targetAgent.name}. ${connection.description}`,
      parameters: z.object({
        message: z
          .string()
          .describe(
            "The message or question to send to the other agent. Be specific and provide context."
          ),
      }),
      execute: async (args: { message: string }): Promise<Record<string, unknown>> => {
        try {
          const targetAgent = connection.targetAgent;

          if (!targetAgent.credential) {
            return {
              error: true,
              message: `Agent "${targetAgent.name}" has no API credential configured`,
            };
          }

          const targetApiKey = decrypt(targetAgent.credential.value);

          // Use ClaudeClient for Anthropic models
          if (targetAgent.model === AgentModel.ANTHROPIC) {
            const client = new ClaudeClient(targetApiKey);
            const result = await client.chat({
              model: "smart",
              messages: [{ role: "user", content: args.message }],
              systemPrompt: targetAgent.systemPrompt,
              temperature: targetAgent.temperature,
              userId: "", // Multi-agent call, no user context
              maxSteps: 3,
            });

            return {
              agentName: targetAgent.name,
              response: result.content,
            };
          }

          // Unsupported model for multi-agent
          return {
            error: true,
            message: `Agent "${targetAgent.name}" uses unsupported model: ${targetAgent.model}`,
          };
        } catch (error) {
          console.error(
            `Agent communication error (${connection.targetAgent.name}):`,
            error
          );
          return {
            error: true,
            message:
              error instanceof Error
                ? error.message
                : "Failed to communicate with agent",
          };
        }
      },
    };
  }

  return tools;
}

/**
 * Get default eval rules if agent.evalRules is null
 */
function getDefaultEvalRules(): {
  assertions: Assertion[];
  minConfidence: number;
  l3Trigger: "always" | "on_irreversible_action" | "on_l2_fail";
  autoSendThreshold: number;
} {
  return {
    assertions: [
      { check: "no_placeholders", severity: "block" },
      { check: "has_real_content", severity: "block" },
      { check: "contains_recipient_name", severity: "warn" },
    ],
    minConfidence: 60,
    l3Trigger: "on_irreversible_action",
    autoSendThreshold: 85,
  };
}

/**
 * Extract content to evaluate from tool args
 */
function extractContentForEval(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case "send_email":
      return (args.body as string) || "";
    case "send_slack_message":
      return (args.text as string) || (args.message as string) || "";
    case "create_notion_page":
    case "append_to_notion":
      return (args.content as string) || "";
    case "create_doc":
    case "append_to_doc":
      return (args.content as string) || (args.text as string) || "";
    default:
      return JSON.stringify(args);
  }
}

/**
 * Helper function to create a safe mode wrapper for side-effect tools with EvalEngine integration
 */
function createSafeModeWrapper(
  toolName: string,
  originalExecute: (args: Record<string, unknown>) => Promise<Record<string, unknown>>,
  safeMode: boolean,
  conversationId: string,
  agent: { id: string; evalRules: unknown },
  userId: string
) {
  if (!safeMode || !SIDE_EFFECT_ACTIONS.has(toolName)) {
    return originalExecute;
  }

  return async (args: Record<string, unknown>): Promise<Record<string, unknown>> => {
    // Extract content to evaluate
    const contentToEval = extractContentForEval(toolName, args);

    // Get eval rules from agent or use defaults
    const evalRules = agent.evalRules
      ? (agent.evalRules as {
          assertions?: Assertion[];
          minConfidence?: number;
          l3Trigger?: "always" | "on_irreversible_action" | "on_l2_fail";
          autoSendThreshold?: number;
        })
      : getDefaultEvalRules();

    // Run evaluation
    const evalResult: EvalResult = await EvalEngine.evaluate({
      text: contentToEval,
      userId,
      action: toolName,
      context: args,
      enableL1: true,
      l1Assertions: evalRules.assertions || getDefaultEvalRules().assertions,
      enableL2: true,
      l2MinScore: evalRules.minConfidence || 60,
      enableL3: true,
      l3Trigger: evalRules.l3Trigger || "on_irreversible_action",
      l3AutoSendThreshold: evalRules.autoSendThreshold || 85,
    });

    // L1 or L3 hard block - return error immediately
    if (!evalResult.passed && (evalResult.blockReason?.includes("L1") || evalResult.blockReason?.includes("L3"))) {
      return {
        error: true,
        blocked: true,
        reason: evalResult.blockReason,
        suggestions: evalResult.suggestions,
        evalResult: {
          l1Passed: evalResult.l1Passed,
          l2Score: evalResult.l2Score,
          l3Triggered: evalResult.l3Triggered,
          l3Passed: evalResult.l3Passed,
        },
      };
    }

    // Can auto-send - execute directly without confirmation
    if (evalResult.canAutoSend && evalResult.passed) {
      const result = await originalExecute(args);
      return {
        ...result,
        autoSent: true,
        evalResult: {
          l1Passed: evalResult.l1Passed,
          l2Score: evalResult.l2Score,
          l3Triggered: evalResult.l3Triggered,
          l3Passed: evalResult.l3Passed,
        },
      };
    }

    // Requires approval - create ConversationActivity with eval details
    const activity = await prisma.conversationActivity.create({
      data: {
        conversationId,
        type: ActivityType.CONFIRMATION_REQUESTED,
        title: ACTION_LABELS[toolName] || toolName,
        details: {
          actionType: toolName,
          actionArgs: args as Record<string, string | number | boolean | null>,
          evalResult: {
            l1Passed: evalResult.l1Passed,
            l2Score: evalResult.l2Score,
            l2Passed: evalResult.l2Passed,
            l3Triggered: evalResult.l3Triggered,
            l3Passed: evalResult.l3Passed,
            suggestions: evalResult.suggestions,
            blockReason: evalResult.blockReason,
          },
        },
        requiresConfirmation: true,
      },
    });

    return {
      requiresConfirmation: true,
      activityId: activity.id,
      actionType: toolName,
      actionLabel: ACTION_LABELS[toolName] || toolName,
      message: `This action requires your confirmation. Please review the details and confirm or reject the action.`,
      details: args,
      evalResult: {
        l1Passed: evalResult.l1Passed,
        l2Score: evalResult.l2Score,
        l2Passed: evalResult.l2Passed,
        l3Triggered: evalResult.l3Triggered,
        l3Passed: evalResult.l3Passed,
        suggestions: evalResult.suggestions,
      },
    };
  };
}

/**
 * Create native integration tools (Gmail, Calendar) based on user's connected integrations
 */
async function createIntegrationTools(
  userId: string,
  safeMode: boolean = false,
  conversationId?: string,
  agent?: { id: string; evalRules: unknown }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  // Check Gmail integration
  const hasGmail = await hasIntegration(userId, "GMAIL");
  if (hasGmail) {
    // Send email tool
    tools.send_email = {
      description: "Send an email through the user's connected Gmail account",
      parameters: z.object({
        to: z.string().describe("The recipient email address"),
        subject: z.string().describe("The email subject line"),
        body: z.string().describe("The email body content (plain text)"),
      }),
      execute: async (args: { to: string; subject: string; body: string }): Promise<Record<string, unknown>> => {
        try {
          const result = await sendEmail(userId, args.to, args.subject, args.body);
          return {
            success: true,
            messageId: result.data.id,
            message: `Email sent successfully to ${args.to}`,
          };
        } catch (error) {
          console.error("Send email error:", error);
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to send email",
          };
        }
      },
    };

    // List emails tool
    tools.list_emails = {
      description: "List recent emails from the user's Gmail inbox",
      parameters: z.object({
        maxResults: z.number().optional().default(10).describe("Maximum number of emails to return (default: 10)"),
      }),
      execute: async (args: { maxResults?: number }): Promise<Record<string, unknown>> => {
        try {
          const emails = await listEmails(userId, args.maxResults || 10);
          return {
            success: true,
            count: emails.length,
            emails: emails.map((email) => ({
              id: email.id,
              snippet: email.snippet,
              from: email.headers?.find((h) => h.name === "From")?.value,
              to: email.headers?.find((h) => h.name === "To")?.value,
              subject: email.headers?.find((h) => h.name === "Subject")?.value,
              date: email.headers?.find((h) => h.name === "Date")?.value,
            })),
          };
        } catch (error) {
          console.error("List emails error:", error);
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to list emails",
          };
        }
      },
    };

    // Search emails tool
    tools.search_emails = {
      description: "Search emails in the user's Gmail account using a query",
      parameters: z.object({
        query: z.string().describe("Gmail search query (e.g., 'from:example@gmail.com', 'subject:meeting', 'is:unread')"),
        maxResults: z.number().optional().default(10).describe("Maximum number of emails to return (default: 10)"),
      }),
      execute: async (args: { query: string; maxResults?: number }): Promise<Record<string, unknown>> => {
        try {
          const emails = await searchEmails(userId, args.query, args.maxResults || 10);
          return {
            success: true,
            query: args.query,
            count: emails.length,
            emails: emails.map((email) => ({
              id: email.id,
              snippet: email.snippet,
              from: email.headers?.find((h) => h.name === "From")?.value,
              to: email.headers?.find((h) => h.name === "To")?.value,
              subject: email.headers?.find((h) => h.name === "Subject")?.value,
              date: email.headers?.find((h) => h.name === "Date")?.value,
            })),
          };
        } catch (error) {
          console.error("Search emails error:", error);
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to search emails",
          };
        }
      },
    };
  }

  // Check Calendar integration
  const hasCalendar = await hasIntegration(userId, "GOOGLE_CALENDAR");
  if (hasCalendar) {
    // List calendar events tool
    tools.list_calendar_events = {
      description: "List upcoming events from the user's Google Calendar",
      parameters: z.object({
        daysAhead: z.number().optional().default(7).describe("Number of days ahead to look for events (default: 7)"),
      }),
      execute: async (args: { daysAhead?: number }): Promise<Record<string, unknown>> => {
        try {
          const timeMin = new Date();
          const timeMax = new Date();
          timeMax.setDate(timeMax.getDate() + (args.daysAhead || 7));

          const events = await listEvents(userId, timeMin, timeMax);
          return {
            success: true,
            count: events?.length || 0,
            events: events?.map((event) => ({
              id: event.id,
              summary: event.summary,
              description: event.description,
              start: event.start?.dateTime || event.start?.date,
              end: event.end?.dateTime || event.end?.date,
              location: event.location,
              attendees: event.attendees?.map((a) => a.email),
            })),
          };
        } catch (error) {
          console.error("List calendar events error:", error);
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to list calendar events",
          };
        }
      },
    };

    // Create calendar event tool
    tools.create_calendar_event = {
      description: "Create a new event in the user's Google Calendar",
      parameters: z.object({
        summary: z.string().describe("The event title/summary"),
        description: z.string().optional().describe("Optional event description"),
        startDateTime: z.string().describe("Event start date and time in ISO format (e.g., '2024-01-15T10:00:00')"),
        endDateTime: z.string().describe("Event end date and time in ISO format (e.g., '2024-01-15T11:00:00')"),
        attendees: z.array(z.string()).optional().describe("Optional list of attendee email addresses"),
      }),
      execute: async (args: {
        summary: string;
        description?: string;
        startDateTime: string;
        endDateTime: string;
        attendees?: string[];
      }): Promise<Record<string, unknown>> => {
        try {
          const result = await createEvent(userId, {
            summary: args.summary,
            description: args.description,
            start: new Date(args.startDateTime),
            end: new Date(args.endDateTime),
            attendees: args.attendees,
          });
          return {
            success: true,
            eventId: result.data.id,
            htmlLink: result.data.htmlLink,
            message: `Calendar event "${args.summary}" created successfully`,
          };
        } catch (error) {
          console.error("Create calendar event error:", error);
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to create calendar event",
          };
        }
      },
    };
  }

  // Check Google Sheets integration
  const hasSheets = await hasIntegration(userId, "GOOGLE_SHEETS");
  if (hasSheets) {
    tools.read_sheet = {
      description: "Read data from a Google Spreadsheet",
      parameters: z.object({
        spreadsheetId: z.string().describe("The ID of the spreadsheet"),
        range: z.string().describe("The A1 notation range to read (e.g., 'Sheet1!A1:D10')"),
      }),
      execute: async (args: { spreadsheetId: string; range: string }): Promise<Record<string, unknown>> => {
        try {
          const values = await readSheet(userId, args.spreadsheetId, args.range);
          return { success: true, range: args.range, rowCount: values?.length || 0, values: values || [] };
        } catch (error) {
          console.error("Read sheet error:", error);
          return { error: true, message: error instanceof Error ? error.message : "Failed to read sheet" };
        }
      },
    };

    tools.append_to_sheet = {
      description: "Append rows to a Google Spreadsheet",
      parameters: z.object({
        spreadsheetId: z.string().describe("The ID of the spreadsheet"),
        range: z.string().describe("The A1 notation range to append to (e.g., 'Sheet1!A:D')"),
        values: z.array(z.array(z.string())).describe("2D array of values to append as rows"),
      }),
      execute: async (args: { spreadsheetId: string; range: string; values: string[][] }): Promise<Record<string, unknown>> => {
        try {
          const result = await appendToSheet(userId, args.spreadsheetId, args.range, args.values);
          return { success: true, updatedRange: result.data.updates?.updatedRange, rowsAppended: args.values.length, message: `Appended ${args.values.length} rows` };
        } catch (error) {
          console.error("Append to sheet error:", error);
          return { error: true, message: error instanceof Error ? error.message : "Failed to append to sheet" };
        }
      },
    };

    tools.update_sheet = {
      description: "Update cells in a Google Spreadsheet",
      parameters: z.object({
        spreadsheetId: z.string().describe("The ID of the spreadsheet"),
        range: z.string().describe("The A1 notation range to update (e.g., 'Sheet1!A1:D5')"),
        values: z.array(z.array(z.string())).describe("2D array of values to write"),
      }),
      execute: async (args: { spreadsheetId: string; range: string; values: string[][] }): Promise<Record<string, unknown>> => {
        try {
          const result = await updateSheet(userId, args.spreadsheetId, args.range, args.values);
          return { success: true, updatedRange: result.data.updatedRange, updatedCells: result.data.updatedCells, message: `Updated ${result.data.updatedCells} cells` };
        } catch (error) {
          console.error("Update sheet error:", error);
          return { error: true, message: error instanceof Error ? error.message : "Failed to update sheet" };
        }
      },
    };

    tools.create_spreadsheet = {
      description: "Create a new Google Spreadsheet",
      parameters: z.object({
        title: z.string().describe("The title for the new spreadsheet"),
      }),
      execute: async (args: { title: string }): Promise<Record<string, unknown>> => {
        try {
          const result = await createSpreadsheet(userId, args.title);
          return { success: true, spreadsheetId: result.data.spreadsheetId, url: result.data.spreadsheetUrl, message: `Spreadsheet "${args.title}" created` };
        } catch (error) {
          console.error("Create spreadsheet error:", error);
          return { error: true, message: error instanceof Error ? error.message : "Failed to create spreadsheet" };
        }
      },
    };
  }

  // Check Google Drive integration
  const hasDrive = await hasIntegration(userId, "GOOGLE_DRIVE");
  if (hasDrive) {
    tools.list_drive_files = {
      description: "List files in the user's Google Drive",
      parameters: z.object({
        pageSize: z.number().optional().default(20).describe("Number of files to return (default: 20)"),
        query: z.string().optional().describe("Optional search query (Google Drive query syntax)"),
      }),
      execute: async (args: { pageSize?: number; query?: string }): Promise<Record<string, unknown>> => {
        try {
          const result = await listDriveFiles(userId, { pageSize: args.pageSize, query: args.query });
          return { success: true, count: result.data.files?.length || 0, files: result.data.files || [] };
        } catch (error) {
          console.error("List drive files error:", error);
          return { error: true, message: error instanceof Error ? error.message : "Failed to list drive files" };
        }
      },
    };

    tools.get_drive_file = {
      description: "Get metadata for a specific Google Drive file",
      parameters: z.object({
        fileId: z.string().describe("The ID of the file to get"),
      }),
      execute: async (args: { fileId: string }): Promise<Record<string, unknown>> => {
        try {
          const result = await getDriveFile(userId, args.fileId);
          return { success: true, file: result.data };
        } catch (error) {
          console.error("Get drive file error:", error);
          return { error: true, message: error instanceof Error ? error.message : "Failed to get drive file" };
        }
      },
    };

    tools.upload_drive_file = {
      description: "Upload a file to Google Drive",
      parameters: z.object({
        name: z.string().describe("The file name"),
        mimeType: z.string().describe("The MIME type of the file (e.g., 'text/plain', 'application/pdf')"),
        content: z.string().describe("The file content as a string"),
      }),
      execute: async (args: { name: string; mimeType: string; content: string }): Promise<Record<string, unknown>> => {
        try {
          const result = await uploadDriveFile(userId, args.name, args.mimeType, args.content);
          return { success: true, fileId: result.data.id, name: result.data.name, webViewLink: result.data.webViewLink, message: `File "${args.name}" uploaded` };
        } catch (error) {
          console.error("Upload drive file error:", error);
          return { error: true, message: error instanceof Error ? error.message : "Failed to upload drive file" };
        }
      },
    };

    tools.delete_drive_file = {
      description: "Delete a file from Google Drive",
      parameters: z.object({
        fileId: z.string().describe("The ID of the file to delete"),
      }),
      execute: async (args: { fileId: string }): Promise<Record<string, unknown>> => {
        try {
          await deleteDriveFile(userId, args.fileId);
          return { success: true, message: `File deleted successfully` };
        } catch (error) {
          console.error("Delete drive file error:", error);
          return { error: true, message: error instanceof Error ? error.message : "Failed to delete drive file" };
        }
      },
    };
  }

  // Check Google Docs integration
  const hasDocs = await hasIntegration(userId, "GOOGLE_DOCS");
  if (hasDocs) {
    tools.create_doc = {
      description: "Create a new Google Doc",
      parameters: z.object({
        title: z.string().describe("The title for the new document"),
      }),
      execute: async (args: { title: string }): Promise<Record<string, unknown>> => {
        try {
          const result = await createDoc(userId, args.title);
          return { success: true, documentId: result.data.documentId, title: result.data.title, message: `Document "${args.title}" created` };
        } catch (error) {
          console.error("Create doc error:", error);
          return { error: true, message: error instanceof Error ? error.message : "Failed to create document" };
        }
      },
    };

    tools.get_doc = {
      description: "Get the content of a Google Doc",
      parameters: z.object({
        documentId: z.string().describe("The ID of the document to read"),
      }),
      execute: async (args: { documentId: string }): Promise<Record<string, unknown>> => {
        try {
          const result = await getDoc(userId, args.documentId);
          return { success: true, documentId: result.data.documentId, title: result.data.title, body: result.data.body };
        } catch (error) {
          console.error("Get doc error:", error);
          return { error: true, message: error instanceof Error ? error.message : "Failed to get document" };
        }
      },
    };

    tools.append_to_doc = {
      description: "Append text to a Google Doc",
      parameters: z.object({
        documentId: z.string().describe("The ID of the document"),
        text: z.string().describe("The text to append to the document"),
      }),
      execute: async (args: { documentId: string; text: string }): Promise<Record<string, unknown>> => {
        try {
          await appendToDoc(userId, args.documentId, args.text);
          return { success: true, message: `Text appended to document` };
        } catch (error) {
          console.error("Append to doc error:", error);
          return { error: true, message: error instanceof Error ? error.message : "Failed to append to document" };
        }
      },
    };
  }

  // Check Slack integration
  const hasSlack = await hasIntegration(userId, "SLACK");
  if (hasSlack) {
    // Send Slack message tool
    tools.send_slack_message = {
      description: "Send a message to a Slack channel",
      parameters: z.object({
        channel: z.string().describe("The Slack channel ID to send the message to"),
        text: z.string().describe("The message text to send"),
      }),
      execute: async (args: { channel: string; text: string }): Promise<Record<string, unknown>> => {
        try {
          const result = await sendSlackMessage(userId, args.channel, args.text);
          return {
            success: true,
            messageTs: result.ts,
            channel: result.channel,
            message: `Message sent successfully to channel`,
          };
        } catch (error) {
          console.error("Send Slack message error:", error);
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to send Slack message",
          };
        }
      },
    };

    // List Slack channels tool
    tools.list_slack_channels = {
      description: "List available Slack channels the bot has access to",
      parameters: z.object({}),
      execute: async (): Promise<Record<string, unknown>> => {
        try {
          const channels = await listSlackChannels(userId);
          return {
            success: true,
            count: channels.length,
            channels: channels.map((channel) => ({
              id: channel.id,
              name: channel.name,
              isPrivate: channel.is_private,
              numMembers: channel.num_members,
            })),
          };
        } catch (error) {
          console.error("List Slack channels error:", error);
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to list Slack channels",
          };
        }
      },
    };

    // Read Slack channel history tool
    tools.read_slack_channel = {
      description: "Read recent messages from a Slack channel",
      parameters: z.object({
        channel: z.string().describe("The Slack channel ID to read from"),
        limit: z.number().optional().default(10).describe("Maximum number of messages to retrieve (default: 10)"),
      }),
      execute: async (args: { channel: string; limit?: number }): Promise<Record<string, unknown>> => {
        try {
          const messages = await getSlackChannelHistory(userId, args.channel, args.limit || 10);
          return {
            success: true,
            count: messages.length,
            messages: messages.map((message) => ({
              user: message.user,
              text: message.text,
              timestamp: message.ts,
            })),
          };
        } catch (error) {
          console.error("Read Slack channel error:", error);
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to read Slack channel",
          };
        }
      },
    };
  }

  // Check Notion integration
  const hasNotion = await hasNotionIntegration(userId);
  if (hasNotion) {
    // Search Notion pages tool
    tools.search_notion = {
      description: "Search for pages in the user's connected Notion workspace",
      parameters: z.object({
        query: z.string().describe("The search query to find Notion pages"),
      }),
      execute: async (args: { query: string }): Promise<Record<string, unknown>> => {
        try {
          const pages = await searchNotionPages(userId, args.query);
          return {
            success: true,
            count: pages.length,
            pages: pages.map((page: { id: string; title: string; url: string; lastEdited: string }) => ({
              id: page.id,
              title: page.title,
              url: page.url,
              lastEdited: page.lastEdited,
            })),
          };
        } catch (error) {
          console.error("Search Notion error:", error);
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to search Notion",
          };
        }
      },
    };

    // Read Notion page tool
    tools.read_notion_page = {
      description: "Read the content of a specific Notion page by its ID",
      parameters: z.object({
        pageId: z.string().describe("The Notion page ID to read"),
      }),
      execute: async (args: { pageId: string }): Promise<Record<string, unknown>> => {
        try {
          const page = await getNotionPage(userId, args.pageId);
          return {
            success: true,
            id: page.id,
            content: page.content,
            url: page.url,
          };
        } catch (error) {
          console.error("Read Notion page error:", error);
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to read Notion page",
          };
        }
      },
    };

    // Create Notion page tool
    tools.create_notion_page = {
      description: "Create a new page in Notion. Requires either a parent page ID or a database ID.",
      parameters: z.object({
        title: z.string().describe("The title of the new page"),
        content: z.string().describe("The content of the page (plain text, each line becomes a paragraph)"),
        parentPageId: z.string().optional().describe("The parent page ID to create the page under"),
        databaseId: z.string().optional().describe("The database ID to create the page in (as a new row)"),
      }),
      execute: async (args: {
        title: string;
        content: string;
        parentPageId?: string;
        databaseId?: string;
      }): Promise<Record<string, unknown>> => {
        try {
          if (!args.parentPageId && !args.databaseId) {
            return {
              error: true,
              message: "Either parentPageId or databaseId is required",
            };
          }
          const page = await createNotionPage(userId, {
            title: args.title,
            content: args.content,
            parentPageId: args.parentPageId,
            databaseId: args.databaseId,
          });
          return {
            success: true,
            id: page.id,
            url: page.url,
            title: page.title,
            message: `Created page "${args.title}" successfully`,
          };
        } catch (error) {
          console.error("Create Notion page error:", error);
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to create Notion page",
          };
        }
      },
    };

    // Append to Notion page tool
    tools.append_to_notion = {
      description: "Append content to an existing Notion page",
      parameters: z.object({
        pageId: z.string().describe("The Notion page ID to append content to"),
        content: z.string().describe("The content to append (plain text, each line becomes a paragraph)"),
      }),
      execute: async (args: { pageId: string; content: string }): Promise<Record<string, unknown>> => {
        try {
          const result = await appendToNotionPage(userId, args.pageId, args.content);
          return {
            success: true,
            blocksAdded: result.blocksAdded,
            message: `Appended ${result.blocksAdded} blocks to the page`,
          };
        } catch (error) {
          console.error("Append to Notion error:", error);
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to append to Notion page",
          };
        }
      },
    };

    // List Notion databases tool
    tools.list_notion_databases = {
      description: "List available databases in the user's Notion workspace",
      parameters: z.object({}),
      execute: async (): Promise<Record<string, unknown>> => {
        try {
          const databases = await listNotionDatabases(userId);
          return {
            success: true,
            count: databases.length,
            databases: databases.map((db: { id: string; title: string; url: string }) => ({
              id: db.id,
              title: db.title,
              url: db.url,
            })),
          };
        } catch (error) {
          console.error("List Notion databases error:", error);
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to list Notion databases",
          };
        }
      },
    };
  }

  // Wrap side-effect tools with Safe Mode if enabled
  if (safeMode && conversationId && agent) {
    for (const toolName of SIDE_EFFECT_ACTIONS) {
      if (tools[toolName]) {
        const originalExecute = tools[toolName].execute;
        tools[toolName].execute = createSafeModeWrapper(
          toolName,
          originalExecute,
          safeMode,
          conversationId,
          agent,
          userId
        );
      }
    }
  }

  return tools;
}

/**
 * Create memory tools for the agent to manage its own memories
 */
function createMemoryTools(agentId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  // Save memory tool
  tools.save_memory = {
    description: "Save a piece of information to remember for future conversations. Use this to remember user preferences, important facts, or instructions.",
    parameters: z.object({
      key: z.string().describe("A short identifier for this memory (e.g., 'user_timezone', 'meeting_preference')"),
      value: z.string().describe("The information to remember"),
      category: z.enum(["GENERAL", "PREFERENCE", "CONTEXT", "HISTORY", "INSTRUCTION"]).optional().describe("The category of memory (defaults to GENERAL)"),
    }),
    execute: async (args: { key: string; value: string; category?: MemoryCategory }): Promise<Record<string, unknown>> => {
      try {
        await prisma.agentMemory.upsert({
          where: { agentId_key: { agentId, key: args.key } },
          create: {
            agentId,
            key: args.key,
            value: args.value,
            category: args.category || MemoryCategory.GENERAL
          },
          update: {
            value: args.value,
            category: args.category || undefined
          },
        });
        return { success: true, message: `Saved memory: ${args.key}` };
      } catch (error) {
        console.error("Save memory error:", error);
        return {
          error: true,
          message: error instanceof Error ? error.message : "Failed to save memory",
        };
      }
    },
  };

  // Get memories tool
  tools.get_memories = {
    description: "Retrieve all saved memories to recall previously stored information",
    parameters: z.object({}),
    execute: async (): Promise<Record<string, unknown>> => {
      try {
        const memories = await prisma.agentMemory.findMany({
          where: { agentId },
          select: { key: true, value: true, category: true },
        });
        return {
          success: true,
          count: memories.length,
          memories: memories.map(m => ({ key: m.key, value: m.value, category: m.category })),
        };
      } catch (error) {
        console.error("Get memories error:", error);
        return {
          error: true,
          message: error instanceof Error ? error.message : "Failed to retrieve memories",
        };
      }
    },
  };

  // Delete memory tool
  tools.delete_memory = {
    description: "Delete a memory that is no longer relevant",
    parameters: z.object({
      key: z.string().describe("The key of the memory to delete"),
    }),
    execute: async (args: { key: string }): Promise<Record<string, unknown>> => {
      try {
        await prisma.agentMemory.delete({
          where: { agentId_key: { agentId, key: args.key } },
        });
        return { success: true, message: `Deleted memory: ${args.key}` };
      } catch (error) {
        console.error("Delete memory error:", error);
        return {
          error: true,
          message: error instanceof Error ? error.message : "Failed to delete memory",
        };
      }
    },
  };

  return tools;
}
