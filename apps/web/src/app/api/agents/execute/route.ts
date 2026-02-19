// @ts-nocheck
// TODO: Uses planned AgentEngine API not yet implemented
/**
 * Agent Execution API Route
 *
 * POST /api/agents/execute
 * Executes an agent with the new core engine.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAgentEngine } from "@/lib/elevay";
import { z } from "zod";
import type { AgentConfig, ExecutionContext } from "@elevay/core";

// ============================================
// Request Schema
// ============================================

const ExecuteAgentRequestSchema = z.object({
  // Agent configuration
  agent: z.object({
    id: z.string(),
    name: z.string(),
    systemPrompt: z.string(),
    llmTier: z.enum(["fast", "smart", "deep"]),
    temperature: z.number().min(0).max(1).default(0.7),
    maxStepsPerRun: z.number().min(1).max(10).default(5),
    fetchSources: z
      .array(
        z.object({
          source: z.string(),
          query: z.string().optional(),
          filters: z.record(z.unknown()).optional(),
        })
      )
      .default([]),
    actions: z
      .array(
        z.object({
          type: z.string(),
          requireApproval: z.boolean().default(true),
        })
      )
      .default([]),
    evalRules: z.object({
      l1: z.object({
        assertions: z.array(
          z.object({
            check: z.string(),
            severity: z.enum(["block", "warn"]),
          })
        ),
      }),
      l2: z.object({
        criteria: z.array(z.string()),
        minScore: z.number().min(0).max(100).default(60),
      }),
      l3: z.object({
        trigger: z.string(),
        minConfidence: z.number().min(0).max(1).default(0.7),
      }),
      requireApproval: z.boolean().default(true),
      autoSendThreshold: z.number().min(0).max(1).default(0.85),
    }),
  }),

  // Execution context
  context: z.object({
    userId: z.string(),
    workspaceId: z.string(),
    triggeredBy: z.string().default("manual"),
    userMessage: z.string().optional(),
    additionalContext: z.record(z.unknown()).optional(),
  }),
});

// ============================================
// POST /api/agents/execute
// ============================================

export async function POST(req: NextRequest) {
  try {
    // Parse and validate request body
    const body = await req.json();
    const validatedData = ExecuteAgentRequestSchema.parse(body);

    // Get agent engine
    const agentEngine = await getAgentEngine();

    // Prepare agent config
    const agentConfig: AgentConfig = {
      id: validatedData.agent.id,
      name: validatedData.agent.name,
      systemPrompt: validatedData.agent.systemPrompt,
      llmTier: validatedData.agent.llmTier,
      temperature: validatedData.agent.temperature,
      maxStepsPerRun: validatedData.agent.maxStepsPerRun,
      fetchSources: validatedData.agent.fetchSources,
      actions: validatedData.agent.actions,
      evalRules: validatedData.agent.evalRules,
    };

    // Prepare execution context
    const executionContext: ExecutionContext = {
      agentId: validatedData.agent.id,
      userId: validatedData.context.userId,
      workspaceId: validatedData.context.workspaceId,
      triggeredBy: validatedData.context.triggeredBy,
      userMessage: validatedData.context.userMessage,
      additionalContext: validatedData.context.additionalContext,
    };

    // Execute agent
    const result = await agentEngine.execute(agentConfig, executionContext);

    // Return result
    return NextResponse.json({
      success: true,
      data: {
        runId: result.runId,
        status: result.status,
        output: result.output,
        llmUsage: {
          model: result.llmUsage.model,
          tokensIn: result.llmUsage.tokensIn,
          tokensOut: result.llmUsage.tokensOut,
          cost: result.llmUsage.cost,
          latencyMs: result.llmUsage.latencyMs,
        },
        evalResult: {
          l1Passed: result.evalResult.l1Passed,
          l1Failures: result.evalResult.l1Failures,
          l2Score: result.evalResult.l2Score,
          l2Breakdown: result.evalResult.l2Breakdown,
          l3Triggered: result.evalResult.l3Triggered,
          l3Blocked: result.evalResult.l3Blocked,
          l3Reason: result.evalResult.l3Reason,
        },
      },
    });
  } catch (error) {
    console.error("[API /agents/execute] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Agent execution failed",
      },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/agents/execute (info)
// ============================================

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      description: "Execute an agent with the Elevay core engine",
      llmTiers: [
        {
          id: "fast",
          name: "Fast (Haiku)",
          model: "claude-3-5-haiku-20241022",
          pricing: { input: "$1/M", output: "$5/M" },
        },
        {
          id: "smart",
          name: "Smart (Sonnet)",
          model: "claude-sonnet-4-5-20250929",
          pricing: { input: "$3/M", output: "$15/M" },
        },
        {
          id: "deep",
          name: "Deep (Opus)",
          model: "claude-opus-4-20250514",
          pricing: { input: "$15/M", output: "$75/M" },
        },
      ],
      evalLayers: [
        {
          id: "l1",
          name: "Deterministic Assertions",
          description: "Fast, rule-based checks (placeholders, profanity, etc.)",
        },
        {
          id: "l2",
          name: "Rule-based Scoring",
          description: "Score output quality on multiple criteria (0-100)",
        },
        {
          id: "l3",
          name: "LLM-as-Judge",
          description: "AI evaluation for safety and quality (blocks if unsafe)",
        },
      ],
    },
  });
}
