// @ts-nocheck
// TODO: Uses planned @nodebase/core exports (ABTestManager, AutoOptimizer) not yet implemented
import prisma from "@/lib/db";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { z } from "zod";

/**
 * Optimization Router (Phase 5)
 * Workspace-wide optimization runs and A/B tests
 */
export const optimizationRouter = createTRPCRouter({
  // ==================
  // OPTIMIZATION RUNS
  // ==================

  getOptimizationRuns: protectedProcedure.query(async ({ ctx }) => {
    return await prisma.optimizationRun.findMany({
      where: {
        agent: { userId: ctx.auth.user.id },
      },
      include: {
        agent: { select: { name: true } },
      },
      orderBy: { triggeredAt: "desc" },
      take: 50,
    });
  }),

  // ==================
  // A/B TESTS
  // ==================

  getAllABTests: protectedProcedure.query(async ({ ctx }) => {
    return await prisma.agentABTest.findMany({
      where: {
        agent: { userId: ctx.auth.user.id },
      },
      include: {
        agent: { select: { name: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 50,
    });
  }),

  selectABTestWinner: protectedProcedure
    .input(
      z.object({
        testId: z.string(),
        variant: z.enum(["A", "B"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const test = await prisma.agentABTest.findUniqueOrThrow({
        where: { id: input.testId },
        include: { agent: true },
      });

      if (test.agent.userId !== ctx.auth.user.id) {
        throw new Error("Unauthorized");
      }

      // Use ABTestManager from @nodebase/core
      const { ABTestManager } = await import("@nodebase/core");
      const manager = new ABTestManager();
      await manager.selectWinner(input.testId, input.variant);
    }),
});
