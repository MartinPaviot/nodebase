import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";
import { decrypt } from "@/lib/encryption";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { description, agentId } = await request.json() as {
      description: string;
      agentId?: string;
    };

    if (!description) {
      return Response.json({ error: "Description is required" }, { status: 400 });
    }

    // Get API key
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
      // Return a fallback purpose card without AI
      return Response.json({
        purpose: {
          description: description,
          trigger: "Conversation (direct chat)",
          tools: ["Web Search", "Browser", "Code Interpreter"],
          features: [
            "Responds to user messages in real-time",
            "Uses available tools to complete tasks",
            "Maintains conversation context",
          ],
        },
        message: "Agent configuration created (AI unavailable)",
      });
    }

    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You are an AI assistant that analyzes agent descriptions and generates structured summaries.
Given a user's description of what they want an AI agent to do, generate a JSON response with:
- description: A clear, concise summary of the agent's purpose (1-2 sentences)
- trigger: How the agent is activated (e.g., "Conversation (direct chat)", "Email received", "Scheduled (daily)", etc.)
- tools: An array of tools the agent would need (e.g., "Perplexity (web search)", "Browser", "Gmail", "Code Interpreter", "Google Sheets", etc.)
- features: An array of 2-4 key features/capabilities of the agent

Respond ONLY with valid JSON, no markdown formatting.`,
      messages: [
        {
          role: "user",
          content: `Analyze this agent description and generate a purpose summary:\n\n"${description}"`,
        },
      ],
    });

    // Extract text content
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from AI");
    }

    // Parse the JSON response
    let purpose;
    try {
      purpose = JSON.parse(textBlock.text);
    } catch {
      // If parsing fails, create a structured response from the text
      purpose = {
        description: description,
        trigger: "Conversation (direct chat)",
        tools: ["Web Search", "Browser"],
        features: ["Responds to user messages", "Completes tasks as requested"],
      };
    }

    // Update agent if agentId provided
    if (agentId) {
      await prisma.agent.update({
        where: { id: agentId, userId: session.user.id },
        data: {
          description: purpose.description,
        },
      });
    }

    return Response.json({
      purpose,
      message: "Agent purpose generated successfully",
    });
  } catch (error) {
    console.error("Purpose generation error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate purpose" },
      { status: 500 }
    );
  }
}
