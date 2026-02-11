/**
 * @nodebase/core
 * Core agent engine with LangChain-inspired patterns
 */

// Agent Engine (Phase 1)
export { AgentRuntime } from './agent-engine/runtime';
export * from './agent-engine/middleware';
export type { AgentState, AgentNode, AgentEdge, ExecutionContext, ExecutionResult } from './agent-engine/types';

// Observability (Phase 1)
export { AgentTracer } from './observability/tracer';

// Evaluation (Phase 2) ✅
export { MultiTurnEvaluator } from './evaluation/multi-turn-evaluator';
export { SentimentAnalyzer } from './evaluation/sentiment-analyzer';
export { HallucinationDetector } from './evaluation/hallucination-detector';
export type { ConversationEvalResult, TraceData } from './evaluation/types';

// Insights (Phase 2) ✅
export { InsightsEngine } from './insights/insights-engine';
export type * from './insights/types';

// Optimization (Phase 3) ✅
export { FeedbackCollector } from './optimization/feedback-collector';
export { AutoOptimizer } from './optimization/auto-optimizer';
export { ABTestManager } from './optimization/ab-test-manager';
export type * from './optimization/types';

// Meta-Agent (Phase 4) ✅
export { AgentBuilder } from './meta-agent/agent-builder';
export { SelfModifier } from './meta-agent/self-modifier';
export { IntentAnalyzer } from './meta-agent/intent-analyzer';
export { AgentTester } from './meta-agent/agent-tester';
export * from './meta-agent/types';
