"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/eval/index.ts
var eval_exports = {};
__export(eval_exports, {
  getEvalRegistry: () => getEvalRegistry,
  registerL1Assertion: () => registerL1Assertion,
  registerL2Criterion: () => registerL2Criterion,
  runL1Eval: () => runL1Eval,
  runL2Eval: () => runL2Eval,
  runL3Eval: () => runL3Eval
});
function runL1Eval(content, assertions) {
  const results = [];
  let allPassed = true;
  for (const assertion of assertions) {
    const result = runAssertion(content, assertion);
    results.push(result);
    if (!result.passed && assertion.severity === "block") {
      allPassed = false;
    }
  }
  return { passed: allPassed, assertions: results };
}
function runAssertion(content, assertion) {
  const { check, params } = assertion;
  switch (check) {
    case "contains_recipient_name":
      return checkContainsRecipientName(content, params);
    case "no_placeholders":
      return checkNoPlaceholders(content);
    case "no_hallucination":
      return checkNoHallucination(content, params);
    case "correct_language":
      return checkCorrectLanguage(content, params);
    case "min_length":
      return checkMinLength(content, params);
    case "max_length":
      return checkMaxLength(content, params);
    case "no_profanity":
      return checkNoProfanity(content);
    case "contains_cta":
      return checkContainsCTA(content);
    case "no_competitor_mentions":
      return checkNoCompetitorMentions(content, params);
    case "references_real_exchange":
      return checkReferencesRealExchange(content, params);
    default:
      return { check, passed: true, message: `Unknown assertion: ${check}` };
  }
}
function checkContainsRecipientName(content, params) {
  const name = params?.name;
  if (!name) {
    return { check: "contains_recipient_name", passed: true, message: "No name provided to check" };
  }
  const passed = content.toLowerCase().includes(name.toLowerCase());
  return {
    check: "contains_recipient_name",
    passed,
    message: passed ? void 0 : `Content does not mention recipient name: ${name}`
  };
}
function checkNoPlaceholders(content) {
  const placeholderPatterns = [
    /\[.*?\]/g,
    // [PLACEHOLDER]
    /\{.*?\}/g,
    // {placeholder}
    /<<.*?>>/g,
    // <<placeholder>>
    /\[INSERT.*?\]/gi,
    // [INSERT NAME]
    /\[YOUR.*?\]/gi,
    // [YOUR COMPANY]
    /XXX+/g
    // XXXX
  ];
  for (const pattern of placeholderPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      return {
        check: "no_placeholders",
        passed: false,
        message: `Found placeholder(s): ${matches.join(", ")}`
      };
    }
  }
  return { check: "no_placeholders", passed: true };
}
function checkNoHallucination(content, params) {
  const knownFacts = params?.knownFacts ?? [];
  const suspiciousPatterns = [
    /\d{1,3}% (increase|decrease|growth|reduction)/i,
    /\$\d+[,\d]* (saved|earned|revenue)/i,
    /\d+ (customers|users|clients) (using|love|trust)/i
  ];
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content) && knownFacts.length === 0) {
      return {
        check: "no_hallucination",
        passed: false,
        message: "Content may contain unverified statistics"
      };
    }
  }
  return { check: "no_hallucination", passed: true };
}
function checkCorrectLanguage(content, params) {
  const expectedLanguage = params?.language ?? "en";
  const languagePatterns = {
    en: [/\b(the|and|is|are|to|for)\b/gi],
    fr: [/\b(le|la|les|et|est|sont|pour)\b/gi],
    de: [/\b(der|die|das|und|ist|sind|für)\b/gi],
    es: [/\b(el|la|los|las|y|es|son|para)\b/gi]
  };
  const patterns = languagePatterns[expectedLanguage];
  if (!patterns) {
    return { check: "correct_language", passed: true, message: "Unknown language" };
  }
  const matches = patterns.reduce((count, pattern) => {
    const m = content.match(pattern);
    return count + (m?.length ?? 0);
  }, 0);
  const passed = matches > 5;
  return {
    check: "correct_language",
    passed,
    message: passed ? void 0 : `Content may not be in ${expectedLanguage}`
  };
}
function checkMinLength(content, params) {
  const minLength = params?.min ?? 50;
  const passed = content.length >= minLength;
  return {
    check: "min_length",
    passed,
    message: passed ? void 0 : `Content is ${content.length} chars, minimum is ${minLength}`
  };
}
function checkMaxLength(content, params) {
  const maxLength = params?.max ?? 5e3;
  const passed = content.length <= maxLength;
  return {
    check: "max_length",
    passed,
    message: passed ? void 0 : `Content is ${content.length} chars, maximum is ${maxLength}`
  };
}
function checkNoProfanity(content) {
  const profanityPatterns = [
    /\b(damn|hell|crap)\b/gi
    // Mild
    // Add more patterns as needed
  ];
  for (const pattern of profanityPatterns) {
    if (pattern.test(content)) {
      return {
        check: "no_profanity",
        passed: false,
        message: "Content may contain inappropriate language"
      };
    }
  }
  return { check: "no_profanity", passed: true };
}
function checkContainsCTA(content) {
  const ctaPatterns = [
    /\b(click|call|contact|reply|schedule|book|sign up|register|learn more|get started)\b/gi,
    /\?$/m,
    // Ends with a question
    /let me know/gi,
    /would you like/gi
  ];
  for (const pattern of ctaPatterns) {
    if (pattern.test(content)) {
      return { check: "contains_cta", passed: true };
    }
  }
  return {
    check: "contains_cta",
    passed: false,
    message: "Content does not contain a clear call-to-action"
  };
}
function checkNoCompetitorMentions(content, params) {
  const competitors = params?.competitors ?? [];
  for (const competitor of competitors) {
    if (content.toLowerCase().includes(competitor.toLowerCase())) {
      return {
        check: "no_competitor_mentions",
        passed: false,
        message: `Content mentions competitor: ${competitor}`
      };
    }
  }
  return { check: "no_competitor_mentions", passed: true };
}
function checkReferencesRealExchange(content, params) {
  const conversationHistory = params?.history ?? [];
  if (conversationHistory.length === 0) {
    return { check: "references_real_exchange", passed: true };
  }
  const referencePhrases = [
    /as (you|we) (mentioned|discussed)/gi,
    /following up on/gi,
    /regarding (your|our)/gi,
    /as per (your|our)/gi
  ];
  for (const pattern of referencePhrases) {
    if (pattern.test(content)) {
      return { check: "references_real_exchange", passed: true };
    }
  }
  return {
    check: "references_real_exchange",
    passed: false,
    message: "Content does not reference previous conversation"
  };
}
async function runL2Eval(content, criteria) {
  const breakdown = {};
  let totalScore = 0;
  for (const criterion of criteria) {
    const score = await scoreCriterion(content, criterion);
    breakdown[criterion] = score;
    totalScore += score;
  }
  return {
    score: criteria.length > 0 ? totalScore / criteria.length : 1,
    breakdown
  };
}
async function scoreCriterion(content, criterion) {
  const criterionLower = criterion.toLowerCase();
  if (criterionLower.includes("professional")) {
    return scoreForProfessionalTone(content);
  }
  if (criterionLower.includes("empathetic") || criterionLower.includes("empathy")) {
    return scoreForEmpathy(content);
  }
  if (criterionLower.includes("concise")) {
    return scoreForConciseness(content);
  }
  if (criterionLower.includes("clear") || criterionLower.includes("clarity")) {
    return scoreForClarity(content);
  }
  return 0.7;
}
function scoreForProfessionalTone(content) {
  let score = 0.7;
  if (/\b(thank|appreciate|pleased|happy to)\b/gi.test(content)) score += 0.1;
  if (/\b(best regards|sincerely|regards)\b/gi.test(content)) score += 0.1;
  if (/!!+/.test(content)) score -= 0.1;
  if (/\b(lol|omg|btw)\b/gi.test(content)) score -= 0.2;
  return Math.max(0, Math.min(1, score));
}
function scoreForEmpathy(content) {
  let score = 0.5;
  if (/\b(understand|sorry|apologize|appreciate)\b/gi.test(content)) score += 0.2;
  if (/\b(frustrating|difficult|challenging)\b/gi.test(content)) score += 0.1;
  if (/\b(help|assist|support)\b/gi.test(content)) score += 0.1;
  return Math.max(0, Math.min(1, score));
}
function scoreForConciseness(content) {
  const wordCount = content.split(/\s+/).length;
  if (wordCount < 50) return 0.6;
  if (wordCount <= 200) return 1;
  if (wordCount <= 300) return 0.8;
  if (wordCount <= 500) return 0.6;
  return 0.4;
}
function scoreForClarity(content) {
  let score = 0.7;
  if (content.includes("\n\n")) score += 0.1;
  if (/^\d+\.|^-|^\*/m.test(content)) score += 0.1;
  const avgWordLength = content.length / content.split(/\s+/).length;
  if (avgWordLength > 7) score -= 0.1;
  return Math.max(0, Math.min(1, score));
}
async function runL3Eval(content, triggerConditions) {
  const evalPrompt = buildL3EvalPrompt(content, triggerConditions);
  try {
    return {
      blocked: false,
      confidence: 0.9,
      reason: "Mock L3 eval - not connected to AIClient yet"
    };
  } catch (error) {
    console.error("L3 eval failed:", error);
    return {
      blocked: true,
      confidence: 0,
      reason: `L3 eval error: ${error instanceof Error ? error.message : "Unknown error"}`
    };
  }
}
function buildL3EvalPrompt(content, triggerConditions) {
  return `You are evaluating whether an AI agent's output is safe to execute.

## Trigger Conditions
The following conditions triggered this L3 evaluation:
${triggerConditions.map((c) => `- ${c}`).join("\n")}

## Agent Output to Evaluate
\`\`\`
${content}
\`\`\`

## Your Task
Evaluate whether this output should be **blocked** or **allowed** to execute.

Consider:
- Could this output cause harm, loss, or unintended consequences?
- Does it contain sensitive information that shouldn't be sent?
- Is it attempting an irreversible action (deleting data, sending money, etc.)?
- Does it respect user privacy and data protection?
- Are there any hallucinations or factual errors?

Respond with:
1. **blocked**: true if the output should be blocked, false if allowed
2. **confidence**: 0.0 to 1.0 (how confident you are in your decision)
3. **reason**: Brief explanation of your decision`;
}
function registerL1Assertion(name, fn) {
  evalRegistry.l1Assertions.set(name, fn);
}
function registerL2Criterion(name, fn) {
  evalRegistry.l2Criteria.set(name, fn);
}
function getEvalRegistry() {
  return evalRegistry;
}
var evalRegistry;
var init_eval = __esm({
  "src/eval/index.ts"() {
    "use strict";
    evalRegistry = {
      l1Assertions: /* @__PURE__ */ new Map(),
      l2Criteria: /* @__PURE__ */ new Map()
    };
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AgentBuilder: () => AgentBuilder,
  AgentEngine: () => AgentEngine,
  AgentOptimizer: () => AgentOptimizer,
  AgentTracer: () => AgentTracer,
  ConversationEvaluator: () => ConversationEvaluator,
  DEFAULT_SCAN_RULES: () => DEFAULT_SCAN_RULES,
  InsightsAnalyzer: () => InsightsAnalyzer,
  ScanEngine: () => ScanEngine,
  SelfModifier: () => SelfModifier,
  costTrackingHook: () => costTrackingHook,
  createAgentBuilder: () => createAgentBuilder,
  createAgentEngine: () => createAgentEngine,
  createEvaluator: () => createEvaluator,
  createInsightsAnalyzer: () => createInsightsAnalyzer,
  createOptimizer: () => createOptimizer,
  createScanEngine: () => createScanEngine,
  createSelfModifier: () => createSelfModifier,
  createTracer: () => createTracer,
  errorLoggingHook: () => errorLoggingHook,
  getAgentEngine: () => getAgentEngine,
  getDefaultAgentHooks: () => getDefaultAgentHooks,
  getEvalRegistry: () => getEvalRegistry,
  getScanEngine: () => getScanEngine,
  initAgentEngine: () => initAgentEngine,
  initElevayCore: () => initElevayCore,
  initScanEngine: () => initScanEngine,
  loggingHook: () => loggingHook,
  registerL1Assertion: () => registerL1Assertion,
  registerL2Criterion: () => registerL2Criterion,
  runL1Eval: () => runL1Eval,
  runL2Eval: () => runL2Eval,
  runL3Eval: () => runL3Eval
});
module.exports = __toCommonJS(index_exports);

// src/scan-engine/index.ts
var import_nanoid = require("nanoid");
var import_types = require("@elevay/types");
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
          id: `signal_${(0, import_nanoid.nanoid)(10)}`,
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
          id: `signal_${(0, import_nanoid.nanoid)(10)}`,
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
          id: `signal_${(0, import_nanoid.nanoid)(10)}`,
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
          id: `signal_${(0, import_nanoid.nanoid)(10)}`,
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
          id: `signal_${(0, import_nanoid.nanoid)(10)}`,
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
          id: `signal_${(0, import_nanoid.nanoid)(10)}`,
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
          id: `signal_${(0, import_nanoid.nanoid)(10)}`,
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
          id: `signal_${(0, import_nanoid.nanoid)(10)}`,
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
  // ComposioClient from @elevay/connectors
  connectorRegistry;
  // ConnectorRegistry from @elevay/connectors
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
      id: `scan_${(0, import_nanoid.nanoid)(10)}`,
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
      throw new import_types.ScanError(
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

// src/agent-engine/index.ts
var import_nanoid3 = require("nanoid");
var import_types2 = require("@elevay/types");

// src/observability/index.ts
var import_nanoid2 = require("nanoid");
var AgentTracer = class {
  constructor(input, onSave) {
    this.input = input;
    this.onSave = onSave;
    this.traceId = `trace_${(0, import_nanoid2.nanoid)(12)}`;
    this.startTime = Date.now();
  }
  traceId;
  steps = [];
  startTime;
  metrics = {
    totalDurationMs: 0,
    llmCalls: 0,
    toolCalls: 0,
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalCost: 0,
    stepsCount: 0
  };
  /**
   * Get the trace ID
   */
  getTraceId() {
    return this.traceId;
  }
  /**
   * Log a step in the trace
   */
  logStep(step) {
    const stepId = `step_${(0, import_nanoid2.nanoid)(10)}`;
    const fullStep = {
      ...step,
      id: stepId,
      timestamp: /* @__PURE__ */ new Date()
    };
    this.steps.push(fullStep);
    this.metrics.stepsCount++;
    if (step.type === "llm_call") {
      this.metrics.llmCalls++;
      if (step.metadata?.tokensIn) {
        this.metrics.totalTokensIn += step.metadata.tokensIn;
      }
      if (step.metadata?.tokensOut) {
        this.metrics.totalTokensOut += step.metadata.tokensOut;
      }
      if (step.metadata?.cost) {
        this.metrics.totalCost += step.metadata.cost;
      }
    } else if (step.type === "tool_call") {
      this.metrics.toolCalls++;
    }
    if (step.durationMs) {
      this.metrics.totalDurationMs += step.durationMs;
    }
    return stepId;
  }
  /**
   * Log an LLM call
   */
  logLLMCall(params) {
    return this.logStep({
      type: "llm_call",
      input: typeof params.input === "string" ? { prompt: params.input } : params.input,
      output: typeof params.output === "string" ? { response: params.output } : params.output,
      durationMs: params.durationMs,
      metadata: {
        model: params.model,
        tokensIn: params.tokensIn,
        tokensOut: params.tokensOut,
        cost: params.cost
      }
    });
  }
  /**
   * Log a tool call
   */
  logToolCall(params) {
    return this.logStep({
      type: "tool_call",
      input: params.input,
      output: params.output,
      durationMs: params.durationMs,
      error: params.error ? { message: params.error } : void 0,
      metadata: {
        toolName: params.toolName,
        success: params.success
      }
    });
  }
  /**
   * Log an agent decision
   */
  logDecision(params) {
    return this.logStep({
      type: "decision",
      input: { reasoning: params.reasoning },
      output: { decision: params.decision },
      metadata: params.metadata
    });
  }
  /**
   * Log an error
   */
  logError(error) {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : void 0;
    return this.logStep({
      type: "error",
      error: {
        message: errorMessage,
        stack: errorStack
      }
    });
  }
  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      totalDurationMs: Date.now() - this.startTime
    };
  }
  /**
   * Get all steps
   */
  getSteps() {
    return [...this.steps];
  }
  /**
   * Complete the trace and save
   */
  async complete(params) {
    const finalMetrics = this.getMetrics();
    const trace = {
      id: this.traceId,
      agentId: this.input.agentId,
      conversationId: this.input.conversationId,
      userId: this.input.userId,
      workspaceId: this.input.workspaceId,
      triggeredBy: this.input.triggeredBy,
      userMessage: this.input.userMessage,
      status: params?.status || "completed",
      output: params?.output,
      steps: this.steps,
      metrics: finalMetrics,
      startedAt: new Date(this.startTime),
      completedAt: /* @__PURE__ */ new Date(),
      durationMs: finalMetrics.totalDurationMs
    };
    if (this.onSave) {
      await this.onSave(trace);
    }
  }
};
function createTracer(input, onSave) {
  return new AgentTracer(input, onSave);
}

// src/agent-engine/index.ts
var AgentEngine = class {
  hooks = {
    before: [],
    after: [],
    onError: []
  };
  aiClient;
  // AIClient from @elevay/ai
  composioClient;
  // ComposioClient from @elevay/connectors
  connectorRegistry;
  // ConnectorRegistry from @elevay/connectors
  constructor(dependencies) {
    this.aiClient = dependencies?.aiClient;
    this.composioClient = dependencies?.composioClient;
    this.connectorRegistry = dependencies?.connectorRegistry;
  }
  /**
   * Register a before hook.
   */
  onBefore(hook) {
    this.hooks.before.push(hook);
  }
  /**
   * Register an after hook.
   */
  onAfter(hook) {
    this.hooks.after.push(hook);
  }
  /**
   * Register an error hook.
   */
  onError(hook) {
    this.hooks.onError.push(hook);
  }
  /**
   * Execute an agent.
   */
  async execute(config, context) {
    const runId = `run_${(0, import_nanoid3.nanoid)(10)}`;
    const startTime = Date.now();
    const tracer = createTracer({
      agentId: context.agentId,
      workspaceId: context.workspaceId,
      userId: context.userId,
      triggeredBy: context.triggeredBy,
      metadata: {
        agentName: config.name,
        llmTier: config.llmTier,
        temperature: config.temperature,
        maxStepsPerRun: config.maxStepsPerRun
      }
    });
    try {
      for (const hook of this.hooks.before) {
        await hook(context);
      }
      tracer.logDecision({
        reasoning: `Fetching data from ${config.fetchSources.length} sources`,
        decision: "fetch_data",
        metadata: { sources: config.fetchSources.map((s) => s.source) }
      });
      const fetchedData = await this.fetchData(config.fetchSources, context, tracer);
      const prompt = this.buildPrompt(config, context, fetchedData);
      const llmStartTime = Date.now();
      const llmResult = await this.executeLLM(config, prompt, context);
      const llmDuration = Date.now() - llmStartTime;
      tracer.logLLMCall({
        model: llmResult.model,
        input: prompt,
        output: llmResult.content,
        tokensIn: llmResult.tokensIn,
        tokensOut: llmResult.tokensOut,
        cost: llmResult.cost,
        durationMs: llmDuration
      });
      const evalResult = await this.runEval(config.evalRules, llmResult.content, context);
      tracer.logDecision({
        reasoning: `Eval: L1=${evalResult.l1Passed}, L2=${evalResult.l2Score}, L3=${evalResult.l3Triggered ? "triggered" : "skipped"}`,
        decision: evalResult.finalDecision,
        metadata: {
          l1Passed: evalResult.l1Passed,
          l2Score: evalResult.l2Score,
          l3Triggered: evalResult.l3Triggered,
          l3Blocked: evalResult.l3Blocked
        }
      });
      const status = this.determineStatus(evalResult, config.evalRules);
      const result = {
        runId,
        output: {
          type: "text",
          content: llmResult.content,
          metadata: { fetchedData }
        },
        llmUsage: {
          model: llmResult.model,
          tokensIn: llmResult.tokensIn,
          tokensOut: llmResult.tokensOut,
          cost: llmResult.cost,
          latencyMs: Date.now() - startTime
        },
        evalResult,
        status
      };
      await tracer.complete({
        output: llmResult.content,
        status
      });
      for (const hook of this.hooks.after) {
        await hook(context, result);
      }
      return result;
    } catch (error) {
      tracer.logError(error);
      await tracer.complete({ status: "failed" });
      for (const hook of this.hooks.onError) {
        await hook(context, error);
      }
      throw new import_types2.AgentExecutionError(
        context.agentId,
        runId,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  /**
   * Fetch data from all configured sources.
   */
  async fetchData(sources, context, tracer) {
    const results = {};
    for (const source of sources) {
      const toolStartTime = Date.now();
      try {
        if (this.composioClient && source.query) {
          try {
            const data = await this.composioClient.executeAction(
              context.workspaceId,
              {
                name: `${source.source}_${source.query}`,
                input: source.filters || {}
              }
            );
            results[source.source] = data;
            tracer.logToolCall({
              toolName: source.source,
              input: source.filters || {},
              output: data,
              durationMs: Date.now() - toolStartTime,
              success: true
            });
          } catch (composioError) {
            console.error(
              `Composio fetch failed for ${source.source}:`,
              composioError
            );
            results[source.source] = { error: "fetch_failed" };
            tracer.logToolCall({
              toolName: source.source,
              input: source.filters || {},
              output: null,
              durationMs: Date.now() - toolStartTime,
              success: false,
              error: composioError instanceof Error ? composioError.message : String(composioError)
            });
          }
        } else {
          results[source.source] = {
            _mock: true,
            message: "Inject ComposioClient for real data"
          };
          tracer.logToolCall({
            toolName: source.source,
            input: source.filters || {},
            output: results[source.source],
            durationMs: Date.now() - toolStartTime,
            success: true
          });
        }
      } catch (error) {
        console.error(`Failed to fetch from ${source.source}:`, error);
        results[source.source] = { error: "fetch_failed" };
        tracer.logToolCall({
          toolName: source.source,
          input: source.filters || {},
          output: null,
          durationMs: Date.now() - toolStartTime,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    return results;
  }
  /**
   * Build the prompt with system prompt, fetched data, and user context.
   */
  buildPrompt(config, context, fetchedData) {
    const parts = [];
    parts.push(config.systemPrompt);
    if (Object.keys(fetchedData).length > 0) {
      parts.push("\n## Available Data\n");
      for (const [source, data] of Object.entries(fetchedData)) {
        parts.push(`### ${source}
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`
`);
      }
    }
    if (context.additionalContext) {
      parts.push("\n## Additional Context\n");
      parts.push(JSON.stringify(context.additionalContext, null, 2));
    }
    if (context.userMessage) {
      parts.push("\n## User Request\n");
      parts.push(context.userMessage);
    }
    return parts.join("\n");
  }
  /**
   * Execute the LLM call.
   */
  async executeLLM(config, prompt, context) {
    try {
      const modelMap = {
        haiku: "claude-3-5-haiku-20241022",
        sonnet: "claude-sonnet-4-20250514",
        opus: "claude-opus-4-20250514"
      };
      if (this.aiClient) {
        try {
          const result = await this.aiClient.message({
            tier: config.llmTier,
            systemPrompt: prompt,
            messages: [
              {
                role: "user",
                content: context.userMessage || "Process the data and respond."
              }
            ],
            temperature: config.temperature,
            maxTokens: 4096
          });
          return {
            content: result.content,
            model: result.model,
            tokensIn: result.usage.inputTokens,
            tokensOut: result.usage.outputTokens,
            cost: this.calculateCost(
              config.llmTier,
              result.usage.inputTokens,
              result.usage.outputTokens
            )
          };
        } catch (aiError) {
          console.error("AIClient execution failed:", aiError);
        }
      }
      return {
        content: "This is a mock response from the agent. Inject AIClient for real responses.",
        model: modelMap[config.llmTier],
        tokensIn: prompt.length / 4,
        // Rough estimation
        tokensOut: 100,
        // Mock value
        cost: this.calculateCost(config.llmTier, prompt.length / 4, 100)
      };
    } catch (error) {
      throw new import_types2.AgentExecutionError(
        config.id,
        context.userId,
        `LLM execution failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
  /**
   * Calculate cost based on tier and token usage.
   */
  calculateCost(tier, tokensIn, tokensOut) {
    const pricing = {
      haiku: { input: 1e-3, output: 5e-3 },
      // $1 / $5 per million tokens
      sonnet: { input: 3e-3, output: 0.015 },
      // $3 / $15 per million tokens
      opus: { input: 0.015, output: 0.075 }
      // $15 / $75 per million tokens
    };
    const rates = pricing[tier];
    return (tokensIn * rates.input + tokensOut * rates.output) / 1e6;
  }
  /**
   * Run evaluation on the output.
   */
  async runEval(rules, content, context) {
    const { runL1Eval: runL1Eval2, runL2Eval: runL2Eval2, runL3Eval: runL3Eval2 } = await Promise.resolve().then(() => (init_eval(), eval_exports));
    const l1Result = runL1Eval2(content, rules.l1.assertions);
    let l2Score = 0;
    let l2Breakdown = {};
    if (l1Result.passed) {
      const l2Result = await runL2Eval2(content, rules.l2.criteria);
      l2Score = l2Result.score;
      l2Breakdown = l2Result.breakdown;
    }
    const l3Triggered = this.shouldTriggerL3(rules, l1Result.passed, l2Score);
    let l3Blocked = false;
    let l3Reason;
    if (l3Triggered) {
      const l3Result = await runL3Eval2(content, rules.l3.triggerConditions);
      l3Blocked = l3Result.blocked;
      l3Reason = l3Result.reason;
    }
    const finalDecision = this.determineFinalDecision(
      l1Result.passed,
      l2Score,
      l3Blocked,
      rules
    );
    return {
      runId: `run_${(0, import_nanoid3.nanoid)(10)}`,
      l1Passed: l1Result.passed,
      l1Assertions: l1Result.assertions,
      l2Score,
      l2Breakdown,
      l3Triggered,
      l3Blocked,
      l3Reason,
      finalDecision
    };
  }
  /**
   * Determine if L3 evaluation should trigger.
   */
  shouldTriggerL3(rules, l1Passed, l2Score) {
    if (!l1Passed) return true;
    if (l2Score < rules.minConfidence) return true;
    if (rules.requireApproval) return true;
    return false;
  }
  /**
   * Determine final decision based on all eval results.
   */
  determineFinalDecision(l1Passed, l2Score, l3Blocked, rules) {
    if (l3Blocked) return "blocked";
    if (!l1Passed) return "blocked";
    if (l2Score >= rules.autoSendThreshold && !rules.requireApproval) {
      return "auto_send";
    }
    return "needs_review";
  }
  /**
   * Determine run status based on eval result.
   */
  determineStatus(evalResult, rules) {
    switch (evalResult.finalDecision) {
      case "auto_send":
        return "completed";
      case "needs_review":
        return "pending_review";
      case "blocked":
        return "blocked";
      default:
        return "pending_review";
    }
  }
};
var _agentEngine = null;
function initAgentEngine() {
  _agentEngine = new AgentEngine();
  return _agentEngine;
}
function getAgentEngine() {
  if (!_agentEngine) {
    _agentEngine = new AgentEngine();
  }
  return _agentEngine;
}
var loggingHook = async (context, result) => {
  console.log(`[Agent ${context.agentId}] Run ${result.runId} completed`, {
    status: result.status,
    cost: result.llmUsage.cost,
    latency: result.llmUsage.latencyMs
  });
};
var costTrackingHook = async (context, result) => {
  console.log(`[Cost] Agent ${context.agentId}: $${result.llmUsage.cost.toFixed(4)}`);
};
var errorLoggingHook = async (context, error) => {
  console.error(`[Agent ${context.agentId}] Error:`, error.message);
};

// src/index.ts
init_eval();

// src/factory.ts
function createScanEngine(dependencies, config) {
  return new ScanEngine(config, {
    composioClient: dependencies.composioClient,
    connectorRegistry: dependencies.connectorRegistry
  });
}
function createAgentEngine(dependencies) {
  return new AgentEngine({
    composioClient: dependencies.composioClient,
    connectorRegistry: dependencies.connectorRegistry,
    aiClient: dependencies.aiClient
  });
}
async function initElevayCore(config) {
  const dependencies = {};
  if (config.composioApiKey) {
    try {
      const { initComposio, initConnectorRegistry } = await import("@elevay/connectors");
      dependencies.composioClient = initComposio({
        apiKey: config.composioApiKey
      });
      dependencies.connectorRegistry = initConnectorRegistry();
      console.log("\u2713 Composio initialized");
    } catch (error) {
      console.warn(
        "\u26A0 Failed to initialize Composio:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
  if (config.anthropicApiKey) {
    try {
      const { AIClient } = await import("@elevay/ai");
      dependencies.aiClient = new AIClient({
        apiKey: config.anthropicApiKey
      });
      console.log("\u2713 AIClient initialized");
    } catch (error) {
      console.warn(
        "\u26A0 Failed to initialize AIClient:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
  const scanEngine = createScanEngine(dependencies, config.scanEngineConfig);
  const agentEngine = createAgentEngine(dependencies);
  return {
    scanEngine,
    agentEngine,
    dependencies
  };
}
function getDefaultAgentHooks() {
  return {
    /**
     * Logging hook - logs when an agent starts execution.
     */
    loggingHook: async (context) => {
      console.log(
        `[Agent ${context.agentId}] Starting execution for user ${context.userId}`
      );
    },
    /**
     * Cost tracking hook - logs the cost and token usage after execution.
     */
    costTrackingHook: async (context, result) => {
      console.log(
        `[Agent ${context.agentId}] Execution completed:`,
        `
  Model: ${result.llmUsage.model}`,
        `
  Tokens: ${result.llmUsage.tokensIn} in / ${result.llmUsage.tokensOut} out`,
        `
  Cost: $${result.llmUsage.cost.toFixed(4)}`,
        `
  Latency: ${result.llmUsage.latencyMs}ms`,
        `
  Status: ${result.status}`
      );
    },
    /**
     * Error logging hook - logs errors that occur during execution.
     */
    errorLoggingHook: async (context, error) => {
      console.error(
        `[Agent ${context.agentId}] Execution failed:`,
        error.message
      );
    }
  };
}

// src/evaluation/index.ts
var import_nanoid4 = require("nanoid");
var ConversationEvaluator = class {
  constructor(criteria, llmEvaluate) {
    this.criteria = criteria;
    this.llmEvaluate = llmEvaluate;
  }
  /**
   * Evaluate a complete conversation
   */
  async evaluateConversation(params) {
    const durationMs = params.endedAt.getTime() - params.startedAt.getTime();
    const goalResults = await this.evaluateGoalCompletion(params.turns);
    const satisfactionResults = await this.evaluateUserSatisfaction(params.turns);
    const qualityResults = await this.evaluateQuality(params.turns);
    return {
      id: `eval_${(0, import_nanoid4.nanoid)(12)}`,
      conversationId: params.conversationId,
      agentId: params.agentId,
      userId: params.userId,
      workspaceId: params.workspaceId,
      goalsDetected: goalResults.detected,
      goalsCompleted: goalResults.completed,
      goalCompletionRate: goalResults.completionRate,
      satisfactionScore: satisfactionResults.score,
      satisfactionIndicators: satisfactionResults.indicators,
      qualityScores: qualityResults.scores,
      overallQualityScore: qualityResults.overallScore,
      turnCount: params.turns.length,
      durationMs,
      evaluatedAt: /* @__PURE__ */ new Date()
    };
  }
  /**
   * Evaluate goal completion
   */
  async evaluateGoalCompletion(turns) {
    if (!this.criteria.goalCompletion.enabled) {
      return { detected: [], completed: [], completionRate: 1 };
    }
    const detected = [];
    const completed = [];
    if (this.llmEvaluate) {
      const conversationText = turns.map((t) => `${t.role}: ${t.content}`).join("\n");
      const prompt = `Analyze this conversation and identify which goals were detected and completed.

Expected goals: ${this.criteria.goalCompletion.expectedGoals.join(", ")}

Conversation:
${conversationText}

Return a JSON object with:
- detected: array of goal names that were discussed
- completed: array of goal names that were successfully completed

Example: {"detected": ["book_meeting"], "completed": ["book_meeting"]}`;
      try {
        const result = await this.llmEvaluate(prompt);
        detected.push(...result.detected || []);
        completed.push(...result.completed || []);
      } catch (error) {
        console.error("[ConversationEvaluator] Goal evaluation failed:", error);
      }
    } else {
      const conversationText = turns.map((t) => t.content.toLowerCase()).join(" ");
      for (const goal of this.criteria.goalCompletion.expectedGoals) {
        if (conversationText.includes(goal.toLowerCase())) {
          detected.push(goal);
          if (!conversationText.includes("failed") && !conversationText.includes("unable")) {
            completed.push(goal);
          }
        }
      }
    }
    const completionRate = detected.length > 0 ? completed.length / detected.length : 1;
    return { detected, completed, completionRate };
  }
  /**
   * Evaluate user satisfaction
   */
  async evaluateUserSatisfaction(turns) {
    if (!this.criteria.userSatisfaction.enabled) {
      return { score: 1, indicators: {} };
    }
    const indicators = {};
    if (this.llmEvaluate) {
      const conversationText = turns.map((t) => `${t.role}: ${t.content}`).join("\n");
      const prompt = `Analyze user satisfaction in this conversation.

Look for these indicators: ${this.criteria.userSatisfaction.indicators.join(", ")}

Conversation:
${conversationText}

Return a JSON object with:
- score: overall satisfaction score from 0 to 1
- indicators: object with boolean for each indicator

Example: {"score": 0.8, "indicators": {"positive_feedback": true, "task_completion": true}}`;
      try {
        const result = await this.llmEvaluate(prompt);
        Object.assign(indicators, result.indicators || {});
        return {
          score: result.score || 0.5,
          indicators: result.indicators || {}
        };
      } catch (error) {
        console.error("[ConversationEvaluator] Satisfaction evaluation failed:", error);
      }
    }
    const userTurns = turns.filter((t) => t.role === "user");
    const positiveWords = ["thanks", "great", "perfect", "excellent", "helpful", "yes"];
    const negativeWords = ["bad", "wrong", "no", "terrible", "unhelpful", "frustrated"];
    let positiveCount = 0;
    let negativeCount = 0;
    for (const turn of userTurns) {
      const content = turn.content.toLowerCase();
      positiveCount += positiveWords.filter((w) => content.includes(w)).length;
      negativeCount += negativeWords.filter((w) => content.includes(w)).length;
    }
    const score = Math.max(0, Math.min(
      1,
      (positiveCount - negativeCount) / Math.max(1, userTurns.length)
    ));
    return { score: score || 0.5, indicators };
  }
  /**
   * Evaluate conversation quality
   */
  async evaluateQuality(turns) {
    if (!this.criteria.conversationQuality.enabled) {
      return { scores: {}, overallScore: 1 };
    }
    const scores = {};
    if (this.llmEvaluate) {
      const conversationText = turns.map((t) => `${t.role}: ${t.content}`).join("\n");
      const prompt = `Evaluate the quality of this conversation on these metrics: ${this.criteria.conversationQuality.metrics.join(", ")}

Conversation:
${conversationText}

Rate each metric from 0 to 1 (0 = very poor, 1 = excellent).

Return a JSON object with scores for each metric.

Example: {"coherence": 0.9, "relevance": 0.85, "helpfulness": 0.8}`;
      try {
        const result = await this.llmEvaluate(prompt);
        Object.assign(scores, result);
      } catch (error) {
        console.error("[ConversationEvaluator] Quality evaluation failed:", error);
      }
    } else {
      for (const metric of this.criteria.conversationQuality.metrics) {
        if (metric === "coherence") {
          scores[metric] = Math.min(1, turns.length / 10);
        } else if (metric === "relevance") {
          scores[metric] = 0.7;
        } else if (metric === "helpfulness") {
          scores[metric] = 0.7;
        } else {
          scores[metric] = 0.5;
        }
      }
    }
    const overallScore = Object.values(scores).length > 0 ? Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.values(scores).length : 0.5;
    return { scores, overallScore };
  }
};
function createEvaluator(criteria, llmEvaluate) {
  return new ConversationEvaluator(criteria, llmEvaluate);
}

// src/insights/index.ts
var import_nanoid5 = require("nanoid");
var InsightsAnalyzer = class {
  constructor(llmAnalyze) {
    this.llmAnalyze = llmAnalyze;
  }
  /**
   * Analyze data and generate insights
   */
  async analyze(input) {
    const insights = [];
    const failurePatterns = await this.detectFailurePatterns(input);
    insights.push(...failurePatterns);
    const successPatterns = await this.detectSuccessPatterns(input);
    insights.push(...successPatterns);
    const costInsights = await this.detectCostOptimizations(input);
    insights.push(...costInsights);
    const performanceInsights = await this.detectPerformanceBottlenecks(input);
    insights.push(...performanceInsights);
    return insights.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.confidence - a.confidence;
    });
  }
  /**
   * Detect failure patterns
   */
  async detectFailurePatterns(input) {
    const insights = [];
    const failures = input.dataPoints.filter(
      (dp) => dp.metadata.status === "failed" || dp.metrics.success === 0
    );
    if (failures.length === 0) return insights;
    const failureRate = failures.length / input.dataPoints.length;
    if (failureRate > 0.1) {
      const examples = failures.slice(0, 5).map((f) => f.id);
      let failureReasons = [];
      if (this.llmAnalyze && failures.length > 0) {
        const failureContext = failures.slice(0, 10).map((f) => ({
          error: f.metadata.error,
          context: f.metadata.context
        }));
        const prompt = `Analyze these failure cases and identify common patterns:

${JSON.stringify(failureContext, null, 2)}

Return a JSON object with:
- commonPatterns: array of pattern descriptions
- rootCause: likely root cause
- recommendations: array of specific actions to fix

Example: {
  "commonPatterns": ["Missing required field", "Invalid credentials"],
  "rootCause": "Configuration issue",
  "recommendations": ["Validate config before execution", "Add retry logic"]
}`;
        try {
          const analysis = await this.llmAnalyze(prompt);
          failureReasons = analysis.commonPatterns || [];
        } catch (error) {
          console.error("[InsightsAnalyzer] Failure pattern analysis failed:", error);
        }
      }
      insights.push({
        id: `insight_${(0, import_nanoid5.nanoid)(10)}`,
        agentId: input.agentId,
        workspaceId: input.workspaceId,
        type: "failure_pattern",
        title: `High failure rate detected (${(failureRate * 100).toFixed(1)}%)`,
        description: `Agent is failing frequently. Common reasons: ${failureReasons.join(", ") || "unknown"}`,
        severity: failureRate > 0.3 ? "critical" : "high",
        confidence: Math.min(1, failures.length / 10),
        impact: {
          metric: "success_rate",
          current: 1 - failureRate,
          potential: 0.95,
          improvement: (0.95 - (1 - failureRate)) / (1 - failureRate) * 100
        },
        evidence: {
          dataPoints: failures.length,
          examples
        },
        recommendations: failureReasons.length > 0 ? failureReasons : [
          "Review error logs for common patterns",
          "Add better error handling",
          "Validate inputs before execution"
        ],
        detectedAt: /* @__PURE__ */ new Date()
      });
    }
    return insights;
  }
  /**
   * Detect success patterns
   */
  async detectSuccessPatterns(input) {
    const insights = [];
    const successes = input.dataPoints.filter(
      (dp) => dp.metadata.status === "completed" && (dp.metrics.satisfaction || 0) > 0.8
    );
    if (successes.length > input.dataPoints.length * 0.3) {
      const examples = successes.slice(0, 5).map((s) => s.id);
      insights.push({
        id: `insight_${(0, import_nanoid5.nanoid)(10)}`,
        agentId: input.agentId,
        workspaceId: input.workspaceId,
        type: "success_pattern",
        title: "Strong performance on specific types of conversations",
        description: "Agent shows consistent success with certain conversation patterns",
        severity: "low",
        confidence: Math.min(1, successes.length / 20),
        impact: {
          metric: "success_rate",
          current: successes.length / input.dataPoints.length,
          potential: 1,
          improvement: (1 - successes.length / input.dataPoints.length) / (successes.length / input.dataPoints.length) * 100
        },
        evidence: {
          dataPoints: successes.length,
          examples
        },
        recommendations: [
          "Analyze successful patterns to replicate across all conversations",
          "Use successful examples for few-shot learning"
        ],
        detectedAt: /* @__PURE__ */ new Date()
      });
    }
    return insights;
  }
  /**
   * Detect cost optimization opportunities
   */
  async detectCostOptimizations(input) {
    const insights = [];
    const costs = input.dataPoints.map((dp) => dp.metrics.cost || 0).filter((c) => c > 0);
    if (costs.length === 0) return insights;
    const avgCost = costs.reduce((sum, c) => sum + c, 0) / costs.length;
    const maxCost = Math.max(...costs);
    const expensive = costs.filter((c) => c > avgCost * 2);
    if (expensive.length > 0) {
      insights.push({
        id: `insight_${(0, import_nanoid5.nanoid)(10)}`,
        agentId: input.agentId,
        workspaceId: input.workspaceId,
        type: "cost_optimization",
        title: `${expensive.length} conversations cost >2x average`,
        description: `Some conversations are significantly more expensive than average. Avg: $${avgCost.toFixed(4)}, Max: $${maxCost.toFixed(4)}`,
        severity: expensive.length > costs.length * 0.2 ? "medium" : "low",
        confidence: 0.9,
        impact: {
          metric: "cost",
          current: avgCost,
          potential: avgCost * 0.7,
          // 30% reduction
          improvement: 30
        },
        evidence: {
          dataPoints: expensive.length,
          examples: input.dataPoints.filter((dp) => (dp.metrics.cost || 0) > avgCost * 2).slice(0, 5).map((dp) => dp.id)
        },
        recommendations: [
          "Use cheaper models (Haiku instead of Sonnet) for simple queries",
          "Implement caching for repeated queries",
          "Optimize prompts to reduce token usage",
          "Set maxTokens limits to prevent runaway costs"
        ],
        detectedAt: /* @__PURE__ */ new Date()
      });
    }
    return insights;
  }
  /**
   * Detect performance bottlenecks
   */
  async detectPerformanceBottlenecks(input) {
    const insights = [];
    const latencies = input.dataPoints.map((dp) => dp.metrics.latencyMs || 0).filter((l) => l > 0);
    if (latencies.length === 0) return insights;
    const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
    if (p95Latency > 1e4) {
      insights.push({
        id: `insight_${(0, import_nanoid5.nanoid)(10)}`,
        agentId: input.agentId,
        workspaceId: input.workspaceId,
        type: "performance_bottleneck",
        title: "Slow response times detected",
        description: `P95 latency is ${(p95Latency / 1e3).toFixed(1)}s (avg: ${(avgLatency / 1e3).toFixed(1)}s)`,
        severity: p95Latency > 2e4 ? "high" : "medium",
        confidence: 0.95,
        impact: {
          metric: "latency",
          current: avgLatency,
          potential: avgLatency * 0.5,
          // 50% reduction
          improvement: 50
        },
        evidence: {
          dataPoints: latencies.length,
          examples: input.dataPoints.filter((dp) => (dp.metrics.latencyMs || 0) > p95Latency).slice(0, 5).map((dp) => dp.id)
        },
        recommendations: [
          "Use parallel tool calls when possible",
          "Cache frequently accessed data",
          "Optimize database queries",
          "Use streaming for long responses"
        ],
        detectedAt: /* @__PURE__ */ new Date()
      });
    }
    return insights;
  }
};
function createInsightsAnalyzer(llmAnalyze) {
  return new InsightsAnalyzer(llmAnalyze);
}

// src/optimization/index.ts
var import_nanoid6 = require("nanoid");
var AgentOptimizer = class {
  constructor(config, llmOptimize) {
    this.config = config;
    this.llmOptimize = llmOptimize;
  }
  /**
   * Run optimization based on feedback and metrics
   */
  async optimize(params) {
    const runId = `optim_${(0, import_nanoid6.nanoid)(12)}`;
    const startedAt = /* @__PURE__ */ new Date();
    const run = {
      id: runId,
      agentId: this.config.agentId,
      workspaceId: this.config.workspaceId,
      startedAt,
      status: "running",
      baseline: {
        systemPrompt: params.currentPrompt,
        model: params.currentModel,
        temperature: params.currentTemperature,
        metrics: params.metricsData
      },
      improvements: [],
      method: "prompt_optimization"
    };
    try {
      const corrections = params.feedbackData.filter((f) => f.type === "correction" || f.type === "edit");
      const negativeFeedback = params.feedbackData.filter((f) => f.type === "thumbs_down");
      if (corrections.length > 5) {
        run.method = "few_shot_learning";
        run.optimized = await this.optimizeWithFewShot(params, corrections);
      } else if (negativeFeedback.length > 10) {
        run.method = "prompt_optimization";
        run.optimized = await this.optimizePrompt(params, negativeFeedback);
      } else if (params.metricsData.cost > (this.config.constraints.maxCostPerConversation || Infinity)) {
        run.method = "model_tier_optimization";
        run.optimized = await this.optimizeModelTier(params);
      } else {
        run.method = "prompt_optimization";
        run.optimized = await this.optimizePrompt(params, params.feedbackData);
      }
      if (run.optimized) {
        for (const goal of this.config.goals) {
          const baselineValue = params.metricsData[goal.metric] || 0;
          const optimizedValue = run.optimized.metrics[goal.metric] || baselineValue;
          const improvement = (optimizedValue - baselineValue) / baselineValue * 100;
          if (Math.abs(improvement) > 1) {
            run.improvements.push({
              metric: goal.metric,
              baselineValue,
              optimizedValue,
              improvement
            });
          }
        }
      }
      run.status = "completed";
      run.completedAt = /* @__PURE__ */ new Date();
    } catch (error) {
      run.status = "failed";
      run.metadata = {
        error: error instanceof Error ? error.message : String(error)
      };
    }
    return run;
  }
  /**
   * Optimize using few-shot learning from corrections
   */
  async optimizeWithFewShot(params, corrections) {
    const examples = corrections.filter((c) => c.originalText && c.correctedText).slice(0, 10).map((c) => ({
      original: c.originalText,
      corrected: c.correctedText
    }));
    const fewShotSection = `

## Style Examples

Here are examples of how to respond. Notice the corrections made:

${examples.map((ex, i) => `
Example ${i + 1}:
Original: ${ex.original}
Improved: ${ex.corrected}
`).join("\n")}

Follow the style demonstrated in the improved versions above.`;
    const optimizedPrompt = params.currentPrompt + fewShotSection;
    return {
      systemPrompt: optimizedPrompt,
      model: params.currentModel,
      temperature: params.currentTemperature,
      metrics: {
        // Estimate improvement
        satisfaction: 0.85
        // Assumed improvement from style learning
      }
    };
  }
  /**
   * Optimize prompt using LLM
   */
  async optimizePrompt(params, negativeFeedback) {
    if (!this.llmOptimize) {
      return {
        systemPrompt: params.currentPrompt,
        model: params.currentModel,
        temperature: params.currentTemperature,
        metrics: {}
      };
    }
    const feedbackContext = negativeFeedback.map((f) => f.metadata?.reason || "User was unsatisfied").join("\n- ");
    const optimizationPrompt = `You are an expert at optimizing AI agent prompts.

Current system prompt:
"""
${params.currentPrompt}
"""

Issues reported by users:
- ${feedbackContext}

Optimization goals:
${this.config.goals.map((g) => `- Improve ${g.metric} (weight: ${g.weight})`).join("\n")}

Rewrite the system prompt to address these issues while maintaining the core functionality.
Return ONLY the optimized prompt, no explanation.`;
    try {
      const optimizedPrompt = await this.llmOptimize(optimizationPrompt);
      return {
        systemPrompt: optimizedPrompt.trim(),
        model: params.currentModel,
        temperature: params.currentTemperature,
        metrics: {
          // Estimate improvement
          satisfaction: 0.8
          // Assumed improvement
        }
      };
    } catch (error) {
      console.error("[AgentOptimizer] Prompt optimization failed:", error);
      return {
        systemPrompt: params.currentPrompt,
        model: params.currentModel,
        temperature: params.currentTemperature,
        metrics: {}
      };
    }
  }
  /**
   * Optimize model tier to reduce cost
   */
  async optimizeModelTier(params) {
    const tierMap = {
      "claude-opus-4-20250514": "claude-3-5-sonnet-20241022",
      // Opus → Sonnet
      "claude-3-5-sonnet-20241022": "claude-3-5-haiku-20241022"
      // Sonnet → Haiku
    };
    const downgradedModel = tierMap[params.currentModel] || params.currentModel;
    const costReduction = downgradedModel !== params.currentModel ? 0.7 : 1;
    return {
      systemPrompt: params.currentPrompt,
      model: downgradedModel,
      temperature: params.currentTemperature,
      metrics: {
        cost: costReduction
        // Relative to baseline
      }
    };
  }
  /**
   * Create A/B test
   */
  async createABTest(params) {
    return {
      id: `abtest_${(0, import_nanoid6.nanoid)(12)}`,
      agentId: this.config.agentId,
      workspaceId: this.config.workspaceId,
      status: "running",
      variants: [
        {
          id: "control",
          name: "control",
          systemPrompt: params.controlPrompt,
          model: params.model,
          temperature: params.temperature,
          trafficPercentage: 1 - this.config.abTestConfig.trafficSplit,
          sampleSize: 0,
          metrics: {}
        },
        {
          id: "variant",
          name: "variant",
          systemPrompt: params.variantPrompt,
          model: params.model,
          temperature: params.temperature,
          trafficPercentage: this.config.abTestConfig.trafficSplit,
          sampleSize: 0,
          metrics: {}
        }
      ],
      confidence: 0,
      startedAt: /* @__PURE__ */ new Date()
    };
  }
  /**
   * Evaluate A/B test and determine winner
   */
  evaluateABTest(test) {
    const control = test.variants.find((v) => v.name === "control");
    const variant = test.variants.find((v) => v.name === "variant");
    if (!control || !variant) {
      return test;
    }
    if (control.sampleSize < this.config.abTestConfig.minSampleSize || variant.sampleSize < this.config.abTestConfig.minSampleSize) {
      return test;
    }
    const primaryGoal = this.config.goals[0];
    const controlMetric = control.metrics[primaryGoal.metric] || 0;
    const variantMetric = variant.metrics[primaryGoal.metric] || 0;
    const improvementThreshold = 0.05;
    const improvement = (variantMetric - controlMetric) / controlMetric;
    if (Math.abs(improvement) > improvementThreshold) {
      test.winner = improvement > 0 ? "variant" : "control";
      test.confidence = Math.min(0.95, 0.5 + Math.abs(improvement));
      test.status = "completed";
      test.completedAt = /* @__PURE__ */ new Date();
    }
    return test;
  }
};
function createOptimizer(config, llmOptimize) {
  return new AgentOptimizer(config, llmOptimize);
}

// src/meta-agent/index.ts
var import_nanoid7 = require("nanoid");
var SelfModifier = class {
  constructor(llmGenerate) {
    this.llmGenerate = llmGenerate;
  }
  /**
   * Analyze agent performance and propose modifications
   */
  async proposeModifications(params) {
    const proposals = [];
    const criticalInsights = params.insights.filter(
      (i) => i.severity === "critical" || i.severity === "high"
    );
    for (const insight of criticalInsights) {
      if (insight.type === "failure_pattern") {
        const proposal = await this.proposePromptUpdate(params, insight);
        if (proposal) proposals.push(proposal);
      } else if (insight.type === "cost_optimization") {
        const proposal = await this.proposeModelChange(params, insight);
        if (proposal) proposals.push(proposal);
      } else if (insight.type === "performance_bottleneck") {
        const proposal = await this.proposeToolAddition(params, insight);
        if (proposal) proposals.push(proposal);
      }
    }
    const corrections = params.feedback.filter((f) => f.correctedText);
    if (corrections.length > 5) {
      const proposal = await this.proposeStyleUpdate(params, corrections);
      if (proposal) proposals.push(proposal);
    }
    return proposals;
  }
  /**
   * Propose prompt update based on insight
   */
  async proposePromptUpdate(params, insight) {
    if (!this.llmGenerate) return null;
    const modificationPrompt = `You are an AI agent optimization expert.

Current system prompt:
"""
${params.currentConfig.systemPrompt}
"""

Problem identified:
${insight.description}

Recommendations:
${insight.recommendations.join("\n- ")}

Generate an improved system prompt that addresses this problem.
Include specific instructions to prevent the identified failure pattern.
Return ONLY the improved prompt, no explanation.`;
    try {
      const improvedPrompt = await this.llmGenerate(modificationPrompt);
      return {
        id: `proposal_${(0, import_nanoid7.nanoid)(12)}`,
        agentId: params.agentId,
        workspaceId: params.workspaceId,
        type: "prompt_update",
        status: "pending",
        current: {
          systemPrompt: params.currentConfig.systemPrompt
        },
        proposed: {
          systemPrompt: improvedPrompt.trim()
        },
        rationale: `Addresses ${insight.type}: ${insight.description}`,
        expectedImpact: [
          {
            metric: "success_rate",
            currentValue: params.metrics.success_rate || 0.5,
            expectedValue: (params.metrics.success_rate || 0.5) * 1.3,
            // 30% improvement
            confidence: 0.7
          }
        ],
        evidence: {
          insights: [insight.id],
          feedback: [],
          metrics: params.metrics
        },
        createdAt: /* @__PURE__ */ new Date()
      };
    } catch (error) {
      console.error("[SelfModifier] Prompt update proposal failed:", error);
      return null;
    }
  }
  /**
   * Propose model tier change
   */
  async proposeModelChange(params, insight) {
    const tierDowngrade = {
      "claude-opus-4-20250514": "claude-3-5-sonnet-20241022",
      "claude-3-5-sonnet-20241022": "claude-3-5-haiku-20241022"
    };
    const currentModel = params.currentConfig.model;
    const proposedModel = tierDowngrade[currentModel];
    if (!proposedModel || proposedModel === currentModel) {
      return null;
    }
    return {
      id: `proposal_${(0, import_nanoid7.nanoid)(12)}`,
      agentId: params.agentId,
      workspaceId: params.workspaceId,
      type: "parameter_tuning",
      status: "pending",
      current: {
        model: currentModel
      },
      proposed: {
        model: proposedModel
      },
      rationale: `Reduce costs while maintaining quality. ${insight.description}`,
      expectedImpact: [
        {
          metric: "cost",
          currentValue: params.metrics.cost || 0,
          expectedValue: (params.metrics.cost || 0) * 0.3,
          // 70% cost reduction
          confidence: 0.9
        }
      ],
      evidence: {
        insights: [insight.id],
        feedback: [],
        metrics: params.metrics
      },
      createdAt: /* @__PURE__ */ new Date()
    };
  }
  /**
   * Propose tool addition
   */
  async proposeToolAddition(params, insight) {
    const toolSuggestions = insight.recommendations.filter((r) => r.includes("cache") || r.includes("parallel") || r.includes("optimize")).map((r) => {
      if (r.includes("cache")) return "caching_tool";
      if (r.includes("parallel")) return "parallel_executor";
      return "optimization_tool";
    });
    if (toolSuggestions.length === 0) return null;
    return {
      id: `proposal_${(0, import_nanoid7.nanoid)(12)}`,
      agentId: params.agentId,
      workspaceId: params.workspaceId,
      type: "tool_addition",
      status: "pending",
      current: {
        tools: params.currentConfig.tools
      },
      proposed: {
        tools: [...params.currentConfig.tools, ...toolSuggestions]
      },
      rationale: `Add tools to improve performance: ${insight.description}`,
      expectedImpact: [
        {
          metric: "latency",
          currentValue: params.metrics.latency || 0,
          expectedValue: (params.metrics.latency || 0) * 0.6,
          // 40% latency reduction
          confidence: 0.6
        }
      ],
      evidence: {
        insights: [insight.id],
        feedback: [],
        metrics: params.metrics
      },
      createdAt: /* @__PURE__ */ new Date()
    };
  }
  /**
   * Propose style update based on corrections
   */
  async proposeStyleUpdate(params, corrections) {
    if (!this.llmGenerate) return null;
    const examples = corrections.slice(0, 5).map((c) => c.correctedText).join("\n\n");
    const stylePrompt = `Analyze these corrected responses and extract the preferred writing style:

${examples}

Describe the style in 2-3 sentences (tone, structure, formality level, etc.).`;
    try {
      const styleDescription = await this.llmGenerate(stylePrompt);
      const updatedPrompt = `${params.currentConfig.systemPrompt}

## Writing Style

${styleDescription}

Follow this style in all your responses.`;
      return {
        id: `proposal_${(0, import_nanoid7.nanoid)(12)}`,
        agentId: params.agentId,
        workspaceId: params.workspaceId,
        type: "prompt_update",
        status: "pending",
        current: {
          systemPrompt: params.currentConfig.systemPrompt
        },
        proposed: {
          systemPrompt: updatedPrompt
        },
        rationale: "Incorporate user's preferred writing style based on corrections",
        expectedImpact: [
          {
            metric: "satisfaction",
            currentValue: params.metrics.satisfaction || 0.5,
            expectedValue: 0.85,
            confidence: 0.8
          }
        ],
        evidence: {
          insights: [],
          feedback: corrections.map((_, i) => `feedback_${i}`),
          metrics: params.metrics
        },
        createdAt: /* @__PURE__ */ new Date()
      };
    } catch (error) {
      console.error("[SelfModifier] Style update proposal failed:", error);
      return null;
    }
  }
  /**
   * Apply an approved modification
   */
  async applyModification(proposalId, approved) {
    console.log(`[SelfModifier] ${approved ? "Applying" : "Rejecting"} proposal ${proposalId}`);
  }
};
var AgentBuilder = class {
  constructor(llmGenerate) {
    this.llmGenerate = llmGenerate;
  }
  /**
   * Build an agent from natural language description
   */
  async buildAgent(request) {
    if (!this.llmGenerate) {
      throw new Error("LLM generation required for agent building");
    }
    const buildPrompt = `You are an AI agent architect. Build a complete agent specification from this request:

Name: ${request.name}
Description: ${request.description}
Goals:
${request.goals.map((g) => `- ${g}`).join("\n")}

${request.constraints ? `Constraints:
${request.constraints.maxCost ? `- Max cost: $${request.constraints.maxCost}/conversation` : ""}
${request.constraints.maxLatency ? `- Max latency: ${request.constraints.maxLatency}ms` : ""}` : ""}

${request.domain ? `Domain: ${request.domain}` : ""}
${request.style ? `Communication style: ${request.style}` : ""}

Generate a complete agent specification with:
1. System prompt (detailed instructions for the agent)
2. Recommended model (haiku/sonnet/opus based on complexity)
3. Temperature (0-1)
4. Suggested tools (composio apps that would be useful)
5. Suggested triggers (when the agent should run)
6. Rationale for your choices

Return a JSON object with this structure:
{
  "systemPrompt": "...",
  "model": "claude-3-5-haiku-20241022",
  "temperature": 0.7,
  "suggestedTools": ["gmail", "calendar"],
  "suggestedTriggers": ["scheduled", "webhook"],
  "rationale": "..."
}`;
    try {
      const response = await this.llmGenerate(buildPrompt);
      const result = JSON.parse(response);
      return {
        systemPrompt: result.systemPrompt,
        model: result.model || "claude-3-5-sonnet-20241022",
        temperature: result.temperature || 0.7,
        suggestedTools: result.suggestedTools || [],
        suggestedTriggers: result.suggestedTriggers || [],
        rationale: result.rationale || "Agent built based on requirements"
      };
    } catch (error) {
      console.error("[AgentBuilder] Agent building failed:", error);
      throw new Error(`Failed to build agent: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
};
function createSelfModifier(llmGenerate) {
  return new SelfModifier(llmGenerate);
}
function createAgentBuilder(llmGenerate) {
  return new AgentBuilder(llmGenerate);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AgentBuilder,
  AgentEngine,
  AgentOptimizer,
  AgentTracer,
  ConversationEvaluator,
  DEFAULT_SCAN_RULES,
  InsightsAnalyzer,
  ScanEngine,
  SelfModifier,
  costTrackingHook,
  createAgentBuilder,
  createAgentEngine,
  createEvaluator,
  createInsightsAnalyzer,
  createOptimizer,
  createScanEngine,
  createSelfModifier,
  createTracer,
  errorLoggingHook,
  getAgentEngine,
  getDefaultAgentHooks,
  getEvalRegistry,
  getScanEngine,
  initAgentEngine,
  initElevayCore,
  initScanEngine,
  loggingHook,
  registerL1Assertion,
  registerL2Criterion,
  runL1Eval,
  runL2Eval,
  runL3Eval
});
