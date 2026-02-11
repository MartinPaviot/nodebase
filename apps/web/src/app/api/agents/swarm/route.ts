import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { executeSwarm } from "@/lib/swarm-executor";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId, name, taskTemplate, items } = await request.json();

  // Verify agent ownership
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, userId: session.user.id },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Validate inputs
  if (!name || typeof name !== "string") {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  if (!taskTemplate || typeof taskTemplate !== "string") {
    return NextResponse.json(
      { error: "Task template is required" },
      { status: 400 }
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "Items array is required and must not be empty" },
      { status: 400 }
    );
  }

  // Create swarm with tasks
  const swarm = await prisma.agentSwarm.create({
    data: {
      agentId,
      name,
      taskTemplate,
      totalTasks: items.length,
      tasks: {
        create: items.map((input: Record<string, unknown>) => ({
          input: input as any,
        })),
      },
    },
  });

  // Execute in background
  executeSwarm(swarm.id).catch(console.error);

  return NextResponse.json({ swarmId: swarm.id });
}
