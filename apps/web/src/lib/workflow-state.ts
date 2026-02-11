/**
 * Workflow State Management (LangGraph-inspired)
 *
 * Benefits:
 * - Explicit state management (no implicit context passing)
 * - Automatic checkpointing after each step
 * - Resume capability (continue from last checkpoint)
 * - Audit trail of all state transitions
 * - Type-safe state access
 *
 * Usage:
 * ```typescript
 * const state = await WorkflowState.create(workflowId, userId, initialData);
 * const result = await state.executeNode(node, executor);
 * await state.saveCheckpoint();
 * ```
 */

import prisma from "./db";
import { NotFoundError, WorkflowExecutionError } from "./errors";
import type { WorkflowContext } from "@/features/executions/types";
import { nanoid } from "nanoid";

// ============================================
// STATE TYPES
// ============================================

/**
 * Status of workflow execution
 */
export enum WorkflowStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  PAUSED = "PAUSED",
}

/**
 * Checkpoint representing state at a specific point in execution
 */
export interface WorkflowCheckpoint {
  id: string;
  workflowExecutionId: string;
  nodeId: string;
  nodeName: string;
  stepNumber: number;
  context: WorkflowContext;
  timestamp: Date;
  error?: string;
}

/**
 * Workflow execution record
 */
export interface WorkflowExecutionRecord {
  id: string;
  workflowId: string;
  userId: string;
  status: WorkflowStatus;
  initialData: Record<string, unknown>;
  currentContext: WorkflowContext;
  currentStep: number;
  totalSteps: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

// ============================================
// WORKFLOW STATE CLASS
// ============================================

export class WorkflowState {
  private constructor(
    private executionId: string,
    private workflowId: string,
    private userId: string,
    private context: WorkflowContext,
    private currentStep: number,
    private totalSteps: number,
    private status: WorkflowStatus,
    private checkpoints: WorkflowCheckpoint[]
  ) {}

  // ============================================
  // STATIC FACTORY METHODS
  // ============================================

  /**
   * Create new workflow execution with initial state
   */
  static async create(
    workflowId: string,
    userId: string,
    initialData: Record<string, unknown> = {},
    totalSteps: number = 0
  ): Promise<WorkflowState> {
    const executionId = nanoid();

    // Create execution record in database
    await prisma.execution.create({
      data: {
        id: executionId,
        workflowId,
        userId,
        status: "PENDING",
        input: initialData,
        output: {},
      },
    });

    return new WorkflowState(
      executionId,
      workflowId,
      userId,
      { ...initialData },
      0,
      totalSteps,
      WorkflowStatus.PENDING,
      []
    );
  }

  /**
   * Resume workflow execution from last checkpoint
   */
  static async resume(executionId: string): Promise<WorkflowState> {
    // Fetch execution record
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      throw new NotFoundError("Execution", executionId);
    }

    // Load checkpoints from execution output
    // Note: We store checkpoints in the output field as JSON for now
    // In a more advanced setup, we'd have a separate ExecutionCheckpoint table
    const executionData = execution.output as any;
    const checkpoints: WorkflowCheckpoint[] = executionData?.checkpoints || [];
    const currentContext: WorkflowContext = executionData?.currentContext || execution.input;
    const currentStep = executionData?.currentStep || 0;
    const totalSteps = executionData?.totalSteps || 0;

    return new WorkflowState(
      executionId,
      execution.workflowId,
      execution.userId,
      currentContext,
      currentStep,
      totalSteps,
      execution.status as WorkflowStatus,
      checkpoints
    );
  }

  // ============================================
  // STATE ACCESSORS
  // ============================================

  getExecutionId(): string {
    return this.executionId;
  }

  getWorkflowId(): string {
    return this.workflowId;
  }

  getUserId(): string {
    return this.userId;
  }

  getContext(): Readonly<WorkflowContext> {
    return { ...this.context };
  }

  getCurrentStep(): number {
    return this.currentStep;
  }

  getTotalSteps(): number {
    return this.totalSteps;
  }

  getStatus(): WorkflowStatus {
    return this.status;
  }

  getCheckpoints(): ReadonlyArray<WorkflowCheckpoint> {
    return [...this.checkpoints];
  }

  getLastCheckpoint(): WorkflowCheckpoint | null {
    return this.checkpoints.length > 0
      ? this.checkpoints[this.checkpoints.length - 1]
      : null;
  }

  // ============================================
  // STATE MUTATIONS
  // ============================================

  /**
   * Update context (merge new data)
   */
  updateContext(updates: Partial<WorkflowContext>): void {
    this.context = {
      ...this.context,
      ...updates,
    };
  }

  /**
   * Set context completely (replace)
   */
  setContext(newContext: WorkflowContext): void {
    this.context = newContext;
  }

  /**
   * Increment step counter
   */
  incrementStep(): void {
    this.currentStep += 1;
  }

  /**
   * Set total steps
   */
  setTotalSteps(total: number): void {
    this.totalSteps = total;
  }

  /**
   * Update status
   */
  setStatus(status: WorkflowStatus): void {
    this.status = status;
  }

  // ============================================
  // CHECKPOINTING
  // ============================================

  /**
   * Create checkpoint at current state
   */
  async createCheckpoint(nodeId: string, nodeName: string): Promise<void> {
    const checkpoint: WorkflowCheckpoint = {
      id: nanoid(),
      workflowExecutionId: this.executionId,
      nodeId,
      nodeName,
      stepNumber: this.currentStep,
      context: { ...this.context },
      timestamp: new Date(),
    };

    this.checkpoints.push(checkpoint);
    await this.saveCheckpoint();
  }

  /**
   * Create error checkpoint
   */
  async createErrorCheckpoint(
    nodeId: string,
    nodeName: string,
    error: Error
  ): Promise<void> {
    const checkpoint: WorkflowCheckpoint = {
      id: nanoid(),
      workflowExecutionId: this.executionId,
      nodeId,
      nodeName,
      stepNumber: this.currentStep,
      context: { ...this.context },
      timestamp: new Date(),
      error: error.message,
    };

    this.checkpoints.push(checkpoint);
    this.setStatus(WorkflowStatus.FAILED);
    await this.saveCheckpoint();
  }

  /**
   * Save current state to database
   */
  async saveCheckpoint(): Promise<void> {
    await prisma.execution.update({
      where: { id: this.executionId },
      data: {
        status: this.status,
        output: {
          checkpoints: this.checkpoints,
          currentContext: this.context,
          currentStep: this.currentStep,
          totalSteps: this.totalSteps,
        },
      },
    });
  }

  /**
   * Mark execution as completed
   */
  async markCompleted(): Promise<void> {
    this.setStatus(WorkflowStatus.COMPLETED);
    await prisma.execution.update({
      where: { id: this.executionId },
      data: {
        status: "COMPLETED",
        output: {
          checkpoints: this.checkpoints,
          finalContext: this.context,
          currentStep: this.currentStep,
          totalSteps: this.totalSteps,
        },
      },
    });
  }

  /**
   * Mark execution as failed
   */
  async markFailed(error: Error): Promise<void> {
    this.setStatus(WorkflowStatus.FAILED);
    await prisma.execution.update({
      where: { id: this.executionId },
      data: {
        status: "FAILED",
        output: {
          checkpoints: this.checkpoints,
          currentContext: this.context,
          currentStep: this.currentStep,
          totalSteps: this.totalSteps,
          error: error.message,
        },
      },
    });
  }

  // ============================================
  // EXECUTION HELPERS
  // ============================================

  /**
   * Check if can resume from checkpoint
   */
  canResume(): boolean {
    return (
      this.status === WorkflowStatus.PAUSED ||
      (this.status === WorkflowStatus.FAILED && this.checkpoints.length > 0)
    );
  }

  /**
   * Get resume point (node to start from)
   */
  getResumePoint(): { nodeId: string; stepNumber: number } | null {
    const lastCheckpoint = this.getLastCheckpoint();
    if (!lastCheckpoint) return null;

    return {
      nodeId: lastCheckpoint.nodeId,
      stepNumber: lastCheckpoint.stepNumber,
    };
  }

  /**
   * Convert to JSON for serialization
   */
  toJSON(): WorkflowExecutionRecord {
    return {
      id: this.executionId,
      workflowId: this.workflowId,
      userId: this.userId,
      status: this.status,
      initialData: this.checkpoints[0]?.context || {},
      currentContext: this.context,
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      startedAt: this.checkpoints[0]?.timestamp || new Date(),
      completedAt:
        this.status === WorkflowStatus.COMPLETED
          ? this.checkpoints[this.checkpoints.length - 1]?.timestamp
          : undefined,
    };
  }
}
