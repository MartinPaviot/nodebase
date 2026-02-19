import prisma from "@/lib/db";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, type CoreMessage } from "ai";
import { AgentModel, MessageRole } from "@prisma/client";
import { getPlatformApiKey } from "@/lib/config";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentId, conversationId, message } = body;

    if (!agentId || !message) {
      return Response.json(
        { error: "Missing agentId or message" },
        { status: 400 }
      );
    }

    // Get embed config to verify it's enabled
    const embed = await prisma.agentEmbed.findUnique({
      where: { agentId },
      include: {
        agent: true,
      },
    });

    if (!embed || !embed.enabled) {
      return Response.json(
        { error: "Embed not configured or disabled" },
        { status: 403 }
      );
    }

    // Check origin if domain restrictions are set
    const origin = request.headers.get("origin");
    if (embed.allowedDomains.length > 0 && origin) {
      try {
        const originHost = new URL(origin).hostname;
        const isAllowed = embed.allowedDomains.some(
          (domain) => originHost === domain || originHost.endsWith(`.${domain}`)
        );
        if (!isAllowed) {
          return Response.json(
            { error: "Domain not allowed" },
            { status: 403 }
          );
        }
      } catch {
        // Invalid origin URL, reject
        return Response.json({ error: "Invalid origin" }, { status: 403 });
      }
    }

    const agent = embed.agent;

    // Get platform API key
    const apiKey = getPlatformApiKey();

    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId, agentId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 20, // Limit context for embed
          },
        },
      });
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          agentId,
          title: `Embed: ${message.slice(0, 30)}...`,
        },
        include: {
          messages: true,
        },
      });
    }

    // Create model
    const model = createModel(agent.model, apiKey);

    // Build message history
    const messageHistory: CoreMessage[] = conversation.messages
      .filter((msg) => msg.role !== MessageRole.TOOL)
      .map((msg) => ({
        role: msg.role.toLowerCase() as "user" | "assistant",
        content: msg.content,
      }));

    messageHistory.push({
      role: "user",
      content: message,
    });

    // Save user message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.USER,
        content: message,
      },
    });

    // Generate response
    const result = await generateText({
      model,
      system: agent.systemPrompt,
      messages: messageHistory,
      temperature: agent.temperature,
    });

    // Save assistant response
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.ASSISTANT,
        content: result.text,
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return Response.json({
      conversationId: conversation.id,
      response: result.text,
    });
  } catch (error) {
    console.error("Embed chat error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
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
