import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { AgentResource } from "@/lib/resources/agent-resource";
import { Authenticator } from "@/lib/resources/authenticator";
import { NotFoundError, ValidationError } from "@/lib/errors";

const CreateToolSchema = z.object({
  type: z.enum(["composio_action", "custom"]),
  name: z.string(),
  config: z.record(z.any()),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agentId } = await params;
    const body = await req.json();

    // Validate input
    const validatedData = CreateToolSchema.parse(body);

    // Use Resource Pattern - automatic permission check
    const authenticator = new Authenticator({
      userId: session.user.id,
      workspaceId: undefined,
      isAdmin: false,
    });

    const agent = await AgentResource.findById(agentId, authenticator);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Extract description from config if it exists
    const description = (validatedData.config as Record<string, unknown>)?.description as string | undefined;

    // Add tool via AgentResource (automatic permission check)
    const tool = await agent.addTool({
      name: validatedData.name,
      description: description || undefined,
      type: validatedData.type,
      config: validatedData.config,
    });

    return NextResponse.json({ data: tool });
  } catch (error) {
    console.error("Error creating agent tool:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create tool" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agentId } = await params;

    // Use Resource Pattern - automatic permission check
    const authenticator = new Authenticator({
      userId: session.user.id,
      workspaceId: undefined,
      isAdmin: false,
    });

    const agent = await AgentResource.findById(agentId, authenticator);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get tools via AgentResource (automatic permission check)
    const tools = await agent.getTools();

    return NextResponse.json({ data: tools });
  } catch (error) {
    console.error("Error fetching agent tools:", error);

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch tools" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const toolId = searchParams.get("toolId");

    if (!toolId) {
      return NextResponse.json(
        { error: "Missing toolId parameter" },
        { status: 400 }
      );
    }

    const { agentId } = await params;

    // Use Resource Pattern - automatic permission check
    const authenticator = new Authenticator({
      userId: session.user.id,
      workspaceId: undefined,
      isAdmin: false,
    });

    const agent = await AgentResource.findById(agentId, authenticator);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Delete tool via AgentResource (automatic permission check + validation)
    await agent.deleteTool(toolId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting agent tool:", error);

    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete tool" },
      { status: 500 }
    );
  }
}
