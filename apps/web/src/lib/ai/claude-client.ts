/**
 * Claude API Client - Direct Anthropic SDK Wrapper
 *
 * Benefits over Vercel AI SDK:
 * - Full control over tool calling loop
 * - Per-call AI event logging (tokens, cost, latency)
 * - Model tiering (Haiku/Sonnet/Opus)
 * - Better error handling
 * - Real streaming with tool execution mid-stream
 *
 * Usage:
 * ```typescript
 * const client = new ClaudeClient(config.llm.anthropicApiKey);
 *
 * // Non-streaming
 * const response = await client.chat({ ... });
 *
 * // Streaming (yields SSE-compatible events)
 * for await (const event of client.chatStream({ ... })) {
 *   // Handle text-delta, tool-input-start, tool-output-available, etc.
 * }
 * ```
 */

import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ContentBlock } from "@anthropic-ai/sdk/resources/messages";
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

// Stream events matching the frontend SSE protocol
export type StreamEvent =
  | { type: "text-delta"; delta: string }
  | { type: "tool-input-start"; toolCallId: string; toolName: string }
  | { type: "tool-input-available"; toolCallId: string; input: Record<string, unknown> }
  | { type: "tool-output-available"; toolCallId: string; output: unknown }
  | { type: "step-complete"; event: AIEvent }
  | { type: "finish"; usage: { promptTokens: number; completionTokens: number }; finishReason: string }
  | { type: "error"; message: string };

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
  // STREAMING CHAT
  // ============================================

  /**
   * Execute chat with streaming, yielding SSE-compatible events.
   * Handles tool calling loop: stream → detect tool_use → execute → resume.
   */
  async *chatStream(options: ChatOptions): AsyncGenerator<StreamEvent, ChatResponse, unknown> {
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
    let totalTokensIn = 0;
    let totalTokensOut = 0;

    // Tool calling loop
    while (stepNumber < maxSteps) {
      stepNumber++;
      const startTime = Date.now();

      try {
        const stream = this.client.messages.stream({
          model: modelName,
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt,
          messages,
          tools: tools.length > 0 ? (tools as Anthropic.Messages.Tool[]) : undefined,
        });

        // Track content blocks during streaming
        const toolCalls: ClaudeToolCall[] = [];
        let currentToolBlock: { id: string; name: string; jsonAccumulator: string } | null = null;
        let textContent = "";

        for await (const rawEvent of stream) {
          switch (rawEvent.type) {
            case "content_block_start": {
              const block = rawEvent.content_block;
              if (block.type === "tool_use") {
                currentToolBlock = {
                  id: block.id,
                  name: block.name,
                  jsonAccumulator: "",
                };
                yield { type: "tool-input-start", toolCallId: block.id, toolName: block.name };
              }
              break;
            }

            case "content_block_delta": {
              if (rawEvent.delta.type === "text_delta") {
                textContent += rawEvent.delta.text;
                yield { type: "text-delta", delta: rawEvent.delta.text };
              } else if (rawEvent.delta.type === "input_json_delta" && currentToolBlock) {
                currentToolBlock.jsonAccumulator += rawEvent.delta.partial_json;
              }
              break;
            }

            case "content_block_stop": {
              if (currentToolBlock) {
                let input: Record<string, unknown> = {};
                try {
                  input = JSON.parse(currentToolBlock.jsonAccumulator || "{}");
                } catch {
                  input = {};
                }

                toolCalls.push({
                  id: currentToolBlock.id,
                  name: currentToolBlock.name,
                  input,
                });

                yield { type: "tool-input-available", toolCallId: currentToolBlock.id, input };
                currentToolBlock = null;
              }
              break;
            }
          }
        }

        // Get final message for usage stats
        const message = await stream.finalMessage();
        const latency = Date.now() - startTime;

        finalContent = textContent;
        totalTokensIn += message.usage.input_tokens;
        totalTokensOut += message.usage.output_tokens;

        // Create AI event for this step
        const action: AIEvent["action"] = toolCalls.length > 0 ? "tool_use" : "final_response";
        const aiEvent: AIEvent = {
          agentId,
          conversationId,
          userId,
          model: modelName,
          tier: model,
          tokensIn: message.usage.input_tokens,
          tokensOut: message.usage.output_tokens,
          cost: calculateCost(message.usage.input_tokens, message.usage.output_tokens, model),
          latency,
          stepNumber,
          action,
          toolName: toolCalls.length > 0 ? toolCalls[0].name : undefined,
          timestamp: new Date(),
        };

        events.push(aiEvent);
        yield { type: "step-complete", event: aiEvent };

        if (onStepComplete) {
          await onStepComplete(aiEvent);
        }

        // If no tool calls, we're done
        if (toolCalls.length === 0 || message.stop_reason === "end_turn") {
          yield {
            type: "finish",
            usage: { promptTokens: totalTokensIn, completionTokens: totalTokensOut },
            finishReason: message.stop_reason || "end_turn",
          };

          return {
            content: finalContent,
            toolCalls: [],
            stopReason: message.stop_reason ?? "end_turn",
            usage: { input_tokens: totalTokensIn, output_tokens: totalTokensOut },
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

        // Add assistant message with tool calls to conversation
        messages.push({
          role: "assistant",
          content: message.content,
        });

        // Execute each tool and yield results
        const toolResults: ClaudeToolResult[] = [];
        for (const toolCall of toolCalls) {
          try {
            const result = await onToolCall(toolCall);
            toolResults.push(result);
            yield { type: "tool-output-available", toolCallId: toolCall.id, output: result.content };
          } catch (error) {
            const errorContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
            toolResults.push({
              tool_use_id: toolCall.id,
              content: errorContent,
              is_error: true,
            });
            yield { type: "tool-output-available", toolCallId: toolCall.id, output: errorContent };
          }
        }

        // Add tool results as user message for next iteration
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
            error.status >= 500
          );
        }
        throw error;
      }
    }

    // Max steps exceeded
    yield {
      type: "finish",
      usage: { promptTokens: totalTokensIn, completionTokens: totalTokensOut },
      finishReason: "max_steps",
    };

    return {
      content: finalContent || "Max steps exceeded",
      toolCalls: [],
      stopReason: "max_steps",
      usage: { input_tokens: totalTokensIn, output_tokens: totalTokensOut },
      events,
    };
  }

  // ============================================
  // SSE RESPONSE HELPER
  // ============================================

  /**
   * Create a ReadableStream SSE response from chatStream.
   * Returns a Response ready to send to the client.
   */
  createStreamResponse(options: ChatOptions): Response {
    const encoder = new TextEncoder();
    const generator = this.chatStream(options);

    const readable = new ReadableStream({
      async pull(controller) {
        try {
          const { value, done } = await generator.next();
          if (done) {
            controller.close();
            return;
          }
          const sseData = `data: ${JSON.stringify(value)}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        } catch (error) {
          const errorEvent = {
            type: "error",
            message: error instanceof Error ? error.message : "Stream error",
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
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
      if (!block) continue;
      if (block.type === "text") {
        textContent += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: (block.input ?? {}) as Record<string, unknown>,
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
        model: "claude-haiku-4-5-20251001",
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
