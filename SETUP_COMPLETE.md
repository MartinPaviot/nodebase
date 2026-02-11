# ✅ Setup Complete - Ready to Test!

**Date:** Février 2026
**Status:** Toutes les dépendances sont configurées, le schema Prisma est sync, prêt pour tests

---

## Ce qui a été fait

### 1. Schema Prisma mis à jour ✅
- Ajouté `llmTier`, `maxStepsPerRun`, `evalRules`, `workspaceId` au modèle `Agent`
- Schema sync avec la DB (`npx prisma db push` complété)

### 2. Fichiers créés (17 nouveaux fichiers) ✅
```
apps/web/src/lib/
├── ai/
│   ├── claude-client.ts          ✅ Claude API wrapper
│   ├── event-logger.ts           ✅ AI event persistence
│   └── README.md                 ✅ Documentation
├── connectors/
│   ├── base-connector.ts         ✅ Abstract interface
│   ├── composio-connector.ts     ✅ Composio (24 apps)
│   ├── registry.ts               ✅ Factory pattern
│   ├── index.ts                  ✅ Exports
│   ├── USAGE_GUIDE.md           ✅ Guide d'usage
│   └── CONNECTORS_COMPLETE.md   ✅ Status
├── eval/
│   ├── l1-assertions.ts          ✅ Deterministic checks
│   ├── l2-scoring.ts             ✅ Rule-based scoring
│   ├── l3-llm-judge.ts           ✅ LLM as Judge
│   ├── index.ts                  ✅ Orchestrator
│   ├── types.ts                  ✅ Type definitions
│   └── EVAL_GUIDE.md            ✅ Complete guide
├── workflow-state.ts             ✅ State management
├── workflow-executor-v2.ts       ✅ New executor
├── WORKFLOW_STATE_MIGRATION.md   ✅ Migration guide
├── IMPLEMENTATION_COMPLETE.md    ✅ Récap complet
└── QUICK_START.md               ✅ Test guide

apps/web/src/app/api/agents/chat/
├── route-v2.ts                   ✅ New route (Claude Direct + Eval)
└── MIGRATION_V1_V2.md           ✅ Migration guide

.env.example                      ✅ Template variables
```

### 3. Erreurs TypeScript corrigées ✅
- Route-v2.ts compile maintenant sans erreurs
- Imports corrects pour ClaudeClient, AIEventLogger, Eval
- Compatibilité avec AgentTracer existant

---

## Variables d'Environnement Requises

### Minimum pour démarrer:
```bash
# 1. Database
DATABASE_URL="postgresql://..."

# 2. Auth
BETTER_AUTH_SECRET="..." # Min 32 chars
BETTER_AUTH_URL="http://localhost:3000"

# 3. LLM - REQUIS pour ClaudeClient
ANTHROPIC_API_KEY="sk-ant-..."

# 4. Composio - REQUIS pour BaseConnector
COMPOSIO_API_KEY="..."

# 5. Encryption - REQUIS
CREDENTIAL_ENCRYPTION_KEY="..." # Min 32 chars
```

### Optionnel (avec defaults):
```bash
# Eval Layer (defaults: L1=true, L2=true, L3=false)
EVAL_ENABLE_L1="true"
EVAL_ENABLE_L2="true"
EVAL_ENABLE_L3="false"  # Coûte $, désactivé par défaut

# Observability (defaults: all true)
ENABLE_AI_EVENT_LOGGING="true"
ENABLE_TRACING="true"

# Feature flag (default: false, use V1)
USE_CLAUDE_DIRECT="false"  # Set to "true" to use route-v2.ts
```

**Voir `.env.example` pour la liste complète.**

---

## Quick Start (3 minutes)

### Étape 1: Vérifier les variables d'environnement
```bash
# Copier .env.example si besoin
cp .env.example .env

# Éditer .env et remplir:
# - ANTHROPIC_API_KEY=sk-ant-...
# - COMPOSIO_API_KEY=...
# - CREDENTIAL_ENCRYPTION_KEY=... (32+ chars)
```

### Étape 2: Vérifier le schema
```bash
# Le schema est déjà sync, mais pour vérifier:
npx prisma studio --schema=prisma/schema.prisma

# Dans Prisma Studio, vérifier:
# - Agent table a: llmTier, maxStepsPerRun, evalRules, workspaceId ✅
# - AiEvent table existe avec timestamp, conversationId ✅
```

### Étape 3: Test rapide - ClaudeClient
```typescript
// test-claude.ts
import { ClaudeClient } from "./apps/web/src/lib/ai/claude-client";

const client = new ClaudeClient({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

const response = await client.chat({
  model: "fast", // Haiku
  messages: [{ role: "user", content: "Say hello in 3 words" }],
  maxSteps: 1,
  userId: "test",

  onStepComplete: async (event) => {
    console.log(`Tokens: ${event.tokensIn} → ${event.tokensOut}, Cost: $${event.cost}`);
  },
});

console.log("Response:", response.content);
```

```bash
npx tsx test-claude.ts
```

**Résultat attendu:**
```
Tokens: 12 → 5, Cost: $0.0000
Response: [{"type":"text","text":"Hello, good day!"}]
✅ ClaudeClient fonctionne!
```

---

## Tests End-to-End

### Option A: Tester avec route V1 (actuel, sans eval)
```bash
# Rien à changer, fonctionne comme avant
npm run dev
# → http://localhost:3000/agents/{agentId}/chat/{conversationId}
```

### Option B: Tester avec route V2 (nouveau, avec eval)
```bash
# 1. Activer feature flag
echo "USE_CLAUDE_DIRECT=true" >> .env

# 2. Créer un agent Anthropic (via UI ou Prisma Studio)
# 3. Optionnel: Configurer evalRules sur l'agent:
```

```typescript
// Via Prisma Studio ou code
await prisma.agent.update({
  where: { id: "agent_xxx" },
  data: {
    llmTier: "smart", // fast, smart, ou deep
    maxStepsPerRun: 10,
    evalRules: {
      assertions: [
        { check: "no_placeholders", severity: "block" },
        { check: "has_real_content", severity: "block" },
      ],
      min_confidence: 0.6,
      l3_trigger: "on_irreversible_action",
      auto_send_threshold: 0.85,
    },
  },
});
```

```bash
# 4. Démarrer l'app
npm run dev

# 5. Tester via UI
# → Chat avec agent
# → Essayer: "Draft an email to John with {{name}}"
# → Devrait bloquer avec "L1 failed: Contains placeholders"

# 6. Vérifier AI events loggés
# → Prisma Studio → AiEvent table → devrait voir les events
```

---

## Vérifications Post-Test

### Check 1: AI Events dans DB
```sql
SELECT
  model, tier, "tokensIn", "tokensOut", cost, "latencyMs"
FROM "AiEvent"
ORDER BY timestamp DESC
LIMIT 10;
```

**Attendu:** Chaque appel LLM crée un AiEvent.

### Check 2: Agent Traces
```sql
SELECT
  "agentId", "totalSteps", "totalCost",
  "l1Passed", "l2Score", "l3Triggered"
FROM "AgentTrace"
ORDER BY "startedAt" DESC
LIMIT 5;
```

**Attendu:** Chaque conversation crée un AgentTrace.

### Check 3: Cost Tracking
```typescript
import { AIEventLogger } from "@/lib/ai/event-logger";

const logger = new AIEventLogger();
const cost = await logger.getUserCost("user_xxx", {
  startDate: new Date("2026-02-01"),
});

console.log(`Total cost: $${cost.totalCost}`);
console.log(`Total calls: ${cost.totalCalls}`);
```

---

## Troubleshooting

### ❌ Erreur: "ANTHROPIC_API_KEY is required"
**Solution:** Ajoutez dans `.env`:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### ❌ Erreur: "Only Anthropic models are supported"
**Solution:** Votre agent utilise `model = OPENAI` ou `GEMINI`. Changez vers `ANTHROPIC` via Prisma Studio.

### ❌ Erreur: Prisma generate fails (Windows)
**Solution:** Normal (permissions). Utilisez `npx prisma db push` directement.

### ❌ Eval L3 ne se déclenche jamais
**Solution:**
- Vérifiez `EVAL_ENABLE_L3=true` dans `.env`
- L3 se déclenche seulement pour actions irréversibles (send_email, send_slack_message, etc.)

### ❌ AI events non loggés
**Solution:**
- Vérifiez `ENABLE_AI_EVENT_LOGGING=true` dans `.env`
- Vérifiez que vous utilisez route-v2.ts (feature flag `USE_CLAUDE_DIRECT=true`)

---

## Documentation Complète

- **Quick Start:** `apps/web/src/lib/QUICK_START.md`
- **ClaudeClient:** `apps/web/src/lib/ai/README.md`
- **BaseConnector:** `apps/web/src/lib/connectors/USAGE_GUIDE.md`
- **Eval Layer:** `apps/web/src/lib/eval/EVAL_GUIDE.md`
- **Migration V1→V2:** `apps/web/src/app/api/agents/chat/MIGRATION_V1_V2.md`
- **Implementation Status:** `apps/web/src/lib/IMPLEMENTATION_COMPLETE.md`

---

## Prochaines Étapes

### Immédiat:
1. ✅ Vérifier variables d'environnement
2. ✅ Tester ClaudeClient (3 min)
3. ✅ Tester via UI avec un agent Anthropic

### Court terme:
4. Migrer V1 → V2 en production (feature flag rollout)
5. Configurer evalRules sur templates
6. Dashboard cost tracking

### Moyen terme (Phase 3):
7. Agent Engine Refactor (hooks)
8. Scan Engine (metadata detection)
9. Style Learner (few-shot)

---

## STATUS: ✅ READY TO TEST

Tout est configuré et prêt! Suivez le Quick Start ci-dessus pour tester.

**Questions?** Voir la doc complète dans `apps/web/src/lib/IMPLEMENTATION_COMPLETE.md`.
