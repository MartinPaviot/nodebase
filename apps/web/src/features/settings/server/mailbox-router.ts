import prisma from "@/lib/db";
import {
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import z from "zod";
import { TRPCError } from "@trpc/server";

export const mailboxRouter = createTRPCRouter({
  // ==================
  // MAILBOX ACCOUNTS
  // ==================

  getMailboxes: protectedProcedure.query(async ({ ctx }) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const mailboxes = await prisma.mailboxAccount.findMany({
      where: { userId: ctx.auth.user.id },
      orderBy: [{ domain: "asc" }, { email: "asc" }],
    });

    // Include count of sent emails today for each mailbox
    const mailboxIds = mailboxes.map((m) => m.id);

    const sentTodayCounts = await prisma.campaignEmail.groupBy({
      by: ["mailboxAccountId"],
      where: {
        mailboxAccountId: { in: mailboxIds },
        sentAt: { gte: startOfDay },
        status: { not: "QUEUED" },
      },
      _count: { id: true },
    });

    const sentCountMap = new Map(
      sentTodayCounts.map((c) => [c.mailboxAccountId, c._count.id])
    );

    return mailboxes.map((mailbox) => ({
      ...mailbox,
      sentToday: sentCountMap.get(mailbox.id) ?? 0,
    }));
  }),

  getMailbox: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const mailbox = await prisma.mailboxAccount.findUniqueOrThrow({
        where: { id: input.id },
      });

      // Verify ownership
      if (mailbox.userId !== ctx.auth.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not own this mailbox",
        });
      }

      // Get domain health for this mailbox's domain
      const domainHealth = await prisma.domainHealth.findUnique({
        where: {
          userId_domain: {
            userId: ctx.auth.user.id,
            domain: mailbox.domain,
          },
        },
      });

      return { ...mailbox, domainHealth };
    }),

  pauseMailbox: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const mailbox = await prisma.mailboxAccount.findUniqueOrThrow({
        where: { id: input.id },
      });

      if (mailbox.userId !== ctx.auth.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not own this mailbox",
        });
      }

      // Disable warmup on Instantly (non-blocking)
      if (mailbox.instantlyAccountId) {
        try {
          const { disableWarmup } = await import("@/lib/instantly");
          await disableWarmup(mailbox.instantlyAccountId);
        } catch (error) {
          console.error(
            `[mailbox:pauseMailbox] Failed to disable warmup on Instantly for ${mailbox.email}:`,
            error
          );
        }
      }

      return prisma.mailboxAccount.update({
        where: { id: input.id },
        data: { status: "PAUSED" },
      });
    }),

  resumeMailbox: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const mailbox = await prisma.mailboxAccount.findUniqueOrThrow({
        where: { id: input.id },
      });

      if (mailbox.userId !== ctx.auth.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not own this mailbox",
        });
      }

      // Re-enable warmup on Instantly (non-blocking)
      if (mailbox.instantlyAccountId) {
        try {
          const { enableWarmup } = await import("@/lib/instantly");
          await enableWarmup(mailbox.instantlyAccountId);
        } catch (error) {
          console.error(
            `[mailbox:resumeMailbox] Failed to enable warmup on Instantly for ${mailbox.email}:`,
            error
          );
        }
      }

      return prisma.mailboxAccount.update({
        where: { id: input.id },
        data: { status: "WARMING" },
      });
    }),

  removeMailbox: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const mailbox = await prisma.mailboxAccount.findUniqueOrThrow({
        where: { id: input.id },
      });

      if (mailbox.userId !== ctx.auth.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not own this mailbox",
        });
      }

      // Check if any active campaigns are using this mailbox
      const activeCampaignEmails = await prisma.campaignEmail.findFirst({
        where: {
          mailboxAccountId: input.id,
          campaign: { status: "ACTIVE" },
        },
      });

      if (activeCampaignEmails) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Cannot remove mailbox while active campaigns are using it. Pause or complete the campaigns first.",
        });
      }

      // Remove from Instantly (non-blocking)
      if (mailbox.instantlyAccountId) {
        try {
          const { removeAccount } = await import("@/lib/instantly");
          await removeAccount(mailbox.instantlyAccountId);
        } catch (error) {
          console.error(
            `[mailbox:removeMailbox] Failed to remove from Instantly for ${mailbox.email}:`,
            error
          );
        }
      }

      return prisma.mailboxAccount.delete({
        where: { id: input.id },
      });
    }),

  // ==================
  // DOMAIN HEALTH
  // ==================

  getDomainHealth: protectedProcedure.query(async ({ ctx }) => {
    return prisma.domainHealth.findMany({
      where: { userId: ctx.auth.user.id },
      orderBy: { domain: "asc" },
    });
  }),

  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const mailboxes = await prisma.mailboxAccount.findMany({
      where: { userId: ctx.auth.user.id },
      select: {
        id: true,
        status: true,
        healthScore: true,
        deliveryRate: true,
      },
    });

    const totalAccounts = mailboxes.length;
    const readyCount = mailboxes.filter((m) => m.status === "READY").length;
    const averageHealthScore =
      totalAccounts > 0
        ? Math.round(
            mailboxes.reduce((sum, m) => sum + m.healthScore, 0) /
              totalAccounts
          )
        : 0;
    const averageDeliveryRate =
      totalAccounts > 0
        ? mailboxes.reduce((sum, m) => sum + m.deliveryRate, 0) / totalAccounts
        : 0;

    return {
      totalAccounts,
      readyCount,
      averageHealthScore,
      averageDeliveryRate,
    };
  }),

  refreshDomainHealth: protectedProcedure
    .input(z.object({ domain: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the user owns mailboxes on this domain
      const mailboxOnDomain = await prisma.mailboxAccount.findFirst({
        where: {
          userId: ctx.auth.user.id,
          domain: input.domain,
        },
      });

      if (!mailboxOnDomain) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have any mailbox on this domain",
        });
      }

      // Run DNS + blacklist checks
      const { checkDomainHealth } = await import("@/lib/monitoring");
      const healthData = await checkDomainHealth(input.domain);

      // Upsert domain health record
      const domainHealth = await prisma.domainHealth.upsert({
        where: {
          userId_domain: {
            userId: ctx.auth.user.id,
            domain: input.domain,
          },
        },
        create: {
          userId: ctx.auth.user.id,
          domain: input.domain,
          ...healthData,
          lastCheckedAt: new Date(),
        },
        update: {
          ...healthData,
          lastCheckedAt: new Date(),
        },
      });

      return domainHealth;
    }),
});
