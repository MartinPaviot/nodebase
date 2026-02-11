/**
 * Types for evaluation system
 */
export interface ConversationEvalResult {
    conversationId: string;
    goalCompleted: boolean;
    goalCompletionConfidence: number;
    userSatisfactionScore: number;
    categories: string[];
    failureModes: string[];
    improvementSuggestions: string[];
    metadata: Record<string, any>;
}
export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    createdAt: Date;
}
export interface ConversationData {
    id: string;
    messages: Message[];
    agentId: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface TraceData {
    id: string;
    totalSteps: number;
    totalCost: number;
    toolCalls: any[];
    toolSuccesses: number;
    toolFailures: number;
    status: string;
    latencyMs: number | null;
    feedbackScore: number | null;
    userEdited: boolean;
}
export interface GoalCompletionResult {
    completed: boolean;
    confidence: number;
    reasoning: string;
}
export interface SentimentResult {
    sentiment: 'positive' | 'neutral' | 'negative';
    score: number;
    confidence: number;
}
//# sourceMappingURL=types.d.ts.map