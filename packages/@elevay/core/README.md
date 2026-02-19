# @elevay/core

Core agent engine for Elevay, inspired by LangChain/LangSmith patterns.

## Features

### 1. Agent Engine (LangGraph-inspired)
- **Runtime**: Graph-based execution with ReAct pattern
- **Middleware Hooks**: Composable hooks (before/after step, tool, LLM, error, completion)
- **State Management**: Persistent state across execution steps

### 2. Observability (LangSmith-inspired)
- **Tracing**: Complete execution traces with tokens, cost, latency
- **Metrics**: Real-time P50/P99 latency, error rates, cost tracking
- **AI Event Logging**: Every LLM call logged with full context

### 3. Evaluation
- **Multi-turn Evals**: Conversation-level evaluation (not just message-level)
- **Goal Detection**: Automatic detection of goal completion
- **Satisfaction Inference**: Infer user satisfaction from signals

### 4. Insights
- **Clustering**: Automatic conversation clustering by similarity
- **Pattern Detection**: Identify common usage patterns
- **Anomaly Detection**: Detect cost/latency/failure anomalies
- **Optimization Opportunities**: Surface opportunities for improvement

### 5. Optimization (Promptim-inspired)
- **Feedback Collection**: Capture thumbs up/down, edits, corrections
- **Auto-Optimizer**: Analyze patterns → generate variations → A/B test
- **A/B Testing**: Automated prompt testing with real traffic

### 6. Meta-Agent
- **Agent Builder**: Build agents from natural language descriptions
- **Self-Modification**: Agents that propose their own improvements
- **Performance Analysis**: Automatic performance analysis and suggestions

## Installation

```bash
npm install @elevay/core
```

## Usage

### Agent Runtime with Hooks

```typescript
import { AgentRuntime, TracingMiddleware, CostGuardMiddleware } from '@elevay/core/agent-engine';

const runtime = new AgentRuntime({
  agentId: 'my-agent',
  maxSteps: 5,
  middleware: [
    TracingMiddleware,
    CostGuardMiddleware
  ]
});

const result = await runtime.execute({
  conversationId: 'conv-123',
  messages: [{ role: 'user', content: 'Hello!' }],
  // ... other state
});
```

### Agent Tracer

```typescript
import { AgentTracer } from '@elevay/core/observability';

const tracer = new AgentTracer(agentId, conversationId, userId, workspaceId);
await tracer.startTrace();

// ... during execution
await tracer.recordLlmCall({
  model: 'claude-sonnet-4',
  tokensIn: 100,
  tokensOut: 200,
  cost: 0.05,
  latencyMs: 1500
});

await tracer.completeTrace(result);
```

### Multi-turn Evaluator

```typescript
import { MultiTurnEvaluator } from '@elevay/core/evaluation';

const evaluator = new MultiTurnEvaluator();
const evaluation = await evaluator.evaluateConversation(conversationId);

console.log(evaluation.goalCompleted); // true/false
console.log(evaluation.userSatisfactionScore); // 1-5
console.log(evaluation.failureModes); // ["hallucination", "tool_error"]
```

### Auto-Optimizer

```typescript
import { AutoOptimizer } from '@elevay/core/optimization';

const optimizer = new AutoOptimizer();
const result = await optimizer.optimizeAgent(agentId);

console.log(result.editPatterns); // Patterns identified from user corrections
console.log(result.proposedPrompt); // Optimized prompt
console.log(result.abTestId); // A/B test ID
```

## Architecture

```
@elevay/core/
├── agent-engine/       # Runtime + Middleware
│   ├── runtime.ts
│   ├── middleware.ts
│   ├── nodes/
│   └── types/
│
├── observability/      # Tracing + Metrics
│   ├── tracer.ts
│   └── metrics-calculator.ts
│
├── evaluation/         # Multi-turn Evals
│   ├── multi-turn-evaluator.ts
│   ├── sentiment-analyzer.ts
│   └── hallucination-detector.ts
│
├── insights/           # Pattern Detection
│   ├── insights-engine.ts
│   ├── clustering.ts
│   ├── pattern-detector.ts
│   └── anomaly-detector.ts
│
├── optimization/       # Auto-Optimization
│   ├── feedback-collector.ts
│   ├── auto-optimizer.ts
│   ├── ab-test-manager.ts
│   └── dataset-builder.ts
│
└── meta-agent/         # Self-Building
    ├── agent-builder.ts
    ├── self-modifier.ts
    ├── intent-analyzer.ts
    └── agent-tester.ts
```

## Status

- ✅ Package structure created
- 🔄 Phase 1: Runtime + Tracing (in progress)
- ⏳ Phase 2: Multi-turn Evals + Insights
- ⏳ Phase 3: Auto-Optimization
- ⏳ Phase 4: Meta-Agent

## License

MIT
