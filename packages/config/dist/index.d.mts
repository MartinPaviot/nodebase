import { z } from 'zod';
import { ConfigError } from '@nodebase/types';

/**
 * @nodebase/config
 *
 * Configuration management with @Env() decorator pattern and Zod validation.
 * The app refuses to start if required config is missing or invalid.
 */

interface EnvOptions<T = string> {
    /** Environment variable key (defaults to SCREAMING_SNAKE_CASE of property name) */
    key?: string;
    /** Whether this env var is required (default: true) */
    required?: boolean;
    /** Default value if not set */
    defaultValue?: T;
    /** Zod schema for validation */
    schema?: z.ZodType<T>;
    /** Transform function for the raw string value */
    transform?: (value: string) => T;
}
/**
 * Decorator to mark a property as sourced from an environment variable.
 *
 * @example
 * class AppConfig extends BaseConfig {
 *   @Env('ANTHROPIC_API_KEY')
 *   apiKey!: string;
 *
 *   @Env({ key: 'PORT', defaultValue: 3000, schema: z.coerce.number() })
 *   port!: number;
 *
 *   @Env({ key: 'DEBUG', defaultValue: false, transform: (v) => v === 'true' })
 *   debug!: boolean;
 * }
 */
declare function Env<T = string>(keyOrOptions?: string | EnvOptions<T>): PropertyDecorator;
declare abstract class BaseConfig {
    private _validated;
    private _errors;
    constructor();
    private loadFromEnv;
    /**
     * Validates the config and throws if there are any errors.
     * Call this at app startup to fail fast on bad config.
     */
    validate(): void;
    /**
     * Returns validation errors without throwing.
     */
    getErrors(): ConfigError[];
    /**
     * Whether the config has been validated successfully.
     */
    isValid(): boolean;
}
declare const DatabaseConfigSchema: z.ZodObject<{
    url: z.ZodString;
    poolSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    url: string;
    poolSize: number;
}, {
    url: string;
    poolSize?: number | undefined;
}>;
declare const AnthropicConfigSchema: z.ZodObject<{
    apiKey: z.ZodString;
    defaultModel: z.ZodDefault<z.ZodEnum<["claude-3-5-haiku-20241022", "claude-sonnet-4-20250514", "claude-opus-4-20250514"]>>;
    maxTokens: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    apiKey: string;
    defaultModel: "claude-3-5-haiku-20241022" | "claude-sonnet-4-20250514" | "claude-opus-4-20250514";
    maxTokens: number;
}, {
    apiKey: string;
    defaultModel?: "claude-3-5-haiku-20241022" | "claude-sonnet-4-20250514" | "claude-opus-4-20250514" | undefined;
    maxTokens?: number | undefined;
}>;
declare const RedisConfigSchema: z.ZodObject<{
    url: z.ZodString;
    maxRetriesPerRequest: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    url: string;
    maxRetriesPerRequest: number;
}, {
    url: string;
    maxRetriesPerRequest?: number | undefined;
}>;
declare const PipedreamConfigSchema: z.ZodObject<{
    publicKey: z.ZodString;
    secretKey: z.ZodString;
    projectId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    publicKey: string;
    secretKey: string;
    projectId: string;
}, {
    publicKey: string;
    secretKey: string;
    projectId: string;
}>;
declare class DatabaseConfig extends BaseConfig {
    url: string;
    poolSize: number;
}
declare class AnthropicConfig extends BaseConfig {
    apiKey: string;
    defaultModel: string;
    maxTokens: number;
}
declare class RedisConfig extends BaseConfig {
    url: string;
    maxRetriesPerRequest: number;
}
declare class PipedreamConfig extends BaseConfig {
    publicKey: string;
    secretKey: string;
    projectId: string;
}
declare class AppConfig extends BaseConfig {
    nodeEnv: string;
    port: number;
    appUrl: string;
    maxStepsPerRun: number;
    encryptionKey: string;
    isDevelopment(): boolean;
    isProduction(): boolean;
    isTest(): boolean;
}
declare function getAppConfig(): AppConfig;
declare function getDatabaseConfig(): DatabaseConfig;
declare function getAnthropicConfig(): AnthropicConfig;
declare function getRedisConfig(): RedisConfig;
declare function getPipedreamConfig(): PipedreamConfig;
/**
 * Validates all configs at once. Call this at app startup.
 * Throws if any config is invalid.
 */
declare function validateAllConfigs(): void;
/**
 * Creates a type-safe env getter for a specific key.
 * Useful for one-off env access outside of config classes.
 */
declare function envString(key: string, defaultValue?: string): string;
declare function envNumber(key: string, defaultValue?: number): number;
declare function envBoolean(key: string, defaultValue?: boolean): boolean;
declare function envArray(key: string, defaultValue?: string[]): string[];

export { AnthropicConfig, AnthropicConfigSchema, AppConfig, BaseConfig, DatabaseConfig, DatabaseConfigSchema, Env, PipedreamConfig, PipedreamConfigSchema, RedisConfig, RedisConfigSchema, envArray, envBoolean, envNumber, envString, getAnthropicConfig, getAppConfig, getDatabaseConfig, getPipedreamConfig, getRedisConfig, validateAllConfigs };
