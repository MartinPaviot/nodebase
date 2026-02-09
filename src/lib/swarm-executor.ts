import prisma from "./db";
import Anthropic from "@anthropic-ai/sdk";
import Handlebars from "handlebars";

const MAX_CONCURRENT = 10; // Max parallel executions

export async function executeSwarm(swarmId: string) {
  const swarm = await prisma.agentSwarm.findUnique({
    where: { id: swarmId },
    include: {
      agent: { include: { credential: true } },
      tasks: { where: { status: "PENDING" } },
    },
  });

  if (!swarm) throw new Error("Swarm not found");

  await prisma.agentSwarm.update({
    where: { id: swarmId },
    data: { status: "RUNNING" },
  });

  const template = Handlebars.compile(swarm.taskTemplate);

  // Get API key from credential or environment
  const apiKey = swarm.agent.credential?.value || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await prisma.agentSwarm.update({
      where: { id: swarmId },
      data: { status: "FAILED" },
    });
    throw new Error("No API key available");
  }

  const anthropic = new Anthropic({ apiKey });

  // Process tasks in batches
  const pendingTasks = [...swarm.tasks];

  while (pendingTasks.length > 0) {
    // Check if swarm was cancelled
    const currentSwarm = await prisma.agentSwarm.findUnique({
      where: { id: swarmId },
      select: { status: true },
    });

    if (currentSwarm?.status === "CANCELLED") {
      break;
    }

    const batch = pendingTasks.splice(0, MAX_CONCURRENT);

    await Promise.all(
      batch.map(async (task) => {
        try {
          // Mark as running
          await prisma.swarmTask.update({
            where: { id: task.id },
            data: { status: "RUNNING", startedAt: new Date() },
          });

          // Generate prompt from template
          const prompt = template(task.input as Record<string, unknown>);

          // Execute with LLM
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            system: swarm.agent.systemPrompt,
            messages: [{ role: "user", content: prompt }],
          });

          const output =
            response.content[0].type === "text" ? response.content[0].text : "";

          // Mark as completed
          await prisma.swarmTask.update({
            where: { id: task.id },
            data: {
              status: "COMPLETED",
              output,
              completedAt: new Date(),
            },
          });

          await prisma.agentSwarm.update({
            where: { id: swarmId },
            data: { completedTasks: { increment: 1 } },
          });
        } catch (error) {
          await prisma.swarmTask.update({
            where: { id: task.id },
            data: {
              status: "FAILED",
              error: error instanceof Error ? error.message : "Unknown error",
              completedAt: new Date(),
            },
          });

          await prisma.agentSwarm.update({
            where: { id: swarmId },
            data: { failedTasks: { increment: 1 } },
          });
        }
      })
    );
  }

  // Update swarm status
  const finalSwarm = await prisma.agentSwarm.findUnique({
    where: { id: swarmId },
  });

  if (finalSwarm && finalSwarm.status !== "CANCELLED") {
    await prisma.agentSwarm.update({
      where: { id: swarmId },
      data: {
        status:
          finalSwarm.failedTasks === finalSwarm.totalTasks
            ? "FAILED"
            : "COMPLETED",
      },
    });
  }
}

/**
 * Cancel a running swarm
 */
export async function cancelSwarm(swarmId: string) {
  const swarm = await prisma.agentSwarm.findUnique({
    where: { id: swarmId },
    select: { status: true },
  });

  if (!swarm) throw new Error("Swarm not found");
  if (swarm.status !== "RUNNING" && swarm.status !== "PENDING") {
    throw new Error("Swarm is not running");
  }

  // Mark swarm as cancelled
  await prisma.agentSwarm.update({
    where: { id: swarmId },
    data: { status: "CANCELLED" },
  });

  // Mark all pending tasks as failed
  await prisma.swarmTask.updateMany({
    where: {
      swarmId,
      status: "PENDING",
    },
    data: {
      status: "FAILED",
      error: "Swarm cancelled",
      completedAt: new Date(),
    },
  });
}
