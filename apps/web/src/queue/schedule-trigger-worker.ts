/**
 * Schedule Trigger Worker
 *
 * Polls for AgentTrigger records with type=SCHEDULE and executes
 * agents when their cron expression matches the current time.
 * Runs as a BullMQ repeatable job every 60 seconds.
 */

import { Queue, Worker } from "bullmq";
import { getRedisConnection } from "./bullmq/config";
import prisma from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { ClaudeClient } from "@/lib/ai/claude-client";
import { AgentModel, type AgentTrigger, type Agent, type Credential } from "@prisma/client";
import { CronExpressionParser } from "cron-parser";
import { AgentTracer } from "@nodebase/core";
import { calculateCost } from "@/lib/config";

const QUEUE_NAME = "schedule-triggers";
const JOB_NAME = "check-schedule-triggers";
const POLL_INTERVAL_MS = 60_000; // 60 seconds

type TriggerWithAgent = AgentTrigger & {
  agent: Agent & { credential: Credential | null };
};

let scheduleQueue: Queue | null = null;

function getScheduleQueue(): Queue {
  if (!scheduleQueue) {
    scheduleQueue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return scheduleQueue;
}

/**
 * Schedule the repeatable schedule check job.
 * Call this once at app startup.
 */
export async function scheduleScheduleTrigger(): Promise<void> {
  const queue = getScheduleQueue();

  // Remove old repeatable job if exists
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === JOB_NAME) {
      await queue.removeRepeatableByKey(job.key);
    }
  }

  // Add new repeatable job
  await queue.add(
    JOB_NAME,
    {},
    {
      repeat: {
        every: POLL_INTERVAL_MS,
      },
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 50 },
    }
  );

  console.log(`[ScheduleTrigger] Scheduled polling every ${POLL_INTERVAL_MS / 1000}s`);
}

/**
 * Schedule trigger worker - processes the repeatable job.
 */
export const scheduleTriggerWorker = new Worker(
  QUEUE_NAME,
  async () => {
    await checkScheduleTriggers();
  },
  {
    connection: getRedisConnection(),
    concurrency: 1,
  }
);

/**
 * Check if a cron expression should fire now.
 */
function shouldRunNow(cronExpression: string, lastRunAt: Date | null): boolean {
  try {
    const interval = CronExpressionParser.parse(cronExpression);
    const prevDate = interval.prev().toDate();

    const now = new Date();
    const windowStart = new Date(now.getTime() - POLL_INTERVAL_MS);

    // The cron should fire if:
    // 1. The previous scheduled time is within our poll window (last 60s)
    // 2. AND we haven't already run for this slot
    if (prevDate >= windowStart && prevDate <= now) {
      if (!lastRunAt || lastRunAt < prevDate) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Compute the next run time from a cron expression.
 */
function computeNextRunAt(cronExpression: string): Date | null {
  try {
    const interval = CronExpressionParser.parse(cronExpression);
    return interval.next().toDate();
  } catch {
    return null;
  }
}

/**
 * Check all scheduled triggers and execute those that should fire.
 */
async function checkScheduleTriggers(): Promise<void> {
  const triggers = await prisma.agentTrigger.findMany({
    where: {
      type: "SCHEDULE",
      enabled: true,
      cronExpression: { not: null },
    },
    include: {
      agent: {
        include: {
          credential: true,
        },
      },
    },
  });

  if (triggers.length === 0) return;

  for (const trigger of triggers as TriggerWithAgent[]) {
    if (!trigger.cronExpression) continue;

    if (shouldRunNow(trigger.cronExpression, trigger.lastRunAt)) {
      try {
        await executeScheduledTrigger(trigger);
      } catch (error) {
        console.error(
          `[ScheduleTrigger] Failed to execute trigger "${trigger.name}" (${trigger.id}):`,
          error
        );
      }
    }
  }
}

/**
 * Execute a single scheduled trigger.
 */
async function executeScheduledTrigger(trigger: TriggerWithAgent): Promise<void> {
  const startTime = Date.now();
  const agent = trigger.agent;

  if (!agent.credential) {
    console.warn(`[ScheduleTrigger] Agent "${agent.name}" (${agent.id}) has no credential, skipping`);
    return;
  }

  const apiKey = decrypt(agent.credential.value);

  // Build prompt from trigger config
  const triggerConfig = trigger.config as Record<string, unknown>;
  const promptTemplate = (triggerConfig.promptTemplate as string) ||
    "This is a scheduled run. Execute your tasks according to your instructions.";

  // Create conversation first (needed for tracer)
  const conversation = await prisma.conversation.create({
    data: {
      agentId: agent.id,
      title: `Scheduled: ${trigger.name} - ${new Date().toISOString()}`,
      source: "SCHEDULE",
    },
  });

  // Initialize tracer with onSave to persist to DB
  const tracer = new AgentTracer(
    {
      agentId: agent.id,
      conversationId: conversation.id,
      userId: agent.userId,
      workspaceId: agent.userId,
      triggeredBy: "schedule",
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
            maxSteps: 5,
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
        console.warn("Failed to persist schedule trace:", saveError);
      }
    }
  );

  try {
    // Save user message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: promptTemplate,
      },
    });

    // Execute based on model type
    let responseText: string;
    let tokensIn = 0;
    let tokensOut = 0;
    let modelName = "unknown";

    if (agent.model === AgentModel.ANTHROPIC) {
      modelName = "claude-3-5-sonnet-20241022";
      const client = new ClaudeClient(apiKey);
      const result = await client.chat({
        model: "smart",
        messages: [{ role: "user", content: promptTemplate }],
        systemPrompt: agent.systemPrompt,
        temperature: agent.temperature,
        userId: agent.userId,
        agentId: agent.id,
        conversationId: conversation.id,
        maxSteps: 5,
      });
      responseText = result.content;
      // ClaudeClient tracks events internally
      for (const event of result.events || []) {
        tokensIn += event.tokensIn;
        tokensOut += event.tokensOut;
      }
    } else {
      // Fallback: use Vercel AI SDK for OpenAI/Gemini
      modelName = agent.model === AgentModel.OPENAI ? "gpt-4o" : "gemini-1.5-pro";
      const { generateText } = await import("ai");
      const model = createModelForTrigger(agent.model, apiKey);
      const llmStart = Date.now();
      const result = await generateText({
        model,
        system: agent.systemPrompt,
        prompt: promptTemplate,
        temperature: agent.temperature,
      });
      responseText = result.text;
      tokensIn = result.usage?.inputTokens || 0;
      tokensOut = result.usage?.outputTokens || 0;

      // Record LLM call for non-Anthropic models
      tracer.logLLMCall({
        model: modelName,
        input: promptTemplate,
        output: responseText,
        tokensIn,
        tokensOut,
        cost: calculateCost(tokensIn, tokensOut, "smart"),
        durationMs: Date.now() - llmStart,
      });
    }

    // Save assistant response
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: responseText,
      },
    });

    // Update trigger times
    const nextRunAt = computeNextRunAt(trigger.cronExpression!);
    await prisma.agentTrigger.update({
      where: { id: trigger.id },
      data: {
        lastRunAt: new Date(),
        ...(nextRunAt ? { nextRunAt } : {}),
      },
    });

    // Complete and persist trace
    await tracer.complete({ status: "completed" });

    console.log(
      `[ScheduleTrigger] Executed trigger "${trigger.name}" for agent "${agent.name}" (${agent.id}), next run: ${nextRunAt?.toISOString() ?? "unknown"}`
    );
  } catch (error) {
    tracer.logError(error instanceof Error ? error : new Error(String(error)));
    await tracer.complete({ status: "failed" });
    throw error;
  }
}

/**
 * Create a Vercel AI SDK model for non-Anthropic triggers.
 */
function createModelForTrigger(modelType: AgentModel, apiKey: string) {
  switch (modelType) {
    case AgentModel.OPENAI: {
      const { createOpenAI } = require("@ai-sdk/openai");
      const openai = createOpenAI({ apiKey });
      return openai("gpt-4o");
    }
    case AgentModel.GEMINI: {
      const { createGoogleGenerativeAI } = require("@ai-sdk/google");
      const google = createGoogleGenerativeAI({ apiKey });
      return google("gemini-1.5-pro");
    }
    default:
      throw new Error(`Unsupported model type for schedule trigger: ${modelType}`);
  }
}

/**
 * Remove the repeatable job and close the queue.
 */
export async function removeScheduleTrigger(): Promise<void> {
  const queue = getScheduleQueue();
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === JOB_NAME) {
      await queue.removeRepeatableByKey(job.key);
    }
  }
  await scheduleTriggerWorker.close();
  await queue.close();
}
