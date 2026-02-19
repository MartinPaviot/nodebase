/**
 * Queue Types
 *
 * Shared types for BullMQ jobs and results.
 */

/**
 * Trigger source type
 */
export type TriggerSource = "manual" | "webhook" | "cron";

/**
 * Workflow job data
 */
export interface WorkflowJobData {
  workflowId: string;
  userId?: string;
  initialData?: Record<string, unknown>;
  triggeredBy?: TriggerSource;
}

/**
 * Workflow job result
 */
export interface WorkflowJobResult {
  workflowId: string;
  executionId: string;
  status: "success" | "failed";
  result?: Record<string, unknown>;
  error?: string;
}
