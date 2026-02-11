/**
 * Claude API Client - Direct Anthropic SDK Wrapper
 *
 * Benefits over Vercel AI SDK:
 * - Full control over tool calling loop
 * - Per-call AI event logging (tokens, cost, latency)
 * - Model tiering (Haiku/Sonnet/Opus)
 * - Better error handling
 * - Explicit streaming control
 *
 * Usage:
 * ```typescript
 * const client = new ClaudeClient(config.llm.anthropicApiKey);
 *
 * const stream = await client.chat({
 *   model: "smart", // or "fast", "deep"
 *   messages: [...],
 *   systemPrompt: "...",
 *   tools: [...],
 *   maxSteps: 5,
 *   onStepComplete: async (event) => {
 *     await logAIEvent(event);
 *   },
 * });
 * ```
 */

import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool, ContentBlock } from "@anthropic-ai/sdk/resources/messages";
import { LLMError } from "../errors";
import { getModelForTier, calculateCost } from "../config";

// ============================================
// TYPES
// ============================================

export type ModelTier = "fast" | "smart" | "deep";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ClaudeToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ClaudeToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface AIEvent {
  agentId?: string;
  conversationId?: string;
  userId: string;
  model: string;
  tier: ModelTier;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  latency: number;
  stepNumber: number;
  action: "thinking" | "tool_use" | "final_response";
  toolName?: string;
  timestamp: Date;
}

export interface ChatOptions {
  model: ModelTier;
  messages: ClaudeMessage[];
  systemPrompt?: string;
  tools?: ClaudeTool[];
  maxSteps?: number;
  temperature?: number;
  maxTokens?: number;
  userId: string;
  agentId?: string;
  conversationId?: string;
  onStepComplete?: (event: AIEvent) => Promise<void>;
  onToolCall?: (toolCall: ClaudeToolCall) => Promise<ClaudeToolResult>;
}

export interface ChatResponse {
  content: string;
  toolCalls: ClaudeToolCall[];
  stopReason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  events: AIEvent[];
}

// ============================================
// CLAUDE CLIENT
// ============================================

export class ClaudeClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
    });
  }

  // ============================================
  // MAIN CHAT METHOD
  // ============================================

  /**
   * Execute chat with automatic tool calling loop
   */
  async chat(options: ChatOptions): Promise<ChatResponse> {
    const {
      model,
      messages: initialMessages,
      systemPrompt,
      tools = [],
      maxSteps = 5,
      temperature = 0.3,
      maxTokens = 4096,
      userId,
      agentId,
      conversationId,
      onStepComplete,
      onToolCall,
    } = options;

    const modelName = getModelForTier(model);
    const messages: MessageParam[] = this.convertMessages(initialMessages);
    const events: AIEvent[] = [];
    let stepNumber = 0;
    let finalContent = "";

    // Tool calling loop
    while (stepNumber < maxSteps) {
      stepNumber++;
      const startTime = Date.now();

      try {
        // Call Claude API
        const response = await this.client.messages.create({
          model: modelName,
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt,
          messages,
          tools: tools.length > 0 ? tools : undefined,
        });

        const latency = Date.now() - startTime;

        // Extract content and tool calls
        const { textContent, toolCalls } = this.extractContent(response.content);
        finalContent = textContent;

        // Determine action type
        let action: "thinking" | "tool_use" | "final_response" = "final_response";
        let toolName: string | undefined;

        if (toolCalls.length > 0) {
          action = "tool_use";
          toolName = toolCalls[0].name;
        } else if (response.stop_reason === "end_turn") {
          action = "final_response";
        }

        // Create AI event
        const event: AIEvent = {
          agentId,
          conversationId,
          userId,
          model: modelName,
          tier: model,
          tokensIn: response.usage.input_tokens,
          tokensOut: response.usage.output_tokens,
          cost: calculateCost(
            response.usage.input_tokens,
            response.usage.output_tokens,
            model
          ),
          latency,
          stepNumber,
          action,
          toolName,
          timestamp: new Date(),
        };

        events.push(event);

        // Callback for logging
        if (onStepComplete) {
          await onStepComplete(event);
        }

        // If no tool calls, we're done
        if (toolCalls.length === 0 || response.stop_reason === "end_turn") {
          return {
            content: finalContent,
            toolCalls: [],
            stopReason: response.stop_reason ?? "end_turn",
            usage: response.usage,
            events,
          };
        }

        // Execute tool calls
        if (!onToolCall) {
          throw new LLMError(
            "anthropic",
            modelName,
            "Tool calls requested but no onToolCall handler provided",
            false
          );
        }

        // Add assistant message with tool calls
        messages.push({
          role: "assistant",
          content: response.content,
        });

        // Execute tools and collect results
        const toolResults: ClaudeToolResult[] = [];
        for (const toolCall of toolCalls) {
          try {
            const result = await onToolCall(toolCall);
            toolResults.push(result);
          } catch (error) {
            // Tool execution failed, return error result
            toolResults.push({
              tool_use_id: toolCall.id,
              content: `Error: ${error instanceof Error ? error.message : String(error)}`,
              is_error: true,
            });
          }
        }

        // Add tool results as user message
        messages.push({
          role: "user",
          content: toolResults.map((result) => ({
            type: "tool_result" as const,
            tool_use_id: result.tool_use_id,
            content: result.content,
            is_error: result.is_error,
          })),
        });
      } catch (error) {
        if (error instanceof Anthropic.APIError) {
          if (error.status === 429) {
            throw LLMError.rateLimited("anthropic", modelName);
          }
          if (error.status === 401 || error.status === 403) {
            throw LLMError.invalidApiKey("anthropic");
          }
          throw new LLMError(
            "anthropic",
            modelName,
            `API error: ${error.message}`,
            error.status >= 500 // Server errors are retryable
          );
        }
        throw error;
      }
    }

    // Max steps exceeded
    return {
      content: finalContent || "Max steps exceeded",
      toolCalls: [],
      stopReason: "max_steps",
      usage: {
        input_tokens: events.reduce((sum, e) => sum + e.tokensIn, 0),
        output_tokens: events.reduce((sum, e) => sum + e.tokensOut, 0),
      },
      events,
    };
  }

  // ============================================
  // STREAMING CHAT (TODO: Phase 2.2)
  // ============================================

  /**
   * Execute chat with streaming response
   * TODO: Implement SSE streaming for real-time UI updates
   */
  async *chatStream(options: ChatOptions): AsyncGenerator<string, ChatResponse, unknown> {
    // For now, just yield the final response
    // In Phase 2.2, we'll implement proper SSE streaming
    const response = await this.chat(options);
    yield response.content;
    return response;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Convert our message format to Anthropic format
   */
  private convertMessages(messages: ClaudeMessage[]): MessageParam[] {
    return messages.map((msg) => ({
      role: msg.role,
      content:
        typeof msg.content === "string"
          ? msg.content
          : msg.content.map((block) => {
              if ("type" in block && block.type === "text") {
                return { type: "text" as const, text: block.text };
              }
              return block;
            }),
    }));
  }

  /**
   * Extract text content and tool calls from response
   */
  private extractContent(
    content: ContentBlock[]
  ): {
    textContent: string;
    toolCalls: ClaudeToolCall[];
  } {
    let textContent = "";
    const toolCalls: ClaudeToolCall[] = [];

    for (const block of content) {
      if (block.type === "text") {
        textContent += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    return { textContent, toolCalls };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Test API key validity
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 1,
        messages: [{ role: "user", content: "test" }],
      });
      return true;
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        if (error.status === 401 || error.status === 403) {
          return false;
        }
      }
      throw error;
    }
  }

  /**
   * Get available models
   */
  getAvailableModels(): Record<ModelTier, string> {
    return {
      fast: getModelForTier("fast"),
      smart: getModelForTier("smart"),
      deep: getModelForTier("deep"),
    };
  }
}
