/**
 * @elevay/config
 *
 * Configuration management with @Env() decorator pattern and Zod validation.
 * The app refuses to start if required config is missing or invalid.
 */

import { z } from "zod";
import { ConfigError } from "@elevay/types";

// ============================================
// Types
// ============================================

interface EnvMetadata {
  envKey: string;
  required: boolean;
  defaultValue?: unknown;
  schema?: z.ZodType;
  transform?: (value: string) => unknown;
}

// ============================================
// Metadata Storage
// ============================================

const ENV_METADATA_KEY = Symbol("env:metadata");
const envMetadataMap = new Map<object, Map<string | symbol, EnvMetadata>>();

// ============================================
// @Env() Decorator
// ============================================

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
export function Env<T = string>(
  keyOrOptions?: string | EnvOptions<T>
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const options: EnvOptions<T> =
      typeof keyOrOptions === "string"
        ? { key: keyOrOptions }
        : keyOrOptions ?? {};

    const envKey =
      options.key ?? toScreamingSnakeCase(String(propertyKey));

    const metadata: EnvMetadata = {
      envKey,
      required: options.required ?? true,
      defaultValue: options.defaultValue,
      schema: options.schema,
      transform: options.transform as ((value: string) => unknown) | undefined,
    };

    let classMetadata = envMetadataMap.get(target);
    if (!classMetadata) {
      classMetadata = new Map();
      envMetadataMap.set(target, classMetadata);
    }
    classMetadata.set(propertyKey, metadata);
  };
}

// ============================================
// Base Config Class
// ============================================

export abstract class BaseConfig {
  private _validated = false;
  private _errors: ConfigError[] = [];

  constructor() {
    this.loadFromEnv();
  }

  private loadFromEnv(): void {
    const metadata = envMetadataMap.get(Object.getPrototypeOf(this));
    if (!metadata) return;

    for (const [propertyKey, envMeta] of metadata.entries()) {
      const rawValue = process.env[envMeta.envKey];

      // Handle missing values
      if (rawValue === undefined || rawValue === "") {
        if (envMeta.defaultValue !== undefined) {
          (this as Record<string | symbol, unknown>)[propertyKey] =
            envMeta.defaultValue;
          continue;
        }

        if (envMeta.required) {
          this._errors.push(
            new ConfigError(
              envMeta.envKey,
              `Required environment variable ${envMeta.envKey} is not set`
            )
          );
          continue;
        }

        continue;
      }

      // Transform value
      let value: unknown = rawValue;
      if (envMeta.transform) {
        try {
          value = envMeta.transform(rawValue);
        } catch (err) {
          this._errors.push(
            new ConfigError(
              envMeta.envKey,
              `Failed to transform ${envMeta.envKey}: ${err instanceof Error ? err.message : String(err)}`
            )
          );
          continue;
        }
      }

      // Validate with Zod schema
      if (envMeta.schema) {
        const result = envMeta.schema.safeParse(value);
        if (!result.success) {
          this._errors.push(
            new ConfigError(
              envMeta.envKey,
              `Validation failed for ${envMeta.envKey}: ${result.error.message}`
            )
          );
          continue;
        }
        value = result.data;
      }

      (this as Record<string | symbol, unknown>)[propertyKey] = value;
    }

    this._validated = true;
  }

  /**
   * Validates the config and throws if there are any errors.
   * Call this at app startup to fail fast on bad config.
   */
  validate(): void {
    if (this._errors.length > 0) {
      const messages = this._errors.map((e) => e.message).join("\n");
      throw new ConfigError(
        "MULTIPLE",
        `Configuration validation failed:\n${messages}`
      );
    }
  }

  /**
   * Returns validation errors without throwing.
   */
  getErrors(): ConfigError[] {
    return [...this._errors];
  }

  /**
   * Whether the config has been validated successfully.
   */
  isValid(): boolean {
    return this._validated && this._errors.length === 0;
  }
}

// ============================================
// Config Schemas
// ============================================

export const DatabaseConfigSchema = z.object({
  url: z.string().url(),
  poolSize: z.number().int().min(1).max(100).default(10),
});

export const AnthropicConfigSchema = z.object({
  apiKey: z.string().min(1),
  defaultModel: z
    .enum(["claude-3-5-haiku-20241022", "claude-sonnet-4-20250514", "claude-opus-4-20250514"])
    .default("claude-sonnet-4-20250514"),
  maxTokens: z.number().int().min(1).max(200000).default(4096),
});

export const RedisConfigSchema = z.object({
  url: z.string(),
  maxRetriesPerRequest: z.number().int().min(0).default(3),
});

export const PipedreamConfigSchema = z.object({
  publicKey: z.string().min(1),
  secretKey: z.string().min(1),
  projectId: z.string().min(1),
});

// ============================================
// Concrete Config Classes
// ============================================

export class DatabaseConfig extends BaseConfig {
  @Env("DATABASE_URL")
  url!: string;

  @Env({ key: "DATABASE_POOL_SIZE", defaultValue: 10, schema: z.coerce.number().int().min(1).max(100) })
  poolSize!: number;
}

export class AnthropicConfig extends BaseConfig {
  @Env("ANTHROPIC_API_KEY")
  apiKey!: string;

  @Env({
    key: "ANTHROPIC_DEFAULT_MODEL",
    defaultValue: "claude-sonnet-4-20250514",
  })
  defaultModel!: string;

  @Env({
    key: "ANTHROPIC_MAX_TOKENS",
    defaultValue: 4096,
    schema: z.coerce.number().int().min(1).max(200000),
  })
  maxTokens!: number;
}

export class RedisConfig extends BaseConfig {
  @Env("REDIS_URL")
  url!: string;

  @Env({
    key: "REDIS_MAX_RETRIES",
    defaultValue: 3,
    schema: z.coerce.number().int().min(0),
  })
  maxRetriesPerRequest!: number;
}

export class PipedreamConfig extends BaseConfig {
  @Env("PIPEDREAM_PUBLIC_KEY")
  publicKey!: string;

  @Env("PIPEDREAM_SECRET_KEY")
  secretKey!: string;

  @Env("PIPEDREAM_PROJECT_ID")
  projectId!: string;
}

export class AppConfig extends BaseConfig {
  @Env({ key: "NODE_ENV", defaultValue: "development" })
  nodeEnv!: string;

  @Env({
    key: "PORT",
    defaultValue: 3000,
    schema: z.coerce.number().int().min(1).max(65535),
  })
  port!: number;

  @Env("NEXT_PUBLIC_APP_URL")
  appUrl!: string;

  @Env({
    key: "LLM_MAX_STEPS_PER_RUN",
    defaultValue: 10,
    schema: z.coerce.number().int().min(1).max(100),
  })
  maxStepsPerRun!: number;

  @Env({
    key: "ENCRYPTION_KEY",
    required: true,
  })
  encryptionKey!: string;

  isDevelopment(): boolean {
    return this.nodeEnv === "development";
  }

  isProduction(): boolean {
    return this.nodeEnv === "production";
  }

  isTest(): boolean {
    return this.nodeEnv === "test";
  }
}

// ============================================
// Config Factory
// ============================================

let _appConfig: AppConfig | null = null;
let _databaseConfig: DatabaseConfig | null = null;
let _anthropicConfig: AnthropicConfig | null = null;
let _redisConfig: RedisConfig | null = null;
let _pipedreamConfig: PipedreamConfig | null = null;

export function getAppConfig(): AppConfig {
  if (!_appConfig) {
    _appConfig = new AppConfig();
    _appConfig.validate();
  }
  return _appConfig;
}

export function getDatabaseConfig(): DatabaseConfig {
  if (!_databaseConfig) {
    _databaseConfig = new DatabaseConfig();
    _databaseConfig.validate();
  }
  return _databaseConfig;
}

export function getAnthropicConfig(): AnthropicConfig {
  if (!_anthropicConfig) {
    _anthropicConfig = new AnthropicConfig();
    _anthropicConfig.validate();
  }
  return _anthropicConfig;
}

export function getRedisConfig(): RedisConfig {
  if (!_redisConfig) {
    _redisConfig = new RedisConfig();
    _redisConfig.validate();
  }
  return _redisConfig;
}

export function getPipedreamConfig(): PipedreamConfig {
  if (!_pipedreamConfig) {
    _pipedreamConfig = new PipedreamConfig();
    _pipedreamConfig.validate();
  }
  return _pipedreamConfig;
}

/**
 * Validates all configs at once. Call this at app startup.
 * Throws if any config is invalid.
 */
export function validateAllConfigs(): void {
  const configs = [
    new AppConfig(),
    new DatabaseConfig(),
    new AnthropicConfig(),
    // Redis and Pipedream are optional for basic operation
  ];

  const errors: ConfigError[] = [];
  for (const config of configs) {
    errors.push(...config.getErrors());
  }

  if (errors.length > 0) {
    const messages = errors.map((e) => e.message).join("\n");
    throw new ConfigError(
      "MULTIPLE",
      `Configuration validation failed:\n${messages}`
    );
  }
}

// ============================================
// Helpers
// ============================================

function toScreamingSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toUpperCase();
}

/**
 * Creates a type-safe env getter for a specific key.
 * Useful for one-off env access outside of config classes.
 */
export function envString(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    if (defaultValue !== undefined) return defaultValue;
    throw new ConfigError(key, `Required environment variable ${key} is not set`);
  }
  return value;
}

export function envNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined || value === "") {
    if (defaultValue !== undefined) return defaultValue;
    throw new ConfigError(key, `Required environment variable ${key} is not set`);
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    throw new ConfigError(key, `Environment variable ${key} must be a number, got: ${value}`);
  }
  return num;
}

export function envBoolean(key: string, defaultValue?: boolean): boolean {
  const value = process.env[key];
  if (value === undefined || value === "") {
    if (defaultValue !== undefined) return defaultValue;
    throw new ConfigError(key, `Required environment variable ${key} is not set`);
  }
  return value.toLowerCase() === "true" || value === "1";
}

export function envArray(key: string, defaultValue?: string[]): string[] {
  const value = process.env[key];
  if (value === undefined || value === "") {
    if (defaultValue !== undefined) return defaultValue;
    throw new ConfigError(key, `Required environment variable ${key} is not set`);
  }
  return value.split(",").map((s) => s.trim());
}
