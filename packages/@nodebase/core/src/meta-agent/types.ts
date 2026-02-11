/**
 * Types for Meta-Agent system (Phase 4)
 * - Agent Builder: Natural language-driven agent creation
 * - Self-Modifier: Agents that propose their own improvements
 */

// Local enum definitions (mirroring Prisma schema)
export enum AgentModel {
  ANTHROPIC = 'ANTHROPIC',
  OPENAI = 'OPENAI',
  GEMINI = 'GEMINI'
}

export enum ModificationType {
  PROMPT_REFINEMENT = 'PROMPT_REFINEMENT',
  MODEL_UPGRADE = 'MODEL_UPGRADE',
  MODEL_DOWNGRADE = 'MODEL_DOWNGRADE',
  ADD_TOOL = 'ADD_TOOL',
  REMOVE_TOOL = 'REMOVE_TOOL',
  ADD_RAG = 'ADD_RAG',
  ADJUST_TEMPERATURE = 'ADJUST_TEMPERATURE'
}

export enum ProposalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  APPLIED = 'APPLIED'
}

// ===================
// AGENT BUILDER TYPES
// ===================

export interface AgentBuildRequest {
  description: string;            // User's natural language description
  requirements?: string[];        // Optional explicit requirements
  integrations?: string[];        // Suggested integrations (e.g., ["hubspot", "gmail"])
  sampleInputs?: string[];        // Sample user queries
  expectedOutputs?: string[];     // Sample expected responses
  category?: AgentCategory;       // Override auto-detection
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

export type AgentCategory =
  | 'SALES'
  | 'SUPPORT'
  | 'MARKETING'
  | 'HR'
  | 'FINANCE'
  | 'OPERATIONS'
  | 'RESEARCH'
  | 'PRODUCTIVITY';

export type DataSource =
  | 'crm'
  | 'email'
  | 'calendar'
  | 'documents'
  | 'spreadsheets'
  | 'support_tickets'
  | 'tasks'
  | 'meetings'
  | 'slack'
  | 'notion';

export type OutputFormat =
  | 'email'
  | 'report'
  | 'notification'
  | 'task'
  | 'summary'
  | 'chat_response'
  | 'form_submission';

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
    minScore: number;  // 0-100
  };
  l3: {
    trigger: 'always' | 'on_irreversible_action' | 'never';
    minConfidence: number;  // 0-1
  };
  requireApproval: boolean;
  autoSendThreshold: number;  // 0-1
}

export interface L1Assertion {
  check: string;  // e.g., "contains_recipient_name", "no_placeholders"
  severity: 'block' | 'warn';
  message?: string;
}

export interface L2Criterion {
  name: string;
  description: string;
  weight: number;  // 0-1 (sum to 1.0)
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
  score: number;  // 0-1
  passed: boolean;
}

export interface TestResults {
  results: TestResult[];
  avgScore: number;
  passRate: number;
}

// ===================
// SELF-MODIFIER TYPES
// ===================

export interface PerformanceAnalysis {
  totalConversations: number;
  successRate: number;  // 0-1
  avgSatisfaction: number;  // 1-5
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
  usageRate: number;  // 0-1
  successRate: number;  // 0-1
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

// ModificationType enum is already defined at the top of this file (line 14)
// Removed duplicate type union to avoid TS2567 error

export interface SelfModificationResult {
  agentId: string;
  analysis: PerformanceAnalysis;
  proposals: ModificationProposal[];
  recommendation: string;
}
