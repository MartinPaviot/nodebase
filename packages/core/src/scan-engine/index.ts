/**
 * Scan Engine
 *
 * Detects signals across connected services:
 * - Dormant deals in CRM
 * - Tickets approaching SLA
 * - Unprocessed applications
 * - Overdue invoices
 */

import { nanoid } from "nanoid";
import {
  type ScanCategory,
  type ScanSignal,
  type ScanResult,
  type WorkspaceId,
  ScanError,
} from "@elevay/types";

// ============================================
// Types
// ============================================

export interface ScanConfig {
  category: ScanCategory;
  connectorIds: string[];
  rules: ScanRule[];
}

export interface ScanRule {
  id: string;
  name: string;
  description: string;
  connector: string;
  query: string;
  severity: ScanSignal["severity"];
  transform: (data: unknown) => ScanSignal[];
}

export interface ScanContext {
  workspaceId: WorkspaceId;
  credentials: Map<string, { accessToken: string }>;
}

export interface ScanEngineConfig {
  maxConcurrentScans?: number;
  timeoutMs?: number;
  retryAttempts?: number;
}

// ============================================
// Default Scan Rules
// ============================================

export const DEFAULT_SCAN_RULES: Record<ScanCategory, ScanRule[]> = {
  SALES: [
    {
      id: "dormant-deals",
      name: "Dormant Deals",
      description: "Deals with no activity in the last 7 days",
      connector: "hubspot",
      query: "deals.where(lastActivity < 7d AND stage != 'closed')",
      severity: "medium",
      transform: (data) => {
        const deals = data as Array<{ id: string; name: string; amount: number; daysSinceActivity: number }>;
        return deals.map((deal) => ({
          id: `signal_${nanoid(10)}`,
          type: "dormant-deal",
          severity: deal.daysSinceActivity > 14 ? "high" : "medium",
          title: `Deal "${deal.name}" is dormant`,
          description: `No activity for ${deal.daysSinceActivity} days. Value: $${deal.amount}`,
          metadata: { dealId: deal.id, amount: deal.amount, daysSinceActivity: deal.daysSinceActivity },
          connectorId: "hubspot",
          detectedAt: new Date(),
        }));
      },
    },
    {
      id: "stale-leads",
      name: "Stale Leads",
      description: "Leads not contacted in 48 hours",
      connector: "hubspot",
      query: "contacts.where(status = 'lead' AND lastContact > 48h)",
      severity: "high",
      transform: (data) => {
        const leads = data as Array<{ id: string; name: string; email: string; hoursSinceContact: number }>;
        return leads.map((lead) => ({
          id: `signal_${nanoid(10)}`,
          type: "stale-lead",
          severity: "high",
          title: `Lead "${lead.name}" needs follow-up`,
          description: `No contact for ${lead.hoursSinceContact} hours`,
          metadata: { leadId: lead.id, email: lead.email },
          connectorId: "hubspot",
          detectedAt: new Date(),
        }));
      },
    },
  ],
  SUPPORT: [
    {
      id: "sla-warning",
      name: "SLA Warning",
      description: "Tickets approaching SLA deadline",
      connector: "zendesk",
      query: "tickets.where(sla_remaining < 2h AND status != 'solved')",
      severity: "critical",
      transform: (data) => {
        const tickets = data as Array<{ id: string; subject: string; minutesRemaining: number }>;
        return tickets.map((ticket) => ({
          id: `signal_${nanoid(10)}`,
          type: "sla-warning",
          severity: ticket.minutesRemaining < 30 ? "critical" : "high",
          title: `Ticket #${ticket.id} approaching SLA`,
          description: `${ticket.minutesRemaining} minutes remaining. Subject: ${ticket.subject}`,
          metadata: { ticketId: ticket.id, minutesRemaining: ticket.minutesRemaining },
          connectorId: "zendesk",
          detectedAt: new Date(),
        }));
      },
    },
    {
      id: "unassigned-tickets",
      name: "Unassigned Tickets",
      description: "Tickets without an assignee",
      connector: "zendesk",
      query: "tickets.where(assignee = null AND status = 'new')",
      severity: "medium",
      transform: (data) => {
        const tickets = data as Array<{ id: string; subject: string; createdAt: string }>;
        return tickets.map((ticket) => ({
          id: `signal_${nanoid(10)}`,
          type: "unassigned-ticket",
          severity: "medium",
          title: `Unassigned ticket #${ticket.id}`,
          description: ticket.subject,
          metadata: { ticketId: ticket.id, createdAt: ticket.createdAt },
          connectorId: "zendesk",
          detectedAt: new Date(),
        }));
      },
    },
  ],
  MARKETING: [
    {
      id: "campaign-underperforming",
      name: "Underperforming Campaign",
      description: "Campaigns with below-average engagement",
      connector: "mailchimp",
      query: "campaigns.where(openRate < 15% AND sent > 1000)",
      severity: "medium",
      transform: (data) => {
        const campaigns = data as Array<{ id: string; name: string; openRate: number }>;
        return campaigns.map((campaign) => ({
          id: `signal_${nanoid(10)}`,
          type: "underperforming-campaign",
          severity: "medium",
          title: `Campaign "${campaign.name}" underperforming`,
          description: `Open rate: ${campaign.openRate}%`,
          metadata: { campaignId: campaign.id, openRate: campaign.openRate },
          connectorId: "mailchimp",
          detectedAt: new Date(),
        }));
      },
    },
  ],
  HR: [
    {
      id: "unreviewed-applications",
      name: "Unreviewed Applications",
      description: "Applications pending review for > 48 hours",
      connector: "greenhouse",
      query: "applications.where(status = 'new' AND createdAt < 48h)",
      severity: "high",
      transform: (data) => {
        const apps = data as Array<{ id: string; candidateName: string; jobTitle: string; hoursWaiting: number }>;
        return apps.map((app) => ({
          id: `signal_${nanoid(10)}`,
          type: "unreviewed-application",
          severity: app.hoursWaiting > 72 ? "critical" : "high",
          title: `Application from ${app.candidateName} needs review`,
          description: `Applied for: ${app.jobTitle}. Waiting: ${app.hoursWaiting}h`,
          metadata: { applicationId: app.id, jobTitle: app.jobTitle },
          connectorId: "greenhouse",
          detectedAt: new Date(),
        }));
      },
    },
  ],
  FINANCE: [
    {
      id: "overdue-invoices",
      name: "Overdue Invoices",
      description: "Invoices past due date",
      connector: "stripe",
      query: "invoices.where(status = 'open' AND dueDate < now())",
      severity: "high",
      transform: (data) => {
        const invoices = data as Array<{ id: string; customerName: string; amount: number; daysOverdue: number }>;
        return invoices.map((invoice) => ({
          id: `signal_${nanoid(10)}`,
          type: "overdue-invoice",
          severity: invoice.daysOverdue > 30 ? "critical" : "high",
          title: `Invoice for ${invoice.customerName} is overdue`,
          description: `Amount: $${invoice.amount}. Days overdue: ${invoice.daysOverdue}`,
          metadata: { invoiceId: invoice.id, amount: invoice.amount, daysOverdue: invoice.daysOverdue },
          connectorId: "stripe",
          detectedAt: new Date(),
        }));
      },
    },
  ],
  PROJECTS: [
    {
      id: "overdue-tasks",
      name: "Overdue Tasks",
      description: "Tasks past their due date",
      connector: "asana",
      query: "tasks.where(dueDate < now() AND completed = false)",
      severity: "medium",
      transform: (data) => {
        const tasks = data as Array<{ id: string; name: string; assignee: string; daysOverdue: number }>;
        return tasks.map((task) => ({
          id: `signal_${nanoid(10)}`,
          type: "overdue-task",
          severity: task.daysOverdue > 7 ? "high" : "medium",
          title: `Task "${task.name}" is overdue`,
          description: `Assigned to: ${task.assignee}. Days overdue: ${task.daysOverdue}`,
          metadata: { taskId: task.id, assignee: task.assignee },
          connectorId: "asana",
          detectedAt: new Date(),
        }));
      },
    },
  ],
};

// ============================================
// Scan Engine Class
// ============================================

export class ScanEngine {
  private config: Required<ScanEngineConfig>;
  private composioClient?: any; // ComposioClient from @elevay/connectors
  private connectorRegistry?: any; // ConnectorRegistry from @elevay/connectors

  constructor(
    config: ScanEngineConfig = {},
    dependencies?: {
      composioClient?: any;
      connectorRegistry?: any;
    }
  ) {
    this.config = {
      maxConcurrentScans: config.maxConcurrentScans ?? 5,
      timeoutMs: config.timeoutMs ?? 30000,
      retryAttempts: config.retryAttempts ?? 2,
    };
    this.composioClient = dependencies?.composioClient;
    this.connectorRegistry = dependencies?.connectorRegistry;
  }

  /**
   * Run a scan for a specific category.
   */
  async scan(
    category: ScanCategory,
    context: ScanContext,
    options?: { rules?: ScanRule[] }
  ): Promise<ScanResult> {
    const rules = options?.rules ?? DEFAULT_SCAN_RULES[category] ?? [];
    const signals: ScanSignal[] = [];

    for (const rule of rules) {
      try {
        const ruleSignals = await this.executeRule(rule, context);
        signals.push(...ruleSignals);
      } catch (error) {
        console.error(`Scan rule ${rule.id} failed:`, error);
        // Continue with other rules even if one fails
      }
    }

    return {
      id: `scan_${nanoid(10)}`,
      workspaceId: context.workspaceId,
      category,
      signals,
      scannedAt: new Date(),
    };
  }

  /**
   * Run scans for all categories.
   */
  async scanAll(context: ScanContext): Promise<ScanResult[]> {
    const categories: ScanCategory[] = [
      "SALES",
      "SUPPORT",
      "MARKETING",
      "HR",
      "FINANCE",
      "PROJECTS",
    ];

    const results = await Promise.all(
      categories.map((category) => this.scan(category, context))
    );

    return results;
  }

  /**
   * Get signals by severity across all results.
   */
  getSignalsBySeverity(
    results: ScanResult[],
    severity: ScanSignal["severity"]
  ): ScanSignal[] {
    return results.flatMap((r) => r.signals.filter((s) => s.severity === severity));
  }

  /**
   * Get critical signals (high + critical) across all results.
   */
  getCriticalSignals(results: ScanResult[]): ScanSignal[] {
    return results.flatMap((r) =>
      r.signals.filter((s) => s.severity === "high" || s.severity === "critical")
    );
  }

  /**
   * Execute a single scan rule.
   */
  private async executeRule(
    rule: ScanRule,
    context: ScanContext
  ): Promise<ScanSignal[]> {
    const credential = context.credentials.get(rule.connector);

    if (!credential) {
      // No credential for this connector, skip silently
      return [];
    }

    try {
      // 1. Parse the pseudo-query to get the action and filters
      const { action, filters } = this.parseQuery(rule.query, rule.connector);

      // 2. Execute via Composio if available
      let data: unknown;

      if (this.composioClient) {
        // Real Composio execution
        try {
          data = await this.composioClient.executeAction(context.workspaceId, {
            name: action,
            input: filters,
          });
        } catch (composioError) {
          console.error(`Composio execution failed for ${action}:`, composioError);
          // Fallback to mock data
          data = this.getMockDataForRule(rule.id);
        }
      } else {
        // Mock data when Composio not injected (testing/development)
        data = this.getMockDataForRule(rule.id);
      }

      // 3. Transform the results using the rule's transformer
      const signals = rule.transform(data);

      return signals;
    } catch (error) {
      throw new ScanError(
        rule.id,
        rule.connector,
        `Failed to execute scan rule: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Parse a pseudo-query into a Composio action and filters.
   * Example: "deals.where(lastActivity < 7d AND stage != 'closed')"
   * Returns: { action: "hubspot_search_deals", filters: { ... } }
   */
  private parseQuery(query: string, connector: string): { action: string; filters: Record<string, unknown> } {
    // Simplified query parsing - in production, use a proper query parser
    // For now, map known patterns to Composio actions

    // HubSpot deals
    if (query.includes("deals.where")) {
      return {
        action: `${connector}_search_deals`,
        filters: {
          // Extract filters from query
          // This is a simplified version
        },
      };
    }

    // HubSpot contacts/leads
    if (query.includes("contacts.where")) {
      return {
        action: `${connector}_search_contacts`,
        filters: {},
      };
    }

    // Zendesk tickets
    if (query.includes("tickets.where")) {
      return {
        action: `${connector}_search_tickets`,
        filters: {},
      };
    }

    // Default fallback
    return {
      action: `${connector}_search`,
      filters: {},
    };
  }

  /**
   * Get mock data for testing.
   * In production, this would be removed and actual Composio calls would be used.
   */
  private getMockDataForRule(ruleId: string): unknown {
    // Return empty array for now - in production, Composio would return real data
    return [];
  }
}

// ============================================
// Singleton Instance
// ============================================

let _scanEngine: ScanEngine | null = null;

export function initScanEngine(config?: ScanEngineConfig): ScanEngine {
  _scanEngine = new ScanEngine(config);
  return _scanEngine;
}

export function getScanEngine(): ScanEngine {
  if (!_scanEngine) {
    _scanEngine = new ScanEngine();
  }
  return _scanEngine;
}
