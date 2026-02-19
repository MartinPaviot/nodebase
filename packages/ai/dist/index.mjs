// src/index.ts
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  LLM_MODELS,
  ElevayError
} from "@elevay/types";
var COST_PER_MILLION_TOKENS = {
  "claude-3-5-haiku-20241022": { input: 1, output: 5 },
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-opus-4-20250514": { input: 15, output: 75 }
};
function calculateCost(model, inputTokens, outputTokens) {
  const costs = COST_PER_MILLION_TOKENS[model];
  if (!costs) {
    return (inputTokens * 3 + outputTokens * 15) / 1e6;
  }
  return (inputTokens * costs.input + outputTokens * costs.output) / 1e6;
}
var AIClient = class {
  client;
  config;
  constructor(config) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.config = {
      apiKey: config.apiKey,
      defaultModel: config.defaultModel ?? LLM_MODELS.sonnet,
      defaultMaxTokens: config.defaultMaxTokens ?? 4096,
      onEvent: config.onEvent ?? (() => {
      })
    };
  }
  /**
   * Get the model ID for a tier.
   */
  getModelForTier(tier) {
    return LLM_MODELS[tier];
  }
  /**
   * Send a message and get a response.
   */
  async message(userMessage, options = {}) {
    const startTime = Date.now();
    const model = options.tier ? this.getModelForTier(options.tier) : this.config.defaultModel;
    const response = await this.client.messages.create({
      model,
      max_tokens: options.maxTokens ?? this.config.defaultMaxTokens,
      temperature: options.temperature ?? 0.7,
      system: options.systemPrompt,
      messages: [{ role: "user", content: userMessage }]
    });
    const latencyMs = Date.now() - startTime;
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cost = calculateCost(model, inputTokens, outputTokens);
    const usage = {
      model,
      tier: options.tier ?? "sonnet",
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      cost,
      latencyMs
    };
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
        timestamp: /* @__PURE__ */ new Date()
      });
    }
    const textBlock = response.content.find((block) => block.type === "text");
    const text = textBlock?.type === "text" ? textBlock.text : "";
    return { text, usage };
  }
  /**
   * Send a message with conversation history.
   */
  async chat(messages, options = {}) {
    const startTime = Date.now();
    const model = options.tier ? this.getModelForTier(options.tier) : this.config.defaultModel;
    const response = await this.client.messages.create({
      model,
      max_tokens: options.maxTokens ?? this.config.defaultMaxTokens,
      temperature: options.temperature ?? 0.7,
      system: options.systemPrompt,
      messages
    });
    const latencyMs = Date.now() - startTime;
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cost = calculateCost(model, inputTokens, outputTokens);
    const usage = {
      model,
      tier: options.tier ?? "sonnet",
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      cost,
      latencyMs
    };
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
        timestamp: /* @__PURE__ */ new Date()
      });
    }
    const textBlock = response.content.find((block) => block.type === "text");
    const text = textBlock?.type === "text" ? textBlock.text : "";
    return { text, usage };
  }
  /**
   * Stream a response with callbacks.
   */
  async stream(userMessage, options = {}, callbacks = {}) {
    const startTime = Date.now();
    const model = options.tier ? this.getModelForTier(options.tier) : this.config.defaultModel;
    callbacks.onStart?.();
    let fullText = "";
    let inputTokens = 0;
    let outputTokens = 0;
    const stream = this.client.messages.stream({
      model,
      max_tokens: options.maxTokens ?? this.config.defaultMaxTokens,
      temperature: options.temperature ?? 0.7,
      system: options.systemPrompt,
      messages: [{ role: "user", content: userMessage }]
    });
    try {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
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
      callbacks.onError?.(error);
      throw error;
    }
    const latencyMs = Date.now() - startTime;
    const cost = calculateCost(model, inputTokens, outputTokens);
    const usage = {
      model,
      tier: options.tier ?? "sonnet",
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      cost,
      latencyMs
    };
    callbacks.onComplete?.(fullText, usage);
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
        timestamp: /* @__PURE__ */ new Date()
      });
    }
    return { text: fullText, usage };
  }
  /**
   * Get structured output validated with Zod.
   */
  async structured(userMessage, options) {
    const { schema, schemaName = "response", schemaDescription, ...messageOptions } = options;
    const structuredPrompt = `${messageOptions.systemPrompt ?? ""}

You must respond with valid JSON that matches the following schema:
${JSON.stringify(zodToJsonSchema(schema), null, 2)}

${schemaDescription ? `Description: ${schemaDescription}` : ""}

Respond ONLY with the JSON object, no additional text.`;
    const { text, usage } = await this.message(userMessage, {
      ...messageOptions,
      systemPrompt: structuredPrompt
    });
    try {
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
  async withTools(userMessage, tools, options = {}) {
    const startTime = Date.now();
    const model = options.tier ? this.getModelForTier(options.tier) : this.config.defaultModel;
    const anthropicTools = Object.entries(tools).map(([name, tool]) => {
      const schema = zodToJsonSchema(tool.schema);
      return {
        name,
        description: tool.description,
        input_schema: {
          type: "object",
          ...typeof schema === "object" && schema !== null ? schema : {}
        }
      };
    });
    const response = await this.client.messages.create({
      model,
      max_tokens: options.maxTokens ?? this.config.defaultMaxTokens,
      temperature: options.temperature ?? 0.7,
      system: options.systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools: anthropicTools
    });
    const latencyMs = Date.now() - startTime;
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cost = calculateCost(model, inputTokens, outputTokens);
    const usage = {
      model,
      tier: options.tier ?? "sonnet",
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      cost,
      latencyMs
    };
    let text = "";
    const toolCalls = [];
    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
      } else if (block.type === "tool_use") {
        const toolDef = tools[block.name];
        if (toolDef) {
          const validated = toolDef.schema.parse(block.input);
          toolCalls.push({ name: block.name, input: validated });
        }
      }
    }
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
        timestamp: /* @__PURE__ */ new Date()
      });
    }
    return { text, toolCalls, usage };
  }
};
var _aiClient = null;
function initAI(config) {
  _aiClient = new AIClient(config);
  return _aiClient;
}
function getAI() {
  if (!_aiClient) {
    throw new ElevayError(
      "AI client not initialized. Call initAI() first.",
      "AI_NOT_INITIALIZED"
    );
  }
  return _aiClient;
}
function zodToJsonSchema(schema) {
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
      items: zodToJsonSchema(schema._def.type)
    };
  }
  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();
    const properties = {};
    const required = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }
    return {
      type: "object",
      properties,
      required
    };
  }
  if (schema instanceof z.ZodEnum) {
    return {
      type: "string",
      enum: schema._def.values
    };
  }
  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(schema._def.innerType);
  }
  if (schema instanceof z.ZodNullable) {
    return {
      anyOf: [zodToJsonSchema(schema._def.innerType), { type: "null" }]
    };
  }
  return { type: "string" };
}
function selectTier(options) {
  const { complexity, requiresReasoning = false, costSensitive = true } = options;
  if (complexity === "high" || requiresReasoning) {
    return costSensitive ? "sonnet" : "opus";
  }
  if (complexity === "medium") {
    return "sonnet";
  }
  return "haiku";
}
export {
  AIClient,
  getAI,
  initAI,
  selectTier
};
