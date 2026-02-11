/**
 * Eval Engine - Complete Evaluation Pipeline
 *
 * Orchestrates L1/L2/L3 evaluation
 * Progressive evaluation: L1 → L2 → L3 (only if needed)
 *
 * Usage:
 * ```typescript
 * import { evaluateContent } from "@/lib/eval";
 *
 * const result = await evaluateContent({
 *   text: "Dear John, ...",
 *   userId: "user_123",
 *   action: "send_email",
 *   enableL1: true,
 *   enableL2: true,
 *   enableL3: true,
 *   l1Assertions: [
 *     { check: "no_placeholders", severity: "block" },
 *     { check: "contains_recipient_name", severity: "block" },
 *   ],
 *   l2MinScore: 60,
 *   l3Trigger: "on_irreversible_action",
 * });
 *
 * if (!result.passed) {
 *   console.log("Blocked:", result.blockReason);
 * }
 * ```
 */

import { evaluateL1, type Assertion, type L1EvalResult } from "./l1-assertions";
import { evaluateL2, type L2Config, type L2EvalResult } from "./l2-scoring";
import { evaluateL3, type L3Config, type L3EvalResult } from "./l3-llm-judge";
import { config } from "../config";

// ============================================
// TYPES
// ============================================

export interface EvalConfig {
  text: string;
  userId: string;
  action: string; // "send_email", "post_social", etc.
  context?: Record<string, unknown>;

  // L1 config
  enableL1?: boolean;
  l1Assertions?: Assertion[];

  // L2 config
  enableL2?: boolean;
  l2MinScore?: number;
  l2Weights?: L2Config["weights"];

  // L3 config
  enableL3?: boolean;
  l3Trigger?: "always" | "on_irreversible_action" | "on_l2_fail";
  l3AutoSendThreshold?: number;
}

export interface EvalResult {
  passed: boolean;
  blockReason?: string;

  // L1 results
  l1?: L1EvalResult;
  l1Passed: boolean;

  // L2 results
  l2?: L2EvalResult;
  l2Passed: boolean;
  l2Score: number;

  // L3 results
  l3?: L3EvalResult;
  l3Triggered: boolean;
  l3Passed: boolean;

  // Overall
  canAutoSend: boolean;
  requiresApproval: boolean;
  suggestions: string[];
}

// ============================================
// EVAL ENGINE
// ============================================

export class EvalEngine {
  /**
   * Run complete evaluation pipeline
   */
  static async evaluate(evalConfig: EvalConfig): Promise<EvalResult> {
    const {
      text,
      userId,
      action,
      context = {},
      enableL1 = config.eval.enableL1,
      l1Assertions = [],
      enableL2 = config.eval.enableL2,
      l2MinScore = config.eval.l2MinScore,
      l2Weights,
      enableL3 = config.eval.enableL3,
      l3Trigger = "on_irreversible_action",
      l3AutoSendThreshold = config.eval.l3AutoSendThreshold,
    } = evalConfig;

    const result: EvalResult = {
      passed: true,
      l1Passed: true,
      l2Passed: true,
      l2Score: 100,
      l3Triggered: false,
      l3Passed: true,
      canAutoSend: false,
      requiresApproval: false,
      suggestions: [],
    };

    // ============================================
    // L1: Deterministic Assertions
    // ============================================

    if (enableL1 && l1Assertions.length > 0) {
      const l1Result = await evaluateL1(text, l1Assertions, context);
      result.l1 = l1Result;
      result.l1Passed = l1Result.passed;

      if (!l1Result.passed) {
        result.passed = false;
        result.blockReason = `L1 failed: ${l1Result.failedAssertions.map((a) => a.message).join("; ")}`;
        return result; // Early exit - no point evaluating further
      }

      // Add warnings as suggestions
      if (l1Result.warnings.length > 0) {
        result.suggestions.push(
          ...l1Result.warnings.map((w) => `L1 warning: ${w.message}`)
        );
      }
    }

    // ============================================
    // L2: Rule-Based Scoring
    // ============================================

    if (enableL2) {
      const l2Result = await evaluateL2(
        text,
        { minScore: l2MinScore, weights: l2Weights },
        context
      );
      result.l2 = l2Result;
      result.l2Passed = l2Result.passed;
      result.l2Score = l2Result.score;

      if (!l2Result.passed) {
        result.passed = false;
        result.blockReason = `L2 score too low: ${l2Result.score} (min ${l2MinScore})`;
        result.requiresApproval = true; // Don't hard block, just require approval
      }

      // Add L2 recommendations
      result.suggestions.push(...l2Result.recommendations);
    }

    // ============================================
    // L3: LLM as Judge
    // ============================================

    const shouldTriggerL3 =
      enableL3 &&
      (l3Trigger === "always" ||
        (l3Trigger === "on_irreversible_action" && this.isIrreversibleAction(action)) ||
        (l3Trigger === "on_l2_fail" && !result.l2Passed));

    if (shouldTriggerL3) {
      result.l3Triggered = true;

      const l3Result = await evaluateL3(
        text,
        {
          action,
          context,
          tier: "fast", // Use Haiku for cost efficiency
          autoSendThreshold: l3AutoSendThreshold,
        },
        userId
      );

      result.l3 = l3Result;
      result.l3Passed = !l3Result.shouldBlock;

      if (l3Result.shouldBlock) {
        result.passed = false;
        result.blockReason = `L3 blocked: ${l3Result.reason}`;
        result.requiresApproval = false; // Hard block
      } else if (l3Result.shouldWarn) {
        result.requiresApproval = true;
      }

      // L3 determines if can auto-send
      result.canAutoSend = l3Result.canAutoSend && result.passed;

      // Add L3 suggestions
      result.suggestions.push(...l3Result.suggestions.map((s) => `L3: ${s}`));
    } else {
      // If L3 not triggered, decide auto-send based on L2
      result.canAutoSend = result.l2Score >= (l3AutoSendThreshold || 85) && result.passed;
    }

    // Final decision
    if (!result.passed || result.requiresApproval) {
      result.canAutoSend = false;
    }

    return result;
  }

  /**
   * Check if action is irreversible
   */
  private static isIrreversibleAction(action: string): boolean {
    const irreversibleActions = [
      "send_email",
      "send_message",
      "post_social",
      "delete_data",
      "transfer_money",
      "submit_form",
      "publish_content",
    ];

    return irreversibleActions.some((a) => action.toLowerCase().includes(a.toLowerCase()));
  }

  /**
   * Quick eval - just return pass/fail
   */
  static async quickEval(text: string, action: string, userId: string): Promise<boolean> {
    const result = await this.evaluate({
      text,
      userId,
      action,
      enableL1: true,
      enableL2: true,
      enableL3: true,
      l1Assertions: [
        { check: "no_placeholders", severity: "block" },
        { check: "has_real_content", severity: "block" },
      ],
      l2MinScore: 50,
    });

    return result.passed;
  }
}

// ============================================
// CONVENIENCE EXPORTS
// ============================================

export const evaluateContent = EvalEngine.evaluate;
export const quickEval = EvalEngine.quickEval;

// Re-export individual evaluators
export { evaluateL1, evaluateL2, evaluateL3 };
export type { Assertion, L1EvalResult, L2EvalResult, L3EvalResult };
