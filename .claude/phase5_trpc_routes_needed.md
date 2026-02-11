# Phase 5 tRPC Routes Required

Les 3 pages UI créées en Phase 5 nécessitent les routes tRPC suivantes pour fonctionner.

## Routes pour Analytics Dashboard (`/agents/[agentId]/analytics`)

### `trpc.agents.getMetrics`
```typescript
input: {
  agentId: string;
  timeframe: number; // days
}

output: {
  totalConversations: number;
  successRate: number; // 0-1
  avgCost: number;
  avgLatency: number; // ms
  avgSatisfaction: number; // 1-5
  totalFeedback: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
}
```

### `trpc.agents.getLatestInsights`
```typescript
input: {
  agentId: string;
}

output: AgentInsight | null  // From Prisma model
```

### `trpc.agents.getEvaluations`
```typescript
input: {
  agentId: string;
  limit: number;
}

output: ConversationEvaluation[]  // From Prisma model
```

### `trpc.agents.getFeedback`
```typescript
input: {
  agentId: string;
  limit: number;
}

output: AgentFeedback[]  // From Prisma model
```

### `trpc.agents.getABTests`
```typescript
input: {
  agentId: string;
}

output: AgentABTest[]  // From Prisma model with agent relation
```

---

## Routes pour Improvements Page (`/agents/[agentId]/improvements`)

### `trpc.agents.getModificationProposals`
```typescript
input: {
  agentId: string;
}

output: ModificationProposal[]  // From Prisma model
```

### `trpc.agents.getPerformanceAnalysis`
```typescript
input: {
  agentId: string;
}

output: PerformanceAnalysis  // From @nodebase/core/meta-agent/types.ts
// Uses SelfModifier.analyzePerformance() internally
```

### `trpc.agents.approveModification` (mutation)
```typescript
input: {
  proposalId: string;
  approved: boolean;
}

output: void
// Uses SelfModifier.applyModification() internally
```

---

## Routes pour Optimization Queue (`/optimization`)

### `trpc.optimization.getOptimizationRuns`
```typescript
input: void  // Get all runs for current workspace

output: OptimizationRun[]  // From Prisma model with agent relation
```

### `trpc.optimization.getAllABTests`
```typescript
input: void  // Get all tests for current workspace

output: AgentABTest[]  // From Prisma model with agent relation
```

### `trpc.optimization.selectABTestWinner` (mutation)
```typescript
input: {
  testId: string;
  variant: 'A' | 'B';
}

output: void
// Uses ABTestManager.selectWinner() internally
```

---

## Implémentation

Les routes doivent être ajoutées dans :
- `apps/web/src/trpc/routers/_app.ts` (import des nouveaux routers)
- Créer nouveau fichier : `apps/web/src/trpc/routers/optimization.ts`
- Étendre le fichier existant : `apps/web/src/trpc/routers/agents.ts` (ajouter les nouvelles procédures)

### Exemple d'implémentation

```typescript
// apps/web/src/trpc/routers/agents.ts

import { z } from 'zod';
import { router, protectedProcedure } from '../init';
import { InsightsQuery, SelfModifier } from '@nodebase/core';
import { prisma } from '@/lib/db';
import { subDays } from 'date-fns';

export const agentsRouter = router({
  // ... existing procedures ...

  getMetrics: protectedProcedure
    .input(z.object({
      agentId: z.string(),
      timeframe: z.number().default(30),
    }))
    .query(async ({ input, ctx }) => {
      const since = subDays(new Date(), input.timeframe);

      const traces = await prisma.agentTrace.findMany({
        where: {
          agentId: input.agentId,
          startedAt: { gte: since },
        },
      });

      const evaluations = await prisma.conversationEvaluation.findMany({
        where: {
          conversation: { agentId: input.agentId },
          evaluatedAt: { gte: since },
        },
      });

      // Calculate metrics
      const totalConversations = traces.length;
      const successRate = traces.filter(t => t.status === 'COMPLETED').length / Math.max(traces.length, 1);
      const avgCost = traces.reduce((sum, t) => sum + t.totalCost, 0) / Math.max(traces.length, 1);
      const avgLatency = traces.reduce((sum, t) => sum + (t.latencyMs || 0), 0) / Math.max(traces.length, 1);
      const avgSatisfaction = evaluations.reduce((sum, e) => sum + e.userSatisfactionScore, 0) / Math.max(evaluations.length, 1);
      const totalTokensIn = traces.reduce((sum, t) => sum + t.totalTokensIn, 0);
      const totalTokensOut = traces.reduce((sum, t) => sum + t.totalTokensOut, 0);
      const totalCost = traces.reduce((sum, t) => sum + t.totalCost, 0);

      return {
        totalConversations,
        successRate,
        avgCost,
        avgLatency,
        avgSatisfaction,
        totalFeedback: evaluations.length,
        totalTokensIn,
        totalTokensOut,
        totalCost,
      };
    }),

  getLatestInsights: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ input }) => {
      return await InsightsQuery.getLatestInsights(input.agentId);
    }),

  getEvaluations: protectedProcedure
    .input(z.object({
      agentId: z.string(),
      limit: z.number().default(10),
    }))
    .query(async ({ input }) => {
      return await prisma.conversationEvaluation.findMany({
        where: {
          conversation: { agentId: input.agentId },
        },
        orderBy: { evaluatedAt: 'desc' },
        take: input.limit,
      });
    }),

  getFeedback: protectedProcedure
    .input(z.object({
      agentId: z.string(),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      return await prisma.agentFeedback.findMany({
        where: { agentId: input.agentId },
        orderBy: { timestamp: 'desc' },
        take: input.limit,
      });
    }),

  getABTests: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ input }) => {
      return await prisma.agentABTest.findMany({
        where: { agentId: input.agentId },
        include: { agent: { select: { name: true } } },
        orderBy: { startedAt: 'desc' },
      });
    }),

  getModificationProposals: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ input }) => {
      return await prisma.modificationProposal.findMany({
        where: { agentId: input.agentId },
        orderBy: { proposedAt: 'desc' },
      });
    }),

  getPerformanceAnalysis: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ input }) => {
      const modifier = new SelfModifier();
      return await modifier.analyzePerformance(input.agentId);
    }),

  approveModification: protectedProcedure
    .input(z.object({
      proposalId: z.string(),
      approved: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const modifier = new SelfModifier();
      await modifier.applyModification(input.proposalId, input.approved);
    }),
});
```

```typescript
// apps/web/src/trpc/routers/optimization.ts

import { z } from 'zod';
import { router, protectedProcedure } from '../init';
import { ABTestManager } from '@nodebase/core';
import { prisma } from '@/lib/db';

export const optimizationRouter = router({
  getOptimizationRuns: protectedProcedure
    .query(async ({ ctx }) => {
      return await prisma.optimizationRun.findMany({
        where: {
          agent: { userId: ctx.user.id },
        },
        include: {
          agent: { select: { name: true } },
        },
        orderBy: { triggeredAt: 'desc' },
        take: 50,
      });
    }),

  getAllABTests: protectedProcedure
    .query(async ({ ctx }) => {
      return await prisma.agentABTest.findMany({
        where: {
          agent: { userId: ctx.user.id },
        },
        include: {
          agent: { select: { name: true } },
        },
        orderBy: { startedAt: 'desc' },
        take: 50,
      });
    }),

  selectABTestWinner: protectedProcedure
    .input(z.object({
      testId: z.string(),
      variant: z.enum(['A', 'B']),
    }))
    .mutation(async ({ input }) => {
      const manager = new ABTestManager();
      await manager.selectWinner(input.testId, input.variant);
    }),
});
```

```typescript
// apps/web/src/trpc/routers/_app.ts

import { router } from '../init';
import { agentsRouter } from './agents';
import { optimizationRouter } from './optimization';
// ... other imports

export const appRouter = router({
  agents: agentsRouter,
  optimization: optimizationRouter,
  // ... other routers
});
```

---

## Note importante

Ces routes tRPC doivent être implémentées pour que les pages UI fonctionnent. Les pages afficheront des erreurs ou des états de chargement infinis si les routes ne sont pas disponibles.

Les imports de `@nodebase/core` (InsightsQuery, SelfModifier, ABTestManager) sont disponibles depuis les phases précédentes.
