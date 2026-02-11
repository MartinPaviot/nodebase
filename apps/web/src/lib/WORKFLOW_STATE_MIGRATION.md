# Workflow State Management - Migration Guide V1 → V2

## Résumé des changements

### V1 (Actuel - State Implicite)
```typescript
// État passé en paramètre et muté
let context: WorkflowContext = { ...initialData };

for (const node of sortedNodes) {
  const executor = getExecutor(node.type);
  context = await executor({ context, ... }); // ❌ State implicite
}
```

**Problèmes:**
- ❌ État implicite (passé en paramètre)
- ❌ Pas de checkpoints (perte totale si crash)
- ❌ Pas de persistence (tout en mémoire)
- ❌ Impossible de reprendre l'exécution

### V2 (Nouveau - State Explicite LangGraph-style)
```typescript
// État encapsulé dans une classe avec checkpointing automatique
const state = await WorkflowState.create(workflowId, userId, initialData);

for (const node of executableNodes) {
  const currentContext = state.getContext();
  const newContext = await executor({ context: currentContext, ... });

  state.setContext(newContext);        // ✅ Update explicite
  state.incrementStep();
  await state.createCheckpoint(node.id, node.type); // ✅ Checkpoint auto
}

await state.markCompleted();
```

**Avantages:**
- ✅ État explicite (encapsulé dans WorkflowState)
- ✅ Checkpoints automatiques après chaque node
- ✅ Persistence dans la base de données
- ✅ Resume capability (reprendre depuis checkpoint)
- ✅ Error checkpoints (traçabilité des erreurs)

---

## Architecture V2

### Classes principales

#### 1. `WorkflowState` - Gestion de l'état
```typescript
class WorkflowState {
  // Factory methods
  static async create(workflowId, userId, initialData, totalSteps): Promise<WorkflowState>
  static async resume(executionId): Promise<WorkflowState>

  // Accessors (read-only)
  getContext(): Readonly<WorkflowContext>
  getCurrentStep(): number
  getStatus(): WorkflowStatus
  getCheckpoints(): ReadonlyArray<WorkflowCheckpoint>

  // Mutations
  updateContext(updates: Partial<WorkflowContext>): void
  setContext(newContext: WorkflowContext): void
  incrementStep(): void
  setStatus(status: WorkflowStatus): void

  // Checkpointing
  async createCheckpoint(nodeId, nodeName): Promise<void>
  async createErrorCheckpoint(nodeId, nodeName, error): Promise<void>
  async saveCheckpoint(): Promise<void>

  // Completion
  async markCompleted(): Promise<void>
  async markFailed(error): Promise<void>

  // Resume helpers
  canResume(): boolean
  getResumePoint(): { nodeId, stepNumber } | null
}
```

#### 2. `executeWorkflowV2` - Executor avec state management
```typescript
async function executeWorkflowV2({
  workflowId,
  userId,
  initialData,
  resumeFromExecutionId?, // Optionnel: reprendre depuis checkpoint
}): Promise<ExecuteWorkflowResult>
```

---

## Guide de migration

### Étape 1: Tester V2 en parallèle avec V1

**Avant (V1):**
```typescript
import { executeWorkflowSync } from "@/lib/workflow-executor";

const result = await executeWorkflowSync({
  workflowId: "workflow_123",
  userId: "user_456",
  initialData: { foo: "bar" },
});

if (result.success) {
  console.log("Output:", result.output);
}
```

**Après (V2 - compatible):**
```typescript
import { executeWorkflowSync } from "@/lib/workflow-executor-v2";
// OU
import { executeWorkflowV2 } from "@/lib/workflow-executor-v2";

// Option A: Utiliser le wrapper compatible V1
const result = await executeWorkflowSync({
  workflowId: "workflow_123",
  userId: "user_456",
  initialData: { foo: "bar" },
});

// Option B: Utiliser la nouvelle interface (recommandé)
const result = await executeWorkflowV2({
  workflowId: "workflow_123",
  userId: "user_456",
  initialData: { foo: "bar" },
});

console.log("Execution ID:", result.executionId);
console.log("Checkpoints:", result.checkpointsCount);
```

### Étape 2: Utiliser la resume capability

```typescript
import { executeWorkflowV2, resumeWorkflow } from "@/lib/workflow-executor-v2";

// Première exécution
const result1 = await executeWorkflowV2({
  workflowId: "workflow_123",
  userId: "user_456",
  initialData: { foo: "bar" },
});

// Si échec à mi-parcours, reprendre depuis le dernier checkpoint
if (!result1.success) {
  console.log("Échec détecté, reprise...");

  const result2 = await resumeWorkflow({
    executionId: result1.executionId,
  });

  if (result2.success) {
    console.log("Reprise réussie!");
  }
}
```

### Étape 3: Inspecter l'état d'une exécution

```typescript
import { getExecutionState } from "@/lib/workflow-executor-v2";

const state = await getExecutionState("execution_xyz");

console.log("Status:", state.getStatus());
console.log("Step:", state.getCurrentStep(), "/", state.getTotalSteps());
console.log("Checkpoints:", state.getCheckpoints().length);

const lastCheckpoint = state.getLastCheckpoint();
if (lastCheckpoint) {
  console.log("Last node:", lastCheckpoint.nodeName);
  console.log("Context:", lastCheckpoint.context);
}

if (state.canResume()) {
  const resumePoint = state.getResumePoint();
  console.log("Can resume from:", resumePoint);
}
```

---

## Cas d'usage

### 1. Workflow long avec risque de timeout

**Problème V1:** Si le workflow prend plus de 30s, tout est perdu.

**Solution V2:**
```typescript
// Première tentative (timeout après 30s)
const result1 = await executeWorkflowV2({
  workflowId: "long_workflow",
  userId: "user_123",
  initialData: { items: [...1000 items...] },
});

if (!result1.success && result1.error?.includes("timeout")) {
  // Reprendre immédiatement là où on s'est arrêté
  const result2 = await resumeWorkflow({
    executionId: result1.executionId,
  });
}
```

### 2. Workflow avec external API calls (risque de rate limiting)

**Problème V1:** Si une API externe rate-limit au node 8/10, on doit tout refaire.

**Solution V2:**
```typescript
try {
  await executeWorkflowV2({ ... });
} catch (error) {
  if (error.message.includes("rate limit")) {
    // Attendre 60s puis reprendre exactement là où on s'est arrêté
    await new Promise(resolve => setTimeout(resolve, 60000));
    await resumeWorkflow({ executionId });
  }
}
```

### 3. Debug d'un workflow qui échoue

**Problème V1:** Pas d'historique, impossible de savoir où ça a planté.

**Solution V2:**
```typescript
const state = await getExecutionState("execution_123");

// Voir l'historique complet
state.getCheckpoints().forEach((checkpoint, i) => {
  console.log(`Step ${i + 1}: ${checkpoint.nodeName}`);
  console.log(`  Context:`, checkpoint.context);
  if (checkpoint.error) {
    console.error(`  ❌ Error:`, checkpoint.error);
  }
});
```

---

## Plan de rollout

### Phase 1: Tests (Semaine 1)
- ✅ Créer WorkflowState class
- ✅ Créer executeWorkflowV2
- ⏳ Tester V2 sur workflows de dev
- ⏳ Comparer résultats V1 vs V2

### Phase 2: Migration graduelle (Semaine 2-3)
- Migrer 10% des workflows vers V2
- Monitorer checkpoints, performance, erreurs
- Ajuster si nécessaire

### Phase 3: Migration complète (Semaine 4)
- Migrer 100% des workflows vers V2
- Déprécier workflow-executor.ts (V1)
- Renommer workflow-executor-v2.ts → workflow-executor.ts

### Phase 4: Cleanup (Semaine 5)
- Supprimer l'ancien code V1
- Documentation finale

---

## Persistence - Structure dans Execution table

V2 utilise le champ `output` de la table `Execution` pour stocker:

```typescript
{
  checkpoints: [
    {
      id: "checkpoint_1",
      nodeId: "node_abc",
      nodeName: "ANTHROPIC",
      stepNumber: 1,
      context: { ... },
      timestamp: "2026-02-10T...",
    },
    // ...
  ],
  currentContext: { ... },
  currentStep: 5,
  totalSteps: 10,
  error?: "Rate limit exceeded", // Si échec
}
```

**Note:** Pour une implémentation production plus robuste, on pourrait créer une table `ExecutionCheckpoint` dédiée.

---

## Performance

### Overhead des checkpoints

**Coût par checkpoint:**
- 1 UPDATE dans la table Execution
- JSON serialization du context (~1-10KB typiquement)

**Temps ajouté:** ~10-50ms par node

**Acceptable?** Oui, car:
- Workflows sont déjà I/O bound (API calls externes)
- 50ms x 10 nodes = 500ms total (négligeable vs 30s timeout)
- Gain en robustesse >> coût en performance

---

## Questions fréquentes

### Q: Faut-il migrer TOUS les workflows?
**R:** Non, commencer par les workflows critiques ou longs. Les workflows simples (2-3 nodes, <5s) peuvent rester en V1.

### Q: Que se passe-t-il si on resume un workflow dont les nodes ont changé?
**R:** V2 reprend depuis le dernier checkpoint. Si la structure du workflow a changé (nodes supprimés/ajoutés), il peut y avoir des incohérences. Dans ce cas, il vaut mieux créer une nouvelle exécution.

### Q: Les checkpoints sont-ils thread-safe?
**R:** Oui, chaque exécution a son propre `WorkflowState` et son propre `executionId` dans la DB.

### Q: Peut-on avoir plusieurs executions du même workflow en parallèle?
**R:** Oui, chaque exécution est isolée.

---

## Références

- **LangGraph State Management**: https://langchain-ai.github.io/langgraph/concepts/low_level/#state
- **Audit complet**: `.claude/plans/sleepy-gathering-parrot.md`
- **Code source:**
  - `workflow-state.ts` - State management class
  - `workflow-executor-v2.ts` - Nouveau executor
  - `workflow-executor.ts` - Ancien executor (à déprécier)
