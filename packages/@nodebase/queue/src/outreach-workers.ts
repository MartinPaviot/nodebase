/**
 * Outreach BullMQ Worker implementations
 *
 * Four workers for the cold email outreach system:
 * 1. mailboxSyncWorker         - Sync Instantly stats, DNS checks, health score
 * 2. campaignSendWorker        - Generate & send cold emails via Claude + Gmail
 * 3. campaignCheckRepliesWorker - Detect replies and bounces via Gmail API
 * 4. campaignStatsWorker       - Aggregate daily stats and A/B test convergence
 *
 * All database operations use Prisma via dynamic import of `@/lib/db`.
 * Campaign helpers are imported from `@/lib/campaign`.
 * Monitoring helpers are imported from `@/lib/monitoring`.
 * Instantly client is imported from `@/lib/instantly/client`.
 */

import { Worker, Job } from 'bullmq';
import redisConnection from './client';

// Worker configuration — lower concurrency than core workers
// because outreach jobs are heavier (external API calls, LLM calls)
const outreachWorkerOptions = {
  connection: redisConnection,
  concurrency: 2,
  limiter: {
    max: 5,
    duration: 1000, // 5 jobs per second max
  },
};

// ============================================
// 1. MAILBOX SYNC WORKER
// ============================================

/**
 * Sync Instantly warmup stats, run DNS checks, recalculate health scores,
 * auto-pause critical mailboxes, and reset daily send counters.
 *
 * Schedule: every 6 hours (0 * /6 * * *)
 */
export const mailboxSyncWorker = new Worker(
  'mailbox:sync',
  async (job: Job) => {
    console.log('[mailbox:sync] Starting mailbox sync...');

    // Dynamic imports to avoid circular deps and keep the package light
    const prisma = (await import('@/lib/db')).default;
    const { getInstantlyClient } = await import('@/lib/instantly/client');
    const { checkDomainHealth } = await import('@/lib/monitoring/dns-checker');
    const { checkBlacklists } = await import('@/lib/monitoring/blacklist-checker');
    const { calculateHealthScore, shouldPauseMailbox } = await import(
      '@/lib/monitoring/health-score'
    );

    // 1. Get all active mailbox accounts (WARMING or READY)
    const mailboxes = await prisma.mailboxAccount.findMany({
      where: { status: { in: ['WARMING', 'READY'] } },
    });

    console.log(`[mailbox:sync] Found ${mailboxes.length} active mailboxes`);

    // 2. Collect unique domains for batch DNS/blacklist checks
    const domainSet = new Set<string>();
    for (const mb of mailboxes) {
      domainSet.add(mb.domain.toLowerCase());
    }

    // 3. Run DNS + blacklist checks per unique domain
    const domainResults = new Map<
      string,
      {
        dns: Awaited<ReturnType<typeof checkDomainHealth>>;
        blacklist: Awaited<ReturnType<typeof checkBlacklists>>;
      }
    >();

    for (const domain of domainSet) {
      try {
        const [dns, blacklist] = await Promise.all([
          checkDomainHealth(domain),
          checkBlacklists(domain),
        ]);
        domainResults.set(domain, { dns, blacklist });
      } catch (error) {
        console.error(`[mailbox:sync] DNS/blacklist check failed for ${domain}:`, error);
      }
    }

    // 4. Persist DomainHealth records
    for (const [domain, result] of domainResults) {
      // Find any user that owns a mailbox on this domain (for the userId FK)
      const representative = mailboxes.find(
        (mb) => mb.domain.toLowerCase() === domain
      );
      if (!representative) continue;

      try {
        await prisma.domainHealth.upsert({
          where: {
            userId_domain: {
              userId: representative.userId,
              domain,
            },
          },
          update: {
            spfStatus: result.dns.spfStatus,
            spfRecord: result.dns.spfRecord,
            dkimStatus: result.dns.dkimStatus,
            dkimRecord: result.dns.dkimRecord,
            dmarcStatus: result.dns.dmarcStatus,
            dmarcRecord: result.dns.dmarcRecord,
            dmarcPolicy: result.dns.dmarcPolicy,
            mxStatus: result.dns.mxStatus,
            mxRecords: result.dns.mxRecords,
            isBlacklisted: result.blacklist.isBlacklisted,
            blacklistedOn: result.blacklist.blacklistedOn,
            lastBlacklistCheck: new Date(),
            overallScore: result.dns.overallScore,
            lastCheckedAt: new Date(),
          },
          create: {
            userId: representative.userId,
            domain,
            spfStatus: result.dns.spfStatus,
            spfRecord: result.dns.spfRecord,
            dkimStatus: result.dns.dkimStatus,
            dkimRecord: result.dns.dkimRecord,
            dmarcStatus: result.dns.dmarcStatus,
            dmarcRecord: result.dns.dmarcRecord,
            dmarcPolicy: result.dns.dmarcPolicy,
            mxStatus: result.dns.mxStatus,
            mxRecords: result.dns.mxRecords,
            isBlacklisted: result.blacklist.isBlacklisted,
            blacklistedOn: result.blacklist.blacklistedOn,
            lastBlacklistCheck: new Date(),
            overallScore: result.dns.overallScore,
            lastCheckedAt: new Date(),
          },
        });
      } catch (error) {
        console.error(`[mailbox:sync] Failed to upsert DomainHealth for ${domain}:`, error);
      }
    }

    // 5. For each mailbox: sync Instantly warmup stats + recalculate health score
    let syncedCount = 0;
    let pausedCount = 0;

    for (const mb of mailboxes) {
      try {
        // Sync Instantly warmup stats (if account is linked)
        let warmupScore = mb.warmupScore;
        let deliveryRate = mb.deliveryRate;
        let spamRate = mb.spamRate;

        if (mb.instantlyAccountId) {
          try {
            const instantly = getInstantlyClient();
            const warmupStats = await instantly.getWarmupStats(mb.instantlyAccountId);
            warmupScore = warmupStats.warmup_score;

            // Fetch analytics for delivery/spam rates
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const analytics = await instantly.getAccountAnalytics(
              thirtyDaysAgo.toISOString().split('T')[0],
              new Date().toISOString().split('T')[0],
              mb.instantlyAccountId
            );
            deliveryRate = analytics.delivery_rate;
            // Approximate spam rate from bounces (Instantly doesn't expose spam rate directly)
            spamRate = analytics.bounce_rate;
          } catch (instantlyError) {
            console.error(
              `[mailbox:sync] Instantly sync failed for ${mb.email}:`,
              instantlyError
            );
          }
        }

        // Get domain results
        const domainKey = mb.domain.toLowerCase();
        const domainResult = domainResults.get(domainKey);
        const dnsScore = domainResult?.dns.overallScore ?? 0;
        const isBlacklisted = domainResult?.blacklist.isBlacklisted ?? false;

        // Calculate composite health score
        const health = calculateHealthScore({
          instantlyWarmupScore: warmupScore,
          deliveryRate,
          spamRate,
          dnsScore,
          blacklisted: isBlacklisted,
        });

        // Update MailboxAccount with new health data
        await prisma.mailboxAccount.update({
          where: { id: mb.id },
          data: {
            warmupScore,
            deliveryRate,
            spamRate,
            healthScore: health.score,
            coldEmailRatio: health.coldEmailRatio,
            // Reset daily send count (daily counter reset)
            dailySentCount: 0,
          },
        });

        syncedCount++;

        // Auto-pause mailboxes with critical health
        const bounceRate = deliveryRate > 0 ? 1 - deliveryRate : 0;
        const pauseCheck = shouldPauseMailbox({
          healthScore: health.score,
          spamRate,
          bounceRate,
          blacklisted: isBlacklisted,
          consecutiveErrors: mb.errorCount,
        });

        if (pauseCheck.shouldPause && mb.status !== 'PAUSED') {
          await prisma.mailboxAccount.update({
            where: { id: mb.id },
            data: {
              status: 'PAUSED',
              lastError: `Auto-paused: ${pauseCheck.reason}`,
              lastErrorAt: new Date(),
            },
          });
          pausedCount++;
          console.warn(
            `[mailbox:sync] Auto-paused ${mb.email}: ${pauseCheck.reason}`
          );
        }
      } catch (error) {
        console.error(`[mailbox:sync] Failed to sync mailbox ${mb.email}:`, error);
      }
    }

    console.log(
      `[mailbox:sync] Completed: ${syncedCount}/${mailboxes.length} synced, ${pausedCount} auto-paused`
    );

    return {
      totalMailboxes: mailboxes.length,
      synced: syncedCount,
      paused: pausedCount,
      domainsChecked: domainSet.size,
    };
  },
  outreachWorkerOptions
);

// ============================================
// 2. CAMPAIGN SEND WORKER
// ============================================

/**
 * Process active campaigns: select leads, generate emails via Claude,
 * and send via Gmail API with random delays between sends.
 *
 * Schedule: every 5 min during business hours (Mon-Fri 8-18)
 */
export const campaignSendWorker = new Worker(
  'campaign:send',
  async (job: Job) => {
    console.log('[campaign:send] Processing campaign sends...');

    const prisma = (await import('@/lib/db')).default;
    const {
      getNextLeadsToContact,
      selectMailbox,
      selectVariant,
      updateLeadAfterSend,
      incrementMailboxDailyCount,
      calculateNextSendAt,
    } = await import('@/lib/campaign');
    const { buildEmailPrompt } = await import('@/lib/campaign/agent-email-prompt');
    const { getStyleSamples } = await import('@/lib/campaign/style-learner');
    const { generateUnsubscribeUrl } = await import('@/lib/campaign/unsubscribe');
    const { ClaudeClient } = await import('@/lib/ai/claude-client');
    const { config } = await import('@/lib/config');

    // 1. Get all ACTIVE campaigns
    const campaigns = await prisma.campaign.findMany({
      where: { status: 'ACTIVE' },
      include: { agent: true },
    });

    console.log(`[campaign:send] Found ${campaigns.length} active campaigns`);

    let totalSent = 0;
    let totalErrors = 0;

    for (const campaign of campaigns) {
      try {
        // 2a. Get next leads to contact (batch of 10)
        const leads = await getNextLeadsToContact(campaign.id, 10);

        if (leads.length === 0) continue;

        console.log(
          `[campaign:send] Campaign "${campaign.name}": ${leads.length} leads to process`
        );

        const steps = campaign.steps as unknown as Array<{
          id: string;
          order: number;
          type: string;
          directive?: string;
          subjectHint?: string;
          toneHint?: string;
          maxWords?: number;
          variants?: Array<{ id: string; directive: string; subjectHint?: string; weight: number }>;
          stopOnReply: boolean;
        }>;
        const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

        for (const lead of leads) {
          try {
            // 2b. Select mailbox
            const mailbox = await selectMailbox(
              campaign.agent.userId,
              campaign.mailboxStrategy
            );

            if (!mailbox) {
              console.warn(
                `[campaign:send] No available mailbox for user ${campaign.agent.userId}`
              );
              break; // No mailboxes available — stop processing this campaign
            }

            // Find the current step for this lead
            const currentStep = sortedSteps.find(
              (s) => s.order === lead.currentStep && s.type === 'email'
            );
            if (!currentStep) {
              console.warn(
                `[campaign:send] No email step found at order ${lead.currentStep} for lead ${lead.id}`
              );
              continue;
            }

            // 2c. Select A/B variant
            const variant = selectVariant(currentStep as Parameters<typeof selectVariant>[0]);

            // 2d. Get style samples for few-shot learning
            const styleSamples = await getStyleSamples(campaign.agentId);

            // 2e. Build prompt for Claude
            const prompt = buildEmailPrompt({
              agentSystemPrompt: campaign.agent.systemPrompt ?? '',
              step: currentStep as Parameters<typeof buildEmailPrompt>[0]['step'],
              lead: {
                firstName: lead.firstName,
                lastName: lead.lastName,
                email: lead.email,
                company: lead.company,
                jobTitle: lead.jobTitle,
                linkedinUrl: lead.linkedinUrl,
                enrichmentData: lead.enrichmentData as Record<string, unknown> | null,
                customVariables: lead.customVariables as Record<string, unknown> | null,
              },
              styleSamples,
              variant: variant.variantId
                ? { directive: variant.directive, subjectHint: variant.subjectHint }
                : undefined,
            });

            // 2f. Call Claude (Haiku tier) to generate email
            const client = new ClaudeClient(config.llm.anthropicApiKey);
            const response = await client.chat({
              model: 'fast', // Haiku tier for cost efficiency
              messages: [{ role: 'user', content: prompt }],
              systemPrompt:
                'You are an expert cold email writer. Output ONLY valid JSON with "subject" and "body" fields. No markdown, no explanation.',
              maxSteps: 1,
              maxTokens: 512,
              temperature: 0.7,
              userId: campaign.agent.userId,
              agentId: campaign.agentId,
            });

            // 2g. Parse JSON response { subject, body }
            let subject: string;
            let body: string;

            try {
              const parsed = JSON.parse(response.content) as {
                subject: string;
                body: string;
              };
              subject = parsed.subject;
              body = parsed.body;

              if (!subject || !body) {
                throw new Error('Missing subject or body in LLM response');
              }
            } catch (parseError) {
              console.error(
                `[campaign:send] Failed to parse LLM response for lead ${lead.id}:`,
                parseError
              );
              continue;
            }

            // 2h. Create CampaignEmail record (status: QUEUED)
            const campaignEmail = await prisma.campaignEmail.create({
              data: {
                campaignId: campaign.id,
                leadId: lead.id,
                mailboxAccountId: mailbox.id,
                sequenceStep: lead.currentStep,
                variant: variant.variantId ?? null,
                subject,
                body,
                status: 'QUEUED',
              },
            });

            // 2i. Generate unsubscribe URL
            const unsubscribeUrl = generateUnsubscribeUrl(campaignEmail.id);

            // Update the email record with the unsubscribe URL
            await prisma.campaignEmail.update({
              where: { id: campaignEmail.id },
              data: { unsubscribeUrl },
            });

            // 2j. Send via Gmail API (send-cold-email connector action)
            try {
              // Dynamic import for Gmail send — this is implemented as a
              // connector action in the web app
              const { sendColdEmail } = await import('@/lib/integrations/google');

              const sendResult = await sendColdEmail({
                mailboxAccountId: mailbox.id,
                to: lead.email,
                subject,
                body,
                unsubscribeUrl,
              });

              // 2k. Update CampaignEmail to SENT
              await prisma.campaignEmail.update({
                where: { id: campaignEmail.id },
                data: {
                  status: 'SENT',
                  sentAt: new Date(),
                  gmailMessageId: sendResult.messageId ?? null,
                  gmailThreadId: sendResult.threadId ?? null,
                },
              });

              // 2l. Update lead after send
              const nextSendAt = calculateNextSendAt(campaign, lead.currentStep);
              await updateLeadAfterSend(
                lead.id,
                lead.currentStep,
                campaign.id,
                nextSendAt
              );

              // 2m. Increment mailbox daily count
              await incrementMailboxDailyCount(mailbox.id);

              totalSent++;
            } catch (sendError) {
              // Mark email as FAILED but continue with next lead
              await prisma.campaignEmail.update({
                where: { id: campaignEmail.id },
                data: { status: 'FAILED' },
              });

              // Increment mailbox error count
              await prisma.mailboxAccount.update({
                where: { id: mailbox.id },
                data: {
                  errorCount: { increment: 1 },
                  lastError:
                    sendError instanceof Error ? sendError.message : 'Unknown send error',
                  lastErrorAt: new Date(),
                },
              });

              totalErrors++;
              console.error(
                `[campaign:send] Failed to send email for lead ${lead.id}:`,
                sendError
              );
            }

            // 2n. Random delay 30s-120s between sends to mimic human behavior
            await new Promise((r) => setTimeout(r, 30000 + Math.random() * 90000));
          } catch (leadError) {
            totalErrors++;
            console.error(
              `[campaign:send] Error processing lead ${lead.id}:`,
              leadError
            );
            // Continue with next lead
          }
        }

        // 2o. Update campaign denormalized stats
        try {
          const stats = await prisma.campaignEmail.groupBy({
            by: ['campaignId'],
            where: { campaignId: campaign.id },
            _count: { id: true },
          });

          const leadsContacted = await prisma.lead.count({
            where: {
              campaignId: campaign.id,
              totalEmailsSent: { gt: 0 },
            },
          });

          const leadsReplied = await prisma.lead.count({
            where: { campaignId: campaign.id, status: 'REPLIED' },
          });

          const leadsPositive = await prisma.lead.count({
            where: { campaignId: campaign.id, status: 'POSITIVE' },
          });

          const leadsBounced = await prisma.lead.count({
            where: { campaignId: campaign.id, status: 'BOUNCED' },
          });

          await prisma.campaign.update({
            where: { id: campaign.id },
            data: {
              leadsContacted,
              leadsReplied,
              leadsPositive,
              leadsBounced,
            },
          });
        } catch (statsError) {
          console.error(
            `[campaign:send] Failed to update campaign stats for ${campaign.id}:`,
            statsError
          );
        }
      } catch (campaignError) {
        console.error(
          `[campaign:send] Error processing campaign ${campaign.id}:`,
          campaignError
        );
      }
    }

    console.log(
      `[campaign:send] Completed: ${totalSent} sent, ${totalErrors} errors`
    );

    return {
      campaignsProcessed: campaigns.length,
      totalSent,
      totalErrors,
    };
  },
  {
    ...outreachWorkerOptions,
    concurrency: 1, // Only 1 concurrent send job to control pacing
  }
);

// ============================================
// 3. CAMPAIGN CHECK REPLIES WORKER
// ============================================

/**
 * Detect replies and bounces by checking Gmail threads for sent campaign emails.
 *
 * Schedule: every 10 min 24/7
 */
export const campaignCheckRepliesWorker = new Worker(
  'campaign:check-replies',
  async (job: Job) => {
    console.log('[campaign:check-replies] Checking for replies and bounces...');

    const prisma = (await import('@/lib/db')).default;
    const { classifyReply } = await import('@/lib/campaign/reply-handler');

    // 1. Get all SENT campaign emails with a gmailThreadId
    const sentEmails = await prisma.campaignEmail.findMany({
      where: {
        status: 'SENT',
        gmailThreadId: { not: null },
        repliedAt: null,
        bouncedAt: null,
      },
      include: {
        lead: true,
        mailboxAccount: true,
        campaign: { include: { agent: true } },
      },
    });

    if (sentEmails.length === 0) {
      console.log('[campaign:check-replies] No sent emails to check');
      return { checked: 0, replies: 0, bounces: 0 };
    }

    console.log(`[campaign:check-replies] Checking ${sentEmails.length} sent emails`);

    // 2. Group by mailbox account for efficient Gmail API access
    const emailsByMailbox = new Map<
      string,
      typeof sentEmails
    >();

    for (const email of sentEmails) {
      const key = email.mailboxAccountId;
      const group = emailsByMailbox.get(key) ?? [];
      group.push(email);
      emailsByMailbox.set(key, group);
    }

    let totalReplies = 0;
    let totalBounces = 0;

    // 3. For each mailbox: check Gmail threads for replies
    for (const [mailboxId, emails] of emailsByMailbox) {
      try {
        const { getGmailThread } = await import('@/lib/integrations/google');

        for (const email of emails) {
          try {
            if (!email.gmailThreadId) continue;

            // 3a. Search for replies in the Gmail thread
            const thread = await getGmailThread({
              mailboxAccountId: mailboxId,
              threadId: email.gmailThreadId,
            });

            if (!thread || !thread.messages) continue;

            // Find messages in the thread that are NOT from the mailbox sender
            const mailboxEmail = email.mailboxAccount.email.toLowerCase();
            const replyMessages = thread.messages.filter(
              (msg: { from: string; body: string }) =>
                msg.from.toLowerCase() !== mailboxEmail
            );

            if (replyMessages.length > 0) {
              // We found a reply
              const latestReply = replyMessages[replyMessages.length - 1] as {
                from: string;
                body: string;
              };

              // 3b. Classify reply sentiment
              const sentiment = await classifyReply(latestReply.body, {
                userId: email.campaign.agent.userId,
                agentId: email.campaign.agentId,
              });

              // Determine lead status from sentiment
              let leadStatus: 'REPLIED' | 'POSITIVE' | 'NEGATIVE';
              switch (sentiment) {
                case 'POSITIVE':
                  leadStatus = 'POSITIVE';
                  break;
                case 'NEGATIVE':
                  leadStatus = 'NEGATIVE';
                  break;
                default:
                  leadStatus = 'REPLIED';
                  break;
              }

              // 3c. Update Lead
              await prisma.lead.update({
                where: { id: email.leadId },
                data: {
                  status: leadStatus,
                  repliedAt: new Date(),
                  replyContent: latestReply.body.slice(0, 5000), // Truncate to avoid oversized records
                  replySentiment: sentiment,
                  // Stop sequence: set nextSendAt to null
                  nextSendAt: null,
                },
              });

              // 3d. Update CampaignEmail
              await prisma.campaignEmail.update({
                where: { id: email.id },
                data: { repliedAt: new Date() },
              });

              totalReplies++;
              console.log(
                `[campaign:check-replies] Reply detected for lead ${email.leadId}: ${sentiment}`
              );
            }
          } catch (emailError) {
            console.error(
              `[campaign:check-replies] Error checking email ${email.id}:`,
              emailError
            );
          }
        }

        // 4. Search for bounces (from:mailer-daemon or delivery failures)
        try {
          const { searchGmailBounces } = await import('@/lib/integrations/google');

          const bounces = await searchGmailBounces({
            mailboxAccountId: mailboxId,
            since: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
          });

          for (const bounce of bounces) {
            // Find the matching campaign email by thread ID or recipient
            const matchingEmail = emails.find(
              (e) =>
                e.gmailThreadId === bounce.threadId ||
                e.lead.email.toLowerCase() === bounce.recipientEmail?.toLowerCase()
            );

            if (matchingEmail && !matchingEmail.bouncedAt) {
              // Update Lead: status=BOUNCED
              await prisma.lead.update({
                where: { id: matchingEmail.leadId },
                data: {
                  status: 'BOUNCED',
                  bouncedAt: new Date(),
                  bounceType: bounce.bounceType ?? 'hard',
                  // Stop sequence
                  nextSendAt: null,
                },
              });

              // Update CampaignEmail
              await prisma.campaignEmail.update({
                where: { id: matchingEmail.id },
                data: {
                  bouncedAt: new Date(),
                  bounceReason: bounce.reason ?? 'Delivery failure',
                },
              });

              totalBounces++;
              console.log(
                `[campaign:check-replies] Bounce detected for lead ${matchingEmail.leadId}`
              );
            }
          }
        } catch (bounceError) {
          console.error(
            `[campaign:check-replies] Error checking bounces for mailbox ${mailboxId}:`,
            bounceError
          );
        }
      } catch (mailboxError) {
        console.error(
          `[campaign:check-replies] Error processing mailbox ${mailboxId}:`,
          mailboxError
        );
      }
    }

    // 5. Update campaign denormalized stats for affected campaigns
    const affectedCampaignIds = new Set(sentEmails.map((e) => e.campaignId));

    for (const campaignId of affectedCampaignIds) {
      try {
        const leadsReplied = await prisma.lead.count({
          where: { campaignId, status: { in: ['REPLIED', 'POSITIVE'] } },
        });

        const leadsPositive = await prisma.lead.count({
          where: { campaignId, status: 'POSITIVE' },
        });

        const leadsBounced = await prisma.lead.count({
          where: { campaignId, status: 'BOUNCED' },
        });

        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            leadsReplied,
            leadsPositive,
            leadsBounced,
          },
        });
      } catch (statsError) {
        console.error(
          `[campaign:check-replies] Failed to update stats for campaign ${campaignId}:`,
          statsError
        );
      }
    }

    console.log(
      `[campaign:check-replies] Completed: ${totalReplies} replies, ${totalBounces} bounces`
    );

    return {
      checked: sentEmails.length,
      replies: totalReplies,
      bounces: totalBounces,
    };
  },
  outreachWorkerOptions
);

// ============================================
// 4. CAMPAIGN STATS WORKER
// ============================================

/**
 * Aggregate daily stats for all campaigns and check A/B test convergence.
 *
 * Schedule: daily at 1am
 */
export const campaignStatsWorker = new Worker(
  'campaign:stats',
  async (job: Job) => {
    console.log('[campaign:stats] Aggregating campaign stats...');

    const prisma = (await import('@/lib/db')).default;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Get all campaigns with email activity in last 24h
    const campaigns = await prisma.campaign.findMany({
      where: {
        emails: {
          some: {
            createdAt: { gte: yesterday },
          },
        },
      },
    });

    console.log(`[campaign:stats] ${campaigns.length} campaigns with recent activity`);

    let statsUpserted = 0;

    for (const campaign of campaigns) {
      try {
        // 2a. Aggregate CampaignEmails for the stats date
        const emailsSent = await prisma.campaignEmail.count({
          where: {
            campaignId: campaign.id,
            sentAt: { gte: yesterday, lt: today },
            status: { not: 'QUEUED' },
          },
        });

        const emailsDelivered = await prisma.campaignEmail.count({
          where: {
            campaignId: campaign.id,
            sentAt: { gte: yesterday, lt: today },
            status: { in: ['DELIVERED', 'OPENED', 'REPLIED'] },
          },
        });

        const emailsOpened = await prisma.campaignEmail.count({
          where: {
            campaignId: campaign.id,
            sentAt: { gte: yesterday, lt: today },
            openedAt: { not: null },
          },
        });

        const emailsReplied = await prisma.campaignEmail.count({
          where: {
            campaignId: campaign.id,
            sentAt: { gte: yesterday, lt: today },
            repliedAt: { not: null },
          },
        });

        const emailsBounced = await prisma.campaignEmail.count({
          where: {
            campaignId: campaign.id,
            sentAt: { gte: yesterday, lt: today },
            bouncedAt: { not: null },
          },
        });

        // Count positive and negative replies from leads
        const positiveReplies = await prisma.lead.count({
          where: {
            campaignId: campaign.id,
            repliedAt: { gte: yesterday, lt: today },
            replySentiment: 'POSITIVE',
          },
        });

        const negativeReplies = await prisma.lead.count({
          where: {
            campaignId: campaign.id,
            repliedAt: { gte: yesterday, lt: today },
            replySentiment: 'NEGATIVE',
          },
        });

        const unsubscribes = await prisma.lead.count({
          where: {
            campaignId: campaign.id,
            unsubscribedAt: { gte: yesterday, lt: today },
          },
        });

        // Calculate rates (avoid division by zero)
        const deliveryRate = emailsSent > 0 ? emailsDelivered / emailsSent : 0;
        const openRate = emailsDelivered > 0 ? emailsOpened / emailsDelivered : 0;
        const replyRate = emailsDelivered > 0 ? emailsReplied / emailsDelivered : 0;
        const bounceRate = emailsSent > 0 ? emailsBounced / emailsSent : 0;
        const positiveRate = emailsReplied > 0 ? positiveReplies / emailsReplied : 0;

        // 2b. Upsert CampaignDailyStats
        await prisma.campaignDailyStats.upsert({
          where: {
            campaignId_date: {
              campaignId: campaign.id,
              date: yesterday,
            },
          },
          update: {
            emailsSent,
            emailsDelivered,
            emailsOpened,
            emailsReplied,
            emailsBounced,
            positiveReplies,
            negativeReplies,
            unsubscribes,
            deliveryRate,
            openRate,
            replyRate,
            bounceRate,
            positiveRate,
          },
          create: {
            campaignId: campaign.id,
            date: yesterday,
            emailsSent,
            emailsDelivered,
            emailsOpened,
            emailsReplied,
            emailsBounced,
            positiveReplies,
            negativeReplies,
            unsubscribes,
            deliveryRate,
            openRate,
            replyRate,
            bounceRate,
            positiveRate,
          },
        });

        statsUpserted++;

        // 2c. Update campaign denormalized totals
        const totalLeads = await prisma.lead.count({
          where: { campaignId: campaign.id },
        });

        const leadsContacted = await prisma.lead.count({
          where: { campaignId: campaign.id, totalEmailsSent: { gt: 0 } },
        });

        const totalReplied = await prisma.lead.count({
          where: { campaignId: campaign.id, status: { in: ['REPLIED', 'POSITIVE'] } },
        });

        const totalPositive = await prisma.lead.count({
          where: { campaignId: campaign.id, status: 'POSITIVE' },
        });

        const totalBounced = await prisma.lead.count({
          where: { campaignId: campaign.id, status: 'BOUNCED' },
        });

        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            totalLeads,
            leadsContacted,
            leadsReplied: totalReplied,
            leadsPositive: totalPositive,
            leadsBounced: totalBounced,
          },
        });
      } catch (campaignError) {
        console.error(
          `[campaign:stats] Failed to aggregate stats for campaign ${campaign.id}:`,
          campaignError
        );
      }
    }

    // 3. A/B test convergence
    let testsConverged = 0;

    try {
      // 3a. Find campaigns with A/B testing enabled and sufficient data
      const abCampaigns = await prisma.campaign.findMany({
        where: {
          abTestEnabled: true,
          winningVariant: null, // No winner selected yet
        },
      });

      for (const campaign of abCampaigns) {
        try {
          // Count sends per variant
          const variantCounts = await prisma.campaignEmail.groupBy({
            by: ['variant'],
            where: {
              campaignId: campaign.id,
              status: { not: 'QUEUED' },
              variant: { not: null },
            },
            _count: { id: true },
          });

          // Need at least 100 sends per variant to declare a winner
          const hasEnoughData = variantCounts.every(
            (vc) => vc._count.id >= 100
          );

          if (!hasEnoughData || variantCounts.length < 2) continue;

          // 3b. Compare positive reply rates between variants
          const variantStats: Array<{
            variant: string;
            sent: number;
            positiveReplies: number;
            positiveRate: number;
          }> = [];

          for (const vc of variantCounts) {
            if (!vc.variant) continue;

            const positiveReplies = await prisma.campaignEmail.count({
              where: {
                campaignId: campaign.id,
                variant: vc.variant,
                repliedAt: { not: null },
                lead: { replySentiment: 'POSITIVE' },
              },
            });

            variantStats.push({
              variant: vc.variant,
              sent: vc._count.id,
              positiveReplies,
              positiveRate: vc._count.id > 0 ? positiveReplies / vc._count.id : 0,
            });
          }

          if (variantStats.length < 2) continue;

          // Sort by positive rate descending
          variantStats.sort((a, b) => b.positiveRate - a.positiveRate);
          const best = variantStats[0];
          const second = variantStats[1];

          // 3c. If significant difference (> 20% relative improvement), declare winner
          const relativeImprovement =
            second.positiveRate > 0
              ? (best.positiveRate - second.positiveRate) / second.positiveRate
              : best.positiveRate > 0
                ? 1
                : 0;

          if (relativeImprovement > 0.2) {
            await prisma.campaign.update({
              where: { id: campaign.id },
              data: { winningVariant: best.variant },
            });

            testsConverged++;
            console.log(
              `[campaign:stats] A/B test winner for campaign ${campaign.id}: variant "${best.variant}" (${(best.positiveRate * 100).toFixed(1)}% vs ${(second.positiveRate * 100).toFixed(1)}%)`
            );
          }
        } catch (abError) {
          console.error(
            `[campaign:stats] A/B test check failed for campaign ${campaign.id}:`,
            abError
          );
        }
      }
    } catch (abGlobalError) {
      console.error('[campaign:stats] A/B test convergence check failed:', abGlobalError);
    }

    console.log(
      `[campaign:stats] Completed: ${statsUpserted} campaigns updated, ${testsConverged} A/B tests converged`
    );

    return {
      campaignsProcessed: campaigns.length,
      statsUpserted,
      testsConverged,
    };
  },
  outreachWorkerOptions
);

// ============================================
// Error handlers
// ============================================

mailboxSyncWorker.on('failed', (job, err) => {
  console.error(`[mailbox:sync] Job ${job?.id} failed:`, err);
});

campaignSendWorker.on('failed', (job, err) => {
  console.error(`[campaign:send] Job ${job?.id} failed:`, err);
});

campaignCheckRepliesWorker.on('failed', (job, err) => {
  console.error(`[campaign:check-replies] Job ${job?.id} failed:`, err);
});

campaignStatsWorker.on('failed', (job, err) => {
  console.error(`[campaign:stats] Job ${job?.id} failed:`, err);
});

// ============================================
// Graceful shutdown
// ============================================

export async function closeOutreachWorkers(): Promise<void> {
  await Promise.all([
    mailboxSyncWorker.close(),
    campaignSendWorker.close(),
    campaignCheckRepliesWorker.close(),
    campaignStatsWorker.close(),
  ]);
}

// ============================================
// Export all outreach workers
// ============================================

export const outreachWorkers = {
  mailboxSync: mailboxSyncWorker,
  campaignSend: campaignSendWorker,
  campaignCheckReplies: campaignCheckRepliesWorker,
  campaignStats: campaignStatsWorker,
};
