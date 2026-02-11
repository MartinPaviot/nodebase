import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { headers } from "next/headers";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, stepCountIs, type CoreMessage } from "ai";
import { z } from "zod";
import { AgentModel, MessageRole, ActivityType, MemoryCategory } from "@/generated/prisma";
import { executeWorkflowSync } from "@/lib/workflow-executor";
import type { AgentTool, Workflow } from "@/generated/prisma";
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
import { AgentTracer } from "@nodebase/core";

export const maxDuration = 300; // 5 minutes for Pro plan

// Actions that have side effects and require confirmation in Safe Mode
const SIDE_EFFECT_ACTIONS = new Set([
  "send_email",
  "create_calendar_event",
  "send_slack_message",
  "create_notion_page",
  "append_to_notion",
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
            credential: true,
            agentTools: {
              include: {
                workflow: true,
              },
            },
            // Multi-agent connections
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
    tracer = new AgentTracer({
      agentId: agent.id,
      conversationId,
      userId: session.user.id,
      workspaceId: agent.workspaceId || session.user.id, // Use workspaceId or fallback to userId
      maxSteps: 5,
    });

    // Start tracing
    await tracer.startTrace();

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

    // Create model instance based on agent configuration
    const model = createModel(agent.model, apiKey);

    // Save user message to database
    await prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.USER,
        content: message,
      },
    });

    // Build message history for context (only user and assistant messages)
    const messageHistory: CoreMessage[] = conversation.messages
      .filter((msg) => msg.role !== MessageRole.TOOL)
      .map((msg) => ({
        role: msg.role.toLowerCase() as "user" | "assistant" | "system",
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
      // Log but don't fail the request if RAG search fails
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

    // Create integration tools (Gmail, Calendar)
    // Pass safeMode and conversationId for confirmation handling
    const integrationTools = await createIntegrationTools(
      session.user.id,
      agent.safeMode,
      conversationId
    );

    // Create memory tools for the agent to manage its own memories
    const memoryTools = createMemoryTools(agent.id);

    // Merge all tools
    const tools = { ...workflowTools, ...agentConnectionTools, ...integrationTools, ...memoryTools };

    // Stream the response
    const result = streamText({
      model,
      system: enhancedSystemPrompt,
      messages: messageHistory,
      temperature: agent.temperature,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: Object.keys(tools).length > 0 ? (tools as any) : undefined,
      stopWhen: stepCountIs(5), // Allow up to 5 tool call rounds
      onFinish: async ({ text, steps, usage }) => {
        // Record LLM call in trace (aggregate usage from all steps)
        try {
          const totalLatency = Date.now() - startTime;
          const tokensIn = usage?.promptTokens || 0;
          const tokensOut = usage?.completionTokens || 0;

          // Estimate cost based on model (rough approximation)
          const costPerInputToken = agent.model === AgentModel.ANTHROPIC ? 0.003 / 1000 : 0.01 / 1000;
          const costPerOutputToken = agent.model === AgentModel.ANTHROPIC ? 0.015 / 1000 : 0.03 / 1000;
          const totalCost = (tokensIn * costPerInputToken) + (tokensOut * costPerOutputToken);

          await tracer.recordLlmCall({
            agentId: agent.id,
            userId: session.user.id,
            workspaceId: agent.workspaceId || session.user.id,
            model: agent.model,
            tokensIn,
            tokensOut,
            cost: totalCost,
            latencyMs: totalLatency,
            stepNumber: steps.length,
            action: 'response',
          });
        } catch (traceError) {
          console.warn('Failed to record LLM call in trace:', traceError);
        }

        // Log user message activity
        try {
          await logActivity(
            conversationId,
            "MESSAGE_RECEIVED",
            "User sent a message",
            { preview: message.slice(0, 100) }
          );
        } catch (e) {
          console.warn("Failed to log message activity:", e);
        }

        // Save tool call messages from all steps and log activities
        for (const step of steps) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const toolCalls = step.toolCalls as any[] | undefined;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const toolResults = step.toolResults as any[] | undefined;

          if (toolCalls && toolCalls.length > 0) {
            for (let i = 0; i < toolCalls.length; i++) {
              const toolCall = toolCalls[i];
              const toolResult = toolResults?.[i];

              // Save message to database
              await prisma.message.create({
                data: {
                  conversationId,
                  role: MessageRole.TOOL,
                  content: `Called tool: ${toolCall.toolName}`,
                  toolName: toolCall.toolName,
                  toolInput: toolCall.args ?? undefined,
                  toolOutput: toolResult?.result ?? undefined,
                },
              });

              // Log activity for tool call
              try {
                // Determine if tool succeeded or failed
                const result = toolResult?.result as Record<string, unknown> | undefined;
                const hasError = result?.error === true;

                if (hasError) {
                  await logActivity(
                    conversationId,
                    "TOOL_FAILED",
                    `Failed: ${toolCall.toolName}`,
                    { error: result?.message || "Unknown error" }
                  );
                } else {
                  // Log specific activity types for known tools
                  const activityType = ACTION_TO_ACTIVITY_TYPE[toolCall.toolName] || "TOOL_COMPLETED";
                  await logActivity(
                    conversationId,
                    activityType as ActivityType,
                    `Completed: ${toolCall.toolName}`,
                    { args: toolCall.args, result: result }
                  );
                }
              } catch (e) {
                console.warn("Failed to log tool activity:", e);
              }
            }
          }
        }

        // Save assistant message (final response)
        if (text) {
          await prisma.message.create({
            data: {
              conversationId,
              role: MessageRole.ASSISTANT,
              content: text,
            },
          });

          // Log assistant message activity
          try {
            await logActivity(
              conversationId,
              "MESSAGE_SENT",
              "Assistant sent a message",
              { preview: text.slice(0, 100) }
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

        // Auto-generate title if this is the first exchange
        if (conversation.messages.length === 0 && !conversation.title) {
          // Use first few words of user message as title
          const title =
            message.slice(0, 50) + (message.length > 50 ? "..." : "");
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { title },
          });
        }

        // Record analytics metrics
        try {
          // Count tool calls from all steps
          let totalToolCalls = 0;
          for (const step of steps) {
            const toolCalls = step.toolCalls as unknown[] | undefined;
            if (toolCalls) {
              totalToolCalls += toolCalls.length;
            }
          }

          // Record metrics for this agent
          await recordMetric(agent.id, {
            messages: 2, // User message + assistant response
            toolCalls: totalToolCalls > 0 ? totalToolCalls : undefined,
          });

          // If this is the first message in conversation, also count new conversation
          if (conversation.messages.length === 0) {
            await recordMetric(agent.id, {
              conversations: 1,
            });
          }
        } catch (metricError) {
          // Don't fail the request if metrics recording fails
          console.warn("Failed to record metrics:", metricError);
        }

        // Complete the trace
        try {
          await tracer.completeTrace({
            latencyMs: Date.now() - startTime,
          });
        } catch (traceError) {
          console.warn('Failed to complete trace:', traceError);
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat error:", error);

    // Fail the trace if it was initialized
    try {
      if (typeof tracer !== 'undefined' && tracer) {
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

function createModel(modelType: AgentModel, apiKey: string) {
  switch (modelType) {
    case AgentModel.ANTHROPIC: {
      const anthropic = createAnthropic({ apiKey });
      return anthropic("claude-sonnet-4-5");
    }
    case AgentModel.OPENAI: {
      const openai = createOpenAI({ apiKey });
      return openai("gpt-4o");
    }
    case AgentModel.GEMINI: {
      const google = createGoogleGenerativeAI({ apiKey });
      return google("gemini-1.5-pro");
    }
    default:
      throw new Error(`Unsupported model type: ${modelType}`);
  }
}

/**
 * Sanitize tool name to match AI SDK requirements (alphanumeric + underscores)
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

          // Workflow-based tool (legacy)
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

          // Composio-based tool (new)
          if (agentTool.type === "composio_action") {
            const config = agentTool.config as Record<string, unknown>;
            const appKey = config?.appKey as string;
            const actionName = config?.actionName as string;

            if (!appKey || !actionName) {
              return {
                error: true,
                message: "Invalid Composio tool configuration: missing appKey or actionName",
              };
            }

            const { getComposio } = await import("@/lib/composio-server");
            const composio = getComposio();

            // Merge saved config with runtime input
            const actionInput = {
              ...initialData,
            };

            const result = await composio.executeAction(userId, {
              name: actionName,
              input: actionInput,
            });

            return result as Record<string, unknown>;
          }

          // Invalid tool configuration
          return {
            error: true,
            message: "Invalid tool configuration: missing workflowId or Composio config",
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
 * Convert agent connections to AI SDK tool format for multi-agent communication
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

          // Get API key for target agent
          if (!targetAgent.credential) {
            return {
              error: true,
              message: `Agent "${targetAgent.name}" has no API credential configured`,
            };
          }

          const apiKey = decrypt(targetAgent.credential.value);
          const model = createModel(targetAgent.model, apiKey);

          // Generate response from target agent
          const result = await import("ai").then(({ generateText }) =>
            generateText({
              model,
              system: targetAgent.systemPrompt,
              prompt: args.message,
              temperature: targetAgent.temperature,
            })
          );

          return {
            agentName: targetAgent.name,
            response: result.text,
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
 * Helper function to create a safe mode wrapper for side-effect tools
 */
function createSafeModeWrapper(
  toolName: string,
  originalExecute: (args: Record<string, unknown>) => Promise<Record<string, unknown>>,
  safeMode: boolean,
  conversationId: string
) {
  if (!safeMode || !SIDE_EFFECT_ACTIONS.has(toolName)) {
    return originalExecute;
  }

  return async (args: Record<string, unknown>): Promise<Record<string, unknown>> => {
    // Create a ConversationActivity requiring confirmation
    const activity = await prisma.conversationActivity.create({
      data: {
        conversationId,
        type: ActivityType.CONFIRMATION_REQUESTED,
        title: ACTION_LABELS[toolName] || toolName,
        details: {
          actionType: toolName,
          actionArgs: args as Record<string, string | number | boolean | null>,
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
    };
  };
}

/**
 * Create native integration tools (Gmail, Calendar) based on user's connected integrations
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
  if (safeMode && conversationId) {
    for (const toolName of SIDE_EFFECT_ACTIONS) {
      if (tools[toolName]) {
        const originalExecute = tools[toolName].execute;
        tools[toolName].execute = createSafeModeWrapper(
          toolName,
          originalExecute,
          safeMode,
          conversationId
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
