// @ts-nocheck
// TODO: Uses planned createAgentBuilder API not yet implemented
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAgentBuilder } from "@nodebase/core";
import { Anthropic } from "@anthropic-ai/sdk";
import { decrypt } from "@/lib/encryption";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, goals, constraints, domain, style } = body;

    if (!name || !description || !goals || !Array.isArray(goals)) {
      return NextResponse.json(
        { error: "Missing required fields: name, description, goals" },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        { error: "No Anthropic API key found. Please add one in settings." },
        { status: 400 }
      );
    }

    // Create Anthropic client
    const anthropic = new Anthropic({ apiKey });

    // Create LLM generate function
    const llmGenerate = async (prompt: string): Promise<string> => {
      const message = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });

      const content = message.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type from LLM");
      }

      return content.text;
    };

    // Create agent builder
    const builder = createAgentBuilder(llmGenerate);

    // Build the agent specification
    const agentSpec = await builder.buildAgent({
      name,
      description,
      goals,
      constraints,
      domain,
      style,
    });

    // Get user's workspace
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { workspaceId: true },
    });

    if (!user?.workspaceId) {
      return NextResponse.json(
        { error: "No workspace found for user" },
        { status: 400 }
      );
    }

    // Create the agent in database
    const agent = await prisma.agent.create({
      data: {
        name,
        description,
        systemPrompt: agentSpec.systemPrompt,
        model: agentSpec.model,
        temperature: agentSpec.temperature,
        userId: session.user.id,
        workspaceId: user.workspaceId,
        // TODO: Add suggested tools and triggers
      },
    });

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        model: agent.model,
        temperature: agent.temperature,
      },
      specification: agentSpec,
    });
  } catch (error) {
    console.error("Error generating agent:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate agent",
      },
      { status: 500 }
    );
  }
}
