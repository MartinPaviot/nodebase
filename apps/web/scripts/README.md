# Integration Tests

Scripts pour tester l'intégration Nodebase Core dans l'app Next.js.

## Prérequis

```bash
# Variables d'environnement (.env à la racine)
COMPOSIO_API_KEY=your_composio_key    # Optionnel, utilise mock si absent
ANTHROPIC_API_KEY=your_anthropic_key  # Optionnel, utilise mock si absent
```

## Tests Disponibles

### 1. Test d'Intégration (`test-integration.ts`)

Teste l'initialisation et l'exécution basique du système.

**Exécuter:**
```bash
# Depuis la racine du monorepo
pnpm --filter @nodebase/web tsx scripts/test-integration.ts
```

**Ce qu'il teste:**
- ✅ Initialisation du core (ScanEngine + AgentEngine)
- ✅ Exécution d'un scan SALES
- ✅ Exécution d'un agent avec eval L1/L2/L3
- ✅ Logging des coûts et tokens

**Output attendu:**
```
=== Nodebase Integration Test ===

[Test 1] Initializing Nodebase core...
[Nodebase] Initializing core system...
[Nodebase] Core initialized:
  - Composio: ✓ (or ✗ using mocks)
  - AI Client: ✓ (or ✗ using mocks)
✓ Core initialized successfully
  Scan Engine: ✓
  Agent Engine: ✓

[Test 2] Running SALES scan...
✓ Scan completed successfully
  Category: SALES
  Signals: 0
  Scanned at: 2026-02-10T...
  (No signals detected - using mock data)

[Test 3] Executing test agent...
[Agent test_agent] Starting execution for user test_user
✓ Agent execution completed successfully
  Run ID: run_abc123
  Status: pending_review
  Model: claude-3-5-sonnet-20241022
  Tokens: 100 in / 50 out
  Cost: $0.0008
  Latency: 0ms

  Eval Results:
    L1 Passed: true
    L2 Score: 0/100
    L3 Triggered: false

  Output: This is a mock response from the agent. Inject AIClient for real responses...
[Agent test_agent] Execution completed: ...

=== Integration Test Complete ===
```

## API Routes Créées

### POST /api/scan

Exécute un scan pour une catégorie donnée.

**Request:**
```json
{
  "category": "SALES",
  "workspaceId": "workspace_123",
  "credentials": {
    "hubspot": { "accessToken": "..." },
    "salesforce": { "accessToken": "..." }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "scan_abc123",
    "category": "SALES",
    "workspaceId": "workspace_123",
    "scannedAt": "2026-02-10T...",
    "signalsCount": 5,
    "signals": [
      {
        "id": "signal_xyz",
        "type": "dormant-deal",
        "severity": "high",
        "title": "Deal 'Acme Corp' is dormant",
        "description": "No activity for 15 days. Value: $50,000",
        "metadata": { "dealId": "123", "amount": 50000 },
        "connectorId": "hubspot",
        "detectedAt": "2026-02-10T..."
      }
    ],
    "criticalCount": 2
  }
}
```

**Test avec curl:**
```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "category": "SALES",
    "workspaceId": "test_workspace",
    "credentials": {}
  }'
```

### GET /api/scan

Liste les catégories de scan disponibles.

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "SALES",
        "name": "Sales",
        "description": "Detect dormant deals, stale leads, and lost opportunities",
        "icon": "💼"
      },
      ...
    ]
  }
}
```

### POST /api/agents/execute

Exécute un agent avec le core engine.

**Request:**
```json
{
  "agent": {
    "id": "agent_123",
    "name": "Deal Revival Agent",
    "systemPrompt": "You analyze dormant deals...",
    "llmTier": "smart",
    "temperature": 0.7,
    "maxStepsPerRun": 5,
    "fetchSources": [
      {
        "source": "hubspot",
        "query": "search_deals",
        "filters": { "status": "dormant" }
      }
    ],
    "actions": [
      { "type": "draft_email", "requireApproval": true }
    ],
    "evalRules": { ... }
  },
  "context": {
    "userId": "user_123",
    "workspaceId": "workspace_123",
    "triggeredBy": "manual",
    "userMessage": "Analyze dormant deals"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "runId": "run_abc123",
    "status": "pending_review",
    "output": {
      "type": "text",
      "content": "I've analyzed 5 dormant deals..."
    },
    "llmUsage": {
      "model": "claude-3-5-sonnet-20241022",
      "tokensIn": 250,
      "tokensOut": 150,
      "cost": 0.0032,
      "latencyMs": 1200
    },
    "evalResult": {
      "l1Passed": true,
      "l1Failures": [],
      "l2Score": 75,
      "l2Breakdown": { "professional_tone": 80, "clarity": 70 },
      "l3Triggered": false,
      "l3Blocked": false,
      "l3Reason": null
    }
  }
}
```

### GET /api/agents/execute

Retourne les infos sur l'API (tiers LLM, eval layers).

## Troubleshooting

**"Core initialization failed"**
- Vérifie que les packages `@nodebase/*` sont installés: `pnpm install`
- Vérifie que le build des packages est à jour: `pnpm build`

**"Module not found: @nodebase/core"**
- Run `pnpm install` depuis la racine du monorepo
- Run `turbo run build` pour builder tous les packages

**"Composio: ✗ (using mocks)"**
- Normal si `COMPOSIO_API_KEY` n'est pas définie
- Le système fonctionne en mode mock pour les tests

**"AI Client: ✗ (using mocks)"**
- Normal si `ANTHROPIC_API_KEY` n'est pas définie
- Les réponses LLM seront mockées

## Prochaines Étapes

1. **Connecter OAuth Composio**
   - Créer une route `/api/integrations/composio/connect`
   - Implémenter le flow OAuth
   - Stocker les tokens dans la DB

2. **Implémenter la UI Scan**
   - Page `/scan` avec liste des catégories
   - Bouton "Run Scan" par catégorie
   - Affichage des signaux détectés

3. **Implémenter Agent Dashboard**
   - Page `/agents` avec liste des agents
   - Bouton "Execute" par agent
   - Affichage des résultats + eval

4. **Setup Cron Jobs**
   - Utiliser Vercel Cron ou `@nodebase/queue`
   - Exécuter scans quotidiens
   - Exécuter agents programmés
