/**
 * Application Configuration with Zod Validation
 *
 * Benefits:
 * - Type-safe environment variables
 * - Validation at startup (fail-fast)
 * - Clear error messages for missing/invalid config
 * - Single source of truth for all config
 *
 * Usage:
 * ```typescript
 * import { config } from "@/lib/config";
 *
 * const apiKey = config.anthropic.apiKey;
 * const maxSteps = config.llm.maxStepsPerRun;
 * ```
 */

import { z } from "zod";
import { ConfigError } from "./errors";

// ============================================
// SCHEMA DEFINITIONS
// ============================================

const DatabaseConfigSchema = z.object({
  url: z.string().url("DATABASE_URL must be a valid URL"),
});

const AuthConfigSchema = z.object({
  secret: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  url: z.string().url("BETTER_AUTH_URL must be a valid URL"),
  trustedOrigins: z.string().optional(),
});

const LLMConfigSchema = z.object({
  // Anthropic (Claude)
  anthropicApiKey: z.string().min(1, "ANTHROPIC_API_KEY is required"),

  // OpenAI
  openaiApiKey: z.string().optional(),

  // Gemini
  geminiApiKey: z.string().optional(),

  // Execution limits
  maxStepsPerRun: z.coerce.number().int().min(1).max(50).default(5),
  defaultTemperature: z.coerce.number().min(0).max(1).default(0.3),
});

const ComposioConfigSchema = z.object({
  apiKey: z.string().min(1, "COMPOSIO_API_KEY is required for integrations"),
  baseUrl: z.string().url().default("https://backend.composio.dev"),
});

const PipedreamConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().url().default("https://api.pipedream.com"),
});

const RedisConfigSchema = z.object({
  url: z.string().url("REDIS_URL must be a valid URL").optional(),
});

const CredentialConfigSchema = z.object({
  encryptionKey: z.string().min(32, "CREDENTIAL_ENCRYPTION_KEY must be at least 32 characters").default("dev-encryption-key-32-chars-min!!"),
});

const SentryConfigSchema = z.object({
  dsn: z.string().url().optional(),
  environment: z.string().default("production"),
});

const AppConfigSchema = z.object({
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),
  port: z.coerce.number().int().positive().default(3000),
  baseUrl: z.string().url("NEXT_PUBLIC_BASE_URL must be a valid URL").default("http://localhost:3000"),
});

const ObservabilityConfigSchema = z.object({
  enableTracing: z.coerce.boolean().default(true),
  enableMetrics: z.coerce.boolean().default(true),
  enableAiEventLogging: z.coerce.boolean().default(true),
});

const EvalConfigSchema = z.object({
  enableL1: z.coerce.boolean().default(true),
  enableL2: z.coerce.boolean().default(true),
  enableL3: z.coerce.boolean().default(false),
  l2MinScore: z.coerce.number().min(0).max(1).default(0.6),
  l3AutoSendThreshold: z.coerce.number().min(0).max(1).default(0.85),
});

// ============================================
// COMPLETE CONFIG SCHEMA
// ============================================

const ConfigSchema = z.object({
  app: AppConfigSchema,
  database: DatabaseConfigSchema,
  auth: AuthConfigSchema,
  llm: LLMConfigSchema,
  composio: ComposioConfigSchema,
  pipedream: PipedreamConfigSchema,
  redis: RedisConfigSchema,
  credential: CredentialConfigSchema,
  sentry: SentryConfigSchema,
  observability: ObservabilityConfigSchema,
  eval: EvalConfigSchema,
});

export type Config = z.infer<typeof ConfigSchema>;

// ============================================
// CONFIG LOADER
// ============================================

/**
 * Load and validate configuration from environment variables
 * Throws ConfigError if validation fails
 */
function loadConfig(): Config {
  const rawConfig = {
    app: {
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
    },
    database: {
      url: process.env.DATABASE_URL,
    },
    auth: {
      secret: process.env.BETTER_AUTH_SECRET,
      url: process.env.BETTER_AUTH_URL,
      trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    },
    llm: {
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      geminiApiKey: process.env.GEMINI_API_KEY,
      maxStepsPerRun: process.env.LLM_MAX_STEPS_PER_RUN,
      defaultTemperature: process.env.LLM_DEFAULT_TEMPERATURE,
    },
    composio: {
      apiKey: process.env.COMPOSIO_API_KEY,
      baseUrl: process.env.COMPOSIO_BASE_URL,
    },
    pipedream: {
      apiKey: process.env.PIPEDREAM_API_KEY,
      baseUrl: process.env.PIPEDREAM_BASE_URL,
    },
    redis: {
      url: process.env.REDIS_URL,
    },
    credential: {
      encryptionKey: process.env.CREDENTIAL_ENCRYPTION_KEY,
    },
    sentry: {
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT,
    },
    observability: {
      enableTracing: process.env.ENABLE_TRACING,
      enableMetrics: process.env.ENABLE_METRICS,
      enableAiEventLogging: process.env.ENABLE_AI_EVENT_LOGGING,
    },
    eval: {
      enableL1: process.env.EVAL_ENABLE_L1,
      enableL2: process.env.EVAL_ENABLE_L2,
      enableL3: process.env.EVAL_ENABLE_L3,
      l2MinScore: process.env.EVAL_L2_MIN_SCORE,
      l3AutoSendThreshold: process.env.EVAL_L3_AUTO_SEND_THRESHOLD,
    },
  };

  try {
    return ConfigSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      const path = firstError.path.join(".");
      const message = firstError.message;

      throw ConfigError.missing(path);
    }
    throw error;
  }
}

// ============================================
// CONFIG SINGLETON
// ============================================

let configInstance: Config | null = null;

/**
 * Get application configuration
 * Loads and validates config on first access
 * Subsequent calls return cached config
 */
export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

/**
 * Validate configuration at startup
 * Call this in instrumentation.ts or at app start
 * Throws ConfigError if validation fails
 */
export function validateConfig(): void {
  try {
    getConfig();
    console.log("✓ Configuration validated successfully");
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`✗ Configuration error: ${error.message}`);
      // Re-throw the error instead of process.exit() to support all runtimes
      throw error;
    }
    throw error;
  }
}

// ============================================
// CONVENIENCE EXPORT
// ============================================

/**
 * Lazy configuration instance
 * Config is only validated when a property is actually accessed,
 * not at module import time. This prevents build failures when
 * env vars are unavailable during Next.js static page generation.
 */
export const config: Config = new Proxy({} as Config, {
  get(_, prop: string) {
    return getConfig()[prop as keyof Config];
  },
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return config.app.nodeEnv === "production";
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return config.app.nodeEnv === "development";
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return config.app.nodeEnv === "test";
}

/**
 * Get LLM model tier mapping
 */
export function getModelForTier(tier: "fast" | "smart" | "deep"): string {
  const models = {
    fast: "claude-3-haiku-20240307",
    smart: "claude-3-5-sonnet-20241022",
    deep: "claude-opus-4-5-20251101",
  };
  return models[tier];
}

/**
 * Calculate cost for LLM usage
 */
export function calculateCost(
  tokensIn: number,
  tokensOut: number,
  tier: "fast" | "smart" | "deep"
): number {
  // Pricing per 1M tokens (as of 2026)
  const pricing = {
    fast: { input: 0.25, output: 1.25 },      // Haiku
    smart: { input: 3.0, output: 15.0 },      // Sonnet
    deep: { input: 15.0, output: 75.0 },      // Opus
  };

  const prices = pricing[tier];
  const costIn = (tokensIn / 1_000_000) * prices.input;
  const costOut = (tokensOut / 1_000_000) * prices.output;

  return costIn + costOut;
}
