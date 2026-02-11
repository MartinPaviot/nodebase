/**
 * Base Connector Interface
 *
 * All connectors must implement this interface.
 */

import { z } from "zod";
import {
  type ConnectorCategory,
  type ConnectorConfig,
  ConnectorError,
} from "@nodebase/types";

// ============================================
// Types
// ============================================

export interface ConnectorContext {
  workspaceId: string;
  userId: string;
  credentialId: string;
  accessToken?: string;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    requestId?: string;
    rateLimitRemaining?: number;
    rateLimitReset?: Date;
  };
}

export interface ActionDefinition<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  execute: (input: TInput, context: ConnectorContext) => Promise<ActionResult<TOutput>>;
}

export interface TriggerDefinition<TOutput = unknown> {
  id: string;
  name: string;
  description: string;
  outputSchema: z.ZodType<TOutput>;
}

// ============================================
// Base Connector Class
// ============================================

export abstract class BaseConnector {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly description: string;
  public abstract readonly category: ConnectorCategory;
  public abstract readonly icon: string;

  // Pipedream app slug (if using Pipedream Connect)
  public abstract readonly pipedreamAppSlug?: string;

  // OAuth scopes
  public abstract readonly requiredScopes: string[];
  public abstract readonly optionalScopes?: string[];

  // Actions and triggers
  protected actions: Map<string, ActionDefinition> = new Map();
  protected triggers: Map<string, TriggerDefinition> = new Map();

  /**
   * Register an action.
   */
  protected registerAction<TInput, TOutput>(
    action: ActionDefinition<TInput, TOutput>
  ): void {
    this.actions.set(action.id, action as ActionDefinition);
  }

  /**
   * Register a trigger.
   */
  protected registerTrigger<TOutput>(trigger: TriggerDefinition<TOutput>): void {
    this.triggers.set(trigger.id, trigger as TriggerDefinition);
  }

  /**
   * Get all actions.
   */
  getActions(): ActionDefinition[] {
    return Array.from(this.actions.values());
  }

  /**
   * Get all triggers.
   */
  getTriggers(): TriggerDefinition[] {
    return Array.from(this.triggers.values());
  }

  /**
   * Get an action by ID.
   */
  getAction(actionId: string): ActionDefinition | undefined {
    return this.actions.get(actionId);
  }

  /**
   * Get a trigger by ID.
   */
  getTrigger(triggerId: string): TriggerDefinition | undefined {
    return this.triggers.get(triggerId);
  }

  /**
   * Execute an action.
   */
  async executeAction<TInput, TOutput>(
    actionId: string,
    input: TInput,
    context: ConnectorContext
  ): Promise<ActionResult<TOutput>> {
    const action = this.actions.get(actionId);

    if (!action) {
      return {
        success: false,
        error: `Action ${actionId} not found on connector ${this.id}`,
      };
    }

    // Validate input
    const parseResult = action.inputSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Invalid input: ${parseResult.error.message}`,
      };
    }

    try {
      const result = await action.execute(parseResult.data, context);
      return result as ActionResult<TOutput>;
    } catch (error) {
      throw new ConnectorError(
        this.id,
        actionId,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Test the connection with current credentials.
   */
  abstract testConnection(context: ConnectorContext): Promise<ActionResult<boolean>>;

  /**
   * Get the OAuth URL for connecting this connector.
   */
  abstract getOAuthUrl(state: string, redirectUri: string): string;

  /**
   * Exchange OAuth code for tokens.
   */
  abstract exchangeOAuthCode(
    code: string,
    redirectUri: string
  ): Promise<ActionResult<{ accessToken: string; refreshToken?: string; expiresAt?: Date }>>;

  /**
   * Refresh the access token.
   */
  abstract refreshAccessToken(
    refreshToken: string
  ): Promise<ActionResult<{ accessToken: string; refreshToken?: string; expiresAt?: Date }>>;

  /**
   * Get connector config for display.
   */
  toConfig(): ConnectorConfig {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      provider: this.id,
      pipedreamAppSlug: this.pipedreamAppSlug,
      requiredScopes: this.requiredScopes,
      optionalScopes: this.optionalScopes,
    };
  }
}
