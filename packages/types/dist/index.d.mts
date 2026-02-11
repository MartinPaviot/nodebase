import { z } from 'zod';

/**
 * @nodebase/types
 *
 * Shared TypeScript interfaces and types for the Nodebase monorepo.
 * All packages import types from here to ensure consistency.
 */

type WorkspaceId = string;
type UserId = string;
type AgentId = string;
type TemplateId = string;
type ConversationId = string;
type MessageId = string;
type ScanId = string;
type RunId = string;
type CredentialId = string;
type ConnectorId = string;
declare const LLM_TIERS: readonly ["haiku", "sonnet", "opus"];
type LLMTier = (typeof LLM_TIERS)[number];
declare const LLM_MODELS: {
    readonly haiku: "claude-3-5-haiku-20241022";
    readonly sonnet: "claude-sonnet-4-20250514";
    readonly opus: "claude-opus-4-20250514";
};
interface LLMUsage {
    model: string;
    tier: LLMTier;
    tokensIn: number;
    tokensOut: number;
    cost: number;
    latencyMs: number;
}
interface LLMEvent extends LLMUsage {
    id: string;
    agentId: AgentId;
    userId: UserId;
    workspaceId: WorkspaceId;
    action: string;
    evalResult: "pass" | "block" | "warn";
    stepsUsed: number;
    timestamp: Date;
}
declare const SCAN_CATEGORIES: readonly ["SALES", "SUPPORT", "MARKETING", "HR", "FINANCE", "PROJECTS"];
type ScanCategory = (typeof SCAN_CATEGORIES)[number];
interface ScanSignal {
    id: string;
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    description: string;
    metadata: Record<string, unknown>;
    connectorId: ConnectorId;
    detectedAt: Date;
}
interface ScanResult {
    id: ScanId;
    workspaceId: WorkspaceId;
    category: ScanCategory;
    signals: ScanSignal[];
    scannedAt: Date;
}
declare const AGENT_TRIGGER_TYPES: readonly ["MANUAL", "SCHEDULE", "WEBHOOK", "EMAIL", "CHAT"];
type AgentTriggerType = (typeof AGENT_TRIGGER_TYPES)[number];
interface AgentTrigger {
    type: AgentTriggerType;
    config: Record<string, unknown>;
    enabled: boolean;
}
interface AgentFetchSource {
    source: string;
    provider?: string;
    query?: string;
    dataPoints?: string[];
    limit?: number;
    filters?: Record<string, unknown>;
}
interface AgentAction {
    id: string;
    type: "API_CALL" | "COMPUTE" | "GENERATE" | "NOTIFICATION" | "WORKFLOW" | "INTERNAL";
    service?: string;
    action?: string;
    description?: string;
    requireApproval?: boolean;
}
declare const EVAL_SEVERITIES: readonly ["block", "warn", "info"];
type EvalSeverity = (typeof EVAL_SEVERITIES)[number];
interface L1Assertion {
    check: string;
    severity: EvalSeverity;
    params?: Record<string, unknown>;
}
interface L2Criteria {
    criteria: string[];
    passingScore: number;
}
interface L3Trigger {
    triggerConditions: string[];
}
interface EvalRules {
    l1: {
        assertions: L1Assertion[];
    };
    l2: L2Criteria;
    l3: L3Trigger;
    minConfidence: number;
    autoSendThreshold: number;
    requireApproval: boolean;
}
interface EvalResult {
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
interface AgentRunInput {
    agentId: AgentId;
    userId: UserId;
    workspaceId: WorkspaceId;
    triggeredBy: AgentTriggerType | "system";
    context?: Record<string, unknown>;
}
interface AgentRunOutput {
    id: RunId;
    type: string;
    content: string;
    metadata?: Record<string, unknown>;
}
interface AgentRun {
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
declare const TEMPLATE_CATEGORIES: readonly ["PRODUCTIVITY", "SALES", "MARKETING", "SUPPORT", "HR", "OPERATIONS", "RESEARCH", "FINANCE"];
type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
declare const TEMPLATE_ROLES: readonly ["GENERAL", "SALES", "MARKETING", "SUPPORT", "HR", "OPERATIONS", "RESEARCH", "FINANCE"];
type TemplateRole = (typeof TEMPLATE_ROLES)[number];
declare const TEMPLATE_USE_CASES: readonly ["AUTOMATION", "RESEARCH", "CONTENT_CREATION", "OUTREACH", "MONITORING", "ANALYSIS", "SCHEDULING", "DATA_PROCESSING"];
type TemplateUseCase = (typeof TEMPLATE_USE_CASES)[number];
interface AgentTemplateV6 {
    id: TemplateId;
    name: string;
    subtitle: string;
    description: string;
    systemPrompt: string;
    llmTier: LLMTier;
    temperature: number;
    maxStepsPerRun: number;
    category: TemplateCategory;
    role?: TemplateRole;
    useCase?: TemplateUseCase;
    icon: string;
    color?: string;
    triggers: AgentTrigger[];
    fetchSources: AgentFetchSource[];
    actions: AgentAction[];
    evalRules: EvalRules;
    suggestedIntegrations: string[];
    isPublic: boolean;
    isFeatured?: boolean;
}
declare const CONNECTOR_CATEGORIES: readonly ["CRM", "SUPPORT", "EMAIL", "CALENDAR", "MARKETING", "HR", "FINANCE", "PROJECTS", "MESSAGING", "STORAGE", "ANALYTICS"];
type ConnectorCategory = (typeof CONNECTOR_CATEGORIES)[number];
interface ConnectorConfig {
    id: ConnectorId;
    name: string;
    category: ConnectorCategory;
    provider: string;
    pipedreamAppSlug?: string;
    requiredScopes: string[];
    optionalScopes?: string[];
}
interface ConnectorCredentials {
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
interface ConnectorAction {
    id: string;
    name: string;
    description: string;
    inputSchema: z.ZodType;
    outputSchema: z.ZodType;
}
interface ConnectorTrigger {
    id: string;
    name: string;
    description: string;
    outputSchema: z.ZodType;
}
declare class NodebaseError extends Error {
    code: string;
    context?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, context?: Record<string, unknown> | undefined);
}
declare class ScanError extends NodebaseError {
    signalId: string;
    connectorId: string;
    constructor(signalId: string, connectorId: string, message: string);
}
declare class AgentExecutionError extends NodebaseError {
    agentId: string;
    runId: string;
    constructor(agentId: string, runId: string, message: string);
}
declare class ConnectorError extends NodebaseError {
    connectorId: string;
    action: string;
    constructor(connectorId: string, action: string, message: string);
}
declare class CredentialError extends NodebaseError {
    credentialId: string;
    constructor(credentialId: string, message: string);
}
declare class PermissionError extends NodebaseError {
    userId: string;
    resource: string;
    action: string;
    constructor(userId: string, resource: string, action: string);
}
declare class ConfigError extends NodebaseError {
    envVar: string;
    constructor(envVar: string, message: string);
}
interface Authenticator {
    userId: UserId;
    workspaceId: WorkspaceId;
    role: "owner" | "admin" | "member" | "viewer";
    canAccess(resourceWorkspaceId: WorkspaceId): boolean;
    canWrite(resourceWorkspaceId: WorkspaceId): boolean;
    canDelete(resourceWorkspaceId: WorkspaceId): boolean;
}
declare const LLMTierSchema: z.ZodEnum<["haiku", "sonnet", "opus"]>;
declare const ScanCategorySchema: z.ZodEnum<["SALES", "SUPPORT", "MARKETING", "HR", "FINANCE", "PROJECTS"]>;
declare const AgentTriggerTypeSchema: z.ZodEnum<["MANUAL", "SCHEDULE", "WEBHOOK", "EMAIL", "CHAT"]>;
declare const EvalSeveritySchema: z.ZodEnum<["block", "warn", "info"]>;
declare const TemplateCategorySchema: z.ZodEnum<["PRODUCTIVITY", "SALES", "MARKETING", "SUPPORT", "HR", "OPERATIONS", "RESEARCH", "FINANCE"]>;
declare const TemplateRoleSchema: z.ZodEnum<["GENERAL", "SALES", "MARKETING", "SUPPORT", "HR", "OPERATIONS", "RESEARCH", "FINANCE"]>;
declare const TemplateUseCaseSchema: z.ZodEnum<["AUTOMATION", "RESEARCH", "CONTENT_CREATION", "OUTREACH", "MONITORING", "ANALYSIS", "SCHEDULING", "DATA_PROCESSING"]>;
declare const ConnectorCategorySchema: z.ZodEnum<["CRM", "SUPPORT", "EMAIL", "CALENDAR", "MARKETING", "HR", "FINANCE", "PROJECTS", "MESSAGING", "STORAGE", "ANALYTICS"]>;
declare const ScanSignalSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
    title: z.ZodString;
    description: z.ZodString;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    connectorId: z.ZodString;
    detectedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    connectorId: string;
    id: string;
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    description: string;
    metadata: Record<string, unknown>;
    detectedAt: Date;
}, {
    connectorId: string;
    id: string;
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    description: string;
    metadata: Record<string, unknown>;
    detectedAt: Date;
}>;
declare const L1AssertionSchema: z.ZodObject<{
    check: z.ZodString;
    severity: z.ZodEnum<["block", "warn", "info"]>;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    severity: "block" | "warn" | "info";
    check: string;
    params?: Record<string, unknown> | undefined;
}, {
    severity: "block" | "warn" | "info";
    check: string;
    params?: Record<string, unknown> | undefined;
}>;
declare const EvalRulesSchema: z.ZodObject<{
    l1: z.ZodObject<{
        assertions: z.ZodArray<z.ZodObject<{
            check: z.ZodString;
            severity: z.ZodEnum<["block", "warn", "info"]>;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, "strip", z.ZodTypeAny, {
            severity: "block" | "warn" | "info";
            check: string;
            params?: Record<string, unknown> | undefined;
        }, {
            severity: "block" | "warn" | "info";
            check: string;
            params?: Record<string, unknown> | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        assertions: {
            severity: "block" | "warn" | "info";
            check: string;
            params?: Record<string, unknown> | undefined;
        }[];
    }, {
        assertions: {
            severity: "block" | "warn" | "info";
            check: string;
            params?: Record<string, unknown> | undefined;
        }[];
    }>;
    l2: z.ZodObject<{
        criteria: z.ZodArray<z.ZodString, "many">;
        passingScore: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        criteria: string[];
        passingScore: number;
    }, {
        criteria: string[];
        passingScore: number;
    }>;
    l3: z.ZodObject<{
        triggerConditions: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        triggerConditions: string[];
    }, {
        triggerConditions: string[];
    }>;
    minConfidence: z.ZodNumber;
    autoSendThreshold: z.ZodNumber;
    requireApproval: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    l1: {
        assertions: {
            severity: "block" | "warn" | "info";
            check: string;
            params?: Record<string, unknown> | undefined;
        }[];
    };
    l2: {
        criteria: string[];
        passingScore: number;
    };
    l3: {
        triggerConditions: string[];
    };
    minConfidence: number;
    autoSendThreshold: number;
    requireApproval: boolean;
}, {
    l1: {
        assertions: {
            severity: "block" | "warn" | "info";
            check: string;
            params?: Record<string, unknown> | undefined;
        }[];
    };
    l2: {
        criteria: string[];
        passingScore: number;
    };
    l3: {
        triggerConditions: string[];
    };
    minConfidence: number;
    autoSendThreshold: number;
    requireApproval: boolean;
}>;
declare const AgentFetchSourceSchema: z.ZodObject<{
    source: z.ZodString;
    provider: z.ZodOptional<z.ZodString>;
    query: z.ZodOptional<z.ZodString>;
    dataPoints: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    limit: z.ZodOptional<z.ZodNumber>;
    filters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    source: string;
    provider?: string | undefined;
    query?: string | undefined;
    dataPoints?: string[] | undefined;
    limit?: number | undefined;
    filters?: Record<string, unknown> | undefined;
}, {
    source: string;
    provider?: string | undefined;
    query?: string | undefined;
    dataPoints?: string[] | undefined;
    limit?: number | undefined;
    filters?: Record<string, unknown> | undefined;
}>;
declare const AgentActionSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["API_CALL", "COMPUTE", "GENERATE", "NOTIFICATION", "WORKFLOW", "INTERNAL"]>;
    service: z.ZodOptional<z.ZodString>;
    action: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    requireApproval: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: "API_CALL" | "COMPUTE" | "GENERATE" | "NOTIFICATION" | "WORKFLOW" | "INTERNAL";
    action?: string | undefined;
    description?: string | undefined;
    requireApproval?: boolean | undefined;
    service?: string | undefined;
}, {
    id: string;
    type: "API_CALL" | "COMPUTE" | "GENERATE" | "NOTIFICATION" | "WORKFLOW" | "INTERNAL";
    action?: string | undefined;
    description?: string | undefined;
    requireApproval?: boolean | undefined;
    service?: string | undefined;
}>;
declare const AgentTriggerSchema: z.ZodObject<{
    type: z.ZodEnum<["MANUAL", "SCHEDULE", "WEBHOOK", "EMAIL", "CHAT"]>;
    config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    enabled: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    type: "MANUAL" | "SCHEDULE" | "WEBHOOK" | "EMAIL" | "CHAT";
    config: Record<string, unknown>;
    enabled: boolean;
}, {
    type: "MANUAL" | "SCHEDULE" | "WEBHOOK" | "EMAIL" | "CHAT";
    config: Record<string, unknown>;
    enabled: boolean;
}>;
/**
 * AgentTemplate - Template d'agent pré-configuré (inspiré de Dust AgentConfigurationType)
 *
 * Contrairement à Dust où l'user crée ses agents from scratch,
 * Nodebase propose des templates pré-configurés prêts à l'emploi pour les PME.
 */
interface AgentTemplate {
    id: string;
    slug: string;
    name: string;
    description: string;
    category: AgentCategory;
    tags: string[];
    icon: string;
    trigger: TriggerConfig;
    fetchSteps: FetchStep[];
    prompt: string;
    llmTier: LLMTier;
    temperature: number;
    maxStepsPerRun: number;
    evalRules: AgentEvalRules;
    actions: AgentTemplateAction[];
    isActive: boolean;
    isPremium: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}
type AgentCategory = "sales" | "support" | "marketing" | "hr" | "finance" | "operations";
/**
 * TriggerConfig - Configuration du déclencheur
 */
interface TriggerConfig {
    type: "scan_signal" | "schedule" | "manual" | "webhook" | "email";
    schedule?: string;
    signalTypes?: string[];
    webhookPath?: string;
    config?: Record<string, unknown>;
}
/**
 * FetchStep - Source de données à fetcher (via Pipedream Connect)
 */
interface FetchStep {
    connector: string;
    action: string;
    params: Record<string, unknown>;
    outputKey?: string;
}
/**
 * AgentEvalRules - Règles d'évaluation (inspiré du pattern L1/L2/L3)
 */
interface AgentEvalRules {
    assertions: EvalAssertion[];
    minConfidence: number;
    l3Trigger: "always" | "on_irreversible_action" | "on_low_confidence" | "never";
    requireApproval: boolean;
    autoSendThreshold: number;
}
interface EvalAssertion {
    check: string;
    severity: "block" | "warn";
    message?: string;
}
/**
 * AgentTemplateAction - Action que l'agent peut exécuter
 */
type AgentActionType = "draft_email" | "draft_message" | "draft_ticket" | "update_crm" | "create_task" | "send_notification" | "generate_report" | "schedule_meeting";
interface AgentTemplateAction {
    type: AgentActionType;
    connector: string;
    requiresApproval: boolean;
    config: Record<string, unknown>;
}
/**
 * AgentExecution - Une instance d'exécution d'un template
 */
interface AgentExecution {
    id: string;
    templateId: string;
    workspaceId: string;
    userId: string;
    status: AgentExecutionStatus;
    triggerSignal?: Signal;
    fetchedData: Record<string, unknown>;
    draft?: AgentDraft;
    output?: Record<string, unknown>;
    stepsUsed: number;
    maxStepsAllowed: number;
    aiEvents: string[];
    startedAt: Date;
    completedAt?: Date;
    error?: ExecutionError;
}
type AgentExecutionStatus = "pending" | "running" | "waiting_approval" | "approved" | "rejected" | "completed" | "failed";
interface AgentDraft {
    type: AgentActionType;
    content: string;
    metadata: Record<string, unknown>;
    editedContent?: string;
}
interface ExecutionError {
    type: "scan" | "agent" | "connector" | "credential" | "eval" | "timeout";
    message: string;
    context: Record<string, unknown>;
}
type SignalCategory = AgentCategory;
type SignalSeverity = "low" | "medium" | "high" | "critical";
/**
 * Signal - Un signal détecté par le scan
 */
interface Signal {
    id: string;
    scanResultId: string;
    type: string;
    category: SignalCategory;
    severity: SignalSeverity;
    source: string;
    title: string;
    description: string;
    metadata: Record<string, unknown>;
    suggestedTemplateId?: string;
    snoozedUntil?: Date;
    createdAt: Date;
}
type ConnectorType = "hubspot" | "gmail" | "zendesk" | "stripe" | "pipedrive" | "calendar" | "slack" | "notion" | "asana" | "salesforce" | "freshdesk" | "mailchimp";
type ConnectorStatus = "connected" | "disconnected" | "error" | "syncing";
interface Connector {
    id: string;
    workspaceId: string;
    type: ConnectorType;
    status: ConnectorStatus;
    lastSyncAt?: Date;
    credentialId: string;
    config: Record<string, unknown>;
    error?: string;
}
/**
 * AiEvent - Log de chaque appel LLM
 */
interface AiEvent {
    id: string;
    agentExecutionId: string;
    templateId: string;
    userId: string;
    workspaceId: string;
    model: LLMTier;
    tokensIn: number;
    tokensOut: number;
    cost: number;
    latencyMs: number;
    action: AiEventAction;
    evalResult?: {
        l1Pass: boolean;
        l2Score: number;
        l3Verdict?: "pass" | "fail" | "retry";
    };
    createdAt: Date;
}
type AiEventAction = "generate_draft" | "eval_l3" | "style_learner" | "summarize" | "extract";
type WorkspacePlan = "free" | "starter" | "pro" | "business";
type UserRole = "owner" | "admin" | "member";
interface Workspace {
    id: string;
    name: string;
    slug: string;
    plan: WorkspacePlan;
    credits: number;
    createdAt: Date;
}
interface WorkspaceUser {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    workspaceId: string;
    avatarUrl?: string;
    createdAt: Date;
}
interface EncryptedCredential {
    id: string;
    connectorId: string;
    type: "oauth2" | "api_key" | "basic_auth";
    encryptedData: string;
    createdAt: Date;
    updatedAt: Date;
}
declare const AgentCategorySchema: z.ZodEnum<["sales", "support", "marketing", "hr", "finance", "operations"]>;
declare const TriggerConfigSchema: z.ZodObject<{
    type: z.ZodEnum<["scan_signal", "schedule", "manual", "webhook", "email"]>;
    schedule: z.ZodOptional<z.ZodString>;
    signalTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    webhookPath: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    type: "scan_signal" | "schedule" | "manual" | "webhook" | "email";
    config?: Record<string, unknown> | undefined;
    schedule?: string | undefined;
    signalTypes?: string[] | undefined;
    webhookPath?: string | undefined;
}, {
    type: "scan_signal" | "schedule" | "manual" | "webhook" | "email";
    config?: Record<string, unknown> | undefined;
    schedule?: string | undefined;
    signalTypes?: string[] | undefined;
    webhookPath?: string | undefined;
}>;
declare const FetchStepSchema: z.ZodObject<{
    connector: z.ZodString;
    action: z.ZodString;
    params: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    outputKey: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: string;
    params: Record<string, unknown>;
    connector: string;
    outputKey?: string | undefined;
}, {
    action: string;
    params: Record<string, unknown>;
    connector: string;
    outputKey?: string | undefined;
}>;
declare const EvalAssertionSchema: z.ZodObject<{
    check: z.ZodString;
    severity: z.ZodEnum<["block", "warn"]>;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    severity: "block" | "warn";
    check: string;
    message?: string | undefined;
}, {
    severity: "block" | "warn";
    check: string;
    message?: string | undefined;
}>;
declare const AgentEvalRulesSchema: z.ZodObject<{
    assertions: z.ZodArray<z.ZodObject<{
        check: z.ZodString;
        severity: z.ZodEnum<["block", "warn"]>;
        message: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        severity: "block" | "warn";
        check: string;
        message?: string | undefined;
    }, {
        severity: "block" | "warn";
        check: string;
        message?: string | undefined;
    }>, "many">;
    minConfidence: z.ZodNumber;
    l3Trigger: z.ZodEnum<["always", "on_irreversible_action", "on_low_confidence", "never"]>;
    requireApproval: z.ZodBoolean;
    autoSendThreshold: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    assertions: {
        severity: "block" | "warn";
        check: string;
        message?: string | undefined;
    }[];
    minConfidence: number;
    autoSendThreshold: number;
    requireApproval: boolean;
    l3Trigger: "never" | "always" | "on_irreversible_action" | "on_low_confidence";
}, {
    assertions: {
        severity: "block" | "warn";
        check: string;
        message?: string | undefined;
    }[];
    minConfidence: number;
    autoSendThreshold: number;
    requireApproval: boolean;
    l3Trigger: "never" | "always" | "on_irreversible_action" | "on_low_confidence";
}>;
declare const AgentTemplateActionSchema: z.ZodObject<{
    type: z.ZodEnum<["draft_email", "draft_message", "draft_ticket", "update_crm", "create_task", "send_notification", "generate_report", "schedule_meeting"]>;
    connector: z.ZodString;
    requiresApproval: z.ZodBoolean;
    config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    type: "draft_email" | "draft_message" | "draft_ticket" | "update_crm" | "create_task" | "send_notification" | "generate_report" | "schedule_meeting";
    config: Record<string, unknown>;
    connector: string;
    requiresApproval: boolean;
}, {
    type: "draft_email" | "draft_message" | "draft_ticket" | "update_crm" | "create_task" | "send_notification" | "generate_report" | "schedule_meeting";
    config: Record<string, unknown>;
    connector: string;
    requiresApproval: boolean;
}>;
declare const AgentTemplateSchema: z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    category: z.ZodEnum<["sales", "support", "marketing", "hr", "finance", "operations"]>;
    tags: z.ZodArray<z.ZodString, "many">;
    icon: z.ZodString;
    trigger: z.ZodObject<{
        type: z.ZodEnum<["scan_signal", "schedule", "manual", "webhook", "email"]>;
        schedule: z.ZodOptional<z.ZodString>;
        signalTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        webhookPath: z.ZodOptional<z.ZodString>;
        config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        type: "scan_signal" | "schedule" | "manual" | "webhook" | "email";
        config?: Record<string, unknown> | undefined;
        schedule?: string | undefined;
        signalTypes?: string[] | undefined;
        webhookPath?: string | undefined;
    }, {
        type: "scan_signal" | "schedule" | "manual" | "webhook" | "email";
        config?: Record<string, unknown> | undefined;
        schedule?: string | undefined;
        signalTypes?: string[] | undefined;
        webhookPath?: string | undefined;
    }>;
    fetchSteps: z.ZodArray<z.ZodObject<{
        connector: z.ZodString;
        action: z.ZodString;
        params: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        outputKey: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        action: string;
        params: Record<string, unknown>;
        connector: string;
        outputKey?: string | undefined;
    }, {
        action: string;
        params: Record<string, unknown>;
        connector: string;
        outputKey?: string | undefined;
    }>, "many">;
    prompt: z.ZodString;
    llmTier: z.ZodEnum<["haiku", "sonnet", "opus"]>;
    temperature: z.ZodNumber;
    maxStepsPerRun: z.ZodNumber;
    evalRules: z.ZodObject<{
        assertions: z.ZodArray<z.ZodObject<{
            check: z.ZodString;
            severity: z.ZodEnum<["block", "warn"]>;
            message: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            severity: "block" | "warn";
            check: string;
            message?: string | undefined;
        }, {
            severity: "block" | "warn";
            check: string;
            message?: string | undefined;
        }>, "many">;
        minConfidence: z.ZodNumber;
        l3Trigger: z.ZodEnum<["always", "on_irreversible_action", "on_low_confidence", "never"]>;
        requireApproval: z.ZodBoolean;
        autoSendThreshold: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        assertions: {
            severity: "block" | "warn";
            check: string;
            message?: string | undefined;
        }[];
        minConfidence: number;
        autoSendThreshold: number;
        requireApproval: boolean;
        l3Trigger: "never" | "always" | "on_irreversible_action" | "on_low_confidence";
    }, {
        assertions: {
            severity: "block" | "warn";
            check: string;
            message?: string | undefined;
        }[];
        minConfidence: number;
        autoSendThreshold: number;
        requireApproval: boolean;
        l3Trigger: "never" | "always" | "on_irreversible_action" | "on_low_confidence";
    }>;
    actions: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["draft_email", "draft_message", "draft_ticket", "update_crm", "create_task", "send_notification", "generate_report", "schedule_meeting"]>;
        connector: z.ZodString;
        requiresApproval: z.ZodBoolean;
        config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        type: "draft_email" | "draft_message" | "draft_ticket" | "update_crm" | "create_task" | "send_notification" | "generate_report" | "schedule_meeting";
        config: Record<string, unknown>;
        connector: string;
        requiresApproval: boolean;
    }, {
        type: "draft_email" | "draft_message" | "draft_ticket" | "update_crm" | "create_task" | "send_notification" | "generate_report" | "schedule_meeting";
        config: Record<string, unknown>;
        connector: string;
        requiresApproval: boolean;
    }>, "many">;
    isActive: z.ZodBoolean;
    isPremium: z.ZodBoolean;
    version: z.ZodNumber;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    description: string;
    slug: string;
    name: string;
    category: "sales" | "support" | "marketing" | "hr" | "finance" | "operations";
    tags: string[];
    icon: string;
    trigger: {
        type: "scan_signal" | "schedule" | "manual" | "webhook" | "email";
        config?: Record<string, unknown> | undefined;
        schedule?: string | undefined;
        signalTypes?: string[] | undefined;
        webhookPath?: string | undefined;
    };
    fetchSteps: {
        action: string;
        params: Record<string, unknown>;
        connector: string;
        outputKey?: string | undefined;
    }[];
    prompt: string;
    llmTier: "haiku" | "sonnet" | "opus";
    temperature: number;
    maxStepsPerRun: number;
    evalRules: {
        assertions: {
            severity: "block" | "warn";
            check: string;
            message?: string | undefined;
        }[];
        minConfidence: number;
        autoSendThreshold: number;
        requireApproval: boolean;
        l3Trigger: "never" | "always" | "on_irreversible_action" | "on_low_confidence";
    };
    actions: {
        type: "draft_email" | "draft_message" | "draft_ticket" | "update_crm" | "create_task" | "send_notification" | "generate_report" | "schedule_meeting";
        config: Record<string, unknown>;
        connector: string;
        requiresApproval: boolean;
    }[];
    isActive: boolean;
    isPremium: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}, {
    id: string;
    description: string;
    slug: string;
    name: string;
    category: "sales" | "support" | "marketing" | "hr" | "finance" | "operations";
    tags: string[];
    icon: string;
    trigger: {
        type: "scan_signal" | "schedule" | "manual" | "webhook" | "email";
        config?: Record<string, unknown> | undefined;
        schedule?: string | undefined;
        signalTypes?: string[] | undefined;
        webhookPath?: string | undefined;
    };
    fetchSteps: {
        action: string;
        params: Record<string, unknown>;
        connector: string;
        outputKey?: string | undefined;
    }[];
    prompt: string;
    llmTier: "haiku" | "sonnet" | "opus";
    temperature: number;
    maxStepsPerRun: number;
    evalRules: {
        assertions: {
            severity: "block" | "warn";
            check: string;
            message?: string | undefined;
        }[];
        minConfidence: number;
        autoSendThreshold: number;
        requireApproval: boolean;
        l3Trigger: "never" | "always" | "on_irreversible_action" | "on_low_confidence";
    };
    actions: {
        type: "draft_email" | "draft_message" | "draft_ticket" | "update_crm" | "create_task" | "send_notification" | "generate_report" | "schedule_meeting";
        config: Record<string, unknown>;
        connector: string;
        requiresApproval: boolean;
    }[];
    isActive: boolean;
    isPremium: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}>;
declare const SignalSchema: z.ZodObject<{
    id: z.ZodString;
    scanResultId: z.ZodString;
    type: z.ZodString;
    category: z.ZodEnum<["sales", "support", "marketing", "hr", "finance", "operations"]>;
    severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
    source: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    suggestedTemplateId: z.ZodOptional<z.ZodString>;
    snoozedUntil: z.ZodOptional<z.ZodDate>;
    createdAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    description: string;
    metadata: Record<string, unknown>;
    source: string;
    category: "sales" | "support" | "marketing" | "hr" | "finance" | "operations";
    createdAt: Date;
    scanResultId: string;
    suggestedTemplateId?: string | undefined;
    snoozedUntil?: Date | undefined;
}, {
    id: string;
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    description: string;
    metadata: Record<string, unknown>;
    source: string;
    category: "sales" | "support" | "marketing" | "hr" | "finance" | "operations";
    createdAt: Date;
    scanResultId: string;
    suggestedTemplateId?: string | undefined;
    snoozedUntil?: Date | undefined;
}>;
/**
 * Base type for job data in BullMQ queues.
 */
interface JobData {
    [key: string]: unknown;
}
/**
 * Base type for job results.
 */
interface JobResult {
    [key: string]: unknown;
}
/**
 * Job options for BullMQ.
 */
interface JobOptions {
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

export { AGENT_TRIGGER_TYPES, type AgentAction, AgentActionSchema, type AgentActionType, type AgentCategory, AgentCategorySchema, type AgentDraft, type AgentEvalRules, AgentEvalRulesSchema, type AgentExecution, AgentExecutionError, type AgentExecutionStatus, type AgentFetchSource, AgentFetchSourceSchema, type AgentId, type AgentRun, type AgentRunInput, type AgentRunOutput, type AgentTemplate, type AgentTemplateAction, AgentTemplateActionSchema, AgentTemplateSchema, type AgentTemplateV6, type AgentTrigger, AgentTriggerSchema, type AgentTriggerType, AgentTriggerTypeSchema, type AiEvent, type AiEventAction, type Authenticator, CONNECTOR_CATEGORIES, ConfigError, type Connector, type ConnectorAction, type ConnectorCategory, ConnectorCategorySchema, type ConnectorConfig, type ConnectorCredentials, ConnectorError, type ConnectorId, type ConnectorStatus, type ConnectorTrigger, type ConnectorType, type ConversationId, CredentialError, type CredentialId, EVAL_SEVERITIES, type EncryptedCredential, type EvalAssertion, EvalAssertionSchema, type EvalResult, type EvalRules, EvalRulesSchema, type EvalSeverity, EvalSeveritySchema, type ExecutionError, type FetchStep, FetchStepSchema, type JobData, type JobOptions, type JobResult, type L1Assertion, L1AssertionSchema, type L2Criteria, type L3Trigger, type LLMEvent, type LLMTier, LLMTierSchema, type LLMUsage, LLM_MODELS, LLM_TIERS, type MessageId, NodebaseError, PermissionError, type RunId, SCAN_CATEGORIES, type ScanCategory, ScanCategorySchema, ScanError, type ScanId, type ScanResult, type ScanSignal, ScanSignalSchema, type Signal, type SignalCategory, SignalSchema, type SignalSeverity, TEMPLATE_CATEGORIES, TEMPLATE_ROLES, TEMPLATE_USE_CASES, type TemplateCategory, TemplateCategorySchema, type TemplateId, type TemplateRole, TemplateRoleSchema, type TemplateUseCase, TemplateUseCaseSchema, type TriggerConfig, TriggerConfigSchema, type UserId, type UserRole, type Workspace, type WorkspaceId, type WorkspacePlan, type WorkspaceUser };
