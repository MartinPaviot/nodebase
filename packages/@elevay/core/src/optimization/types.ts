/**
 * Types for optimization system (Phase 3)
 * Inspired by Promptim's auto-optimization patterns
 */

export type FeedbackType =
  | 'thumbs_up'
  | 'thumbs_down'
  | 'user_edit' // User modified agent output before sending
  | 'approval_reject' // User rejected in approval queue
  | 'explicit_correction' // User provided correction text
  | 'retry_request'; // User clicked "Try again"

export interface Feedback {
  id?: string;
  traceId: string;
  conversationId: string;
  userId: string;
  agentId: string;

  type: FeedbackType;
  timestamp?: Date;

  // Context
  originalOutput: string;
  userEdit?: string; // If type = 'user_edit'
  correctionText?: string; // If type = 'explicit_correction'

  // Metadata
  stepNumber: number;
  metadata?: Record<string, any>;
}

export interface FeedbackDataset {
  agentId: string;
  feedbackCount: number;
  samples: FeedbackSample[];
}

export interface FeedbackSample {
  input: string[]; // User messages leading to output
  originalOutput: string;
  correctedOutput: string;
  context?: any[];
  feedbackType: FeedbackType;
}

export interface EditPattern {
  pattern: string; // Description of the pattern
  frequency: number; // How many times it occurred
  examples: string[]; // Example corrections
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
  avgScore: number; // 0-100
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
  variantAPrompt: string; // Current prompt
  variantBPrompt: string; // New prompt
  trafficSplit: number; // 0-1, % to variant B
}

export interface ABTestResult {
  id: string;
  agentId: string;
  status: 'running' | 'completed' | 'cancelled';
  trafficSplit: number; // 0-1, % to variant B
  variantATraces: number;
  variantBTraces: number;
  variantAScore?: number;
  variantBScore?: number;
  winningVariant?: 'A' | 'B';
  startedAt: Date;
  endedAt?: Date;
}
