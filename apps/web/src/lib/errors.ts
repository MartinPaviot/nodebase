/**
 * Error Hierarchy for Elevay
 * Inspired by n8n error handling patterns
 *
 * Benefits:
 * - Type-safe error handling
 * - Rich context for debugging
 * - Better error messages for users
 * - Easier retry logic
 */

/**
 * Base error class for all Elevay errors
 * Never throw generic Error() - always use a specific subclass
 */
export abstract class ElevayError extends Error {
  constructor(
    public readonly code: string,
    public readonly context: Record<string, unknown>,
    message: string,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = this.constructor.name;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get sanitized error info for client display
   * (removes sensitive data like credentials, full stack traces)
   */
  toClientError(): { code: string; message: string; isRetryable: boolean } {
    return {
      code: this.code,
      message: this.message,
      isRetryable: this.isRetryable,
    };
  }

  /**
   * Get full error info for logging/debugging
   */
  toLogObject(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      isRetryable: this.isRetryable,
      stack: this.stack,
    };
  }
}

// ============================================
// AUTHENTICATION & AUTHORIZATION ERRORS
// ============================================

export class AuthenticationError extends ElevayError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super("AUTHENTICATION_ERROR", context, message, false);
  }
}

export class PermissionError extends ElevayError {
  constructor(resource: string, action: string, userId: string) {
    super(
      "PERMISSION_DENIED",
      { resource, action, userId },
      `User ${userId} does not have permission to ${action} ${resource}`,
      false
    );
  }
}

// ============================================
// RESOURCE ERRORS
// ============================================

export class NotFoundError extends ElevayError {
  constructor(resource: string, id: string) {
    super(
      "NOT_FOUND",
      { resource, id },
      `${resource} with id ${id} not found`,
      false
    );
  }
}

export class ResourceConflictError extends ElevayError {
  constructor(resource: string, field: string, value: unknown) {
    super(
      "RESOURCE_CONFLICT",
      { resource, field, value },
      `${resource} with ${field}=${value} already exists`,
      false
    );
  }
}

// ============================================
// CREDENTIAL & API KEY ERRORS
// ============================================

export class CredentialError extends ElevayError {
  constructor(
    public readonly credentialId: string,
    public readonly provider: string,
    message: string,
    isRetryable: boolean = false
  ) {
    super(
      "CREDENTIAL_ERROR",
      { credentialId, provider },
      message,
      isRetryable
    );
  }

  static expired(credentialId: string, provider: string): CredentialError {
    return new CredentialError(
      credentialId,
      provider,
      `${provider} credentials have expired. Please reconnect your account.`,
      false // Need user action to refresh
    );
  }

  static invalid(credentialId: string, provider: string): CredentialError {
    return new CredentialError(
      credentialId,
      provider,
      `${provider} credentials are invalid. Please reconnect your account.`,
      false
    );
  }

  static notFound(credentialId: string): CredentialError {
    return new CredentialError(
      credentialId,
      "unknown",
      `Credential ${credentialId} not found`,
      false
    );
  }
}

// ============================================
// TOOL EXECUTION ERRORS
// ============================================

export class ToolExecutionError extends ElevayError {
  constructor(
    public readonly toolName: string,
    public readonly toolInput: unknown,
    message: string,
    isRetryable: boolean = false,
    additionalContext: Record<string, unknown> = {}
  ) {
    super(
      "TOOL_EXECUTION_ERROR",
      { toolName, toolInput, ...additionalContext },
      message,
      isRetryable
    );
  }

  static fromError(
    toolName: string,
    toolInput: unknown,
    error: Error | unknown
  ): ToolExecutionError {
    const message = error instanceof Error ? error.message : String(error);
    return new ToolExecutionError(
      toolName,
      toolInput,
      `Tool "${toolName}" failed: ${message}`,
      true // Tool errors are generally retryable
    );
  }
}

// ============================================
// CONNECTOR ERRORS (Composio, Pipedream, etc.)
// ============================================

export class ConnectorError extends ElevayError {
  constructor(
    public readonly connector: string,
    public readonly action: string,
    message: string,
    isRetryable: boolean = false,
    additionalContext: Record<string, unknown> = {}
  ) {
    super(
      "CONNECTOR_ERROR",
      { connector, action, ...additionalContext },
      message,
      isRetryable
    );
  }

  static connectionNotFound(
    connector: string,
    userId: string,
    appName: string
  ): ConnectorError {
    return new ConnectorError(
      connector,
      "authenticate",
      `No ${appName} connection found for user. Please connect your ${appName} account first.`,
      false,
      { userId, appName }
    );
  }

  static rateLimited(
    connector: string,
    action: string,
    retryAfter?: number
  ): ConnectorError {
    return new ConnectorError(
      connector,
      action,
      `Rate limit exceeded for ${connector}. ${retryAfter ? `Retry after ${retryAfter}s` : "Please try again later."}`,
      true,
      { retryAfter }
    );
  }

  static timeout(
    connector: string,
    action: string,
    timeoutMs: number
  ): ConnectorError {
    return new ConnectorError(
      connector,
      action,
      `${connector} request timed out after ${timeoutMs}ms`,
      true,
      { timeoutMs }
    );
  }
}

// ============================================
// WORKFLOW EXECUTION ERRORS
// ============================================

export class WorkflowExecutionError extends ElevayError {
  constructor(
    public readonly workflowId: string,
    public readonly nodeId: string | null,
    message: string,
    isRetryable: boolean = false,
    additionalContext: Record<string, unknown> = {}
  ) {
    super(
      "WORKFLOW_EXECUTION_ERROR",
      { workflowId, nodeId, ...additionalContext },
      message,
      isRetryable
    );
  }

  static nodeNotFound(workflowId: string, nodeId: string): WorkflowExecutionError {
    return new WorkflowExecutionError(
      workflowId,
      nodeId,
      `Node ${nodeId} not found in workflow ${workflowId}`,
      false
    );
  }

  static cyclicDependency(workflowId: string): WorkflowExecutionError {
    return new WorkflowExecutionError(
      workflowId,
      null,
      `Workflow ${workflowId} contains cyclic dependencies`,
      false
    );
  }

  static timeout(
    workflowId: string,
    nodeId: string,
    timeoutMs: number
  ): WorkflowExecutionError {
    return new WorkflowExecutionError(
      workflowId,
      nodeId,
      `Workflow execution timed out after ${timeoutMs}ms at node ${nodeId}`,
      true,
      { timeoutMs }
    );
  }
}

// ============================================
// AGENT ERRORS
// ============================================

export class AgentExecutionError extends ElevayError {
  constructor(
    public readonly agentId: string,
    public readonly conversationId: string | null,
    message: string,
    isRetryable: boolean = false,
    additionalContext: Record<string, unknown> = {}
  ) {
    super(
      "AGENT_EXECUTION_ERROR",
      { agentId, conversationId, ...additionalContext },
      message,
      isRetryable
    );
  }

  static maxStepsExceeded(
    agentId: string,
    conversationId: string,
    maxSteps: number
  ): AgentExecutionError {
    return new AgentExecutionError(
      agentId,
      conversationId,
      `Agent exceeded maximum steps (${maxSteps})`,
      false,
      { maxSteps }
    );
  }

  static llmError(
    agentId: string,
    conversationId: string,
    llmError: string
  ): AgentExecutionError {
    return new AgentExecutionError(
      agentId,
      conversationId,
      `LLM request failed: ${llmError}`,
      true,
      { llmError }
    );
  }
}

// ============================================
// LLM ERRORS
// ============================================

export class LLMError extends ElevayError {
  constructor(
    public readonly provider: string,
    public readonly model: string,
    message: string,
    isRetryable: boolean = false,
    additionalContext: Record<string, unknown> = {}
  ) {
    super(
      "LLM_ERROR",
      { provider, model, ...additionalContext },
      message,
      isRetryable
    );
  }

  static rateLimited(
    provider: string,
    model: string,
    retryAfter?: number
  ): LLMError {
    return new LLMError(
      provider,
      model,
      `Rate limit exceeded for ${provider}/${model}. ${retryAfter ? `Retry after ${retryAfter}s` : "Please try again later."}`,
      true,
      { retryAfter }
    );
  }

  static contextLengthExceeded(
    provider: string,
    model: string,
    tokensUsed: number,
    maxTokens: number
  ): LLMError {
    return new LLMError(
      provider,
      model,
      `Context length exceeded: ${tokensUsed} tokens used, max is ${maxTokens}`,
      false,
      { tokensUsed, maxTokens }
    );
  }

  static invalidApiKey(provider: string): LLMError {
    return new LLMError(
      provider,
      "unknown",
      `Invalid API key for ${provider}. Please check your credentials.`,
      false
    );
  }
}

// ============================================
// VALIDATION ERRORS
// ============================================

export class ValidationError extends ElevayError {
  constructor(
    public readonly field: string,
    public readonly value: unknown,
    public readonly constraint: string
  ) {
    super(
      "VALIDATION_ERROR",
      { field, value, constraint },
      `Validation failed for field "${field}": ${constraint}`,
      false
    );
  }
}

// ============================================
// CONFIG ERRORS
// ============================================

export class ConfigError extends ElevayError {
  constructor(
    public readonly configKey: string,
    message: string
  ) {
    super(
      "CONFIG_ERROR",
      { configKey },
      message,
      false
    );
  }

  static missing(configKey: string): ConfigError {
    return new ConfigError(
      configKey,
      `Required configuration "${configKey}" is missing. Please check your environment variables.`
    );
  }

  static invalid(configKey: string, expectedType: string): ConfigError {
    return new ConfigError(
      configKey,
      `Configuration "${configKey}" is invalid. Expected type: ${expectedType}`
    );
  }
}

// ============================================
// SCAN ENGINE ERRORS
// ============================================

export class ScanError extends ElevayError {
  constructor(
    public readonly signalId: string,
    public readonly connectorId: string,
    message: string,
    isRetryable: boolean = true,
    additionalContext: Record<string, unknown> = {}
  ) {
    super(
      "SCAN_ERROR",
      { signalId, connectorId, ...additionalContext },
      message,
      isRetryable
    );
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ElevayError) {
    return error.isRetryable;
  }
  return false;
}

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ElevayError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Convert unknown error to ElevayError
 */
export function toElevayError(
  error: unknown,
  defaultMessage: string = "An unexpected error occurred"
): ElevayError {
  if (error instanceof ElevayError) {
    return error;
  }

  // If it's a generic Error, wrap it
  if (error instanceof Error) {
    const msg = error.message;
    return new (class extends ElevayError {
      constructor() {
        super("UNKNOWN_ERROR", { originalError: msg }, msg || defaultMessage, false);
      }
    })();
  }

  // Fallback for non-Error objects
  return new (class extends ElevayError {
    constructor() {
      super("UNKNOWN_ERROR", { originalError: String(error) }, defaultMessage, false);
    }
  })();
}
