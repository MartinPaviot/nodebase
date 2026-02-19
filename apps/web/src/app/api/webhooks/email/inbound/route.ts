import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { AgentModel } from "@prisma/client";
import { getPlatformApiKey } from "@/lib/config";

export const maxDuration = 60;

interface EmailData {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// This endpoint receives emails from email provider webhooks (SendGrid/Mailgun/Postmark)
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let emailData: EmailData;

    // Parse based on provider format
    if (contentType.includes("multipart/form-data")) {
      // SendGrid Inbound Parse format
      const formData = await request.formData();
      emailData = {
        from: (formData.get("from") as string) || "",
        to: (formData.get("to") as string) || "",
        subject: (formData.get("subject") as string) || "",
        text: (formData.get("text") as string) || "",
        html: (formData.get("html") as string) || undefined,
      };
    } else {
      // JSON format (Postmark, custom)
      const body = await request.json();
      emailData = {
        from: body.from || body.From || body.FromFull?.Email || "",
        to: body.to || body.To || body.ToFull?.[0]?.Email || "",
        subject: body.subject || body.Subject || "",
        text: body.text || body.TextBody || body.StrippedTextReply || "",
        html: body.html || body.HtmlBody || undefined,
      };
    }

    // Validate required fields
    if (!emailData.to || !emailData.from) {
      return NextResponse.json(
        { error: "Missing required email fields (from, to)" },
        { status: 400 }
      );
    }

    // Extract local part from 'to' address
    // Handle formats like: "agent-abc123@agents.elevay.app" or "Name <agent-abc123@agents.elevay.app>"
    const toMatch = emailData.to.match(/<([^@]+)@/) || emailData.to.match(/([^@\s]+)@/);
    if (!toMatch) {
      return NextResponse.json(
        { error: "Invalid to address format" },
        { status: 400 }
      );
    }
    const localPart = toMatch[1].toLowerCase();

    // Find agent by email address
    const agentEmail = await prisma.agentEmailAddress.findFirst({
      where: { localPart },
      include: {
        agent: true,
      },
    });

    if (!agentEmail) {
      return NextResponse.json(
        { error: "Agent not found for this email address" },
        { status: 404 }
      );
    }

    const agent = agentEmail.agent;

    // Create a conversation for this email thread
    const conversation = await prisma.conversation.create({
      data: {
        agentId: agentEmail.agentId,
        title: `Email: ${emailData.subject || "(No subject)"}`,
      },
    });

    // Add the email as a message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: `From: ${emailData.from}\nSubject: ${emailData.subject}\n\n${emailData.text}`,
      },
    });

    // Generate agent response if autoReply is enabled
    if (agentEmail.autoReply) {
      // Get platform API key
      const apiKey = getPlatformApiKey();

      // Create model
      const model = createModel(agent.model, apiKey);

      const systemPrompt = `${agent.systemPrompt}

You are responding to an email. Write a professional email response.
Keep your response focused and helpful.
Do not include email headers like "Subject:" or "From:" in your response - just write the body of the email.`;

      const prompt = `Please respond to this email:

From: ${emailData.from}
Subject: ${emailData.subject}

${emailData.text}`;

      // Generate response
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt,
        temperature: agent.temperature,
      });

      const agentReply = result.text;

      // Save agent response
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "ASSISTANT",
          content: agentReply,
        },
      });

      // TODO: Send email reply via email integration (SendGrid, SES, etc.)
      // For now, log it for debugging
      console.log("Agent email reply generated:", {
        agentId: agent.id,
        conversationId: conversation.id,
        replyPreview: agentReply.substring(0, 100) + "...",
      });
    }

    // Update trigger lastRunAt for EMAIL triggers
    await prisma.agentTrigger.updateMany({
      where: {
        agentId: agentEmail.agentId,
        type: "EMAIL",
        enabled: true,
      },
      data: { lastRunAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
    });
  } catch (error) {
    console.error("Email inbound webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
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
