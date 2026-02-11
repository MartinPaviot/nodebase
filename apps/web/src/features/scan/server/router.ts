import prisma from "@/lib/db";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import z from "zod";
import { ScanCategory, Prisma } from "@prisma/client";
import {
  listEmails,
  listEvents,
} from "@/lib/integrations/google";
import { getSlackChannelHistory, listSlackChannels } from "@/lib/integrations/slack";

// ==========================================
// Types
// ==========================================

type ScanSignal = {
  id: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  connectorId: string;
  detectedAt: string;
};

type CategoryScanResult = {
  category: ScanCategory;
  signals: ScanSignal[];
  scannedAt: string;
};

// ==========================================
// Scan Rules
// ==========================================

function analyzeEmails(emails: Array<{ id: string; from: string; subject: string; date: string; snippet: string }>): ScanSignal[] {
  const signals: ScanSignal[] = [];
  const now = Date.now();

  for (const email of emails) {
    const emailDate = new Date(email.date).getTime();
    const hoursAgo = (now - emailDate) / (1000 * 60 * 60);

    // Detect unanswered emails older than 24 hours
    if (hoursAgo > 24 && hoursAgo < 72) {
      signals.push({
        id: `email_${email.id}`,
        type: "unanswered-email",
        severity: "medium",
        title: `Email from ${email.from} needs response`,
        description: `Subject: "${email.subject}" - ${Math.floor(hoursAgo)}h without response`,
        metadata: { emailId: email.id, from: email.from, subject: email.subject },
        connectorId: "gmail",
        detectedAt: new Date().toISOString(),
      });
    }

    // Detect urgent emails
    const urgentKeywords = ["urgent", "asap", "immediately", "critical", "deadline"];
    const isUrgent = urgentKeywords.some(
      (kw) =>
        email.subject.toLowerCase().includes(kw) ||
        email.snippet.toLowerCase().includes(kw)
    );
    if (isUrgent && hoursAgo < 48) {
      signals.push({
        id: `urgent_${email.id}`,
        type: "urgent-email",
        severity: "high",
        title: `Urgent email: ${email.subject}`,
        description: `From ${email.from} - marked as urgent`,
        metadata: { emailId: email.id, from: email.from, subject: email.subject },
        connectorId: "gmail",
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return signals;
}

function analyzeCalendarEvents(events: Array<{ id: string; summary: string; start: { dateTime?: string; date?: string }; attendees?: Array<{ email: string; responseStatus: string }> }>): ScanSignal[] {
  const signals: ScanSignal[] = [];
  const now = Date.now();

  for (const event of events) {
    const eventStart = event.start.dateTime || event.start.date;
    if (!eventStart) continue;

    const eventDate = new Date(eventStart).getTime();
    const hoursUntil = (eventDate - now) / (1000 * 60 * 60);

    // Detect meetings starting soon without preparation
    if (hoursUntil > 0 && hoursUntil < 2) {
      signals.push({
        id: `meeting_soon_${event.id}`,
        type: "meeting-soon",
        severity: "medium",
        title: `Meeting "${event.summary}" starting in ${Math.floor(hoursUntil * 60)} minutes`,
        description: "Upcoming meeting - ensure you're prepared",
        metadata: { eventId: event.id, summary: event.summary, start: eventStart },
        connectorId: "google_calendar",
        detectedAt: new Date().toISOString(),
      });
    }

    // Detect meetings with pending RSVPs
    const pendingAttendees = event.attendees?.filter(
      (a) => a.responseStatus === "needsAction"
    );
    if (pendingAttendees && pendingAttendees.length > 0 && hoursUntil > 0 && hoursUntil < 24) {
      signals.push({
        id: `rsvp_pending_${event.id}`,
        type: "pending-rsvp",
        severity: "low",
        title: `${pendingAttendees.length} pending RSVPs for "${event.summary}"`,
        description: `Meeting in ${Math.floor(hoursUntil)}h with unconfirmed attendees`,
        metadata: {
          eventId: event.id,
          summary: event.summary,
          pendingCount: pendingAttendees.length,
        },
        connectorId: "google_calendar",
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return signals;
}

function analyzeSlackMessages(messages: Array<{ ts: string; text: string; user?: string }>): ScanSignal[] {
  const signals: ScanSignal[] = [];
  const now = Date.now();

  for (const msg of messages) {
    const msgTime = parseFloat(msg.ts) * 1000;
    const hoursAgo = (now - msgTime) / (1000 * 60 * 60);

    // Detect mentions that might need response
    if (msg.text.includes("@") && hoursAgo < 24) {
      const mentionKeywords = ["help", "question", "issue", "problem", "urgent"];
      const needsAttention = mentionKeywords.some((kw) =>
        msg.text.toLowerCase().includes(kw)
      );

      if (needsAttention) {
        signals.push({
          id: `slack_${msg.ts}`,
          type: "slack-needs-attention",
          severity: "medium",
          title: "Slack message needs attention",
          description: msg.text.slice(0, 100) + (msg.text.length > 100 ? "..." : ""),
          metadata: { ts: msg.ts, user: msg.user },
          connectorId: "slack",
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return signals;
}

// ==========================================
// Router
// ==========================================

export const scanRouter = createTRPCRouter({
  // Get user's connected integrations
  getConnectedIntegrations: protectedProcedure.query(async ({ ctx }) => {
    const integrations = await prisma.integration.findMany({
      where: { userId: ctx.auth.user.id },
      select: { id: true, type: true, createdAt: true },
    });

    return integrations.map((i) => ({
      id: i.id,
      type: i.type,
      connected: true,
      connectedAt: i.createdAt,
    }));
  }),

  // Run a scan across connected integrations
  runScan: protectedProcedure
    .input(
      z.object({
        categories: z.array(z.nativeEnum(ScanCategory)).optional(),
      }).optional()
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.user.id;
      const results: CategoryScanResult[] = [];

      // Get connected integrations
      const integrations = await prisma.integration.findMany({
        where: { userId },
      });

      const hasGmail = integrations.some((i) => i.type === "GMAIL");
      const hasCalendar = integrations.some((i) => i.type === "GOOGLE_CALENDAR");
      const hasSlack = integrations.some((i) => i.type === "SLACK");

      // Scan Sales (emails, calendar)
      if (!input?.categories || input.categories.includes("SALES")) {
        const salesSignals: ScanSignal[] = [];

        if (hasGmail) {
          try {
            const gmailIntegration = integrations.find((i) => i.type === "GMAIL");
            if (gmailIntegration) {
              // TODO: Transform email format from Google API to expected format
              // const emails = await listEmails(userId, 20);
              // salesSignals.push(...analyzeEmails(emails));
            }
          } catch (error) {
            console.error("Failed to scan Gmail:", error);
          }
        }

        if (hasCalendar) {
          try {
            // TODO: Transform event format from Google API to expected format
            // const events = await listEvents(userId);
            // salesSignals.push(...analyzeCalendarEvents(events));
          } catch (error) {
            console.error("Failed to scan Calendar:", error);
          }
        }

        results.push({
          category: "SALES",
          signals: salesSignals,
          scannedAt: new Date().toISOString(),
        });
      }

      // Scan Support (emails, slack)
      if (!input?.categories || input.categories.includes("SUPPORT")) {
        const supportSignals: ScanSignal[] = [];

        if (hasSlack) {
          try {
            const slackIntegration = integrations.find((i) => i.type === "SLACK");
            if (slackIntegration) {
              // Get first channel and scan its history
              const channels = await listSlackChannels(userId);
              if (channels.length > 0) {
                const history = await getSlackChannelHistory(userId, channels[0].id, 20);
                supportSignals.push(...analyzeSlackMessages(history));
              }
            }
          } catch (error) {
            console.error("Failed to scan Slack:", error);
          }
        }

        // Also include urgent emails in support
        if (hasGmail) {
          try {
            // TODO: Transform email format from Google API to expected format
            // const emails = await listEmails(userId, 10, "is:unread");
            // const urgentEmails = analyzeEmails(emails).filter(
            //   (s) => s.type === "urgent-email"
            // );
            // supportSignals.push(...urgentEmails);
          } catch (error) {
            console.error("Failed to scan Gmail for support:", error);
          }
        }

        results.push({
          category: "SUPPORT",
          signals: supportSignals,
          scannedAt: new Date().toISOString(),
        });
      }

      // Scan HR (calendar for interviews)
      if (!input?.categories || input.categories.includes("HR")) {
        const hrSignals: ScanSignal[] = [];

        if (hasCalendar) {
          try {
            // TODO: Transform event format from Google API to expected format
            // const events = await listEvents(userId);
            // // Filter for interview-related events
            // const interviewEvents = events.filter(
            //   (e) =>
            //     e.summary?.toLowerCase().includes("interview") ||
            //     e.summary?.toLowerCase().includes("candidate")
            // );
            // hrSignals.push(...analyzeCalendarEvents(interviewEvents));
          } catch (error) {
            console.error("Failed to scan Calendar for HR:", error);
          }
        }

        results.push({
          category: "HR",
          signals: hrSignals,
          scannedAt: new Date().toISOString(),
        });
      }

      // Marketing, Finance, Projects - placeholder for now
      const emptyCategories: ScanCategory[] = ["MARKETING", "FINANCE", "PROJECTS"];
      for (const category of emptyCategories) {
        if (!input?.categories || input.categories.includes(category)) {
          results.push({
            category,
            signals: [],
            scannedAt: new Date().toISOString(),
          });
        }
      }

      // Save results to database
      for (const result of results) {
        await prisma.scanResult.create({
          data: {
            userId,
            category: result.category,
            signals: result.signals as unknown as Prisma.JsonArray,
            scannedAt: new Date(result.scannedAt),
          },
        });
      }

      return results;
    }),

  // Get latest scan results
  getLatestResults: protectedProcedure
    .input(
      z.object({
        categories: z.array(z.nativeEnum(ScanCategory)).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const categories = input?.categories || [
        "SALES",
        "SUPPORT",
        "MARKETING",
        "HR",
        "FINANCE",
        "PROJECTS",
      ];

      const results = await Promise.all(
        categories.map(async (category) => {
          const latest = await prisma.scanResult.findFirst({
            where: {
              userId: ctx.auth.user.id,
              category,
            },
            orderBy: { scannedAt: "desc" },
          });

          return {
            category,
            signals: (latest?.signals as ScanSignal[]) || [],
            scannedAt: latest?.scannedAt?.toISOString() || null,
          };
        })
      );

      return results;
    }),

  // Get scan history
  getScanHistory: protectedProcedure
    .input(
      z.object({
        category: z.nativeEnum(ScanCategory).optional(),
        limit: z.number().min(1).max(50).default(10),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: { userId: string; category?: ScanCategory } = {
        userId: ctx.auth.user.id,
      };

      if (input?.category) {
        where.category = input.category;
      }

      const results = await prisma.scanResult.findMany({
        where,
        orderBy: { scannedAt: "desc" },
        take: input?.limit ?? 10,
      });

      return results.map((r) => ({
        id: r.id,
        category: r.category,
        signals: r.signals as ScanSignal[],
        scannedAt: r.scannedAt.toISOString(),
      }));
    }),
});
