"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AGENT_TRIGGER_TYPES: () => AGENT_TRIGGER_TYPES,
  AgentActionSchema: () => AgentActionSchema,
  AgentCategorySchema: () => AgentCategorySchema,
  AgentEvalRulesSchema: () => AgentEvalRulesSchema,
  AgentExecutionError: () => AgentExecutionError,
  AgentFetchSourceSchema: () => AgentFetchSourceSchema,
  AgentTemplateActionSchema: () => AgentTemplateActionSchema,
  AgentTemplateSchema: () => AgentTemplateSchema,
  AgentTriggerSchema: () => AgentTriggerSchema,
  AgentTriggerTypeSchema: () => AgentTriggerTypeSchema,
  CONNECTOR_CATEGORIES: () => CONNECTOR_CATEGORIES,
  ConfigError: () => ConfigError,
  ConnectorCategorySchema: () => ConnectorCategorySchema,
  ConnectorError: () => ConnectorError,
  CredentialError: () => CredentialError,
  EVAL_SEVERITIES: () => EVAL_SEVERITIES,
  ElevayError: () => ElevayError,
  EvalAssertionSchema: () => EvalAssertionSchema,
  EvalRulesSchema: () => EvalRulesSchema,
  EvalSeveritySchema: () => EvalSeveritySchema,
  FetchStepSchema: () => FetchStepSchema,
  L1AssertionSchema: () => L1AssertionSchema,
  LLMTierSchema: () => LLMTierSchema,
  LLM_MODELS: () => LLM_MODELS,
  LLM_TIERS: () => LLM_TIERS,
  PermissionError: () => PermissionError,
  SCAN_CATEGORIES: () => SCAN_CATEGORIES,
  ScanCategorySchema: () => ScanCategorySchema,
  ScanError: () => ScanError,
  ScanSignalSchema: () => ScanSignalSchema,
  SignalSchema: () => SignalSchema,
  TEMPLATE_CATEGORIES: () => TEMPLATE_CATEGORIES,
  TEMPLATE_ROLES: () => TEMPLATE_ROLES,
  TEMPLATE_USE_CASES: () => TEMPLATE_USE_CASES,
  TemplateCategorySchema: () => TemplateCategorySchema,
  TemplateRoleSchema: () => TemplateRoleSchema,
  TemplateUseCaseSchema: () => TemplateUseCaseSchema,
  TriggerConfigSchema: () => TriggerConfigSchema
});
module.exports = __toCommonJS(index_exports);
var import_zod = require("zod");
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
var ElevayError = class extends Error {
  constructor(message, code, context) {
    super(message);
    this.code = code;
    this.context = context;
    this.name = "ElevayError";
  }
};
var ScanError = class extends ElevayError {
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
var AgentExecutionError = class extends ElevayError {
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
var ConnectorError = class extends ElevayError {
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
var CredentialError = class extends ElevayError {
  constructor(credentialId, message) {
    super(`Credential ${credentialId} error: ${message}`, "CREDENTIAL_ERROR", {
      credentialId
    });
    this.credentialId = credentialId;
    this.name = "CredentialError";
  }
};
var PermissionError = class extends ElevayError {
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
var ConfigError = class extends ElevayError {
  constructor(envVar, message) {
    super(`Configuration error for ${envVar}: ${message}`, "CONFIG_ERROR", { envVar });
    this.envVar = envVar;
    this.name = "ConfigError";
  }
};
var LLMTierSchema = import_zod.z.enum(LLM_TIERS);
var ScanCategorySchema = import_zod.z.enum(SCAN_CATEGORIES);
var AgentTriggerTypeSchema = import_zod.z.enum(AGENT_TRIGGER_TYPES);
var EvalSeveritySchema = import_zod.z.enum(EVAL_SEVERITIES);
var TemplateCategorySchema = import_zod.z.enum(TEMPLATE_CATEGORIES);
var TemplateRoleSchema = import_zod.z.enum(TEMPLATE_ROLES);
var TemplateUseCaseSchema = import_zod.z.enum(TEMPLATE_USE_CASES);
var ConnectorCategorySchema = import_zod.z.enum(CONNECTOR_CATEGORIES);
var ScanSignalSchema = import_zod.z.object({
  id: import_zod.z.string(),
  type: import_zod.z.string(),
  severity: import_zod.z.enum(["low", "medium", "high", "critical"]),
  title: import_zod.z.string(),
  description: import_zod.z.string(),
  metadata: import_zod.z.record(import_zod.z.unknown()),
  connectorId: import_zod.z.string(),
  detectedAt: import_zod.z.date()
});
var L1AssertionSchema = import_zod.z.object({
  check: import_zod.z.string(),
  severity: EvalSeveritySchema,
  params: import_zod.z.record(import_zod.z.unknown()).optional()
});
var EvalRulesSchema = import_zod.z.object({
  l1: import_zod.z.object({
    assertions: import_zod.z.array(L1AssertionSchema)
  }),
  l2: import_zod.z.object({
    criteria: import_zod.z.array(import_zod.z.string()),
    passingScore: import_zod.z.number().min(0).max(1)
  }),
  l3: import_zod.z.object({
    triggerConditions: import_zod.z.array(import_zod.z.string())
  }),
  minConfidence: import_zod.z.number().min(0).max(1),
  autoSendThreshold: import_zod.z.number().min(0).max(1),
  requireApproval: import_zod.z.boolean()
});
var AgentFetchSourceSchema = import_zod.z.object({
  source: import_zod.z.string(),
  provider: import_zod.z.string().optional(),
  query: import_zod.z.string().optional(),
  dataPoints: import_zod.z.array(import_zod.z.string()).optional(),
  limit: import_zod.z.number().optional(),
  filters: import_zod.z.record(import_zod.z.unknown()).optional()
});
var AgentActionSchema = import_zod.z.object({
  id: import_zod.z.string(),
  type: import_zod.z.enum(["API_CALL", "COMPUTE", "GENERATE", "NOTIFICATION", "WORKFLOW", "INTERNAL"]),
  service: import_zod.z.string().optional(),
  action: import_zod.z.string().optional(),
  description: import_zod.z.string().optional(),
  requireApproval: import_zod.z.boolean().optional()
});
var AgentTriggerSchema = import_zod.z.object({
  type: AgentTriggerTypeSchema,
  config: import_zod.z.record(import_zod.z.unknown()),
  enabled: import_zod.z.boolean()
});
var AgentCategorySchema = import_zod.z.enum([
  "sales",
  "support",
  "marketing",
  "hr",
  "finance",
  "operations"
]);
var TriggerConfigSchema = import_zod.z.object({
  type: import_zod.z.enum(["scan_signal", "schedule", "manual", "webhook", "email"]),
  schedule: import_zod.z.string().optional(),
  signalTypes: import_zod.z.array(import_zod.z.string()).optional(),
  webhookPath: import_zod.z.string().optional(),
  config: import_zod.z.record(import_zod.z.unknown()).optional()
});
var FetchStepSchema = import_zod.z.object({
  connector: import_zod.z.string(),
  action: import_zod.z.string(),
  params: import_zod.z.record(import_zod.z.unknown()),
  outputKey: import_zod.z.string().optional()
});
var EvalAssertionSchema = import_zod.z.object({
  check: import_zod.z.string(),
  severity: import_zod.z.enum(["block", "warn"]),
  message: import_zod.z.string().optional()
});
var AgentEvalRulesSchema = import_zod.z.object({
  assertions: import_zod.z.array(EvalAssertionSchema),
  minConfidence: import_zod.z.number().min(0).max(1),
  l3Trigger: import_zod.z.enum(["always", "on_irreversible_action", "on_low_confidence", "never"]),
  requireApproval: import_zod.z.boolean(),
  autoSendThreshold: import_zod.z.number().min(0).max(1)
});
var AgentTemplateActionSchema = import_zod.z.object({
  type: import_zod.z.enum([
    "draft_email",
    "draft_message",
    "draft_ticket",
    "update_crm",
    "create_task",
    "send_notification",
    "generate_report",
    "schedule_meeting"
  ]),
  connector: import_zod.z.string(),
  requiresApproval: import_zod.z.boolean(),
  config: import_zod.z.record(import_zod.z.unknown())
});
var AgentTemplateSchema = import_zod.z.object({
  id: import_zod.z.string(),
  slug: import_zod.z.string(),
  name: import_zod.z.string(),
  description: import_zod.z.string(),
  category: AgentCategorySchema,
  tags: import_zod.z.array(import_zod.z.string()),
  icon: import_zod.z.string(),
  trigger: TriggerConfigSchema,
  fetchSteps: import_zod.z.array(FetchStepSchema),
  prompt: import_zod.z.string(),
  llmTier: LLMTierSchema,
  temperature: import_zod.z.number().min(0).max(1),
  maxStepsPerRun: import_zod.z.number().min(1).max(20),
  evalRules: AgentEvalRulesSchema,
  actions: import_zod.z.array(AgentTemplateActionSchema),
  isActive: import_zod.z.boolean(),
  isPremium: import_zod.z.boolean(),
  version: import_zod.z.number(),
  createdAt: import_zod.z.date(),
  updatedAt: import_zod.z.date()
});
var SignalSchema = import_zod.z.object({
  id: import_zod.z.string(),
  scanResultId: import_zod.z.string(),
  type: import_zod.z.string(),
  category: AgentCategorySchema,
  severity: import_zod.z.enum(["low", "medium", "high", "critical"]),
  source: import_zod.z.string(),
  title: import_zod.z.string(),
  description: import_zod.z.string(),
  metadata: import_zod.z.record(import_zod.z.unknown()),
  suggestedTemplateId: import_zod.z.string().optional(),
  snoozedUntil: import_zod.z.date().optional(),
  createdAt: import_zod.z.date()
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
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
  ElevayError,
  EvalAssertionSchema,
  EvalRulesSchema,
  EvalSeveritySchema,
  FetchStepSchema,
  L1AssertionSchema,
  LLMTierSchema,
  LLM_MODELS,
  LLM_TIERS,
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
});
