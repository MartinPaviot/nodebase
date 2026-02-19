/**
 * Types for insights system
 */

export interface AgentInsights {
  agentId: string;
  timeframe: { from: Date; to: Date };
  totalConversations: number;
  clusters: ConversationCluster[];
  patterns: UsagePattern[];
  anomalies: Anomaly[];
  opportunities: OptimizationOpportunity[];
}

export interface ConversationCluster {
  id: string;
  label: string;
  size: number;
  traceIds: string[];
  centroid?: number[]; // Embedding centroid
  commonKeywords: string[];
  avgSatisfaction: number;
  avgCost: number;
}

export interface UsagePattern {
  clusterId: string;
  label: string;
  frequency: number;
  commonTools: string[];
  commonFailures: string[];
  avgSatisfaction: number;
  recommendation: string;
}

export interface Anomaly {
  type: 'high_cost' | 'high_latency' | 'tool_failures' | 'low_satisfaction';
  traceId: string;
  value: number;
  expected: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface OptimizationOpportunity {
  type: 'model_downgrade' | 'caching' | 'rag_augmentation' | 'tool_optimization';
  impact: string;
  suggestion: string;
  estimatedSavings?: number;
  affectedConversations?: number;
}

export interface TraceWithConversation {
  id: string;
  agentId: string;
  totalCost: number;
  latencyMs: number | null;
  totalSteps: number;
  toolCalls: any;
  toolSuccesses: number;
  toolFailures: number;
  feedbackScore: number | null;
  status: string;
  conversation: {
    id: string;
    messages: Array<{
      role: string;
      content: string;
    }>;
  };
}
