/**
 * @elevay/types
 *
 * Shared TypeScript interfaces and types for the Elevay monorepo.
 * All packages import types from here to ensure consistency.
 */

import { z } from "zod";

// ============================================
// IDs
// ============================================

export type WorkspaceId = string;
export type UserId = string;
export type AgentId = string;
export type TemplateId = string;
export type ConversationId = string;
export type MessageId = string;
export type ScanId = string;
export type RunId = string;
export type CredentialId = string;
export type ConnectorId = string;

// ============================================
// LLM Types
// ============================================

export const LLM_TIERS = ["haiku", "sonnet", "opus"] as const;
export type LLMTier = (typeof LLM_TIERS)[number];

export const LLM_MODELS = {
  haiku: "claude-3-5-haiku-20241022",
  sonnet: "claude-sonnet-4-20250514",
  opus: "claude-opus-4-20250514",
} as const;

export interface LLMUsage {
  model: string;
  tier: LLMTier;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  latencyMs: number;
}

export interface LLMEvent extends LLMUsage {
  id: string;
  agentId: AgentId;
  userId: UserId;
  workspaceId: WorkspaceId;
  action: string;
  evalResult: "pass" | "block" | "warn";
  stepsUsed: number;
  timestamp: Date;
}

// ============================================
// Scan Engine Types
// ============================================

export const SCAN_CATEGORIES = [
  "SALES",
  "SUPPORT",
  "MARKETING",
  "HR",
  "FINANCE",
  "PROJECTS",
] as const;
export type ScanCategory = (typeof SCAN_CATEGORIES)[number];

export interface ScanSignal {
  id: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  connectorId: ConnectorId;
  detectedAt: Date;
}

export interface ScanResult {
  id: ScanId;
  workspaceId: WorkspaceId;
  category: ScanCategory;
  signals: ScanSignal[];
  scannedAt: Date;
}

// ============================================
// Agent Types
// ============================================

export const AGENT_TRIGGER_TYPES = [
  "MANUAL",
  "SCHEDULE",
  "WEBHOOK",
  "EMAIL",
  "CHAT",
] as const;
export type AgentTriggerType = (typeof AGENT_TRIGGER_TYPES)[number];

export interface AgentTrigger {
  type: AgentTriggerType;
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface AgentFetchSource {
  source: string;
  provider?: string;
  query?: string;
  dataPoints?: string[];
  limit?: number;
  filters?: Record<string, unknown>;
}

export interface AgentAction {
  id: string;
  type: "API_CALL" | "COMPUTE" | "GENERATE" | "NOTIFICATION" | "WORKFLOW" | "INTERNAL";
  service?: string;
  action?: string;
  description?: string;
  requireApproval?: boolean;
}

// ============================================
// Eval Layer Types
// ============================================

export const EVAL_SEVERITIES = ["block", "warn", "info"] as const;
export type EvalSeverity = (typeof EVAL_SEVERITIES)[number];

export interface L1Assertion {
  check: string;
  severity: EvalSeverity;
  params?: Record<string, unknown>;
}

export interface L2Criteria {
  criteria: string[];
  passingScore: number;
}

export interface L3Trigger {
  triggerConditions: string[];
}

export interface EvalRules {
  l1: {
    assertions: L1Assertion[];
  };
  l2: L2Criteria;
  l3: L3Trigger;
  minConfidence: number;
  autoSendThreshold: number;
  requireApproval: boolean;
}

export interface EvalResult {
  runId: RunId;
  l1Passed: boolean;
  l1Assertions: Array<{
    check: string;
    passed: boolean;
    message?: string;
  }>;
  l2Score: number;
  l2Breakdown: Record<string, number>;
  l3Triggered: boolean;
  l3Blocked?: boolean;
  l3Reason?: string;
  finalDecision: "auto_send" | "needs_review" | "blocked";
}

// ============================================
// Agent Run Types
// ============================================

export interface AgentRunInput {
  agentId: AgentId;
  userId: UserId;
  workspaceId: WorkspaceId;
  triggeredBy: AgentTriggerType | "system";
  context?: Record<string, unknown>;
}

export interface AgentRunOutput {
  id: RunId;
  type: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface AgentRun {
  id: RunId;
  agentId: AgentId;
  userId: UserId;
  workspaceId: WorkspaceId;
  triggeredAt: Date;
  triggeredBy: string;
  dataSources: AgentFetchSource[];
  output?: AgentRunOutput;
  llmUsage: LLMUsage;
  evalResult: EvalResult;
  userAction?: "approved" | "edited" | "rejected";
  draftDiff?: string;
  finalAction?: string;
  finalAt?: Date;
  status: "running" | "pending_review" | "completed" | "failed" | "blocked";
}

// ============================================
// Template Types
// ============================================

export const TEMPLATE_CATEGORIES = [
  "PRODUCTIVITY",
  "SALES",
  "MARKETING",
  "SUPPORT",
  "HR",
  "OPERATIONS",
  "RESEARCH",
  "FINANCE",
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const TEMPLATE_ROLES = [
  "GENERAL",
  "SALES",
  "MARKETING",
  "SUPPORT",
  "HR",
  "OPERATIONS",
  "RESEARCH",
  "FINANCE",
] as const;
export type TemplateRole = (typeof TEMPLATE_ROLES)[number];

export const TEMPLATE_USE_CASES = [
  "AUTOMATION",
  "RESEARCH",
  "CONTENT_CREATION",
  "OUTREACH",
  "MONITORING",
  "ANALYSIS",
  "SCHEDULING",
  "DATA_PROCESSING",
] as const;
export type TemplateUseCase = (typeof TEMPLATE_USE_CASES)[number];

export interface AgentTemplateV6 {
  id: TemplateId;
  name: string;
  subtitle: string;
  description: string;
  systemPrompt: string;

  // LLM Config
  llmTier: LLMTier;
  temperature: number;
  maxStepsPerRun: number;

  // Categorization
  category: TemplateCategory;
  role?: TemplateRole;
  useCase?: TemplateUseCase;

  // UI
  icon: string;
  color?: string;

  // Triggers
  triggers: AgentTrigger[];

  // Data Sources
  fetchSources: AgentFetchSource[];

  // Actions
  actions: AgentAction[];

  // Eval Rules
  evalRules: EvalRules;

  // Suggested Integrations (Pipedream Connect)
  suggestedIntegrations: string[];

  // Visibility
  isPublic: boolean;
  isFeatured?: boolean;
}

// ============================================
// Connector Types
// ============================================

export const CONNECTOR_CATEGORIES = [
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
  "ANALYTICS",
] as const;
export type ConnectorCategory = (typeof CONNECTOR_CATEGORIES)[number];

export interface ConnectorConfig {
  id: ConnectorId;
  name: string;
  category: ConnectorCategory;
  provider: string;
  pipedreamAppSlug?: string;
  requiredScopes: string[];
  optionalScopes?: string[];
}

export interface ConnectorCredentials {
  id: CredentialId;
  connectorId: ConnectorId;
  workspaceId: WorkspaceId;
  userId: UserId;
  encryptedData: string;
  expiresAt?: Date;
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectorAction {
  id: string;
  name: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
}

export interface ConnectorTrigger {
  id: string;
  name: string;
  description: string;
  outputSchema: z.ZodType;
}

// ============================================
// Error Types
// ============================================

export class ElevayError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ElevayError";
  }
}

export class ScanError extends ElevayError {
  constructor(
    public signalId: string,
    public connectorId: string,
    message: string
  ) {
    super(`Scan failed on signal ${signalId} via ${connectorId}: ${message}`, "SCAN_ERROR", {
      signalId,
      connectorId,
    });
    this.name = "ScanError";
  }
}

export class AgentExecutionError extends ElevayError {
  constructor(
    public agentId: string,
    public runId: string,
    message: string
  ) {
    super(`Agent ${agentId} execution failed (run: ${runId}): ${message}`, "AGENT_EXECUTION_ERROR", {
      agentId,
      runId,
    });
    this.name = "AgentExecutionError";
  }
}

export class ConnectorError extends ElevayError {
  constructor(
    public connectorId: string,
    public action: string,
    message: string
  ) {
    super(`Connector ${connectorId} failed on ${action}: ${message}`, "CONNECTOR_ERROR", {
      connectorId,
      action,
    });
    this.name = "ConnectorError";
  }
}

export class CredentialError extends ElevayError {
  constructor(
    public credentialId: string,
    message: string
  ) {
    super(`Credential ${credentialId} error: ${message}`, "CREDENTIAL_ERROR", {
      credentialId,
    });
    this.name = "CredentialError";
  }
}

export class PermissionError extends ElevayError {
  constructor(
    public userId: string,
    public resource: string,
    public action: string
  ) {
    super(
      `User ${userId} does not have permission to ${action} on ${resource}`,
      "PERMISSION_ERROR",
      { userId, resource, action }
    );
    this.name = "PermissionError";
  }
}

export class ConfigError extends ElevayError {
  constructor(
    public envVar: string,
    message: string
  ) {
    super(`Configuration error for ${envVar}: ${message}`, "CONFIG_ERROR", { envVar });
    this.name = "ConfigError";
  }
}

// ============================================
// Auth Types
// ============================================

export interface Authenticator {
  userId: UserId;
  workspaceId: WorkspaceId;
  role: "owner" | "admin" | "member" | "viewer";
  canAccess(resourceWorkspaceId: WorkspaceId): boolean;
  canWrite(resourceWorkspaceId: WorkspaceId): boolean;
  canDelete(resourceWorkspaceId: WorkspaceId): boolean;
}

// ============================================
// Zod Schemas (for runtime validation)
// ============================================

export const LLMTierSchema = z.enum(LLM_TIERS);
export const ScanCategorySchema = z.enum(SCAN_CATEGORIES);
export const AgentTriggerTypeSchema = z.enum(AGENT_TRIGGER_TYPES);
export const EvalSeveritySchema = z.enum(EVAL_SEVERITIES);
export const TemplateCategorySchema = z.enum(TEMPLATE_CATEGORIES);
export const TemplateRoleSchema = z.enum(TEMPLATE_ROLES);
export const TemplateUseCaseSchema = z.enum(TEMPLATE_USE_CASES);
export const ConnectorCategorySchema = z.enum(CONNECTOR_CATEGORIES);

export const ScanSignalSchema = z.object({
  id: z.string(),
  type: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  title: z.string(),
  description: z.string(),
  metadata: z.record(z.unknown()),
  connectorId: z.string(),
  detectedAt: z.date(),
});

export const L1AssertionSchema = z.object({
  check: z.string(),
  severity: EvalSeveritySchema,
  params: z.record(z.unknown()).optional(),
});

export const EvalRulesSchema = z.object({
  l1: z.object({
    assertions: z.array(L1AssertionSchema),
  }),
  l2: z.object({
    criteria: z.array(z.string()),
    passingScore: z.number().min(0).max(1),
  }),
  l3: z.object({
    triggerConditions: z.array(z.string()),
  }),
  minConfidence: z.number().min(0).max(1),
  autoSendThreshold: z.number().min(0).max(1),
  requireApproval: z.boolean(),
});

export const AgentFetchSourceSchema = z.object({
  source: z.string(),
  provider: z.string().optional(),
  query: z.string().optional(),
  dataPoints: z.array(z.string()).optional(),
  limit: z.number().optional(),
  filters: z.record(z.unknown()).optional(),
});

export const AgentActionSchema = z.object({
  id: z.string(),
  type: z.enum(["API_CALL", "COMPUTE", "GENERATE", "NOTIFICATION", "WORKFLOW", "INTERNAL"]),
  service: z.string().optional(),
  action: z.string().optional(),
  description: z.string().optional(),
  requireApproval: z.boolean().optional(),
});

export const AgentTriggerSchema = z.object({
  type: AgentTriggerTypeSchema,
  config: z.record(z.unknown()),
  enabled: z.boolean(),
});

// ============================================
// Agent Template V6 (Dust-inspired)
// ============================================

/**
 * AgentTemplate - Template d'agent pré-configuré (inspiré de Dust AgentConfigurationType)
 *
 * Contrairement à Dust où l'user crée ses agents from scratch,
 * Elevay propose des templates pré-configurés prêts à l'emploi pour les PME.
 */
export interface AgentTemplate {
  id: string;                      // nanoid, ex: "tmpl_kx7Gh2p"
  slug: string;                    // kebab-case, ex: "relance-client-inactif"
  name: string;                    // ex: "Relance client inactif"
  description: string;             // Description longue
  category: AgentCategory;         // Catégorie métier
  tags: string[];                  // ex: ['churn', 'email', 'hubspot']
  icon: string;                    // emoji ou icon name

  // Trigger - Ce qui déclenche l'agent
  trigger: TriggerConfig;

  // Fetch - D'où l'agent récupère ses données (via Pipedream Connect)
  fetchSteps: FetchStep[];

  // LLM Config
  prompt: string;                  // System prompt du template
  llmTier: LLMTier;               // 'haiku' | 'sonnet' | 'opus'
  temperature: number;             // 0.0 à 1.0
  maxStepsPerRun: number;          // Guard-rail coût (default: 5)

  // Eval - Règles d'évaluation L1/L2/L3
  evalRules: AgentEvalRules;

  // Actions - Ce que l'agent produit
  actions: AgentTemplateAction[];

  // Meta
  isActive: boolean;
  isPremium: boolean;              // Réservé aux plans payants
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export type AgentCategory =
  | "sales"
  | "support"
  | "marketing"
  | "hr"
  | "finance"
  | "operations";

/**
 * TriggerConfig - Configuration du déclencheur
 */
export interface TriggerConfig {
  type: "scan_signal" | "schedule" | "manual" | "webhook" | "email";
  schedule?: string;               // Cron expression pour schedule, ex: "0 9 * * *"
  signalTypes?: string[];          // Types de signaux pour scan_signal
  webhookPath?: string;            // Path pour webhook
  config?: Record<string, unknown>;
}

/**
 * FetchStep - Source de données à fetcher (via Pipedream Connect)
 */
export interface FetchStep {
  connector: string;               // 'hubspot' | 'gmail' | 'zendesk' | etc.
  action: string;                  // Action Pipedream, ex: 'get_inactive_deals'
  params: Record<string, unknown>; // Paramètres de l'action
  outputKey?: string;              // Clé pour stocker le résultat
}

/**
 * AgentEvalRules - Règles d'évaluation (inspiré du pattern L1/L2/L3)
 */
export interface AgentEvalRules {
  assertions: EvalAssertion[];     // L1 checks déterministes
  minConfidence: number;           // Seuil L2 (0.0 à 1.0)
  l3Trigger: "always" | "on_irreversible_action" | "on_low_confidence" | "never";
  requireApproval: boolean;
  autoSendThreshold: number;       // Seuil pour auto-send (0.0 à 1.0)
}

export interface EvalAssertion {
  check: string;                   // ex: "contains_recipient_name", "no_placeholders"
  severity: "block" | "warn";      // block = échec, warn = avertissement
  message?: string;                // Message d'erreur personnalisé
}

/**
 * AgentTemplateAction - Action que l'agent peut exécuter
 */
export type AgentActionType =
  | "draft_email"           // Prépare un email (approval required)
  | "draft_message"         // Prépare un message Slack/Teams
  | "draft_ticket"          // Prépare un ticket support
  | "update_crm"            // Met à jour un champ CRM (approval required)
  | "create_task"           // Crée une tâche dans le CRM/PM tool
  | "send_notification"     // Notification interne
  | "generate_report"       // Génère un rapport/synthèse
  | "schedule_meeting";     // Propose un créneau (calendar)

export interface AgentTemplateAction {
  type: AgentActionType;
  connector: string;               // 'hubspot' | 'gmail' | 'zendesk' | 'slack' | etc.
  requiresApproval: boolean;
  config: Record<string, unknown>;
}

// ============================================
// Agent Execution (Instance d'exécution)
// ============================================

/**
 * AgentExecution - Une instance d'exécution d'un template
 */
export interface AgentExecution {
  id: string;
  templateId: string;
  workspaceId: string;
  userId: string;
  status: AgentExecutionStatus;

  // Input
  triggerSignal?: Signal;          // Le signal qui a déclenché l'exécution
  fetchedData: Record<string, unknown>;

  // Output
  draft?: AgentDraft;
  output?: Record<string, unknown>;

  // Tracking
  stepsUsed: number;
  maxStepsAllowed: number;
  aiEvents: string[];              // IDs des AiEvent liés

  // Timing
  startedAt: Date;
  completedAt?: Date;

  // Error
  error?: ExecutionError;
}

export type AgentExecutionStatus =
  | "pending"
  | "running"
  | "waiting_approval"
  | "approved"
  | "rejected"
  | "completed"
  | "failed";

export interface AgentDraft {
  type: AgentActionType;
  content: string;
  metadata: Record<string, unknown>;
  editedContent?: string;          // Si l'user a modifié le draft
}

export interface ExecutionError {
  type: "scan" | "agent" | "connector" | "credential" | "eval" | "timeout";
  message: string;
  context: Record<string, unknown>;
}

// ============================================
// Signal & Scan (inspiré de Dust + adapté PME)
// ============================================

export type SignalCategory = AgentCategory;
export type SignalSeverity = "low" | "medium" | "high" | "critical";

/**
 * Signal - Un signal détecté par le scan
 */
export interface Signal {
  id: string;
  scanResultId: string;
  type: string;                    // ex: 'deal_stuck', 'ticket_escalation', 'churn_risk'
  category: SignalCategory;
  severity: SignalSeverity;
  source: string;                  // ex: 'hubspot', 'zendesk'
  title: string;                   // ex: "Deal Acme Corp bloqué depuis 15 jours"
  description: string;
  metadata: Record<string, unknown>;
  suggestedTemplateId?: string;    // Le template qui peut traiter ce signal
  snoozedUntil?: Date;
  createdAt: Date;
}

// ============================================
// Connector (Pipedream Connect wrapper)
// ============================================

export type ConnectorType =
  | "hubspot"
  | "gmail"
  | "zendesk"
  | "stripe"
  | "pipedrive"
  | "calendar"
  | "slack"
  | "notion"
  | "asana"
  | "salesforce"
  | "freshdesk"
  | "mailchimp";

export type ConnectorStatus = "connected" | "disconnected" | "error" | "syncing";

export interface Connector {
  id: string;
  workspaceId: string;
  type: ConnectorType;
  status: ConnectorStatus;
  lastSyncAt?: Date;
  credentialId: string;
  config: Record<string, unknown>;
  error?: string;
}

// ============================================
// AI Event Logging (inspiré n8n)
// ============================================

/**
 * AiEvent - Log de chaque appel LLM
 */
export interface AiEvent {
  id: string;
  agentExecutionId: string;
  templateId: string;
  userId: string;
  workspaceId: string;
  model: LLMTier;
  tokensIn: number;
  tokensOut: number;
  cost: number;                    // en euros
  latencyMs: number;
  action: AiEventAction;
  evalResult?: {
    l1Pass: boolean;
    l2Score: number;
    l3Verdict?: "pass" | "fail" | "retry";
  };
  createdAt: Date;
}

export type AiEventAction =
  | "generate_draft"
  | "eval_l3"
  | "style_learner"
  | "summarize"
  | "extract";

// ============================================
// Workspace & User
// ============================================

export type WorkspacePlan = "free" | "starter" | "pro" | "business";
export type UserRole = "owner" | "admin" | "member";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: WorkspacePlan;
  credits: number;
  createdAt: Date;
}

export interface WorkspaceUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  workspaceId: string;
  avatarUrl?: string;
  createdAt: Date;
}

// ============================================
// Encrypted Credential (AES-256)
// ============================================

export interface EncryptedCredential {
  id: string;
  connectorId: string;
  type: "oauth2" | "api_key" | "basic_auth";
  encryptedData: string;           // AES-256-GCM chiffré, JAMAIS en clair
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Zod Schemas additionnels
// ============================================

export const AgentCategorySchema = z.enum([
  "sales",
  "support",
  "marketing",
  "hr",
  "finance",
  "operations",
]);

export const TriggerConfigSchema = z.object({
  type: z.enum(["scan_signal", "schedule", "manual", "webhook", "email"]),
  schedule: z.string().optional(),
  signalTypes: z.array(z.string()).optional(),
  webhookPath: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});

export const FetchStepSchema = z.object({
  connector: z.string(),
  action: z.string(),
  params: z.record(z.unknown()),
  outputKey: z.string().optional(),
});

export const EvalAssertionSchema = z.object({
  check: z.string(),
  severity: z.enum(["block", "warn"]),
  message: z.string().optional(),
});

export const AgentEvalRulesSchema = z.object({
  assertions: z.array(EvalAssertionSchema),
  minConfidence: z.number().min(0).max(1),
  l3Trigger: z.enum(["always", "on_irreversible_action", "on_low_confidence", "never"]),
  requireApproval: z.boolean(),
  autoSendThreshold: z.number().min(0).max(1),
});

export const AgentTemplateActionSchema = z.object({
  type: z.enum([
    "draft_email",
    "draft_message",
    "draft_ticket",
    "update_crm",
    "create_task",
    "send_notification",
    "generate_report",
    "schedule_meeting",
  ]),
  connector: z.string(),
  requiresApproval: z.boolean(),
  config: z.record(z.unknown()),
});

export const AgentTemplateSchema = z.object({
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
  updatedAt: z.date(),
});

export const SignalSchema = z.object({
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
  createdAt: z.date(),
});

// ============================================
// Job Queue Types (BullMQ)
// ============================================

/**
 * Base type for job data in BullMQ queues.
 */
export interface JobData {
  [key: string]: unknown;
}

/**
 * Base type for job results.
 */
export interface JobResult {
  [key: string]: unknown;
}

/**
 * Job options for BullMQ.
 */
export interface JobOptions {
  attempts?: number;
  backoff?: {
    type: "exponential" | "fixed";
    delay: number;
  };
  delay?: number;
  priority?: number;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
  timeout?: number;
}
