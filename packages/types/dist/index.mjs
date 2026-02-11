// src/index.ts
import { z } from "zod";
var LLM_TIERS = ["haiku", "sonnet", "opus"];
var LLM_MODELS = {
  haiku: "claude-3-5-haiku-20241022",
  sonnet: "claude-sonnet-4-20250514",
  opus: "claude-opus-4-20250514"
};
var SCAN_CATEGORIES = [
  "SALES",
  "SUPPORT",
  "MARKETING",
  "HR",
  "FINANCE",
  "PROJECTS"
];
var AGENT_TRIGGER_TYPES = [
  "MANUAL",
  "SCHEDULE",
  "WEBHOOK",
  "EMAIL",
  "CHAT"
];
var EVAL_SEVERITIES = ["block", "warn", "info"];
var TEMPLATE_CATEGORIES = [
  "PRODUCTIVITY",
  "SALES",
  "MARKETING",
  "SUPPORT",
  "HR",
  "OPERATIONS",
  "RESEARCH",
  "FINANCE"
];
var TEMPLATE_ROLES = [
  "GENERAL",
  "SALES",
  "MARKETING",
  "SUPPORT",
  "HR",
  "OPERATIONS",
  "RESEARCH",
  "FINANCE"
];
var TEMPLATE_USE_CASES = [
  "AUTOMATION",
  "RESEARCH",
  "CONTENT_CREATION",
  "OUTREACH",
  "MONITORING",
  "ANALYSIS",
  "SCHEDULING",
  "DATA_PROCESSING"
];
var CONNECTOR_CATEGORIES = [
  "CRM",
  "SUPPORT",
  "EMAIL",
  "CALENDAR",
  "MARKETING",
  "HR",
  "FINANCE",
  "PROJECTS",
  "MESSAGING",
  "STORAGE",
  "ANALYTICS"
];
var NodebaseError = class extends Error {
  constructor(message, code, context) {
    super(message);
    this.code = code;
    this.context = context;
    this.name = "NodebaseError";
  }
};
var ScanError = class extends NodebaseError {
  constructor(signalId, connectorId, message) {
    super(`Scan failed on signal ${signalId} via ${connectorId}: ${message}`, "SCAN_ERROR", {
      signalId,
      connectorId
    });
    this.signalId = signalId;
    this.connectorId = connectorId;
    this.name = "ScanError";
  }
};
var AgentExecutionError = class extends NodebaseError {
  constructor(agentId, runId, message) {
    super(`Agent ${agentId} execution failed (run: ${runId}): ${message}`, "AGENT_EXECUTION_ERROR", {
      agentId,
      runId
    });
    this.agentId = agentId;
    this.runId = runId;
    this.name = "AgentExecutionError";
  }
};
var ConnectorError = class extends NodebaseError {
  constructor(connectorId, action, message) {
    super(`Connector ${connectorId} failed on ${action}: ${message}`, "CONNECTOR_ERROR", {
      connectorId,
      action
    });
    this.connectorId = connectorId;
    this.action = action;
    this.name = "ConnectorError";
  }
};
var CredentialError = class extends NodebaseError {
  constructor(credentialId, message) {
    super(`Credential ${credentialId} error: ${message}`, "CREDENTIAL_ERROR", {
      credentialId
    });
    this.credentialId = credentialId;
    this.name = "CredentialError";
  }
};
var PermissionError = class extends NodebaseError {
  constructor(userId, resource, action) {
    super(
      `User ${userId} does not have permission to ${action} on ${resource}`,
      "PERMISSION_ERROR",
      { userId, resource, action }
    );
    this.userId = userId;
    this.resource = resource;
    this.action = action;
    this.name = "PermissionError";
  }
};
var ConfigError = class extends NodebaseError {
  constructor(envVar, message) {
    super(`Configuration error for ${envVar}: ${message}`, "CONFIG_ERROR", { envVar });
    this.envVar = envVar;
    this.name = "ConfigError";
  }
};
var LLMTierSchema = z.enum(LLM_TIERS);
var ScanCategorySchema = z.enum(SCAN_CATEGORIES);
var AgentTriggerTypeSchema = z.enum(AGENT_TRIGGER_TYPES);
var EvalSeveritySchema = z.enum(EVAL_SEVERITIES);
var TemplateCategorySchema = z.enum(TEMPLATE_CATEGORIES);
var TemplateRoleSchema = z.enum(TEMPLATE_ROLES);
var TemplateUseCaseSchema = z.enum(TEMPLATE_USE_CASES);
var ConnectorCategorySchema = z.enum(CONNECTOR_CATEGORIES);
var ScanSignalSchema = z.object({
  id: z.string(),
  type: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  title: z.string(),
  description: z.string(),
  metadata: z.record(z.unknown()),
  connectorId: z.string(),
  detectedAt: z.date()
});
var L1AssertionSchema = z.object({
  check: z.string(),
  severity: EvalSeveritySchema,
  params: z.record(z.unknown()).optional()
});
var EvalRulesSchema = z.object({
  l1: z.object({
    assertions: z.array(L1AssertionSchema)
  }),
  l2: z.object({
    criteria: z.array(z.string()),
    passingScore: z.number().min(0).max(1)
  }),
  l3: z.object({
    triggerConditions: z.array(z.string())
  }),
  minConfidence: z.number().min(0).max(1),
  autoSendThreshold: z.number().min(0).max(1),
  requireApproval: z.boolean()
});
var AgentFetchSourceSchema = z.object({
  source: z.string(),
  provider: z.string().optional(),
  query: z.string().optional(),
  dataPoints: z.array(z.string()).optional(),
  limit: z.number().optional(),
  filters: z.record(z.unknown()).optional()
});
var AgentActionSchema = z.object({
  id: z.string(),
  type: z.enum(["API_CALL", "COMPUTE", "GENERATE", "NOTIFICATION", "WORKFLOW", "INTERNAL"]),
  service: z.string().optional(),
  action: z.string().optional(),
  description: z.string().optional(),
  requireApproval: z.boolean().optional()
});
var AgentTriggerSchema = z.object({
  type: AgentTriggerTypeSchema,
  config: z.record(z.unknown()),
  enabled: z.boolean()
});
var AgentCategorySchema = z.enum([
  "sales",
  "support",
  "marketing",
  "hr",
  "finance",
  "operations"
]);
var TriggerConfigSchema = z.object({
  type: z.enum(["scan_signal", "schedule", "manual", "webhook", "email"]),
  schedule: z.string().optional(),
  signalTypes: z.array(z.string()).optional(),
  webhookPath: z.string().optional(),
  config: z.record(z.unknown()).optional()
});
var FetchStepSchema = z.object({
  connector: z.string(),
  action: z.string(),
  params: z.record(z.unknown()),
  outputKey: z.string().optional()
});
var EvalAssertionSchema = z.object({
  check: z.string(),
  severity: z.enum(["block", "warn"]),
  message: z.string().optional()
});
var AgentEvalRulesSchema = z.object({
  assertions: z.array(EvalAssertionSchema),
  minConfidence: z.number().min(0).max(1),
  l3Trigger: z.enum(["always", "on_irreversible_action", "on_low_confidence", "never"]),
  requireApproval: z.boolean(),
  autoSendThreshold: z.number().min(0).max(1)
});
var AgentTemplateActionSchema = z.object({
  type: z.enum([
    "draft_email",
    "draft_message",
    "draft_ticket",
    "update_crm",
    "create_task",
    "send_notification",
    "generate_report",
    "schedule_meeting"
  ]),
  connector: z.string(),
  requiresApproval: z.boolean(),
  config: z.record(z.unknown())
});
var AgentTemplateSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  category: AgentCategorySchema,
  tags: z.array(z.string()),
  icon: z.string(),
  trigger: TriggerConfigSchema,
  fetchSteps: z.array(FetchStepSchema),
  prompt: z.string(),
  llmTier: LLMTierSchema,
  temperature: z.number().min(0).max(1),
  maxStepsPerRun: z.number().min(1).max(20),
  evalRules: AgentEvalRulesSchema,
  actions: z.array(AgentTemplateActionSchema),
  isActive: z.boolean(),
  isPremium: z.boolean(),
  version: z.number(),
  createdAt: z.date(),
  updatedAt: z.date()
});
var SignalSchema = z.object({
  id: z.string(),
  scanResultId: z.string(),
  type: z.string(),
  category: AgentCategorySchema,
  severity: z.enum(["low", "medium", "high", "critical"]),
  source: z.string(),
  title: z.string(),
  description: z.string(),
  metadata: z.record(z.unknown()),
  suggestedTemplateId: z.string().optional(),
  snoozedUntil: z.date().optional(),
  createdAt: z.date()
});
export {
  AGENT_TRIGGER_TYPES,
  AgentActionSchema,
  AgentCategorySchema,
  AgentEvalRulesSchema,
  AgentExecutionError,
  AgentFetchSourceSchema,
  AgentTemplateActionSchema,
  AgentTemplateSchema,
  AgentTriggerSchema,
  AgentTriggerTypeSchema,
  CONNECTOR_CATEGORIES,
  ConfigError,
  ConnectorCategorySchema,
  ConnectorError,
  CredentialError,
  EVAL_SEVERITIES,
  EvalAssertionSchema,
  EvalRulesSchema,
  EvalSeveritySchema,
  FetchStepSchema,
  L1AssertionSchema,
  LLMTierSchema,
  LLM_MODELS,
  LLM_TIERS,
  NodebaseError,
  PermissionError,
  SCAN_CATEGORIES,
  ScanCategorySchema,
  ScanError,
  ScanSignalSchema,
  SignalSchema,
  TEMPLATE_CATEGORIES,
  TEMPLATE_ROLES,
  TEMPLATE_USE_CASES,
  TemplateCategorySchema,
  TemplateRoleSchema,
  TemplateUseCaseSchema,
  TriggerConfigSchema
};
