import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { generateTwiml } from "@/lib/integrations/twilio";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { decrypt } from "@/lib/encryption";
import { AgentModel } from "@/generated/prisma";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;
    const callSid = formData.get("CallSid") as string;
    const speechResult = formData.get("SpeechResult") as string | null;
    const callStatus = formData.get("CallStatus") as string;

    // Get agentId from query params (for outbound calls)
    const { searchParams } = new URL(request.url);
    const agentIdParam = searchParams.get("agentId");

    // Find agent by phone number (for inbound) or by agentId (for outbound)
    let agentPhone;
    if (agentIdParam) {
      agentPhone = await prisma.agentPhoneNumber.findUnique({
        where: { agentId: agentIdParam },
        include: {
          agent: {
            include: {
              credential: true,
            },
          },
        },
      });
    } else {
      agentPhone = await prisma.agentPhoneNumber.findUnique({
        where: { phoneNumber: to },
        include: {
          agent: {
            include: {
              credential: true,
            },
          },
        },
      });
    }

    if (!agentPhone) {
      const twiml = generateTwiml(
        "Sorry, this number is not configured.",
        false
      );
      return new NextResponse(twiml, {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Check if voice is enabled
    if (!agentPhone.voiceEnabled) {
      const twiml = generateTwiml(
        "Sorry, voice calls are currently disabled for this agent.",
        false
      );
      return new NextResponse(twiml, {
        headers: { "Content-Type": "text/xml" },
      });
    }

    const agent = agentPhone.agent;

    // If this is the initial call (no speech input yet), play greeting and gather speech
    if (!speechResult) {
      // Log the incoming call
      await prisma.phoneCall.upsert({
        where: { twilioCallSid: callSid },
        create: {
          phoneNumberId: agentPhone.id,
          direction: agentIdParam ? "OUTBOUND" : "INBOUND",
          fromNumber: from,
          toNumber: to,
          status: "IN_PROGRESS",
          twilioCallSid: callSid,
        },
        update: {
          status: "IN_PROGRESS",
        },
      });

      const greeting =
        agentPhone.voiceGreeting ||
        `Hello, you've reached ${agent.name}. How can I help you?`;

      const twiml = generateTwiml(greeting, true, agent.id);
      return new NextResponse(twiml, {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Process speech input with AI
    if (!agent.credential) {
      const twiml = generateTwiml(
        "I apologize, but I'm not properly configured to respond right now. Please try again later.",
        false
      );
      return new NextResponse(twiml, {
        headers: { "Content-Type": "text/xml" },
      });
    }

    const apiKey = decrypt(agent.credential.value);
    const model = createModel(agent.model, apiKey);

    // Build system prompt for phone conversations
    const phoneSystemPrompt = `${agent.systemPrompt}

You are on a phone call. Keep responses concise (2-3 sentences max) and conversational.
Do not use markdown or special formatting. Speak naturally.
Do not use asterisks, bullet points, or numbered lists.
Keep your language simple and clear for spoken delivery.`;

    // Generate AI response
    const aiResponse = await generateText({
      model,
      system: phoneSystemPrompt,
      prompt: speechResult,
      temperature: agent.temperature,
    });

    const reply = aiResponse.text || "I apologize, I couldn't process that.";

    // Update call with transcript
    await prisma.phoneCall.updateMany({
      where: {
        twilioCallSid: callSid,
      },
      data: {
        transcript: prisma.$executeRaw`COALESCE(transcript, '') || '\n\nUser: ' || ${speechResult} || '\nAgent: ' || ${reply}` as unknown as string,
      },
    });

    // Actually update the transcript properly
    const call = await prisma.phoneCall.findUnique({
      where: { twilioCallSid: callSid },
    });

    if (call) {
      const existingTranscript = call.transcript || "";
      const newTranscript = `${existingTranscript}\n\nUser: ${speechResult}\nAgent: ${reply}`.trim();
      await prisma.phoneCall.update({
        where: { id: call.id },
        data: { transcript: newTranscript },
      });
    }

    // Continue conversation
    const twiml = generateTwiml(reply, true, agent.id);
    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Error handling Twilio voice webhook:", error);

    const twiml = generateTwiml(
      "I apologize, but I encountered an error. Please try again later.",
      false
    );
    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
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
