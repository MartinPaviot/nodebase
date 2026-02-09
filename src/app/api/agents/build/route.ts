import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ContentBlockParam, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";
import { generateSlug } from "random-word-slugs";
import { decrypt } from "@/lib/encryption";

export const maxDuration = 120;

const CREATE_AGENT_TOOL = {
  name: "create_agent",
  description: "Create a new AI agent with the specified configuration. Use this tool to build the agent based on the user's requirements.",
  input_schema: {
    type: "object" as const,
    properties: {
      name: {
        type: "string",
        description: "The name of the agent",
      },
      description: {
        type: "string",
        description: "A brief description of what the agent does",
      },
      systemPrompt: {
        type: "string",
        description: "The system prompt that defines the agent's behavior and personality",
      },
      temperature: {
        type: "number",
        description: "The temperature for responses (0-1). Lower values are more focused, higher values more creative.",
      },
      category: {
        type: "string",
        enum: ["PRODUCTIVITY", "SALES", "SUPPORT", "RESEARCH", "CREATIVE", "OPERATIONS", "CUSTOM"],
        description: "The category of the agent",
      },
    },
    required: ["name", "description", "systemPrompt", "temperature", "category"],
  },
};

const UPDATE_AGENT_TOOL = {
  name: "update_agent",
  description: "Update an existing agent's configuration. Use this to modify the agent's name, description, system prompt, or other settings.",
  input_schema: {
    type: "object" as const,
    properties: {
      agentId: {
        type: "string",
        description: "The ID of the agent to update",
      },
      name: {
        type: "string",
        description: "The new name for the agent (optional)",
      },
      description: {
        type: "string",
        description: "The new description (optional)",
      },
      systemPrompt: {
        type: "string",
        description: "The new system prompt (optional)",
      },
      temperature: {
        type: "number",
        description: "The new temperature (optional)",
      },
    },
    required: ["agentId"],
  },
};

// Message format from client
interface ClientMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
    result?: Record<string, unknown>;
  }>;
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { message, history = [], agentContext } = await request.json() as {
      message: string;
      history?: ClientMessage[];
      agentContext?: { id: string; name: string };
    };

    // Get API key - first try environment variable, then user's credential
    let apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      const credential = await prisma.credential.findFirst({
        where: {
          userId: session.user.id,
          type: "ANTHROPIC",
        },
      });

      if (credential) {
        apiKey = decrypt(credential.value);
      }
    }

    if (!apiKey) {
      return new Response("No Anthropic API key configured. Please set ANTHROPIC_API_KEY in .env or add one in Settings > Credentials.", { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey });

    // Convert client history to Anthropic message format
    const messages: MessageParam[] = [];

    for (const msg of history) {
      if (msg.role === "user") {
        messages.push({ role: "user", content: msg.content });
      } else if (msg.role === "assistant") {
        // If the assistant message had tool calls, we need to reconstruct them
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          const contentBlocks: ContentBlockParam[] = [];

          // Add text content if any
          if (msg.content) {
            contentBlocks.push({ type: "text", text: msg.content });
          }

          // Add tool use blocks
          for (const toolCall of msg.toolCalls) {
            contentBlocks.push({
              type: "tool_use",
              id: toolCall.id,
              name: toolCall.name,
              input: toolCall.input,
            });
          }

          messages.push({ role: "assistant", content: contentBlocks });

          // Add tool results as user message
          const toolResults: ToolResultBlockParam[] = msg.toolCalls
            .filter(tc => tc.result)
            .map(tc => ({
              type: "tool_result" as const,
              tool_use_id: tc.id,
              content: JSON.stringify(tc.result),
            }));

          if (toolResults.length > 0) {
            messages.push({ role: "user", content: toolResults });
          }
        } else {
          messages.push({ role: "assistant", content: msg.content });
        }
      }
    }

    // Add the current message
    messages.push({ role: "user", content: message });

    // Build system prompt with context
    let systemPrompt = `You are an AI agent builder assistant. Your job is to help users create and configure AI agents by understanding their requirements.

You have the following tools available:
- create_agent: Create a new AI agent with a name, description, system prompt, temperature, and category
- update_agent: Update an existing agent's configuration

When a user describes what kind of agent they want, use the create_agent tool to build it. Always craft a detailed, helpful system prompt for the agent based on the user's requirements.

After using a tool, provide a brief summary and suggest 2-3 follow-up actions as a numbered list.

Be conversational and helpful. Remember the context of our conversation.`;

    if (agentContext) {
      systemPrompt += `\n\nContext: We have already created an agent named "${agentContext.name}" with ID "${agentContext.id}". You can update this agent using the update_agent tool if the user wants to make changes.`;
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // API call with full conversation history
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: systemPrompt,
            messages,
            tools: [CREATE_AGENT_TOOL, UPDATE_AGENT_TOOL],
          });

          let createdAgent: { id: string; name: string; conversationId?: string } | null = null;
          const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown>; result?: Record<string, unknown> }> = [];

          // Process the response
          for (const block of response.content) {
            if (block.type === "text") {
              controller.enqueue(encoder.encode(`0:${JSON.stringify(block.text)}\n`));
            } else if (block.type === "tool_use") {
              // Send tool call event
              controller.enqueue(encoder.encode(`9:${JSON.stringify({
                toolCallId: block.id,
                toolName: block.name,
                args: block.input,
              })}\n`));

              const toolCall: { id: string; name: string; input: Record<string, unknown>; result?: Record<string, unknown> } = {
                id: block.id,
                name: block.name,
                input: block.input as Record<string, unknown>,
              };

              // Execute the tool
              if (block.name === "create_agent") {
                const input = block.input as {
                  name: string;
                  description: string;
                  systemPrompt: string;
                  temperature: number;
                  category: string;
                };

                try {
                  // Create agent
                  const agent = await prisma.agent.create({
                    data: {
                      name: input.name || generateSlug(2, { format: "title" }),
                      description: input.description,
                      systemPrompt: input.systemPrompt,
                      temperature: input.temperature,
                      model: "ANTHROPIC",
                      userId: session.user.id,
                    },
                  });

                  // Create initial conversation for this agent
                  const conversation = await prisma.conversation.create({
                    data: {
                      agentId: agent.id,
                      title: `Chat with ${agent.name}`,
                      source: "CHAT",
                    },
                  });

                  createdAgent = { id: agent.id, name: agent.name, conversationId: conversation.id };
                  toolCall.result = {
                    success: true,
                    agentId: agent.id,
                    agentName: agent.name,
                    conversationId: conversation.id,
                    message: `Agent "${agent.name}" created successfully`,
                  };

                  controller.enqueue(encoder.encode(`a:${JSON.stringify({
                    toolCallId: block.id,
                    result: toolCall.result,
                  })}\n`));
                } catch (error) {
                  console.error("Create agent error:", error);
                  toolCall.result = {
                    success: false,
                    error: error instanceof Error ? error.message : "Failed to create agent",
                  };
                  controller.enqueue(encoder.encode(`a:${JSON.stringify({
                    toolCallId: block.id,
                    result: toolCall.result,
                  })}\n`));
                }
              } else if (block.name === "update_agent") {
                const input = block.input as {
                  agentId: string;
                  name?: string;
                  description?: string;
                  systemPrompt?: string;
                  temperature?: number;
                };

                try {
                  const agent = await prisma.agent.update({
                    where: { id: input.agentId, userId: session.user.id },
                    data: {
                      ...(input.name && { name: input.name }),
                      ...(input.description && { description: input.description }),
                      ...(input.systemPrompt && { systemPrompt: input.systemPrompt }),
                      ...(input.temperature !== undefined && { temperature: input.temperature }),
                    },
                  });

                  toolCall.result = {
                    success: true,
                    agentId: agent.id,
                    agentName: agent.name,
                    message: `Agent "${agent.name}" updated successfully`,
                  };

                  controller.enqueue(encoder.encode(`a:${JSON.stringify({
                    toolCallId: block.id,
                    result: toolCall.result,
                  })}\n`));
                } catch (error) {
                  console.error("Update agent error:", error);
                  toolCall.result = {
                    success: false,
                    error: error instanceof Error ? error.message : "Failed to update agent",
                  };
                  controller.enqueue(encoder.encode(`a:${JSON.stringify({
                    toolCallId: block.id,
                    result: toolCall.result,
                  })}\n`));
                }
              }

              toolCalls.push(toolCall);
            }
          }

          // If tool was used, make a follow-up call to get the final response
          if (response.stop_reason === "tool_use" && toolCalls.length > 0) {
            const followUpMessages: MessageParam[] = [
              ...messages,
              { role: "assistant", content: response.content },
              {
                role: "user",
                content: toolCalls.map(tc => ({
                  type: "tool_result" as const,
                  tool_use_id: tc.id,
                  content: JSON.stringify(tc.result),
                })),
              },
            ];

            const followUpResponse = await anthropic.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 4096,
              system: systemPrompt,
              messages: followUpMessages,
              tools: [CREATE_AGENT_TOOL, UPDATE_AGENT_TOOL],
            });

            // Stream the follow-up text
            for (const block of followUpResponse.content) {
              if (block.type === "text") {
                controller.enqueue(encoder.encode(`0:${JSON.stringify(block.text)}\n`));
              }
            }
          }

          // Send done event with agent context if created
          controller.enqueue(encoder.encode(`d:${JSON.stringify({
            finishReason: "stop",
            agentContext: createdAgent || agentContext,
          })}\n`));
          controller.close();
        } catch (error) {
          console.error("API Error:", error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          controller.enqueue(encoder.encode(`3:${JSON.stringify(errorMessage)}\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Request error:", error);
    return new Response(
      error instanceof Error ? error.message : "Internal Server Error",
      { status: 500 }
    );
  }
}
