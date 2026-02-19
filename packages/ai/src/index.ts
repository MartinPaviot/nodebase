/**
 * @elevay/ai
 *
 * Direct Anthropic SDK integration with:
 * - Model tiering (Haiku/Sonnet/Opus)
 * - AI event logging for cost tracking
 * - Structured output with Zod
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  type LLMTier,
  type LLMEvent,
  type LLMUsage,
  LLM_MODELS,
  ElevayError,
} from "@elevay/types";

// ============================================
// Types
// ============================================

export interface AIClientConfig {
  apiKey: string;
  defaultModel?: string;
  defaultMaxTokens?: number;
  onEvent?: (event: LLMEvent) => void | Promise<void>;
}

export interface MessageOptions {
  tier?: LLMTier;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  agentId?: string;
  userId?: string;
  workspaceId?: string;
}

export interface StructuredOptions<T extends z.ZodType> extends MessageOptions {
  schema: T;
  schemaName?: string;
  schemaDescription?: string;
}

export interface StreamCallbacks {
  onStart?: () => void;
  onToken?: (token: string) => void;
  onComplete?: (fullText: string, usage: LLMUsage) => void;
  onError?: (error: Error) => void;
}

// ============================================
// Cost Calculation
// ============================================

const COST_PER_MILLION_TOKENS = {
  "claude-3-5-haiku-20241022": { input: 1.0, output: 5.0 },
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "claude-opus-4-20250514": { input: 15.0, output: 75.0 },
} as const;

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = COST_PER_MILLION_TOKENS[model as keyof typeof COST_PER_MILLION_TOKENS];
  if (!costs) {
    // Default to Sonnet pricing for unknown models
    return (inputTokens * 3 + outputTokens * 15) / 1_000_000;
  }
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
}

// ============================================
// AI Client Class
// ============================================

export class AIClient {
  private client: Anthropic;
  private config: Required<AIClientConfig>;

  constructor(config: AIClientConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.config = {
      apiKey: config.apiKey,
      defaultModel: config.defaultModel ?? LLM_MODELS.sonnet,
      defaultMaxTokens: config.defaultMaxTokens ?? 4096,
      onEvent: config.onEvent ?? (() => {}),
    };
  }

  /**
   * Get the model ID for a tier.
   */
  getModelForTier(tier: LLMTier): string {
    return LLM_MODELS[tier];
  }

  /**
   * Send a message and get a response.
   */
  async message(
    userMessage: string,
    options: MessageOptions = {}
  ): Promise<{ text: string; usage: LLMUsage }> {
    const startTime = Date.now();
    const model = options.tier
      ? this.getModelForTier(options.tier)
      : this.config.defaultModel;

    const response = await this.client.messages.create({
      model,
      max_tokens: options.maxTokens ?? this.config.defaultMaxTokens,
      temperature: options.temperature ?? 0.7,
      system: options.systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const latencyMs = Date.now() - startTime;
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cost = calculateCost(model, inputTokens, outputTokens);

    const usage: LLMUsage = {
      model,
      tier: options.tier ?? "sonnet",
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      cost,
      latencyMs,
    };

    // Log event
    if (options.agentId && options.userId && options.workspaceId) {
      await this.config.onEvent({
        id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        ...usage,
        agentId: options.agentId,
        userId: options.userId,
        workspaceId: options.workspaceId,
        action: "message",
        evalResult: "pass",
        stepsUsed: 1,
        timestamp: new Date(),
      });
    }

    // Extract text from response
    const textBlock = response.content.find((block) => block.type === "text");
    const text = textBlock?.type === "text" ? textBlock.text : "";

    return { text, usage };
  }

  /**
   * Send a message with conversation history.
   */
  async chat(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    options: MessageOptions = {}
  ): Promise<{ text: string; usage: LLMUsage }> {
    const startTime = Date.now();
    const model = options.tier
      ? this.getModelForTier(options.tier)
      : this.config.defaultModel;

    const response = await this.client.messages.create({
      model,
      max_tokens: options.maxTokens ?? this.config.defaultMaxTokens,
      temperature: options.temperature ?? 0.7,
      system: options.systemPrompt,
      messages,
    });

    const latencyMs = Date.now() - startTime;
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cost = calculateCost(model, inputTokens, outputTokens);

    const usage: LLMUsage = {
      model,
      tier: options.tier ?? "sonnet",
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      cost,
      latencyMs,
    };

    // Log event
    if (options.agentId && options.userId && options.workspaceId) {
      await this.config.onEvent({
        id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        ...usage,
        agentId: options.agentId,
        userId: options.userId,
        workspaceId: options.workspaceId,
        action: "chat",
        evalResult: "pass",
        stepsUsed: 1,
        timestamp: new Date(),
      });
    }

    const textBlock = response.content.find((block) => block.type === "text");
    const text = textBlock?.type === "text" ? textBlock.text : "";

    return { text, usage };
  }

  /**
   * Stream a response with callbacks.
   */
  async stream(
    userMessage: string,
    options: MessageOptions = {},
    callbacks: StreamCallbacks = {}
  ): Promise<{ text: string; usage: LLMUsage }> {
    const startTime = Date.now();
    const model = options.tier
      ? this.getModelForTier(options.tier)
      : this.config.defaultModel;

    callbacks.onStart?.();

    let fullText = "";
    let inputTokens = 0;
    let outputTokens = 0;

    const stream = this.client.messages.stream({
      model,
      max_tokens: options.maxTokens ?? this.config.defaultMaxTokens,
      temperature: options.temperature ?? 0.7,
      system: options.systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    try {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          fullText += event.delta.text;
          callbacks.onToken?.(event.delta.text);
        }

        if (event.type === "message_delta" && event.usage) {
          outputTokens = event.usage.output_tokens;
        }

        if (event.type === "message_start" && event.message.usage) {
          inputTokens = event.message.usage.input_tokens;
        }
      }
    } catch (error) {
      callbacks.onError?.(error as Error);
      throw error;
    }

    const latencyMs = Date.now() - startTime;
    const cost = calculateCost(model, inputTokens, outputTokens);

    const usage: LLMUsage = {
      model,
      tier: options.tier ?? "sonnet",
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      cost,
      latencyMs,
    };

    callbacks.onComplete?.(fullText, usage);

    // Log event
    if (options.agentId && options.userId && options.workspaceId) {
      await this.config.onEvent({
        id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        ...usage,
        agentId: options.agentId,
        userId: options.userId,
        workspaceId: options.workspaceId,
        action: "stream",
        evalResult: "pass",
        stepsUsed: 1,
        timestamp: new Date(),
      });
    }

    return { text: fullText, usage };
  }

  /**
   * Get structured output validated with Zod.
   */
  async structured<T extends z.ZodType>(
    userMessage: string,
    options: StructuredOptions<T>
  ): Promise<{ data: z.infer<T>; usage: LLMUsage }> {
    const { schema, schemaName = "response", schemaDescription, ...messageOptions } = options;

    // Build a prompt that encourages structured output
    const structuredPrompt = `${messageOptions.systemPrompt ?? ""}

You must respond with valid JSON that matches the following schema:
${JSON.stringify(zodToJsonSchema(schema), null, 2)}

${schemaDescription ? `Description: ${schemaDescription}` : ""}

Respond ONLY with the JSON object, no additional text.`;

    const { text, usage } = await this.message(userMessage, {
      ...messageOptions,
      systemPrompt: structuredPrompt,
    });

    // Parse and validate
    try {
      // Extract JSON from the response (handle potential markdown code blocks)
      let jsonText = text.trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.slice(7);
      }
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith("```")) {
        jsonText = jsonText.slice(0, -3);
      }
      jsonText = jsonText.trim();

      const parsed = JSON.parse(jsonText);
      const validated = schema.parse(parsed);

      return { data: validated, usage };
    } catch (error) {
      throw new ElevayError(
        `Failed to parse structured output: ${error instanceof Error ? error.message : String(error)}`,
        "STRUCTURED_OUTPUT_ERROR",
        { rawOutput: text }
      );
    }
  }

  /**
   * Use tools (function calling).
   */
  async withTools<T extends Record<string, z.ZodType>>(
    userMessage: string,
    tools: { [K in keyof T]: { description: string; schema: T[K] } },
    options: MessageOptions = {}
  ): Promise<{
    text: string;
    toolCalls: Array<{ name: keyof T; input: z.infer<T[keyof T]> }>;
    usage: LLMUsage;
  }> {
    const startTime = Date.now();
    const model = options.tier
      ? this.getModelForTier(options.tier)
      : this.config.defaultModel;

    // Convert tools to Anthropic format
    const anthropicTools = Object.entries(tools).map(([name, tool]) => {
      const schema = zodToJsonSchema(tool.schema);
      return {
        name,
        description: tool.description,
        input_schema: {
          type: "object" as const,
          ...(typeof schema === 'object' && schema !== null ? schema : {}),
        },
      };
    });

    const response = await this.client.messages.create({
      model,
      max_tokens: options.maxTokens ?? this.config.defaultMaxTokens,
      temperature: options.temperature ?? 0.7,
      system: options.systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools: anthropicTools,
    });

    const latencyMs = Date.now() - startTime;
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cost = calculateCost(model, inputTokens, outputTokens);

    const usage: LLMUsage = {
      model,
      tier: options.tier ?? "sonnet",
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      cost,
      latencyMs,
    };

    // Extract text and tool calls
    let text = "";
    const toolCalls: Array<{ name: keyof T; input: z.infer<T[keyof T]> }> = [];

    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
      } else if (block.type === "tool_use") {
        const toolDef = tools[block.name as keyof T];
        if (toolDef) {
          const validated = toolDef.schema.parse(block.input);
          toolCalls.push({ name: block.name as keyof T, input: validated });
        }
      }
    }

    // Log event
    if (options.agentId && options.userId && options.workspaceId) {
      await this.config.onEvent({
        id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        ...usage,
        agentId: options.agentId,
        userId: options.userId,
        workspaceId: options.workspaceId,
        action: "tools",
        evalResult: "pass",
        stepsUsed: 1,
        timestamp: new Date(),
      });
    }

    return { text, toolCalls, usage };
  }
}

// ============================================
// Singleton Instance
// ============================================

let _aiClient: AIClient | null = null;

export function initAI(config: AIClientConfig): AIClient {
  _aiClient = new AIClient(config);
  return _aiClient;
}

export function getAI(): AIClient {
  if (!_aiClient) {
    throw new ElevayError(
      "AI client not initialized. Call initAI() first.",
      "AI_NOT_INITIALIZED"
    );
  }
  return _aiClient;
}

// ============================================
// Helper: Zod to JSON Schema (simplified)
// ============================================

function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  // This is a simplified implementation
  // For production, use a library like zod-to-json-schema

  if (schema instanceof z.ZodString) {
    return { type: "string" };
  }

  if (schema instanceof z.ZodNumber) {
    return { type: "number" };
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: "boolean" };
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: "array",
      items: zodToJsonSchema(schema._def.type),
    };
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodType);
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return {
      type: "object",
      properties,
      required,
    };
  }

  if (schema instanceof z.ZodEnum) {
    return {
      type: "string",
      enum: schema._def.values,
    };
  }

  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(schema._def.innerType);
  }

  if (schema instanceof z.ZodNullable) {
    return {
      anyOf: [zodToJsonSchema(schema._def.innerType), { type: "null" }],
    };
  }

  // Default fallback
  return { type: "string" };
}

// ============================================
// Tier Selection Helper
// ============================================

export function selectTier(options: {
  complexity: "low" | "medium" | "high";
  requiresReasoning?: boolean;
  costSensitive?: boolean;
}): LLMTier {
  const { complexity, requiresReasoning = false, costSensitive = true } = options;

  // High complexity or reasoning required -> Opus
  if (complexity === "high" || requiresReasoning) {
    return costSensitive ? "sonnet" : "opus";
  }

  // Medium complexity -> Sonnet
  if (complexity === "medium") {
    return "sonnet";
  }

  // Low complexity -> Haiku
  return "haiku";
}

// Re-export types
export type { LLMTier, LLMEvent, LLMUsage };
