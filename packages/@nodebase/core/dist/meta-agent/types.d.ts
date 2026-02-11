/**
 * Types for Meta-Agent system (Phase 4)
 * - Agent Builder: Natural language-driven agent creation
 * - Self-Modifier: Agents that propose their own improvements
 */
export declare enum AgentModel {
    ANTHROPIC = "ANTHROPIC",
    OPENAI = "OPENAI",
    GEMINI = "GEMINI"
}
export declare enum ModificationType {
    PROMPT_REFINEMENT = "PROMPT_REFINEMENT",
    MODEL_UPGRADE = "MODEL_UPGRADE",
    MODEL_DOWNGRADE = "MODEL_DOWNGRADE",
    ADD_TOOL = "ADD_TOOL",
    REMOVE_TOOL = "REMOVE_TOOL",
    ADD_RAG = "ADD_RAG",
    ADJUST_TEMPERATURE = "ADJUST_TEMPERATURE"
}
export declare enum ProposalStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    APPLIED = "APPLIED"
}
export interface AgentBuildRequest {
    description: string;
    requirements?: string[];
    integrations?: string[];
    sampleInputs?: string[];
    expectedOutputs?: string[];
    category?: AgentCategory;
}
export interface AgentIntent {
    agentName: string;
    purpose: string;
    capabilities: string[];
    category: AgentCategory;
    dataSources: DataSource[];
    outputFormat: OutputFormat;
    triggers: TriggerSuggestion[];
    tone?: 'professional' | 'casual' | 'friendly' | 'formal';
    language?: string;
}
export type AgentCategory = 'SALES' | 'SUPPORT' | 'MARKETING' | 'HR' | 'FINANCE' | 'OPERATIONS' | 'RESEARCH' | 'PRODUCTIVITY';
export type DataSource = 'crm' | 'email' | 'calendar' | 'documents' | 'spreadsheets' | 'support_tickets' | 'tasks' | 'meetings' | 'slack' | 'notion';
export type OutputFormat = 'email' | 'report' | 'notification' | 'task' | 'summary' | 'chat_response' | 'form_submission';
export interface TriggerSuggestion {
    type: 'schedule' | 'webhook' | 'email' | 'chat' | 'manual';
    config?: Record<string, any>;
    description: string;
}
export interface Tool {
    type: string;
    name: string;
    description?: string;
    config: Record<string, any>;
    integration?: string;
}
export interface EvalRules {
    l1: {
        assertions: L1Assertion[];
    };
    l2: {
        criteria: L2Criterion[];
        minScore: number;
    };
    l3: {
        trigger: 'always' | 'on_irreversible_action' | 'never';
        minConfidence: number;
    };
    requireApproval: boolean;
    autoSendThreshold: number;
}
export interface L1Assertion {
    check: string;
    severity: 'block' | 'warn';
    message?: string;
}
export interface L2Criterion {
    name: string;
    description: string;
    weight: number;
}
export interface AgentAction {
    type: 'draft_email' | 'send_email' | 'update_crm' | 'create_task' | 'send_notification' | 'update_document';
    requireApproval: boolean;
    config?: Record<string, any>;
}
export interface BuiltAgent {
    name: string;
    description: string;
    systemPrompt: string;
    model: AgentModel;
    temperature: number;
    tools: Tool[];
    integrations: string[];
    evalRules: EvalRules;
    actions: AgentAction[];
    suggestedTriggers: TriggerSuggestion[];
    testResults?: TestResults | null;
}
export interface TestResult {
    input: string;
    expected: string;
    actual: string;
    score: number;
    passed: boolean;
}
export interface TestResults {
    results: TestResult[];
    avgScore: number;
    passRate: number;
}
export interface PerformanceAnalysis {
    totalConversations: number;
    successRate: number;
    avgSatisfaction: number;
    avgCost: number;
    avgLatency: number;
    commonFailures: string[];
    toolUsage: ToolUsageStats[];
    topUserComplaints: string[];
    hallucinationRate: number;
}
export interface ToolUsageStats {
    toolId: string;
    toolName: string;
    usageCount: number;
    usageRate: number;
    successRate: number;
    avgLatency: number;
}
export interface ModificationProposal {
    type: ModificationType;
    current: string;
    proposed: string;
    rationale: string;
    impact: string;
    requiresApproval: boolean;
    estimatedSavings?: number;
    affectedConversations?: number;
}
export interface SelfModificationResult {
    agentId: string;
    analysis: PerformanceAnalysis;
    proposals: ModificationProposal[];
    recommendation: string;
}
//# sourceMappingURL=types.d.ts.map