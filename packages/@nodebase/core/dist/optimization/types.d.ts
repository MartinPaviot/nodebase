/**
 * Types for optimization system (Phase 3)
 * Inspired by Promptim's auto-optimization patterns
 */
export type FeedbackType = 'thumbs_up' | 'thumbs_down' | 'user_edit' | 'approval_reject' | 'explicit_correction' | 'retry_request';
export interface Feedback {
    id?: string;
    traceId: string;
    conversationId: string;
    userId: string;
    agentId: string;
    type: FeedbackType;
    timestamp?: Date;
    originalOutput: string;
    userEdit?: string;
    correctionText?: string;
    stepNumber: number;
    metadata?: Record<string, any>;
}
export interface FeedbackDataset {
    agentId: string;
    feedbackCount: number;
    samples: FeedbackSample[];
}
export interface FeedbackSample {
    input: string[];
    originalOutput: string;
    correctedOutput: string;
    context?: any[];
    feedbackType: FeedbackType;
}
export interface EditPattern {
    pattern: string;
    frequency: number;
    examples: string[];
    category: 'tone' | 'accuracy' | 'format' | 'content' | 'other';
}
export interface PromptVariation {
    id: string;
    prompt: string;
    rationale: string;
    addressedPatterns: string[];
}
export interface VariationTestResult {
    variation: PromptVariation;
    avgScore: number;
    outputs: string[];
    improvements: string[];
}
export interface OptimizationResult {
    agentId: string;
    originalPrompt: string;
    proposedPrompt: string;
    editPatterns: EditPattern[];
    testResults: VariationTestResult[];
    abTestId?: string;
    recommendation: string;
}
export interface ABTestConfig {
    agentId: string;
    variantAPrompt: string;
    variantBPrompt: string;
    trafficSplit: number;
}
export interface ABTestResult {
    id: string;
    agentId: string;
    status: 'running' | 'completed' | 'cancelled';
    trafficSplit: number;
    variantATraces: number;
    variantBTraces: number;
    variantAScore?: number;
    variantBScore?: number;
    winningVariant?: 'A' | 'B';
    startedAt: Date;
    endedAt?: Date;
}
//# sourceMappingURL=types.d.ts.map