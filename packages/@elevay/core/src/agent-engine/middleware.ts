/**
 * Middleware System - Composable hooks for agent execution
 * Inspired by LangGraph's extensibility patterns
 */

import type { Middleware, ExecutionContext, LlmCallData } from './types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Tracing Middleware - Logs LLM calls to AiEvent
 */
export const TracingMiddleware: Middleware = {
  id: 'tracing',
  hook: 'after_llm',
  order: 1,
  handler: async (data: LlmCallData, context: ExecutionContext) => {
    try {
      await prisma.aiEvent.create({
        data: {
          traceId: context.traceId,
          agentId: data.agentId,
          userId: data.userId,
          workspaceId: data.workspaceId,
          model: data.model,
          tier: getTierFromModel(data.model),
          tokensIn: data.tokensIn,
          tokensOut: data.tokensOut,
          cost: data.cost,
          latencyMs: data.latencyMs,
          stepNumber: data.stepNumber,
          action: data.action,
          toolName: data.toolName,
          toolInput: data.toolInput,
          toolOutput: data.toolOutput,
        },
      });
    } catch (error) {
      console.error('[TracingMiddleware] Failed to log AI event:', error);
    }

    return data;
  },
};

/**
 * Cost Guard Middleware - Prevents execution if monthly limit exceeded
 */
export const CostGuardMiddleware: Middleware = {
  id: 'cost_guard',
  hook: 'before_llm',
  order: 0,
  handler: async (data: any, context: ExecutionContext) => {
    try {
      // Get monthly usage for this user/workspace
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const monthlyEvents = await prisma.aiEvent.aggregate({
        where: {
          userId: context.userId,
          workspaceId: context.workspaceId,
          timestamp: {
            gte: startOfMonth,
          },
        },
        _sum: {
          cost: true,
        },
      });

      const monthlyUsage = monthlyEvents._sum.cost || 0;

      // TODO: Get user's monthly limit from subscription
      const monthlyLimit = 100.0; // $100 default

      if (monthlyUsage >= monthlyLimit) {
        throw new CostLimitError(
          `Monthly usage limit of $${monthlyLimit} exceeded (current: $${monthlyUsage.toFixed(2)})`
        );
      }
    } catch (error) {
      if (error instanceof CostLimitError) {
        throw error;
      }
      console.error('[CostGuardMiddleware] Failed to check cost limit:', error);
    }

    return data;
  },
};

/**
 * Context Compression Middleware - Compresses old messages
 */
export const ContextCompressionMiddleware: Middleware = {
  id: 'context_compression',
  hook: 'before_llm',
  order: 1,
  handler: async (data: any, context: ExecutionContext) => {
    if (data.messages && data.messages.length > 20) {
      // Keep the last 5 messages uncompressed
      const recentMessages = data.messages.slice(-5);
      const oldMessages = data.messages.slice(0, -5);

      // Compress old messages (simple: just keep first and last of old batch)
      // TODO: Use actual LLM-based compression
      const compressed = [
        {
          role: 'system',
          content: `[Previous ${oldMessages.length} messages compressed]`,
        },
      ];

      data.messages = [...compressed, ...recentMessages];
    }

    return data;
  },
};

/**
 * PII Redaction Middleware - Redacts PII from outputs before logging
 */
export const PiiRedactionMiddleware: Middleware = {
  id: 'pii_redaction',
  hook: 'after_llm',
  order: 0,
  handler: async (data: any, context: ExecutionContext) => {
    if (data.output && typeof data.output === 'string') {
      // Simple PII redaction (emails, phone numbers)
      // TODO: Use more sophisticated PII detection
      data.output = redactPii(data.output);
    }

    return data;
  },
};

/**
 * Safe Mode Middleware - Blocks side-effect actions if safe mode enabled
 */
export const SafeModeMiddleware: Middleware = {
  id: 'safe_mode',
  hook: 'before_tool',
  order: 0,
  handler: async (data: any, context: ExecutionContext) => {
    if (context.safeMode) {
      const sideEffectTools = [
        'send_email',
        'create_calendar_event',
        'send_slack_message',
        'create_notion_page',
        'append_to_notion',
      ];

      if (sideEffectTools.includes(data.toolName)) {
        // Block execution and require confirmation
        throw new SafeModeBlockError(
          `Tool ${data.toolName} blocked by Safe Mode. User confirmation required.`
        );
      }
    }

    return data;
  },
};

/**
 * Logging Middleware - Logs execution steps to console
 */
export const LoggingMiddleware: Middleware = {
  id: 'logging',
  hook: 'after_step',
  order: 100, // Run last
  handler: async (data: any, context: ExecutionContext) => {
    console.log(`[Agent ${context.agentId}] Step ${data.currentStep}: ${data.currentNodeId}`);
    return data;
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function getTierFromModel(model: string): string {
  if (model.includes('haiku')) return 'haiku';
  if (model.includes('opus')) return 'opus';
  return 'sonnet';
}

function redactPii(text: string): string {
  // Redact emails
  text = text.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL_REDACTED]');

  // Redact phone numbers (simple patterns)
  text = text.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]');
  text = text.replace(/\b\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g, '[PHONE_REDACTED]');

  return text;
}

// ============================================================================
// Custom Errors
// ============================================================================

export class CostLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CostLimitError';
  }
}

export class SafeModeBlockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SafeModeBlockError';
  }
}

// ============================================================================
// Export all middleware
// ============================================================================

export const DefaultMiddleware: Middleware[] = [
  CostGuardMiddleware,
  TracingMiddleware,
  LoggingMiddleware,
];

export const ProductionMiddleware: Middleware[] = [
  CostGuardMiddleware,
  SafeModeMiddleware,
  ContextCompressionMiddleware,
  PiiRedactionMiddleware,
  TracingMiddleware,
];
