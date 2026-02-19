import { z } from 'zod';
import { LLMEvent, LLMTier, LLMUsage } from '@elevay/types';
export { LLMEvent, LLMTier, LLMUsage } from '@elevay/types';

/**
 * @elevay/ai
 *
 * Direct Anthropic SDK integration with:
 * - Model tiering (Haiku/Sonnet/Opus)
 * - AI event logging for cost tracking
 * - Structured output with Zod
 */

interface AIClientConfig {
    apiKey: string;
    defaultModel?: string;
    defaultMaxTokens?: number;
    onEvent?: (event: LLMEvent) => void | Promise<void>;
}
interface MessageOptions {
    tier?: LLMTier;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
    agentId?: string;
    userId?: string;
    workspaceId?: string;
}
interface StructuredOptions<T extends z.ZodType> extends MessageOptions {
    schema: T;
    schemaName?: string;
    schemaDescription?: string;
}
interface StreamCallbacks {
    onStart?: () => void;
    onToken?: (token: string) => void;
    onComplete?: (fullText: string, usage: LLMUsage) => void;
    onError?: (error: Error) => void;
}
declare class AIClient {
    private client;
    private config;
    constructor(config: AIClientConfig);
    /**
     * Get the model ID for a tier.
     */
    getModelForTier(tier: LLMTier): string;
    /**
     * Send a message and get a response.
     */
    message(userMessage: string, options?: MessageOptions): Promise<{
        text: string;
        usage: LLMUsage;
    }>;
    /**
     * Send a message with conversation history.
     */
    chat(messages: Array<{
        role: "user" | "assistant";
        content: string;
    }>, options?: MessageOptions): Promise<{
        text: string;
        usage: LLMUsage;
    }>;
    /**
     * Stream a response with callbacks.
     */
    stream(userMessage: string, options?: MessageOptions, callbacks?: StreamCallbacks): Promise<{
        text: string;
        usage: LLMUsage;
    }>;
    /**
     * Get structured output validated with Zod.
     */
    structured<T extends z.ZodType>(userMessage: string, options: StructuredOptions<T>): Promise<{
        data: z.infer<T>;
        usage: LLMUsage;
    }>;
    /**
     * Use tools (function calling).
     */
    withTools<T extends Record<string, z.ZodType>>(userMessage: string, tools: {
        [K in keyof T]: {
            description: string;
            schema: T[K];
        };
    }, options?: MessageOptions): Promise<{
        text: string;
        toolCalls: Array<{
            name: keyof T;
            input: z.infer<T[keyof T]>;
        }>;
        usage: LLMUsage;
    }>;
}
declare function initAI(config: AIClientConfig): AIClient;
declare function getAI(): AIClient;
declare function selectTier(options: {
    complexity: "low" | "medium" | "high";
    requiresReasoning?: boolean;
    costSensitive?: boolean;
}): LLMTier;

export { AIClient, type AIClientConfig, type MessageOptions, type StreamCallbacks, type StructuredOptions, getAI, initAI, selectTier };
