/**
 * BaseConnector - Unified interface for all integrations
 *
 * Benefits:
 * - Abstract OAuth, token refresh, rate limiting
 * - Switch providers (Composio, Pipedream, custom) without code changes
 * - Type-safe tool execution
 * - Automatic error handling
 *
 * Usage:
 * ```typescript
 * const connector = getConnector("gmail");
 *
 * // Check auth
 * const isAuth = await connector.isAuthenticated(userId);
 * if (!isAuth) {
 *   await connector.authenticate(userId);
 * }
 *
 * // Execute tool
 * const result = await connector.executeTool("send_email", {
 *   to: "user@example.com",
 *   subject: "Hello",
 *   body: "Test",
 * }, userId);
 * ```
 */

import { ConnectorError } from "../errors";

// ============================================
// TYPES
// ============================================

/**
 * Tool definition
 */
export interface ConnectorTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Authentication status
 */
export interface AuthenticationStatus {
  isAuthenticated: boolean;
  userId: string;
  connectedAt?: Date;
  expiresAt?: Date;
  scopes?: string[];
}

// ============================================
// BASE CONNECTOR INTERFACE
// ============================================

/**
 * Abstract base class for all connectors
 * Implementations: ComposioConnector, PipedreamConnector, CustomConnector
 */
export abstract class BaseConnector {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly provider: "composio" | "pipedream" | "custom"
  ) {}

  // ============================================
  // AUTHENTICATION METHODS
  // ============================================

  /**
   * Initiate OAuth flow
   * Returns authorization URL to redirect user to
   */
  abstract getAuthUrl(userId: string, redirectUrl: string): Promise<string>;

  /**
   * Complete OAuth flow after callback
   */
  abstract handleCallback(
    userId: string,
    code: string,
    state?: string
  ): Promise<void>;

  /**
   * Check if user is authenticated
   */
  abstract isAuthenticated(userId: string): Promise<boolean>;

  /**
   * Get authentication status with details
   */
  abstract getAuthStatus(userId: string): Promise<AuthenticationStatus>;

  /**
   * Disconnect/revoke authentication
   */
  abstract disconnect(userId: string): Promise<void>;

  // ============================================
  // TOOL METHODS
  // ============================================

  /**
   * List all available tools for this connector
   */
  abstract listAvailableTools(): Promise<ConnectorTool[]>;

  /**
   * Execute a tool
   * Handles auth automatically (refresh tokens if needed)
   */
  abstract executeTool(
    toolName: string,
    input: Record<string, unknown>,
    userId: string
  ): Promise<ToolExecutionResult>;

  /**
   * Get tool definition by name
   */
  async getTool(toolName: string): Promise<ConnectorTool | null> {
    const tools = await this.listAvailableTools();
    return tools.find((t) => t.name === toolName) || null;
  }

  // ============================================
  // VALIDATION METHODS
  // ============================================

  /**
   * Validate tool input against schema
   */
  protected validateInput(
    toolName: string,
    input: Record<string, unknown>,
    schema: ConnectorTool["inputSchema"]
  ): void {
    const required = schema.required || [];

    for (const field of required) {
      if (!(field in input)) {
        throw new ConnectorError(
          this.id,
          toolName,
          `Missing required field: ${field}`,
          false
        );
      }
    }
  }

  /**
   * Assert user is authenticated
   */
  protected async assertAuthenticated(userId: string): Promise<void> {
    const isAuth = await this.isAuthenticated(userId);
    if (!isAuth) {
      throw ConnectorError.connectionNotFound(
        this.id,
        userId,
        this.name
      );
    }
  }
}
