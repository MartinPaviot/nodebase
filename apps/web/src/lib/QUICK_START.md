# Quick Start - Testing New Implementation

**Date:** Février 2026
**Status:** ✅ Ready for testing

---

## 1. Vérifier les Variables d'Environnement

Assurez-vous que votre fichier `.env` contient:

```bash
# Database
DATABASE_URL="postgresql://..."

# Auth
BETTER_AUTH_SECRET="..." # Min 32 chars
BETTER_AUTH_URL="http://localhost:3000"

# LLM - REQUIS pour ClaudeClient
ANTHROPIC_API_KEY="sk-ant-..."

# Composio - REQUIS pour BaseConnector
COMPOSIO_API_KEY="..."

# Encryption - REQUIS pour credentials
CREDENTIAL_ENCRYPTION_KEY="..." # Min 32 chars

# Eval Layer (Optionnel, defaults activés)
EVAL_ENABLE_L1=true
EVAL_ENABLE_L2=true
EVAL_ENABLE_L3=false # Coûte $, désactivé par défaut
EVAL_L2_MIN_SCORE=0.6
EVAL_L3_AUTO_SEND_THRESHOLD=0.85

# AI Event Logging (Optionnel, activé par défaut)
ENABLE_AI_EVENT_LOGGING=true
```

---

## 2. Appliquer les Changements Prisma

```bash
# Generate Prisma client (peut échouer sur Windows, normal)
npx prisma generate --schema=prisma/schema.prisma

# Push schema to DB
npx prisma db push --schema=prisma/schema.prisma

# Verify tables
npx prisma studio --schema=prisma/schema.prisma
# Check: Agent has llmTier, maxStepsPerRun, evalRules, workspaceId
# Check: AiEvent exists with timestamp, conversationId
```

---

## 3. Test 1: ClaudeClient Direct

Créez un fichier test:

```typescript
// apps/web/test-claude-client.ts
import { ClaudeClient } from "./src/lib/ai/claude-client";
import { config } from "./src/lib/config";

async function testClaudeClient() {
  const client = new ClaudeClient({ apiKey: config.llm.anthropicApiKey });

  console.log("Testing ClaudeClient...");

  const response = await client.chat({
    model: "fast", // Haiku
    messages: [{ role: "user", content: "Say hello in French" }],
    systemPrompt: "You are a helpful assistant.",
    maxSteps: 1,
    userId: "test_user",

    onStepComplete: async (event) => {
      console.log(`Step ${event.stepNumber}:`);
      console.log(`  Model: ${event.model} (${event.tier})`);
      console.log(`  Tokens: ${event.tokensIn} → ${event.tokensOut}`);
      console.log(`  Cost: $${event.cost.toFixed(4)}`);
      console.log(`  Latency: ${event.latency}ms`);
    },
  });

  const text = response.content
    .filter(block => block.type === "text")
    .map(block => block.text)
    .join("\n");

  console.log("\nResponse:", text);
  console.log("\nUsage:", response.usage);
  console.log("✓ ClaudeClient works!");
}

testClaudeClient().catch(console.error);
```

```bash
npx tsx apps/web/test-claude-client.ts
```

**Résultat attendu:**
```
Testing ClaudeClient...
Step 1:
  Model: claude-3-haiku-20240307 (fast)
  Tokens: 15 → 8
  Cost: $0.0000
  Latency: 1234ms

Response: Bonjour !

Usage: { input_tokens: 15, output_tokens: 8 }
✓ ClaudeClient works!
```

---

## 4. Test 2: AIEventLogger

```typescript
// apps/web/test-event-logger.ts
import { AIEventLogger } from "./src/lib/ai/event-logger";
import prisma from "./src/lib/db";

async function testEventLogger() {
  const logger = new AIEventLogger();

  console.log("Logging AI event...");

  await logger.log({
    agentId: "test_agent",
    conversationId: "test_conv",
    userId: "test_user",
    workspaceId: "test_workspace",
    model: "claude-3-haiku-20240307",
    tier: "fast",
    tokensIn: 100,
    tokensOut: 50,
    cost: 0.005,
    latency: 1500,
    stepNumber: 1,
    action: "chat",
    timestamp: new Date(),
  });

  console.log("✓ Event logged!");

  // Check in DB
  const events = await prisma.aiEvent.findMany({
    where: { userId: "test_user" },
    orderBy: { timestamp: "desc" },
    take: 5,
  });

  console.log(`\nFound ${events.length} events in DB:`);
  events.forEach(e => {
    console.log(`  - ${e.model}: ${e.tokensIn}→${e.tokensOut} tokens, $${e.cost}`);
  });

  // Test cost aggregation
  const cost = await logger.getUserCost("test_user", {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
  });

  console.log(`\nTotal cost (30 days): $${cost.totalCost.toFixed(4)}`);
  console.log(`Total calls: ${cost.totalCalls}`);
  console.log(`Avg cost per call: $${cost.avgCostPerCall.toFixed(6)}`);
}

testEventLogger().catch(console.error);
```

```bash
npx tsx apps/web/test-event-logger.ts
```

---

## 5. Test 3: Eval Layer

```typescript
// apps/web/test-eval.ts
import { evaluateContent } from "./src/lib/eval";

async function testEval() {
  console.log("Test 1: Block placeholder...");

  const badEmail = await evaluateContent({
    text: "Dear {{name}}, thank you for your email.",
    userId: "test_user",
    action: "send_email",
    enableL1: true,
    l1Assertions: [
      { check: "no_placeholders", severity: "block" },
    ],
  });

  console.log("  Passed:", badEmail.passed);
  console.log("  Block reason:", badEmail.blockReason);
  // Expected: passed = false, blockReason = "L1 failed: Contains placeholders"

  console.log("\nTest 2: Good email...");

  const goodEmail = await evaluateContent({
    text: "Dear John, thank you for your email. I'll get back to you soon.",
    userId: "test_user",
    action: "send_email",
    context: { recipientName: "John" },
    enableL1: true,
    enableL2: true,
    enableL3: false, // Skip LLM judge for now
    l1Assertions: [
      { check: "no_placeholders", severity: "block" },
      { check: "contains_recipient_name", severity: "block" },
      { check: "has_real_content", severity: "block" },
    ],
    l2MinScore: 60,
  });

  console.log("  Passed:", goodEmail.passed);
  console.log("  L2 Score:", goodEmail.l2Score);
  console.log("  Can auto-send:", goodEmail.canAutoSend);
  console.log("  Requires approval:", goodEmail.requiresApproval);
  // Expected: passed = true, l2Score > 60

  console.log("\n✓ Eval layer works!");
}

testEval().catch(console.error);
```

```bash
npx tsx apps/web/test-eval.ts
```

---

## 6. Test 4: BaseConnector (Composio)

```typescript
// apps/web/test-connector.ts
import { getConnector, listConnectors } from "./src/lib/connectors";

async function testConnector() {
  console.log("Available connectors:");
  const all = listConnectors();
  console.log(`  Total: ${all.length} connectors`);

  console.log("\nGmail connector:");
  const gmail = getConnector("gmail");
  console.log(`  ID: ${gmail.id}`);
  console.log(`  Name: ${gmail.name}`);
  console.log(`  Provider: ${gmail.provider}`);

  // List tools
  const tools = await gmail.listAvailableTools();
  console.log(`\nAvailable tools: ${tools.length}`);
  tools.slice(0, 5).forEach(tool => {
    console.log(`  - ${tool.name}: ${tool.description}`);
  });

  console.log("\n✓ BaseConnector works!");
}

testConnector().catch(console.error);
```

```bash
npx tsx apps/web/test-connector.ts
```

---

## 7. Test 5: Chat Route V2 (End-to-End)

1. **Créer un agent Anthropic:**
   ```bash
   # Via l'UI ou Prisma Studio
   # Assurez-vous que model = ANTHROPIC
   ```

2. **Optionnel: Activer eval rules sur l'agent:**
   ```typescript
   // Via Prisma Studio ou code
   await prisma.agent.update({
     where: { id: "agent_123" },
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

3. **Router vers V2:**
   ```typescript
   // apps/web/src/app/api/agents/chat/route.ts
   // Option 1: Renommer
   // mv route.ts route-v1.ts
   // mv route-v2.ts route.ts

   // Option 2: Feature flag
   export { POST } from process.env.USE_CLAUDE_DIRECT === "true"
     ? "./route-v2"
     : "./route-v1";
   ```

4. **Tester via l'UI:**
   ```
   http://localhost:3000/agents/{agentId}/chat/{conversationId}

   Envoyer: "Draft an email to John thanking him for the meeting"

   Attendu:
   - AI events loggés dans DB (SELECT * FROM "AiEvent" ORDER BY timestamp DESC)
   - Si email avec {{name}}, doit bloquer (L1 assertion)
   - Si score < 85, doit demander approval
   - Si score >= 85, doit auto-send
   ```

---

## 8. Vérifications Post-Test

### Check 1: AI Events dans DB
```sql
SELECT
  model, tier,
  "tokensIn", "tokensOut",
  cost, "latencyMs",
  timestamp
FROM "AiEvent"
WHERE "userId" = 'your_user_id'
ORDER BY timestamp DESC
LIMIT 10;
```

**Attendu:** Chaque appel LLM doit créer un AiEvent.

### Check 2: Agent Traces
```sql
SELECT
  "agentId", "conversationId",
  "totalSteps", "totalTokensIn", "totalTokensOut", "totalCost",
  "l1Passed", "l2Score", "l3Triggered",
  status
FROM "AgentTrace"
WHERE "userId" = 'your_user_id'
ORDER BY "startedAt" DESC
LIMIT 5;
```

**Attendu:** Chaque conversation doit créer un AgentTrace avec eval fields populated.

### Check 3: Cost Aggregation
```typescript
import { AIEventLogger } from "@/lib/ai/event-logger";

const logger = new AIEventLogger();
const cost = await logger.getUserCost("your_user_id", {
  startDate: new Date("2026-02-01"),
  endDate: new Date("2026-02-28"),
});

console.log(`Total cost (Feb): $${cost.totalCost}`);
console.log(`Total calls: ${cost.totalCalls}`);
console.log(`By tier:`, cost.breakdown);
```

---

## 9. Troubleshooting

### Erreur: "ANTHROPIC_API_KEY is required"
**Solution:** Ajoutez `ANTHROPIC_API_KEY=sk-ant-...` dans `.env`

### Erreur: "COMPOSIO_API_KEY is required"
**Solution:** Ajoutez `COMPOSIO_API_KEY=...` dans `.env`

### Erreur: "Only Anthropic models are supported"
**Solution:** Votre agent utilise `model = OPENAI` ou `GEMINI`. Changez vers `ANTHROPIC`.

### Erreur: Prisma generate échoue (Windows)
**Solution:** Normal, c'est un problème de permissions. Faites `npx prisma db push` directement.

### Eval L3 ne se déclenche pas
**Solution:**
- Vérifiez `EVAL_ENABLE_L3=true` dans `.env`
- Vérifiez que l'action est dans `IRREVERSIBLE_ACTIONS` (send_email, send_slack_message, etc.)

### AI events non loggés
**Solution:**
- Vérifiez `ENABLE_AI_EVENT_LOGGING=true` dans `.env`
- Vérifiez que vous utilisez route-v2.ts (pas route.ts)

---

## 10. Next Steps

Une fois les tests validés:

1. **Migration V1 → V2:**
   - Renommer `route.ts` → `route-v1-backup.ts`
   - Renommer `route-v2.ts` → `route.ts`

2. **Configurer eval rules sur templates:**
   - Mettre à jour `prisma/seed-templates.ts`
   - Ajouter `evalRules` pour chaque template

3. **Monitoring:**
   - Dashboard cost par agent/user
   - Alertes si eval fail rate > 10%

4. **Phase 3 (Optionnel):**
   - Agent Engine Refactor (hooks)
   - Scan Engine (metadata detection)
   - Style Learner (few-shot)

---

**STATUS: ✅ READY TO TEST**

Suivez les étapes ci-dessus pour valider que tout fonctionne!
