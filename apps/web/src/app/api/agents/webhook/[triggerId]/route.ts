import prisma from "@/lib/db";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { AgentModel } from "@prisma/client";
import { AgentTracer } from "@elevay/core";
import { calculateCost, getPlatformApiKey } from "@/lib/config";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ triggerId: string }> }
) {
  const startTime = Date.now();
  let tracer: AgentTracer | null = null;

  try {
    const { triggerId } = await params;
    const url = new URL(request.url);
    const secret = url.searchParams.get("secret");

    // Get trigger with agent
    const trigger = await prisma.agentTrigger.findUnique({
      where: { id: triggerId },
      include: {
        agent: true,
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

    // Get platform API key
    const apiKey = getPlatformApiKey();

    // Create model
    const model = createModel(agent.model, apiKey);
    const modelName = getModelName(agent.model);

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
        source: "WEBHOOK",
      },
    });

    // Initialize tracer with onSave to persist to DB
    tracer = new AgentTracer(
      {
        agentId: agent.id,
        conversationId: conversation.id,
        userId: agent.userId,
        workspaceId: agent.userId,
        triggeredBy: "webhook",
      },
      async (trace) => {
        try {
          await prisma.agentTrace.create({
            data: {
              id: trace.id,
              agentId: trace.agentId,
              conversationId: trace.conversationId || conversation.id,
              userId: trace.userId,
              workspaceId: trace.workspaceId,
              status: trace.status === "completed" ? "COMPLETED" : "FAILED",
              steps: JSON.parse(JSON.stringify(trace.steps)),
              totalSteps: trace.metrics.stepsCount,
              maxSteps: 1,
              totalTokensIn: trace.metrics.totalTokensIn,
              totalTokensOut: trace.metrics.totalTokensOut,
              totalCost: trace.metrics.totalCost,
              toolCalls: [],
              toolSuccesses: 0,
              toolFailures: 0,
              latencyMs: trace.durationMs,
              completedAt: trace.completedAt,
            },
          });
        } catch (saveError) {
          console.warn("Failed to persist webhook trace:", saveError);
        }
      }
    );

    // Save user message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: prompt,
      },
    });

    // Generate response
    const llmStart = Date.now();
    const result = await generateText({
      model,
      system: agent.systemPrompt,
      prompt,
      temperature: agent.temperature,
    });
    const llmLatency = Date.now() - llmStart;

    // Record LLM call in tracer
    const tokensIn = result.usage?.inputTokens || 0;
    const tokensOut = result.usage?.outputTokens || 0;

    tracer.logLLMCall({
      model: modelName,
      input: prompt,
      output: result.text,
      tokensIn,
      tokensOut,
      cost: calculateCost(tokensIn, tokensOut, "smart"),
      durationMs: llmLatency,
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

    // Complete and persist trace
    await tracer.complete({ status: "completed" });

    return Response.json({
      success: true,
      conversationId: conversation.id,
      response: result.text,
    });
  } catch (error) {
    console.error("Webhook error:", error);

    if (tracer) {
      try {
        tracer.logError(error instanceof Error ? error : new Error("Unknown error"));
        await tracer.complete({ status: "failed" });
      } catch {
        // Ignore tracer errors
      }
    }

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

function getModelName(modelType: AgentModel): string {
  switch (modelType) {
    case AgentModel.ANTHROPIC:
      return "claude-sonnet-4-5";
    case AgentModel.OPENAI:
      return "gpt-4o";
    case AgentModel.GEMINI:
      return "gemini-1.5-pro";
    default:
      return "unknown";
  }
}
