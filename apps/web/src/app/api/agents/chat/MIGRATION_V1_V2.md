# Migration Chat Route V1 → V2

**Date:** Février 2026
**Migration:** `route.ts` (Vercel AI SDK) → `route-v2.ts` (Claude API Direct + Eval Layer)

---

## Résumé des Changements

| Feature | V1 (route.ts) | V2 (route-v2.ts) |
|---------|---------------|-------------------|
| **LLM SDK** | Vercel AI SDK (`streamText`) | Claude API Direct (`ClaudeClient`) |
| **Model Support** | Anthropic, OpenAI, Gemini | **Anthropic only** (Claude) |
| **AI Event Logging** | Via AgentTracer (aggregate) | Per-call via `AIEventLogger` |
| **Eval Layer** | None | **L1/L2/L3 progressive evaluation** |
| **Tool Execution** | Direct (no eval) | **Evaluated for irreversible actions** |
| **Streaming** | SSE via Vercel SDK | JSON response (SSE peut être ajouté) |
| **Model Tiering** | Hardcoded Sonnet | **Haiku/Sonnet/Opus** (future) |
| **Max Steps** | Hardcoded 5 | **Configurable** (default 10) |

---

## Nouveaux Imports

```typescript
// V2 imports
import { ClaudeClient } from "@/lib/ai/claude-client";
import { AIEventLogger } from "@/lib/ai/event-logger";
import { evaluateContent } from "@/lib/eval";
```

---

## Changement 1: ClaudeClient au lieu de streamText

### V1 (Vercel AI SDK)
```typescript
const result = streamText({
  model: createModel(agent.model, apiKey),
  system: enhancedSystemPrompt,
  messages: messageHistory,
  temperature: agent.temperature,
  tools: Object.keys(tools).length > 0 ? tools : undefined,
  stopWhen: stepCountIs(5), // Hardcoded
  onFinish: async ({ text, steps, usage }) => {
    // Aggregate logging only
  },
});

return result.toUIMessageStreamResponse();
```

**Issues:**
- Abstraction cache les détails (tokens, latency, step-by-step)
- Pas de per-call AI event logging
- Hardcoded max steps (5)
- Support multi-provider (OpenAI, Gemini) = complexité inutile

### V2 (Claude API Direct)
```typescript
const claudeClient = new ClaudeClient({ apiKey });
const eventLogger = new AIEventLogger();

const response = await claudeClient.chat({
  model: "smart", // Haiku/Sonnet/Opus tiering
  messages: messageHistory,
  systemPrompt: enhancedSystemPrompt,
  temperature: agent.temperature,
  maxSteps: 10, // Configurable
  tools: claudeTools,
  userId: session.user.id,

  // ✅ Log EACH step
  onStepComplete: async (event) => {
    await eventLogger.log({
      ...event,
      agentId: agent.id,
      conversationId,
      userId: session.user.id,
      workspaceId: agent.workspaceId || session.user.id,
    });
  },

  // ✅ Tool execution with eval
  onToolCall: async (toolCall) => {
    // Eval before executing irreversible actions
    // ...
  },
});
```

**Avantages:**
- Per-call AI event logging (tokens, cost, latency par step)
- Model tiering (Haiku/Sonnet/Opus)
- Control explicite sur tool execution
- Pas de multi-provider (Anthropic only, simplifié)

---

## Changement 2: Eval Layer pour Actions Irréversibles

### V1 (Aucune Évaluation)
```typescript
// Tool exécuté directement sans validation
const result = await tool.execute(toolCall.input);

// Aucun check de qualité, placeholders, profanity, etc.
```

**Risque:** Envoi d'emails avec placeholders, profanity, ou contenu de mauvaise qualité.

### V2 (Eval L1/L2/L3)
```typescript
// Check if this is an irreversible action
if (IRREVERSIBLE_ACTIONS.has(toolCall.name)) {
  // Extract draft content
  let draftContent = "";
  if (toolCall.name === "send_email") {
    const args = toolCall.input as { subject?: string; body?: string };
    draftContent = `Subject: ${args.subject || ""}\n\n${args.body || ""}`;
  }

  if (draftContent) {
    // ✅ Run 3-tier evaluation
    const evalResult = await evaluateContent({
      text: draftContent,
      userId: session.user.id,
      action: toolCall.name,
      context: toolCall.input,

      // L1: Block placeholders, profanity, etc.
      enableL1: true,
      l1Assertions: [
        { check: "no_placeholders", severity: "block" },
        { check: "has_real_content", severity: "block" },
        { check: "no_profanity", severity: "block" },
      ],

      // L2: Score quality (0-100)
      enableL2: true,
      l2MinScore: 60,

      // L3: LLM judge for irreversible actions
      enableL3: true,
      l3Trigger: "on_irreversible_action",
      l3AutoSendThreshold: 85,
    });

    // ✅ Block if eval failed
    if (!evalResult.passed) {
      return {
        type: "tool_result" as const,
        tool_use_id: toolCall.id,
        content: JSON.stringify({
          error: true,
          message: `Action blocked: ${evalResult.blockReason}`,
          suggestions: evalResult.suggestions,
        }),
      };
    }

    // ✅ Require approval if score < 85
    if (evalResult.requiresApproval) {
      // Create activity for user approval
      const activity = await prisma.conversationActivity.create({ ... });

      return {
        type: "tool_result" as const,
        tool_use_id: toolCall.id,
        content: JSON.stringify({
          requiresConfirmation: true,
          activityId: activity.id,
          message: `Quality score: ${evalResult.l2Score}/100. Please review.`,
        }),
      };
    }

    // ✅ Auto-send if score >= 85
  }
}

// Execute tool if eval passed
const result = await tool.execute(toolCall.input);
```

**Avantages:**
- **L1** (instant, free): Bloque placeholders, profanity, contenu vide
- **L2** (10-50ms, free): Score quality 0-100 (relevance, quality, tone, completeness)
- **L3** (1-10s, ~$0.001): LLM juge LLM output pour actions critiques
- **Auto-send threshold**: Score >= 85 → envoi automatique, < 85 → demande approval
- **Cost-effective**: L3 seulement pour actions irréversibles

---

## Changement 3: AI Event Logging Per-Call

### V1 (Aggregate Logging)
```typescript
onFinish: async ({ text, steps, usage }) => {
  // Log une fois en fin
  await tracer.recordLlmCall({
    agentId: agent.id,
    model: agent.model,
    tokensIn: usage?.promptTokens || 0,
    tokensOut: usage?.completionTokens || 0,
    cost: totalCost,
    latencyMs: totalLatency,
    stepNumber: steps.length,
  });
}
```

**Issue:** Pas de visibilité sur chaque step individuel (tool calls, retries, etc.)

### V2 (Per-Call Logging)
```typescript
onStepComplete: async (event) => {
  // ✅ Log CHAQUE step
  await eventLogger.log({
    ...event, // model, tier, tokensIn, tokensOut, cost, latency
    agentId: agent.id,
    conversationId,
    userId: session.user.id,
    workspaceId: agent.workspaceId || session.user.id,
  });
}
```

**Avantages:**
- Visibilité step-by-step
- Tracking précis des tool calls
- Cost tracking granulaire
- Debug facilité

---

## Changement 4: Model Support (Anthropic Only)

### V1 (Multi-Provider)
```typescript
function createModel(modelType: AgentModel, apiKey: string) {
  switch (modelType) {
    case AgentModel.ANTHROPIC:
      return createAnthropic({ apiKey })("claude-sonnet-4-5");
    case AgentModel.OPENAI:
      return createOpenAI({ apiKey })("gpt-4o");
    case AgentModel.GEMINI:
      return createGoogleGenerativeAI({ apiKey })("gemini-1.5-pro");
  }
}
```

### V2 (Anthropic Only)
```typescript
// Only Anthropic supported
if (agent.model !== AgentModel.ANTHROPIC) {
  return new Response("Only Anthropic models are supported with ClaudeClient", {
    status: 400,
  });
}

const claudeClient = new ClaudeClient({ apiKey });
```

**Justification:**
- ClaudeClient = wrapper spécifique Anthropic
- OpenAI et Gemini non supportés dans V2
- Simplification du code, focus sur Claude API

---

## Changement 5: Response Format

### V1 (SSE Streaming)
```typescript
return result.toUIMessageStreamResponse();
```

### V2 (JSON Response)
```typescript
return new Response(JSON.stringify({
  content: finalText,
  usage: response.usage,
  stopReason: response.stop_reason,
}), {
  headers: { "Content-Type": "application/json" },
});
```

**Note:** SSE streaming peut être ajouté plus tard via Redis PubSub.

---

## Plan de Rollout

### Phase 1: Tester V2 en Parallèle
1. Déployer `route-v2.ts` à côté de `route.ts`
2. Créer un feature flag `USE_CLAUDE_DIRECT` dans config
3. Router conditionnellement vers V1 ou V2

```typescript
// apps/web/src/app/api/agents/chat/route.ts
import { POST as POSTV1 } from "./route-v1";
import { POST as POSTV2 } from "./route-v2";

export async function POST(request: Request) {
  const useClaude = process.env.USE_CLAUDE_DIRECT === "true";
  return useClaude ? POSTV2(request) : POSTV1(request);
}
```

### Phase 2: Migration Graduelle
1. Tester V2 avec 10% des requêtes (feature flag randomisé)
2. Monitorer erreurs, latence, coûts
3. Augmenter progressivement à 50%, puis 100%

### Phase 3: Cleanup
1. Supprimer `route.ts` (V1)
2. Renommer `route-v2.ts` → `route.ts`
3. Supprimer imports Vercel AI SDK

---

## Breaking Changes

### ⚠️ Agents OpenAI et Gemini Non Supportés
**Impact:** Agents avec `model = OPENAI` ou `model = GEMINI` ne pourront plus fonctionner.

**Solution:**
1. Migrer tous les agents vers Anthropic
2. Ou garder V1 pour OpenAI/Gemini, V2 pour Anthropic uniquement

### ⚠️ Response Format Changé
**Impact:** Client `useChat` doit être mis à jour.

**Solution:** Adapter le frontend pour consommer JSON au lieu de SSE (ou ajouter SSE à V2).

---

## Avantages Attendus

| Métrique | V1 | V2 | Amélioration |
|----------|----|----|--------------|
| **Cost tracking** | Aggregate | Per-call | +100% visibilité |
| **Model tiering** | Hardcoded Sonnet | Haiku/Sonnet/Opus | -30-50% coût |
| **Safety** | Aucune | Eval L1/L2/L3 | +90% qualité |
| **Observability** | Basique | Step-by-step | +200% debug |
| **Control** | Abstraction SDK | Claude API direct | +100% contrôle |

---

## Checklist Migration

- [ ] Déployer `route-v2.ts`
- [ ] Ajouter feature flag `USE_CLAUDE_DIRECT`
- [ ] Tester avec 1 agent Anthropic
- [ ] Vérifier AI events loggés dans DB
- [ ] Vérifier eval layer bloque placeholders
- [ ] Tester approval flow (score < 85)
- [ ] Tester auto-send (score >= 85)
- [ ] Migrer agents OpenAI/Gemini → Anthropic
- [ ] Rollout progressif (10% → 50% → 100%)
- [ ] Cleanup: supprimer V1, renommer V2 → route.ts

---

## Notes Additionnelles

### Streaming SSE (Futur)
V2 retourne du JSON. Pour ajouter SSE:
1. Utiliser Redis PubSub
2. Publier chaque step sur un canal
3. Client consomme via SSE endpoint

### Model Tiering (Futur)
Actuellement hardcoded `"smart"`. Pour activer tiering:
1. Ajouter champ `llmTier` à `Agent` model Prisma
2. Mapper `llmTier` → `"fast"` (Haiku) | `"smart"` (Sonnet) | `"deep"` (Opus)
3. Passer `model: agent.llmTier` à `ClaudeClient`

### Multi-Agent OpenAI Support (Futur)
Pour supporter OpenAI dans multi-agent connections:
1. Créer `OpenAIClient` similaire à `ClaudeClient`
2. Router dans `createToolsFromAgentConnections()` selon `targetAgent.model`

---

**FIN DU GUIDE**
