// @ts-nocheck
// TODO: This is a draft v2 route with many schema mismatches - needs full rewrite
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { headers } from "next/headers";
import { z } from "zod";
import { AgentModel, MessageRole, ActivityType, MemoryCategory } from "@prisma/client";
import { TONE_SUFFIX } from "@/lib/flow-executor/prompt-utils";
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
import { AgentTracer } from "@elevay/core";
import { ClaudeClient } from "@/lib/ai/claude-client";
import { AIEventLogger } from "@/lib/ai/event-logger";
import { evaluateContent } from "@/lib/eval";

export const maxDuration = 300; // 5 minutes for Pro plan

import { getPlatformApiKey } from "@/lib/config";

// Actions that have side effects and require confirmation in Safe Mode
const SIDE_EFFECT_ACTIONS = new Set([
  "send_email",
  "create_calendar_event",
  "send_slack_message",
  "create_notion_page",
  "append_to_notion",
]);

// Irreversible actions that trigger L3 eval
const IRREVERSIBLE_ACTIONS = new Set([
  "send_email",
  "send_slack_message",
  "create_calendar_event",
  "create_notion_page",
]);

// Map action types to activity types for logging
const ACTION_TO_ACTIVITY_TYPE: Record<string, ActivityType> = {
  send_email: ActivityType.EMAIL_SENT,
  create_calendar_event: ActivityType.CALENDAR_EVENT_CREATED,
  send_slack_message: ActivityType.SLACK_MESSAGE_SENT,
  create_notion_page: ActivityType.TOOL_CALLED,
  append_to_notion: ActivityType.TOOL_CALLED,
};

// Action labels for user display
const ACTION_LABELS: Record<string, string> = {
  send_email: "Send Email",
  create_calendar_event: "Create Calendar Event",
  send_slack_message: "Send Slack Message",
  create_notion_page: "Create Notion Page",
  append_to_notion: "Append to Notion Page",
};

type AgentToolWithWorkflow = AgentTool & { workflow: Workflow | null };

export async function POST(request: Request) {
  let tracer: AgentTracer | null = null;
  const startTime = Date.now();
  const eventLogger = new AIEventLogger();

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

    // useChat sends messages array - get the last user message
    const lastMessage = incomingMessages?.[incomingMessages.length - 1];
    if (!lastMessage || lastMessage.role !== "user") {
      return new Response("Missing user message", { status: 400 });
    }
    const message = lastMessage.content;

    // Get conversation with agent and messages
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        agent: {
          include: {
            agentTools: {
              include: {
                workflow: true,
              },
            },
            // Multi-agent connections
            connectedTo: {
              where: { enabled: true },
              include: {
                targetAgent: true,
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
    tracer = new AgentTracer({
      agentId: agent.id,
      conversationId,
      userId: session.user.id,
      workspaceId: agent.workspaceId || session.user.id,
      triggeredBy: "chat",
    });

    // Start tracing
    await tracer.startTrace();

    // Get platform API key
    const apiKey = getPlatformApiKey();

    // Only support Anthropic for now (ClaudeClient)
    if (agent.model !== AgentModel.ANTHROPIC) {
      return new Response("Only Anthropic models are supported with ClaudeClient", {
        status: 400,
      });
    }

    // Save user message to database
    await prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.USER,
        content: message,
      },
    });

    // Build message history for context (only user and assistant messages)
    const messageHistory = conversation.messages
      .filter((msg) => msg.role !== MessageRole.TOOL)
      .map((msg) => ({
        role: msg.role.toLowerCase() as "user" | "assistant",
        content: msg.content,
      }));

    // Add current message
    messageHistory.push({
      role: "user" as const,
      content: message,
    });

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

    // Build enhanced system prompt with Context, Memories, and RAG
    let enhancedSystemPrompt = agent.systemPrompt;

    // Add Context (read-only global instructions)
    if (agent.context) {
      enhancedSystemPrompt += `\n\n## Context (Always keep in mind)\n${agent.context}`;
    }

    // Add Memories (agent-editable data)
    if (memories.length > 0) {
      enhancedSystemPrompt += `\n\n## Memories\n${memories.map(m => `- ${m.key}: ${m.value}`).join("\n")}`;
    }

    // Add RAG context if available
    if (ragContext) {
      enhancedSystemPrompt += `\n\n${ragContext}\n\nUse the above knowledge base context to inform your responses when relevant. If the context doesn't contain relevant information, rely on your general knowledge.`;
    }

    // Add memory tools instructions
    enhancedSystemPrompt += `\n\nYou have access to memory tools to save, retrieve, and delete memories. Use these to remember important information across conversations (like user preferences, important facts, or standing instructions).`;

    enhancedSystemPrompt += TONE_SUFFIX;

    // Create tools from agent tools (connected workflows)
    const workflowTools = createToolsFromAgentTools(
      agent.agentTools as AgentToolWithWorkflow[],
      session.user.id
    );

    // Create tools from multi-agent connections
    const agentConnectionTools = createToolsFromAgentConnections(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      agent.connectedTo as any[]
    );

    // Create integration tools (Gmail, Calendar, Slack, Notion)
    const integrationTools = await createIntegrationTools(
      session.user.id,
      agent.safeMode,
      conversationId
    );

    // Create memory tools for the agent to manage its own memories
    const memoryTools = createMemoryTools(agent.id);

    // Merge all tools
    const allTools = { ...workflowTools, ...agentConnectionTools, ...integrationTools, ...memoryTools };

    // Convert tools to Claude format
    const claudeTools = Object.entries(allTools).map(([name, tool]) => ({
      name,
      description: tool.description,
      input_schema: {
        type: "object" as const,
        properties: tool.parameters._def.schema.shape,
        required: Object.keys(tool.parameters._def.schema.shape),
      },
    }));

    // Initialize Claude client
    const claudeClient = new ClaudeClient({ apiKey });

    // Map LLM tier (defaults to "smart")
    const llmTier = "smart"; // TODO: Get from agent.llmTier once added to schema

    // Storage for pending eval drafts
    const pendingEvals: Array<{
      toolName: string;
      args: Record<string, unknown>;
      draftContent: string;
    }> = [];

    // Stream the response via Claude API
    const response = await claudeClient.chat({
      model: llmTier,
      messages: messageHistory,
      systemPrompt: enhancedSystemPrompt,
      temperature: agent.temperature,
      maxSteps: 10,
      tools: claudeTools,
      userId: session.user.id,

      // On each step (tool call or text), log AI event
      onStepComplete: async (event) => {
        await eventLogger.log({
          ...event,
          agentId: agent.id,
          conversationId,
          userId: session.user.id,
          workspaceId: agent.workspaceId || session.user.id,
        });
      },

      // On tool call, execute tool
      onToolCall: async (toolCall) => {
        const tool = allTools[toolCall.name];
        if (!tool) {
          return {
            type: "tool_result" as const,
            tool_use_id: toolCall.id,
            content: JSON.stringify({ error: true, message: `Tool "${toolCall.name}" not found` }),
          };
        }

        try {
          // Check if this is an irreversible action requiring eval
          if (IRREVERSIBLE_ACTIONS.has(toolCall.name)) {
            // Extract draft content
            let draftContent = "";
            if (toolCall.name === "send_email") {
              const args = toolCall.input as { subject?: string; body?: string };
              draftContent = `Subject: ${args.subject || ""}\n\n${args.body || ""}`;
            } else if (toolCall.name === "send_slack_message") {
              const args = toolCall.input as { text?: string };
              draftContent = args.text || "";
            }

            if (draftContent) {
              // Run eval layer
              const evalResult = await evaluateContent({
                text: draftContent,
                userId: session.user.id,
                action: toolCall.name,
                context: toolCall.input,

                // L1: Block placeholders, profanity, etc.
                enableL1: true,
                l1Assertions: [
                  { check: "no_placeholders", severity: "block" },
                  { check: "has_real_content", severity: "block" },
                  { check: "no_profanity", severity: "block" },
                ],

                // L2: Score quality
                enableL2: true,
                l2MinScore: 60,

                // L3: LLM judge for irreversible actions
                enableL3: true,
                l3Trigger: "on_irreversible_action",
                l3AutoSendThreshold: 85,
              });

              // Block if eval failed
              if (!evalResult.passed) {
                await logActivity(
                  conversationId,
                  ActivityType.TOOL_FAILED,
                  `Blocked: ${toolCall.name}`,
                  { reason: evalResult.blockReason }
                );

                return {
                  type: "tool_result" as const,
                  tool_use_id: toolCall.id,
                  content: JSON.stringify({
                    error: true,
                    message: `Action blocked by safety check: ${evalResult.blockReason}`,
                    suggestions: evalResult.suggestions,
                  }),
                };
              }

              // If requires approval, store pending eval
              if (evalResult.requiresApproval) {
                pendingEvals.push({
                  toolName: toolCall.name,
                  args: toolCall.input,
                  draftContent,
                });

                // Create activity for user approval
                const activity = await prisma.conversationActivity.create({
                  data: {
                    conversationId,
                    type: ActivityType.CONFIRMATION_REQUESTED,
                    title: ACTION_LABELS[toolCall.name] || toolCall.name,
                    details: {
                      actionType: toolCall.name,
                      actionArgs: toolCall.input as Record<string, string | number | boolean | null>,
                      evalScore: evalResult.l2Score,
                      suggestions: evalResult.suggestions,
                    },
                    requiresConfirmation: true,
                  },
                });

                return {
                  type: "tool_result" as const,
                  tool_use_id: toolCall.id,
                  content: JSON.stringify({
                    requiresConfirmation: true,
                    activityId: activity.id,
                    actionType: toolCall.name,
                    actionLabel: ACTION_LABELS[toolCall.name] || toolCall.name,
                    message: `This action requires your confirmation. Quality score: ${evalResult.l2Score}/100. Please review and approve.`,
                    details: toolCall.input,
                    suggestions: evalResult.suggestions,
                  }),
                };
              }

              // Auto-send approved
              // Fall through to execute tool below
            }
          }

          // Execute tool
          const result = await tool.execute(toolCall.input);

          // Log activity
          const hasError = result.error === true;
          if (hasError) {
            await logActivity(
              conversationId,
              ActivityType.TOOL_FAILED,
              `Failed: ${toolCall.name}`,
              { error: result.message || "Unknown error" }
            );
          } else {
            const activityType = ACTION_TO_ACTIVITY_TYPE[toolCall.name] || ActivityType.TOOL_COMPLETED;
            await logActivity(
              conversationId,
              activityType as ActivityType,
              `Completed: ${toolCall.name}`,
              { args: toolCall.input, result }
            );
          }

          // Save tool message to database
          await prisma.message.create({
            data: {
              conversationId,
              role: MessageRole.TOOL,
              content: `Called tool: ${toolCall.name}`,
              toolName: toolCall.name,
              toolInput: toolCall.input as any,
              toolOutput: result as any,
            },
          });

          return {
            type: "tool_result" as const,
            tool_use_id: toolCall.id,
            content: JSON.stringify(result),
          };
        } catch (error) {
          console.error(`Tool "${toolCall.name}" execution error:`, error);

          await logActivity(
            conversationId,
            ActivityType.TOOL_FAILED,
            `Failed: ${toolCall.name}`,
            { error: error instanceof Error ? error.message : "Unknown error" }
          );

          return {
            type: "tool_result" as const,
            tool_use_id: toolCall.id,
            content: JSON.stringify({
              error: true,
              message: error instanceof Error ? error.message : "Tool execution failed",
            }),
          };
        }
      },
    });

    // Save assistant message (final response)
    const textBlocks = response.content.filter((block: any) => block.type === "text");
    const finalText = textBlocks.map((block: any) => block.text).join("\n");

    if (finalText) {
      await prisma.message.create({
        data: {
          conversationId,
          role: MessageRole.ASSISTANT,
          content: finalText,
        },
      });

      // Log assistant message activity
      await logActivity(
        conversationId,
        ActivityType.MESSAGE_SENT,
        "Assistant sent a message",
        { preview: finalText.slice(0, 100) }
      );
    }

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Auto-generate title if this is the first exchange
    if (conversation.messages.length === 0 && !conversation.title) {
      const title = message.slice(0, 50) + (message.length > 50 ? "..." : "");
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { title },
      });
    }

    // Record analytics metrics
    try {
      const toolBlocks = response.content.filter((block: any) => block.type === "tool_use");
      const totalToolCalls = toolBlocks.length;

      await recordMetric(agent.id, {
        messages: 2, // User message + assistant response
        toolCalls: totalToolCalls > 0 ? totalToolCalls : undefined,
      });

      if (conversation.messages.length === 0) {
        await recordMetric(agent.id, {
          conversations: 1,
        });
      }
    } catch (metricError) {
      console.warn("Failed to record metrics:", metricError);
    }

    // Complete the trace
    try {
      await tracer.completeTrace({
        latencyMs: Date.now() - startTime,
        evalResult: {}, // Eval results would be populated if needed
      });
    } catch (traceError) {
      console.warn('Failed to complete trace:', traceError);
    }

    // Return response as JSON (streaming via SSE could be added later)
    return new Response(JSON.stringify({
      content: finalText,
      usage: response.usage,
      stopReason: response.stopReason,
    }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Chat error:", error);

    // Fail the trace if it was initialized
    try {
      if (tracer) {
        await tracer.failTrace(error instanceof Error ? error : new Error('Unknown error'));
      }
    } catch (traceError) {
      console.warn('Failed to record trace failure:', traceError);
    }

    return new Response(
      error instanceof Error ? error.message : "Internal server error",
      { status: 500 }
    );
  }
}

/**
 * Sanitize tool name to match Claude API requirements (alphanumeric + underscores)
 */
function sanitizeToolName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Convert AgentTools (connected workflows) to tool format
 */
function createToolsFromAgentTools(
  agentTools: AgentToolWithWorkflow[],
  userId: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  for (const agentTool of agentTools) {
    const toolName = sanitizeToolName(agentTool.name);

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

          // Composio-based tool
          if (agentTool.composioAppKey && agentTool.composioActionName) {
            const { getComposio } = await import("@/lib/composio-server");
            const composio = getComposio();

            const result = await composio.executeAction(userId, {
              name: agentTool.composioActionName,
              input: initialData,
            });

            return result as Record<string, unknown>;
          }

          return {
            error: true,
            message: "Invalid tool configuration",
          };
        } catch (error) {
          console.error(`Tool "${agentTool.name}" execution error:`, error);
          return {
            error: true,
            message: error instanceof Error ? error.message : "Tool execution failed",
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
        message: z.string().describe("The message or question to send to the other agent"),
      }),
      execute: async (args: { message: string }): Promise<Record<string, unknown>> => {
        try {
          const targetAgent = connection.targetAgent;

          // Use ClaudeClient for Anthropic agents
          if (targetAgent.model === AgentModel.ANTHROPIC) {
            const client = new ClaudeClient({ apiKey: getPlatformApiKey() });
            const response = await client.chat({
              model: "smart",
              messages: [{ role: "user", content: args.message }],
              systemPrompt: targetAgent.systemPrompt,
              temperature: targetAgent.temperature,
              maxSteps: 1,
              userId: targetAgent.id,
            });

            const textBlocks = response.content.filter((block: any) => block.type === "text");
            const text = textBlocks.map((block: any) => block.text).join("\n");

            return {
              agentName: targetAgent.name,
              response: text,
            };
          }

          return {
            error: true,
            message: "Only Anthropic models are supported for multi-agent communication",
          };
        } catch (error) {
          console.error(`Agent communication error (${connection.targetAgent.name}):`, error);
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to communicate with agent",
          };
        }
      },
    };
  }

  return tools;
}

/**
 * Create native integration tools (Gmail, Calendar, Slack, Notion)
 */
async function createIntegrationTools(
  userId: string,
  safeMode: boolean = false,
  conversationId?: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  // Check Gmail integration
  const hasGmail = await hasIntegration(userId, "GMAIL");
  if (hasGmail) {
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

    tools.list_emails = {
      description: "List recent emails from the user's Gmail inbox",
      parameters: z.object({
        maxResults: z.number().optional().default(10),
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
              subject: email.headers?.find((h) => h.name === "Subject")?.value,
            })),
          };
        } catch (error) {
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to list emails",
          };
        }
      },
    };

    tools.search_emails = {
      description: "Search emails in the user's Gmail account",
      parameters: z.object({
        query: z.string(),
        maxResults: z.number().optional().default(10),
      }),
      execute: async (args: { query: string; maxResults?: number }): Promise<Record<string, unknown>> => {
        try {
          const emails = await searchEmails(userId, args.query, args.maxResults || 10);
          return { success: true, count: emails.length, emails };
        } catch (error) {
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
    tools.list_calendar_events = {
      description: "List upcoming events from Google Calendar",
      parameters: z.object({
        daysAhead: z.number().optional().default(7),
      }),
      execute: async (args: { daysAhead?: number }): Promise<Record<string, unknown>> => {
        try {
          const timeMin = new Date();
          const timeMax = new Date();
          timeMax.setDate(timeMax.getDate() + (args.daysAhead || 7));

          const events = await listEvents(userId, timeMin, timeMax);
          return { success: true, count: events?.length || 0, events };
        } catch (error) {
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to list events",
          };
        }
      },
    };

    tools.create_calendar_event = {
      description: "Create a new Google Calendar event",
      parameters: z.object({
        summary: z.string(),
        description: z.string().optional(),
        startDateTime: z.string(),
        endDateTime: z.string(),
        attendees: z.array(z.string()).optional(),
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
          return { success: true, eventId: result.data.id };
        } catch (error) {
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to create event",
          };
        }
      },
    };
  }

  // Check Slack integration
  const hasSlack = await hasIntegration(userId, "SLACK");
  if (hasSlack) {
    tools.send_slack_message = {
      description: "Send a message to a Slack channel",
      parameters: z.object({
        channel: z.string(),
        text: z.string(),
      }),
      execute: async (args: { channel: string; text: string }): Promise<Record<string, unknown>> => {
        try {
          const result = await sendSlackMessage(userId, args.channel, args.text);
          return { success: true, messageTs: result.ts };
        } catch (error) {
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to send Slack message",
          };
        }
      },
    };

    tools.list_slack_channels = {
      description: "List available Slack channels",
      parameters: z.object({}),
      execute: async (): Promise<Record<string, unknown>> => {
        try {
          const channels = await listSlackChannels(userId);
          return { success: true, count: channels.length, channels };
        } catch (error) {
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to list channels",
          };
        }
      },
    };

    tools.read_slack_channel = {
      description: "Read recent messages from a Slack channel",
      parameters: z.object({
        channel: z.string(),
        limit: z.number().optional().default(10),
      }),
      execute: async (args: { channel: string; limit?: number }): Promise<Record<string, unknown>> => {
        try {
          const messages = await getSlackChannelHistory(userId, args.channel, args.limit || 10);
          return { success: true, count: messages.length, messages };
        } catch (error) {
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to read channel",
          };
        }
      },
    };
  }

  // Check Notion integration
  const hasNotion = await hasNotionIntegration(userId);
  if (hasNotion) {
    tools.search_notion = {
      description: "Search for pages in Notion workspace",
      parameters: z.object({
        query: z.string(),
      }),
      execute: async (args: { query: string }): Promise<Record<string, unknown>> => {
        try {
          const pages = await searchNotionPages(userId, args.query);
          return { success: true, count: pages.length, pages };
        } catch (error) {
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to search Notion",
          };
        }
      },
    };

    tools.read_notion_page = {
      description: "Read content of a Notion page",
      parameters: z.object({
        pageId: z.string(),
      }),
      execute: async (args: { pageId: string }): Promise<Record<string, unknown>> => {
        try {
          const page = await getNotionPage(userId, args.pageId);
          return { success: true, ...page };
        } catch (error) {
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to read page",
          };
        }
      },
    };

    tools.create_notion_page = {
      description: "Create a new Notion page",
      parameters: z.object({
        title: z.string(),
        content: z.string(),
        parentPageId: z.string().optional(),
        databaseId: z.string().optional(),
      }),
      execute: async (args: {
        title: string;
        content: string;
        parentPageId?: string;
        databaseId?: string;
      }): Promise<Record<string, unknown>> => {
        try {
          if (!args.parentPageId && !args.databaseId) {
            return { error: true, message: "Either parentPageId or databaseId is required" };
          }
          const page = await createNotionPage(userId, args);
          return { success: true, ...page };
        } catch (error) {
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to create page",
          };
        }
      },
    };

    tools.append_to_notion = {
      description: "Append content to an existing Notion page",
      parameters: z.object({
        pageId: z.string(),
        content: z.string(),
      }),
      execute: async (args: { pageId: string; content: string }): Promise<Record<string, unknown>> => {
        try {
          const result = await appendToNotionPage(userId, args.pageId, args.content);
          return { success: true, blocksAdded: result.blocksAdded };
        } catch (error) {
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to append",
          };
        }
      },
    };

    tools.list_notion_databases = {
      description: "List available Notion databases",
      parameters: z.object({}),
      execute: async (): Promise<Record<string, unknown>> => {
        try {
          const databases = await listNotionDatabases(userId);
          return { success: true, count: databases.length, databases };
        } catch (error) {
          return {
            error: true,
            message: error instanceof Error ? error.message : "Failed to list databases",
          };
        }
      },
    };
  }

  return tools;
}

/**
 * Create memory tools for agent self-management
 */
function createMemoryTools(agentId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  tools.save_memory = {
    description: "Save information to remember for future conversations",
    parameters: z.object({
      key: z.string(),
      value: z.string(),
      category: z.enum(["GENERAL", "PREFERENCE", "CONTEXT", "HISTORY", "INSTRUCTION"]).optional(),
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
        return {
          error: true,
          message: error instanceof Error ? error.message : "Failed to save memory",
        };
      }
    },
  };

  tools.get_memories = {
    description: "Retrieve all saved memories",
    parameters: z.object({}),
    execute: async (): Promise<Record<string, unknown>> => {
      try {
        const memories = await prisma.agentMemory.findMany({
          where: { agentId },
          select: { key: true, value: true, category: true },
        });
        return { success: true, count: memories.length, memories };
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : "Failed to get memories",
        };
      }
    },
  };

  tools.delete_memory = {
    description: "Delete a memory that is no longer relevant",
    parameters: z.object({
      key: z.string(),
    }),
    execute: async (args: { key: string }): Promise<Record<string, unknown>> => {
      try {
        await prisma.agentMemory.delete({
          where: { agentId_key: { agentId, key: args.key } },
        });
        return { success: true, message: `Deleted memory: ${args.key}` };
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : "Failed to delete memory",
        };
      }
    },
  };

  return tools;
}
