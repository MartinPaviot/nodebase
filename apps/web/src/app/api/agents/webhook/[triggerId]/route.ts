import prisma from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { AgentModel } from "@prisma/client";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ triggerId: string }> }
) {
  try {
    const { triggerId } = await params;
    const url = new URL(request.url);
    const secret = url.searchParams.get("secret");

    // Get trigger with agent
    const trigger = await prisma.agentTrigger.findUnique({
      where: { id: triggerId },
      include: {
        agent: {
          include: {
            credential: true,
          },
        },
      },
    });

    if (!trigger) {
      return new Response("Trigger not found", { status: 404 });
    }

    if (!trigger.enabled) {
      return new Response("Trigger is disabled", { status: 403 });
    }

    // Verify webhook secret
    if (trigger.webhookSecret && trigger.webhookSecret !== secret) {
      return new Response("Invalid secret", { status: 401 });
    }

    // Parse incoming data
    let payload: Record<string, unknown> = {};
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      try {
        payload = await request.json();
      } catch {
        // Empty body or invalid JSON
      }
    }

    const agent = trigger.agent;

    // Get API key
    let apiKey: string | undefined;
    if (agent.credential) {
      apiKey = decrypt(agent.credential.value);
    }

    if (!apiKey) {
      return new Response("No API credential configured", { status: 400 });
    }

    // Create model
    const model = createModel(agent.model, apiKey);

    // Build prompt from trigger config and payload
    const triggerConfig = trigger.config as Record<string, unknown>;
    const promptTemplate = (triggerConfig.promptTemplate as string) ||
      "You received a webhook with the following data: {{data}}. Process this according to your instructions.";

    const prompt = promptTemplate.replace(
      "{{data}}",
      JSON.stringify(payload, null, 2)
    );

    // Create a conversation for this trigger execution
    const conversation = await prisma.conversation.create({
      data: {
        agentId: agent.id,
        title: `Webhook: ${trigger.name} - ${new Date().toISOString()}`,
      },
    });

    // Save user message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: prompt,
      },
    });

    // Generate response
    const result = await generateText({
      model,
      system: agent.systemPrompt,
      prompt,
      temperature: agent.temperature,
    });

    // Save assistant response
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: result.text,
      },
    });

    // Update trigger last run time
    await prisma.agentTrigger.update({
      where: { id: triggerId },
      data: { lastRunAt: new Date() },
    });

    return Response.json({
      success: true,
      conversationId: conversation.id,
      response: result.text,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      error instanceof Error ? error.message : "Internal server error",
      { status: 500 }
    );
  }
}

// Also support GET for simple webhooks
export async function GET(
  request: Request,
  props: { params: Promise<{ triggerId: string }> }
) {
  return POST(request, props);
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
