# Intégration LangChain/LangSmith - Implémentation Complète

> **Date :** 2026-02-10
> **Statut :** Modules core créés ✅ | API routes en attente | UI en attente

---

## 🎯 Objectif

Transformer Nodebase en plateforme auto-optimisante inspirée de LangChain/LangSmith/Promptim avec :
- **Observabilité totale** (LangSmith-style tracing)
- **Évaluation multi-tour** (conversations complètes, pas messages isolés)
- **Insights automatiques** (détection patterns, anomalies, opportunités)
- **Auto-optimisation** (Promptim-style feedback loop + A/B testing)
- **Meta-agents** (self-modification + agent building en langage naturel)

---

## ✅ Modules Core Implémentés

### 1. Observability (`packages/core/src/observability/index.ts`)

**Tracing LangSmith-style avec métriques complètes**

```typescript
import { createTracer } from "@nodebase/core";

// Create tracer for an agent execution
const tracer = createTracer({
  agentId: "agent_123",
  conversationId: "conv_456",
  userId: "user_789",
  workspaceId: "workspace_abc",
  triggeredBy: "manual",
  userMessage: "Book a meeting with John",
});

// Log steps during execution
tracer.logLLMCall({
  model: "claude-3-5-sonnet-20241022",
  input: "Book a meeting with John",
  output: "I'll help you book a meeting...",
  tokensIn: 150,
  tokensOut: 200,
  cost: 0.0012,
  durationMs: 1200,
});

tracer.logToolCall({
  toolName: "calendar_search",
  input: { attendee: "John", timeframe: "this week" },
  output: { slots: ["Mon 2pm", "Wed 10am"] },
  durationMs: 300,
  success: true,
});

tracer.logDecision({
  reasoning: "User wants to meet John this week",
  decision: "propose_monday_2pm",
});

// Complete trace and save
await tracer.complete({
  output: { meetingBooked: true, time: "Mon 2pm" },
  status: "completed",
});
```

**Fonctionnalités :**
- Traces complètes avec ID unique (`trace_xxx`)
- Logging structuré de chaque étape (LLM calls, tool calls, decisions, errors)
- Métriques automatiques (tokens, coût, latence, nombre d'étapes)
- Support callback onSave pour persistence Prisma

**Intégration Prisma :**
```prisma
model AgentTrace {
  id              String   @id @default(cuid())
  agentId         String
  conversationId  String?
  userId          String
  workspaceId     String
  triggeredBy     String
  userMessage     String?
  status          TraceStatus
  output          Json?
  steps           Json
  metrics         Json
  startedAt       DateTime
  completedAt     DateTime?
  durationMs      Int?
}
```

---

### 2. Evaluation (`packages/core/src/evaluation/index.ts`)

**Évaluation multi-tour des conversations entières**

```typescript
import { createEvaluator } from "@nodebase/core";

const evaluator = createEvaluator(
  {
    goalCompletion: {
      enabled: true,
      expectedGoals: ["book_meeting", "confirm_attendees"],
    },
    userSatisfaction: {
      enabled: true,
      indicators: ["positive_feedback", "task_completion"],
    },
    conversationQuality: {
      enabled: true,
      metrics: ["coherence", "relevance", "helpfulness"],
    },
  },
  async (prompt) => {
    // LLM evaluator (optional, fallback to heuristics)
    const result = await anthropic.messages.create({...});
    return JSON.parse(result.content);
  }
);

const evaluation = await evaluator.evaluateConversation({
  conversationId: "conv_456",
  agentId: "agent_123",
  userId: "user_789",
  workspaceId: "workspace_abc",
  turns: [
    { id: "1", role: "user", content: "Book a meeting with John", timestamp: new Date() },
    { id: "2", role: "assistant", content: "I'll help...", timestamp: new Date() },
    // ...
  ],
  startedAt: new Date("2026-02-10T09:00:00Z"),
  endedAt: new Date("2026-02-10T09:05:00Z"),
});

console.log(evaluation);
// {
//   goalsDetected: ["book_meeting"],
//   goalsCompleted: ["book_meeting"],
//   goalCompletionRate: 1.0,
//   satisfactionScore: 0.9,
//   qualityScores: { coherence: 0.95, relevance: 0.9, helpfulness: 0.85 },
//   overallQualityScore: 0.9,
//   turnCount: 6,
//   durationMs: 300000
// }
```

**Fonctionnalités :**
- Évaluation de goal completion (détection + completion)
- Scoring de satisfaction utilisateur (0-1)
- Métriques de qualité multi-dimensionnelles
- Support LLM optionnel pour évaluation sophistiquée
- Fallback heuristics si pas de LLM

**Intégration Prisma :**
```prisma
model ConversationEvaluation {
  id                   String   @id @default(cuid())
  conversationId       String
  agentId              String
  userId               String
  workspaceId          String
  goalsDetected        Json
  goalsCompleted       Json
  goalCompletionRate   Float
  satisfactionScore    Float
  satisfactionIndicators Json
  qualityScores        Json
  overallQualityScore  Float
  turnCount            Int
  durationMs           Int
  evaluatedAt          DateTime @default(now())
}
```

---

### 3. Insights (`packages/core/src/insights/index.ts`)

**Détection automatique de patterns et anomalies**

```typescript
import { createInsightsAnalyzer } from "@nodebase/core";

const analyzer = createInsightsAnalyzer(async (prompt) => {
  // LLM pour analyse avancée (optionnel)
  const result = await anthropic.messages.create({...});
  return JSON.parse(result.content);
});

const insights = await analyzer.analyze({
  agentId: "agent_123",
  workspaceId: "workspace_abc",
  timeframe: {
    start: new Date("2026-02-01"),
    end: new Date("2026-02-10"),
  },
  dataPoints: [
    {
      id: "trace_1",
      type: "trace",
      timestamp: new Date(),
      metrics: { success: 0, cost: 0.05, latencyMs: 5000 },
      metadata: { status: "failed", error: "Missing required field" },
    },
    // ... 100+ data points
  ],
});

console.log(insights);
// [
//   {
//     type: "failure_pattern",
//     title: "High failure rate detected (15%)",
//     description: "Agent is failing frequently. Common reasons: Missing required field, Invalid credentials",
//     severity: "high",
//     confidence: 0.95,
//     impact: {
//       metric: "success_rate",
//       current: 0.85,
//       potential: 0.95,
//       improvement: 11.8
//     },
//     recommendations: [
//       "Validate config before execution",
//       "Add retry logic for transient errors"
//     ]
//   },
//   {
//     type: "cost_optimization",
//     title: "12 conversations cost >2x average",
//     severity: "medium",
//     recommendations: [
//       "Use Haiku instead of Sonnet for simple queries",
//       "Implement caching for repeated queries"
//     ]
//   }
// ]
```

**Types d'insights détectés :**
1. **Failure Patterns** : Taux d'échec élevé, causes communes
2. **Success Patterns** : Patterns de conversations réussies
3. **Cost Optimization** : Conversations anormalement coûteuses
4. **Performance Bottlenecks** : Latences élevées, P95 >10s

**Intégration Prisma :**
```prisma
model AgentInsight {
  id             String   @id @default(cuid())
  agentId        String
  workspaceId    String
  type           String   // failure_pattern, success_pattern, cost_optimization, performance_bottleneck
  title          String
  description    String   @db.Text
  severity       String   // low, medium, high, critical
  confidence     Float
  impact         Json     // { metric, current, potential, improvement }
  evidence       Json     // { dataPoints, examples }
  recommendations Json
  detectedAt     DateTime @default(now())
}
```

---

### 4. Optimization (`packages/core/src/optimization/index.ts`)

**Auto-optimisation Promptim-style avec A/B testing**

```typescript
import { createOptimizer } from "@nodebase/core";

const optimizer = createOptimizer(
  {
    agentId: "agent_123",
    workspaceId: "workspace_abc",
    goals: [
      { metric: "satisfaction", target: 0.9, weight: 0.5 },
      { metric: "cost", target: 0.01, weight: 0.3 },
      { metric: "latency", target: 2000, weight: 0.2 },
    ],
    constraints: {
      maxCostPerConversation: 0.05,
      maxLatencyMs: 5000,
      minSuccessRate: 0.9,
    },
    abTestConfig: {
      enabled: true,
      trafficSplit: 0.2, // 20% traffic to variant
      minSampleSize: 50,
      significanceLevel: 0.05,
    },
  },
  async (prompt) => {
    // LLM pour optimisation de prompt
    const result = await anthropic.messages.create({...});
    return result.content;
  }
);

// Auto-optimize based on feedback
const optimizationRun = await optimizer.optimize({
  currentPrompt: "You are a helpful assistant...",
  currentModel: "claude-3-5-sonnet-20241022",
  currentTemperature: 0.7,
  feedbackData: [
    { conversationId: "c1", messageId: "m1", type: "thumbs_down", userId: "u1" },
    { conversationId: "c2", messageId: "m2", type: "correction", userId: "u2",
      originalText: "Let me help you with that.",
      correctedText: "I'll be happy to assist you with that task." },
    // ... 10+ feedback points
  ],
  metricsData: {
    success_rate: 0.85,
    satisfaction: 0.75,
    cost: 0.03,
    latency: 3000,
  },
});

console.log(optimizationRun);
// {
//   method: "few_shot_learning", // or "prompt_optimization" or "model_tier_optimization"
//   baseline: { systemPrompt: "...", model: "sonnet", metrics: {...} },
//   optimized: { systemPrompt: "... + few-shot examples", model: "sonnet", metrics: {...} },
//   improvements: [
//     { metric: "satisfaction", baselineValue: 0.75, optimizedValue: 0.85, improvement: 13.3 }
//   ]
// }
```

**Méthodes d'optimisation :**
1. **Few-Shot Learning** : Injection d'exemples de corrections utilisateur
2. **Prompt Optimization** : Réécriture via LLM basée sur feedback négatif
3. **Model Tier Optimization** : Downgrade Opus→Sonnet→Haiku pour réduire coûts

**A/B Testing :**
```typescript
const abTest = await optimizer.createABTest({
  controlPrompt: "You are a helpful assistant...",
  variantPrompt: "You are an expert assistant who...",
  model: "claude-3-5-sonnet-20241022",
  temperature: 0.7,
});

// After collecting data...
const evaluated = optimizer.evaluateABTest(abTest);
console.log(evaluated.winner); // "control" or "variant"
console.log(evaluated.confidence); // 0.95
```

**Intégration Prisma :**
```prisma
model OptimizationRun {
  id          String   @id @default(cuid())
  agentId     String
  workspaceId String
  startedAt   DateTime @default(now())
  completedAt DateTime?
  status      String   // running, completed, failed
  baseline    Json
  optimized   Json?
  improvements Json
  method      String   // prompt_optimization, model_tier_optimization, few_shot_learning
}

model AgentABTest {
  id          String   @id @default(cuid())
  agentId     String
  workspaceId String
  status      ABTestStatus
  variants    Json
  winner      String?
  confidence  Float?
  startedAt   DateTime @default(now())
  completedAt DateTime?
}
```

---

### 5. Meta-Agent (`packages/core/src/meta-agent/index.ts`)

**Self-modification + Agent building en NL**

#### Self-Modification

```typescript
import { createSelfModifier } from "@nodebase/core";

const modifier = createSelfModifier(async (prompt) => {
  const result = await anthropic.messages.create({...});
  return result.content;
});

// Analyze performance and propose modifications
const proposals = await modifier.proposeModifications({
  agentId: "agent_123",
  workspaceId: "workspace_abc",
  currentConfig: {
    systemPrompt: "You are a helpful assistant...",
    model: "claude-3-5-sonnet-20241022",
    temperature: 0.7,
    tools: ["calendar", "email"],
  },
  insights: [
    {
      id: "insight_1",
      type: "failure_pattern",
      severity: "high",
      description: "Agent fails when asked to book meetings without checking availability first",
      recommendations: [
        "Always check calendar availability before proposing times",
        "Ask for attendee preferences upfront"
      ],
    },
  ],
  feedback: [
    {
      id: "feedback_1",
      type: "correction",
      correctedText: "I'll check the calendar and get back to you shortly.",
    },
  ],
  metrics: {
    success_rate: 0.75,
    cost: 0.03,
    latency: 2500,
  },
});

console.log(proposals);
// [
//   {
//     type: "prompt_update",
//     status: "pending",
//     current: { systemPrompt: "..." },
//     proposed: { systemPrompt: "... Always check calendar availability first ..." },
//     rationale: "Addresses failure_pattern: Agent fails when...",
//     expectedImpact: [
//       { metric: "success_rate", currentValue: 0.75, expectedValue: 0.975, confidence: 0.7 }
//     ]
//   }
// ]

// User approves proposal
await modifier.applyModification(proposals[0].id, true);
```

#### Agent Builder

```typescript
import { createAgentBuilder } from "@nodebase/core";

const builder = createAgentBuilder(async (prompt) => {
  const result = await anthropic.messages.create({...});
  return result.content;
});

// Build agent from natural language
const agentSpec = await builder.buildAgent({
  name: "Deal Revival Agent",
  description: "Automatically follow up on stale deals in HubSpot and draft personalized emails",
  goals: [
    "Identify deals with no activity in 7+ days",
    "Draft context-aware follow-up emails",
    "Get user approval before sending",
  ],
  constraints: {
    maxCost: 0.05,
    maxLatency: 10000,
  },
  domain: "sales",
  style: "professional",
});

console.log(agentSpec);
// {
//   systemPrompt: "You are a sales automation agent specialized in deal revival...",
//   model: "claude-3-5-sonnet-20241022",
//   temperature: 0.4,
//   suggestedTools: ["hubspot", "gmail", "calendar"],
//   suggestedTriggers: ["scheduled"],
//   rationale: "Chose Sonnet for nuanced email drafting, low temp for consistency..."
// }
```

**Intégration Prisma :**
```prisma
model ModificationProposal {
  id            String   @id @default(cuid())
  agentId       String
  workspaceId   String
  type          ModificationType
  status        ProposalStatus
  current       Json
  proposed      Json
  rationale     String   @db.Text
  expectedImpact Json
  evidence      Json
  createdAt     DateTime @default(now())
  reviewedAt    DateTime?
  reviewedBy    String?
  appliedAt     DateTime?
}
```

---

## 📊 Architecture Globale

```
┌─────────────────────────────────────────────────────────────┐
│                     AGENT EXECUTION                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Agent Engine (with hooks)                             │  │
│  │  - Before hook → Start tracing                        │  │
│  │  - Execute → LLM calls + Tool calls                   │  │
│  │  - After hook → Complete trace, save metrics          │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ↓                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Observability (LangSmith-style)                       │  │
│  │  - AgentTracer logs all steps                         │  │
│  │  - Metrics: tokens, cost, latency, steps              │  │
│  │  - Save to AgentTrace table                           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  CONVERSATION COMPLETE                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Evaluation (Multi-turn)                               │  │
│  │  - Analyze all turns in conversation                  │  │
│  │  - Goal completion rate                               │  │
│  │  - Satisfaction score                                 │  │
│  │  - Quality metrics                                    │  │
│  │  - Save to ConversationEvaluation                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  PERIODIC ANALYSIS                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Insights Engine (Pattern Detection)                  │  │
│  │  - Analyze 100+ traces/evaluations                   │  │
│  │  - Detect failure patterns                           │  │
│  │  - Detect cost/performance issues                    │  │
│  │  - Generate insights with recommendations            │  │
│  │  - Save to AgentInsight                              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  AUTO-OPTIMIZATION                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Optimizer (Promptim-style)                            │  │
│  │  - Collect user feedback (thumbs, corrections)        │  │
│  │  - Analyze insights + feedback                        │  │
│  │  - Propose optimizations (prompt, model, tools)       │  │
│  │  - Run A/B tests                                      │  │
│  │  - Save to OptimizationRun, AgentABTest              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  SELF-MODIFICATION                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Meta-Agent (Self-Modifier)                            │  │
│  │  - Analyze critical insights                          │  │
│  │  - Propose modifications (prompt updates, tools)      │  │
│  │  - User approval → Apply modification                 │  │
│  │  - Save to ModificationProposal                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚧 Travail Restant

### API Routes (En Attente)

Créer les routes Next.js pour exposer les fonctionnalités :

1. **`/api/agents/[agentId]/traces`**
   - GET : Liste des traces
   - GET /[traceId] : Détail d'une trace

2. **`/api/agents/[agentId]/evaluations`**
   - GET : Liste des évaluations
   - POST : Déclencher évaluation manuelle

3. **`/api/agents/[agentId]/insights`**
   - GET : Liste des insights
   - POST /analyze : Déclencher analyse

4. **`/api/agents/[agentId]/optimization`**
   - GET /runs : Historique optimisations
   - POST /run : Déclencher optimisation
   - POST /abtests : Créer A/B test
   - GET /abtests/[testId] : Statut test

5. **`/api/agents/[agentId]/proposals`**
   - GET : Liste propositions de modification
   - POST /[proposalId]/approve : Approuver
   - POST /[proposalId]/reject : Rejeter

6. **`/api/agents/build`**
   - POST : Construire agent depuis description NL

### UI Components (En Attente)

1. **Agent Analytics Dashboard**
   - Graphiques métriques temps réel (success rate, cost, latency)
   - Liste traces récentes
   - Liste insights détectés

2. **Conversation Evaluation View**
   - Affichage conversation avec scores
   - Goal completion visualization
   - Quality metrics breakdown

3. **Insights Panel**
   - Cards insights par sévérité
   - Recommendations clickable
   - Evidence examples

4. **Optimization Dashboard**
   - A/B test results visualization
   - Optimization run history
   - Improvement metrics charts

5. **Modification Proposals Queue**
   - Liste propositions pending
   - Diff viewer (current vs proposed)
   - One-click approve/reject

6. **Agent Builder Wizard**
   - Form description en NL
   - Preview agent spec généré
   - One-click creation

---

## 🧪 Tests End-to-End

### Scénario 1 : Tracing Complet

```typescript
// 1. Agent execution avec tracing
const engine = getAgentEngine();
const tracer = createTracer({...});

engine.onBefore(async (context) => {
  // Start trace
});

engine.onAfter(async (context, result) => {
  await tracer.complete({...});
  // Save to AgentTrace table
});

await engine.execute(agentConfig, executionContext);

// 2. Vérifier trace sauvegardée
const trace = await prisma.agentTrace.findUnique({...});
expect(trace.metrics.llmCalls).toBeGreaterThan(0);
expect(trace.steps.length).toBeGreaterThan(0);
```

### Scénario 2 : Évaluation Multi-Tour

```typescript
// 1. Conversation complète
const turns = await prisma.message.findMany({
  where: { conversationId },
});

// 2. Évaluer
const evaluator = createEvaluator({...});
const evaluation = await evaluator.evaluateConversation({...});

// 3. Sauvegarder
await prisma.conversationEvaluation.create({ data: evaluation });

// 4. Vérifier
expect(evaluation.goalCompletionRate).toBeGreaterThan(0.8);
expect(evaluation.satisfactionScore).toBeGreaterThan(0.7);
```

### Scénario 3 : Insights → Optimization

```typescript
// 1. Générer insights
const analyzer = createInsightsAnalyzer();
const insights = await analyzer.analyze({...});

// 2. Auto-optimize basé sur insights
const optimizer = createOptimizer({...});
const run = await optimizer.optimize({
  currentPrompt,
  currentModel,
  feedbackData: [],
  metricsData: { cost: 0.05 },
});

// 3. Vérifier amélioration
expect(run.improvements.length).toBeGreaterThan(0);
expect(run.improvements[0].improvement).toBeGreaterThan(0);
```

### Scénario 4 : Self-Modification

```typescript
// 1. Proposer modifications
const modifier = createSelfModifier();
const proposals = await modifier.proposeModifications({...});

// 2. Sauvegarder
await prisma.modificationProposal.createMany({ data: proposals });

// 3. Approuver
await modifier.applyModification(proposals[0].id, true);

// 4. Vérifier agent mis à jour
const agent = await prisma.agent.findUnique({...});
expect(agent.systemPrompt).toBe(proposals[0].proposed.systemPrompt);
```

---

## 📈 ROI Attendu

| Métrique | Baseline | Avec LangChain | Amélioration |
|----------|----------|----------------|--------------|
| **Coût moyen/conversation** | $0.05 | $0.03 | -40% (model tier optimization) |
| **Success rate** | 75% | 90% | +20% (auto-optimization) |
| **Satisfaction utilisateur** | 70% | 85% | +21% (few-shot learning) |
| **Temps debug** | 2h/semaine | 30min/semaine | -75% (insights automatiques) |
| **Temps optimisation** | 4h/semaine | 0h/semaine | -100% (auto-optimization) |

**Total économisé :** ~6h/semaine + 40% coûts LLM

---

## 🎯 Next Steps

1. ✅ **Modules core** (FAIT)
2. ⏳ **Enhance agent-engine** avec hooks LangChain
3. ⏳ **API routes** pour exposer fonctionnalités
4. ⏳ **UI components** pour analytics/insights
5. ⏳ **Tests end-to-end** des scénarios complets
6. ⏳ **Documentation** pour utilisateurs

---

## 📚 Références

- **LangSmith Tracing** : https://docs.smith.langchain.com/
- **Promptim Auto-Optimization** : https://promptlayer.com/promptim
- **LangChain Agents** : https://python.langchain.com/docs/modules/agents/
- **CLAUDE.md Section 7** : Plan LangChain complet

