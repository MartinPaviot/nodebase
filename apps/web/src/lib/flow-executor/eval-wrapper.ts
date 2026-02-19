/**
 * Eval Wrapper
 *
 * Wraps side-effect integration executors with:
 * 1. Schema validation (zero cost, < 1ms)
 * 2. EvalEngine L1/L2/L3 + Grounding evaluation
 * 3. Autonomy tier enforcement (auto/review/readonly)
 * 4. ConversationActivity persistence for approval queue
 */

import { EvalEngine, type Assertion, type GroundingSource } from "@/lib/eval";
import type { AutonomyTier } from "@/lib/autonomy";
import { SIDE_EFFECT_ACTIONS, ACTION_LABELS } from "@/lib/eval/constants";
import prisma from "@/lib/db";
import { ActivityType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { NodeExecContext, NodeExecResult, NodeOutput } from "./types";

/**
 * Wrap a side-effect action with schema validation, eval, and autonomy tier enforcement.
 *
 * Flow:
 * 1. Readonly tier + side-effect → BLOCK immediately
 * 2. Non side-effect → execute directly
 * 3. EvalEngine L1/L2/Grounding/L3 → BLOCK if L1 or L3 fails
 * 4. Auto tier + score >= threshold → execute directly
 * 5. Review tier (or auto with low score) → persist ConversationActivity + return requiresApproval
 */
export async function withEvaluation(
  actionName: string,
  contentToEval: string,
  ctx: NodeExecContext,
  executeFn: () => Promise<NodeOutput>,
  autonomyTier: AutonomyTier = "review",
  actionArgs?: Record<string, unknown>,
): Promise<NodeExecResult> {
  // Readonly tier: block ALL side-effect actions
  if (autonomyTier === "readonly" && SIDE_EFFECT_ACTIONS.has(actionName)) {
    ctx.emit({
      type: "eval-result",
      nodeId: ctx.node.id,
      passed: false,
      l2Score: 0,
    });
    return {
      output: {
        kind: "error",
        error: "Agent is in read-only mode. Side-effect actions are disabled.",
        nodeType: actionName,
      },
    };
  }

  // Skip eval for non-side-effect actions
  if (!SIDE_EFFECT_ACTIONS.has(actionName)) {
    const output = await executeFn();
    return { output };
  }

  // Parse eval rules from agent config
  const evalRules = ctx.agentEvalRules as {
    assertions?: Assertion[];
    minConfidence?: number;
    l3Trigger?: "always" | "on_irreversible_action" | "on_l2_fail";
    autoSendThreshold?: number;
  } | null;

  // Build grounding sources from prior node outputs
  const sourceContext: GroundingSource[] = [];
  for (const [nodeId, output] of ctx.state.nodeOutputs.entries()) {
    if (output.kind === "integration" && output.data) {
      sourceContext.push({
        type: "tool_result",
        label: `${output.service || nodeId} result`,
        content: JSON.stringify(output.data),
      });
    } else if (output.kind === "ai-response" && output.content) {
      sourceContext.push({
        type: "conversation_history",
        label: `AI response (${nodeId})`,
        content: output.content,
      });
    }
  }

  try {
    const evalResult = await EvalEngine.evaluate({
      text: contentToEval,
      userId: ctx.userId,
      action: actionName,
      enableL1: true,
      l1Assertions: evalRules?.assertions || [],
      enableL2: true,
      l2MinScore: evalRules?.minConfidence || 60,
      enableGrounding: sourceContext.length > 0,
      sourceContext,
      enableL3: true,
      l3Trigger: evalRules?.l3Trigger || "on_irreversible_action",
      l3AutoSendThreshold: evalRules?.autoSendThreshold || 85,
    });

    // Emit eval result to client
    ctx.emit({
      type: "eval-result",
      nodeId: ctx.node.id,
      passed: evalResult.passed,
      l2Score: evalResult.l2Score,
    });

    // Hard block — L1 or L3 failure
    if (!evalResult.passed && (evalResult.blockReason?.includes("L1") || evalResult.blockReason?.includes("L3"))) {
      return {
        output: {
          kind: "error",
          error: `Blocked by safety evaluation: ${evalResult.blockReason}`,
          nodeType: actionName,
        },
      };
    }

    // Auto tier: execute directly if eval passes and score meets threshold
    if (autonomyTier === "auto" && evalResult.canAutoSend && evalResult.passed) {
      const output = await executeFn();
      if (output.kind === "integration") {
        output.evalPassed = true;
      }
      return { output };
    }

    // Review tier (or auto with low score): persist approval + signal
    if (autonomyTier === "review" || !evalResult.canAutoSend) {
      const evalSummary = {
        l1Passed: evalResult.l1Passed,
        l2Score: evalResult.l2Score,
        l2Passed: evalResult.l2Passed,
        l3Triggered: evalResult.l3Triggered,
        l3Passed: evalResult.l3Passed,
        suggestions: evalResult.suggestions,
        groundingScore: evalResult.groundingScore,
        groundingPassed: evalResult.groundingPassed,
        claims: (evalResult.grounding?.claims || []).map((c) => ({ text: c.text, type: c.type, grounded: c.grounded, evidence: c.evidence })),
      };

      // Persist ConversationActivity for the approval queue
      if (ctx.conversationId) {
        try {
          await prisma.conversationActivity.create({
            data: {
              conversationId: ctx.conversationId,
              type: ActivityType.CONFIRMATION_REQUESTED,
              title: ACTION_LABELS[actionName] || actionName,
              details: {
                actionType: actionName,
                actionArgs: (actionArgs || {}) as Record<string, string | number | boolean | null>,
                evalResult: evalSummary,
              } as unknown as Prisma.InputJsonValue,
              requiresConfirmation: true,
            },
          });
        } catch (dbError) {
          console.warn("Failed to persist approval activity:", dbError);
        }
      }

      return {
        output: {
          kind: "integration",
          service: actionName,
          action: actionName,
          success: false,
          data: {
            requiresApproval: true,
            evalResult: evalSummary,
          },
          evalPassed: false,
        },
      };
    }

    // Fallback: execute the action
    const output = await executeFn();
    if (output.kind === "integration") {
      output.evalPassed = evalResult.passed;
    }
    return { output };
  } catch (evalError) {
    // If eval engine fails, still execute the action (fail-open for eval)
    console.warn("EvalEngine error, proceeding without eval:", evalError);
    const output = await executeFn();
    return { output };
  }
}
