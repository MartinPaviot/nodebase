import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { headers } from "next/headers";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { AgentModel, MessageRole } from "@/generated/prisma";

export const maxDuration = 60;

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
    const { conversationId, message } = body;

    if (!conversationId || !message) {
      return new Response("Missing conversationId or message", { status: 400 });
    }

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

    // Build message history for context
    const messageHistory = conversation.messages.map((msg) => ({
      role: msg.role.toLowerCase() as "user" | "assistant" | "system",
      content: msg.content,
    }));

    // Add current message
    messageHistory.push({
      role: "user" as const,
      content: message,
    });

    // Stream the response
    const result = streamText({
      model,
      system: agent.systemPrompt,
      messages: messageHistory,
      temperature: agent.temperature,
      onFinish: async ({ text }) => {
        // Save assistant message
        await prisma.message.create({
          data: {
            conversationId,
            role: MessageRole.ASSISTANT,
            content: text,
          },
        });

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
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Chat error:", error);
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
