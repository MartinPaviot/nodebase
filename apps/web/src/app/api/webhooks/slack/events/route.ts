import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendSlackMessage, getSlackIntegrationByTeamId } from "@/lib/integrations/slack";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { AgentModel } from "@prisma/client";
import { getPlatformApiKey } from "@/lib/config";

export async function POST(request: NextRequest) {
  const body = await request.json();

  // URL verification challenge (Slack sends this when setting up the webhook)
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  // Handle events
  if (body.type === "event_callback") {
    const event = body.event;
    const teamId = body.team_id;

    // Handle app mention
    if (event.type === "app_mention") {
      // Process in background to avoid timeout
      processSlackMention(teamId, event).catch(console.error);
    }
  }

  // Always respond quickly to Slack
  return NextResponse.json({ ok: true });
}

async function processSlackMention(
  teamId: string,
  event: {
    type: string;
    user: string;
    text: string;
    channel: string;
    ts: string;
  }
) {
  try {
    // Find integration by team ID
    const integration = await getSlackIntegrationByTeamId(teamId);

    if (!integration) {
      console.error("No integration found for team:", teamId);
      return;
    }

    // Find an agent for this user with a CHAT trigger enabled
    const trigger = await prisma.agentTrigger.findFirst({
      where: {
        agent: { userId: integration.userId },
        type: "CHAT",
        enabled: true,
      },
      include: {
        agent: true,
      },
    });

    if (!trigger) {
      console.log("No agent with CHAT trigger found for user:", integration.userId);
      return;
    }

    const agent = trigger.agent;

    // Get platform API key
    const apiKey = getPlatformApiKey();

    // Create model
    const model = createModel(agent.model, apiKey);

    // Remove the bot mention from the text (format: <@BOTID> message)
    const cleanText = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();

    // Generate response
    const response = await generateText({
      model,
      system: agent.systemPrompt,
      prompt: cleanText,
      temperature: agent.temperature,
    });

    // Send reply to Slack
    await sendSlackMessage(integration.userId, event.channel, response.text);
  } catch (error) {
    console.error("Error processing Slack mention:", error);
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
