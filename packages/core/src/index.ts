/**
 * @nodebase/core
 *
 * Core engines for Nodebase:
 * - Scan Engine: Detects signals across connected services
 * - Agent Engine: Executes agents with hooks and eval
 * - Eval Layer: L1/L2/L3 evaluation of agent outputs
 * - Factory: Dependency injection helpers
 *
 * LangChain/LangSmith Integration:
 * - Observability: LangSmith-style tracing with comprehensive metrics
 * - Evaluation: Multi-turn conversation evaluation and quality scoring
 * - Insights: Pattern detection, anomaly analysis, and recommendations
 * - Optimization: Promptim-style auto-optimization with A/B testing
 * - Meta-Agent: Self-modification and agent building from natural language
 */

// Core engines
export * from "./scan-engine";
export * from "./agent-engine";
export * from "./eval";
export * from "./factory";

// LangChain integration modules
export * from "./observability";
export * from "./evaluation";
export * from "./insights";
export * from "./optimization";
export * from "./meta-agent";
