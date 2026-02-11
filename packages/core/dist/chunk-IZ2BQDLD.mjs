// src/scan-engine/index.ts
import { nanoid } from "nanoid";
import {
  ScanError
} from "@nodebase/types";
var DEFAULT_SCAN_RULES = {
  SALES: [
    {
      id: "dormant-deals",
      name: "Dormant Deals",
      description: "Deals with no activity in the last 7 days",
      connector: "hubspot",
      query: "deals.where(lastActivity < 7d AND stage != 'closed')",
      severity: "medium",
      transform: (data) => {
        const deals = data;
        return deals.map((deal) => ({
          id: `signal_${nanoid(10)}`,
          type: "dormant-deal",
          severity: deal.daysSinceActivity > 14 ? "high" : "medium",
          title: `Deal "${deal.name}" is dormant`,
          description: `No activity for ${deal.daysSinceActivity} days. Value: $${deal.amount}`,
          metadata: { dealId: deal.id, amount: deal.amount, daysSinceActivity: deal.daysSinceActivity },
          connectorId: "hubspot",
          detectedAt: /* @__PURE__ */ new Date()
        }));
      }
    },
    {
      id: "stale-leads",
      name: "Stale Leads",
      description: "Leads not contacted in 48 hours",
      connector: "hubspot",
      query: "contacts.where(status = 'lead' AND lastContact > 48h)",
      severity: "high",
      transform: (data) => {
        const leads = data;
        return leads.map((lead) => ({
          id: `signal_${nanoid(10)}`,
          type: "stale-lead",
          severity: "high",
          title: `Lead "${lead.name}" needs follow-up`,
          description: `No contact for ${lead.hoursSinceContact} hours`,
          metadata: { leadId: lead.id, email: lead.email },
          connectorId: "hubspot",
          detectedAt: /* @__PURE__ */ new Date()
        }));
      }
    }
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
        const tickets = data;
        return tickets.map((ticket) => ({
          id: `signal_${nanoid(10)}`,
          type: "sla-warning",
          severity: ticket.minutesRemaining < 30 ? "critical" : "high",
          title: `Ticket #${ticket.id} approaching SLA`,
          description: `${ticket.minutesRemaining} minutes remaining. Subject: ${ticket.subject}`,
          metadata: { ticketId: ticket.id, minutesRemaining: ticket.minutesRemaining },
          connectorId: "zendesk",
          detectedAt: /* @__PURE__ */ new Date()
        }));
      }
    },
    {
      id: "unassigned-tickets",
      name: "Unassigned Tickets",
      description: "Tickets without an assignee",
      connector: "zendesk",
      query: "tickets.where(assignee = null AND status = 'new')",
      severity: "medium",
      transform: (data) => {
        const tickets = data;
        return tickets.map((ticket) => ({
          id: `signal_${nanoid(10)}`,
          type: "unassigned-ticket",
          severity: "medium",
          title: `Unassigned ticket #${ticket.id}`,
          description: ticket.subject,
          metadata: { ticketId: ticket.id, createdAt: ticket.createdAt },
          connectorId: "zendesk",
          detectedAt: /* @__PURE__ */ new Date()
        }));
      }
    }
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
        const campaigns = data;
        return campaigns.map((campaign) => ({
          id: `signal_${nanoid(10)}`,
          type: "underperforming-campaign",
          severity: "medium",
          title: `Campaign "${campaign.name}" underperforming`,
          description: `Open rate: ${campaign.openRate}%`,
          metadata: { campaignId: campaign.id, openRate: campaign.openRate },
          connectorId: "mailchimp",
          detectedAt: /* @__PURE__ */ new Date()
        }));
      }
    }
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
        const apps = data;
        return apps.map((app) => ({
          id: `signal_${nanoid(10)}`,
          type: "unreviewed-application",
          severity: app.hoursWaiting > 72 ? "critical" : "high",
          title: `Application from ${app.candidateName} needs review`,
          description: `Applied for: ${app.jobTitle}. Waiting: ${app.hoursWaiting}h`,
          metadata: { applicationId: app.id, jobTitle: app.jobTitle },
          connectorId: "greenhouse",
          detectedAt: /* @__PURE__ */ new Date()
        }));
      }
    }
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
        const invoices = data;
        return invoices.map((invoice) => ({
          id: `signal_${nanoid(10)}`,
          type: "overdue-invoice",
          severity: invoice.daysOverdue > 30 ? "critical" : "high",
          title: `Invoice for ${invoice.customerName} is overdue`,
          description: `Amount: $${invoice.amount}. Days overdue: ${invoice.daysOverdue}`,
          metadata: { invoiceId: invoice.id, amount: invoice.amount, daysOverdue: invoice.daysOverdue },
          connectorId: "stripe",
          detectedAt: /* @__PURE__ */ new Date()
        }));
      }
    }
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
        const tasks = data;
        return tasks.map((task) => ({
          id: `signal_${nanoid(10)}`,
          type: "overdue-task",
          severity: task.daysOverdue > 7 ? "high" : "medium",
          title: `Task "${task.name}" is overdue`,
          description: `Assigned to: ${task.assignee}. Days overdue: ${task.daysOverdue}`,
          metadata: { taskId: task.id, assignee: task.assignee },
          connectorId: "asana",
          detectedAt: /* @__PURE__ */ new Date()
        }));
      }
    }
  ]
};
var ScanEngine = class {
  config;
  composioClient;
  // ComposioClient from @nodebase/connectors
  connectorRegistry;
  // ConnectorRegistry from @nodebase/connectors
  constructor(config = {}, dependencies) {
    this.config = {
      maxConcurrentScans: config.maxConcurrentScans ?? 5,
      timeoutMs: config.timeoutMs ?? 3e4,
      retryAttempts: config.retryAttempts ?? 2
    };
    this.composioClient = dependencies?.composioClient;
    this.connectorRegistry = dependencies?.connectorRegistry;
  }
  /**
   * Run a scan for a specific category.
   */
  async scan(category, context, options) {
    const rules = options?.rules ?? DEFAULT_SCAN_RULES[category] ?? [];
    const signals = [];
    for (const rule of rules) {
      try {
        const ruleSignals = await this.executeRule(rule, context);
        signals.push(...ruleSignals);
      } catch (error) {
        console.error(`Scan rule ${rule.id} failed:`, error);
      }
    }
    return {
      id: `scan_${nanoid(10)}`,
      workspaceId: context.workspaceId,
      category,
      signals,
      scannedAt: /* @__PURE__ */ new Date()
    };
  }
  /**
   * Run scans for all categories.
   */
  async scanAll(context) {
    const categories = [
      "SALES",
      "SUPPORT",
      "MARKETING",
      "HR",
      "FINANCE",
      "PROJECTS"
    ];
    const results = await Promise.all(
      categories.map((category) => this.scan(category, context))
    );
    return results;
  }
  /**
   * Get signals by severity across all results.
   */
  getSignalsBySeverity(results, severity) {
    return results.flatMap((r) => r.signals.filter((s) => s.severity === severity));
  }
  /**
   * Get critical signals (high + critical) across all results.
   */
  getCriticalSignals(results) {
    return results.flatMap(
      (r) => r.signals.filter((s) => s.severity === "high" || s.severity === "critical")
    );
  }
  /**
   * Execute a single scan rule.
   */
  async executeRule(rule, context) {
    const credential = context.credentials.get(rule.connector);
    if (!credential) {
      return [];
    }
    try {
      const { action, filters } = this.parseQuery(rule.query, rule.connector);
      let data;
      if (this.composioClient) {
        try {
          data = await this.composioClient.executeAction(context.workspaceId, {
            name: action,
            input: filters
          });
        } catch (composioError) {
          console.error(`Composio execution failed for ${action}:`, composioError);
          data = this.getMockDataForRule(rule.id);
        }
      } else {
        data = this.getMockDataForRule(rule.id);
      }
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
  parseQuery(query, connector) {
    if (query.includes("deals.where")) {
      return {
        action: `${connector}_search_deals`,
        filters: {
          // Extract filters from query
          // This is a simplified version
        }
      };
    }
    if (query.includes("contacts.where")) {
      return {
        action: `${connector}_search_contacts`,
        filters: {}
      };
    }
    if (query.includes("tickets.where")) {
      return {
        action: `${connector}_search_tickets`,
        filters: {}
      };
    }
    return {
      action: `${connector}_search`,
      filters: {}
    };
  }
  /**
   * Get mock data for testing.
   * In production, this would be removed and actual Composio calls would be used.
   */
  getMockDataForRule(ruleId) {
    return [];
  }
};
var _scanEngine = null;
function initScanEngine(config) {
  _scanEngine = new ScanEngine(config);
  return _scanEngine;
}
function getScanEngine() {
  if (!_scanEngine) {
    _scanEngine = new ScanEngine();
  }
  return _scanEngine;
}

export {
  DEFAULT_SCAN_RULES,
  ScanEngine,
  initScanEngine,
  getScanEngine
};
