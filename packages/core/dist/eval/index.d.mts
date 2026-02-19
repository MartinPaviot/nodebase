import { L1Assertion } from '@elevay/types';

/**
 * Eval Layer
 *
 * Three levels of evaluation:
 * - L1: Deterministic assertions (fast, cheap)
 * - L2: Rule-based scoring (fast, cheap)
 * - L3: LLM-as-Judge (slow, expensive, high accuracy)
 */

interface L1Result {
    passed: boolean;
    assertions: Array<{
        check: string;
        passed: boolean;
        message?: string;
    }>;
}
/**
 * Run L1 assertions on content.
 */
declare function runL1Eval(content: string, assertions: L1Assertion[]): L1Result;
interface L2Result {
    score: number;
    breakdown: Record<string, number>;
}
/**
 * Run L2 scoring on content.
 */
declare function runL2Eval(content: string, criteria: string[]): Promise<L2Result>;
interface L3Result {
    blocked: boolean;
    reason?: string;
    confidence: number;
}
/**
 * Run L3 evaluation using LLM-as-Judge.
 * Uses Claude to evaluate whether the agent output is safe to execute.
 */
declare function runL3Eval(content: string, triggerConditions: string[]): Promise<L3Result>;
interface EvalRegistry {
    l1Assertions: Map<string, (content: string, params?: Record<string, unknown>) => boolean>;
    l2Criteria: Map<string, (content: string) => number>;
}
/**
 * Register a custom L1 assertion.
 */
declare function registerL1Assertion(name: string, fn: (content: string, params?: Record<string, unknown>) => boolean): void;
/**
 * Register a custom L2 criterion.
 */
declare function registerL2Criterion(name: string, fn: (content: string) => number): void;
/**
 * Get the eval registry.
 */
declare function getEvalRegistry(): EvalRegistry;

export { type EvalRegistry, type L1Result, type L2Result, type L3Result, getEvalRegistry, registerL1Assertion, registerL2Criterion, runL1Eval, runL2Eval, runL3Eval };
