"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AnthropicConfig: () => AnthropicConfig,
  AnthropicConfigSchema: () => AnthropicConfigSchema,
  AppConfig: () => AppConfig,
  BaseConfig: () => BaseConfig,
  DatabaseConfig: () => DatabaseConfig,
  DatabaseConfigSchema: () => DatabaseConfigSchema,
  Env: () => Env,
  PipedreamConfig: () => PipedreamConfig,
  PipedreamConfigSchema: () => PipedreamConfigSchema,
  RedisConfig: () => RedisConfig,
  RedisConfigSchema: () => RedisConfigSchema,
  envArray: () => envArray,
  envBoolean: () => envBoolean,
  envNumber: () => envNumber,
  envString: () => envString,
  getAnthropicConfig: () => getAnthropicConfig,
  getAppConfig: () => getAppConfig,
  getDatabaseConfig: () => getDatabaseConfig,
  getPipedreamConfig: () => getPipedreamConfig,
  getRedisConfig: () => getRedisConfig,
  validateAllConfigs: () => validateAllConfigs
});
module.exports = __toCommonJS(index_exports);
var import_zod = require("zod");
var import_types = require("@elevay/types");
var envMetadataMap = /* @__PURE__ */ new Map();
function Env(keyOrOptions) {
  return (target, propertyKey) => {
    const options = typeof keyOrOptions === "string" ? { key: keyOrOptions } : keyOrOptions ?? {};
    const envKey = options.key ?? toScreamingSnakeCase(String(propertyKey));
    const metadata = {
      envKey,
      required: options.required ?? true,
      defaultValue: options.defaultValue,
      schema: options.schema,
      transform: options.transform
    };
    let classMetadata = envMetadataMap.get(target);
    if (!classMetadata) {
      classMetadata = /* @__PURE__ */ new Map();
      envMetadataMap.set(target, classMetadata);
    }
    classMetadata.set(propertyKey, metadata);
  };
}
var BaseConfig = class {
  _validated = false;
  _errors = [];
  constructor() {
    this.loadFromEnv();
  }
  loadFromEnv() {
    const metadata = envMetadataMap.get(Object.getPrototypeOf(this));
    if (!metadata) return;
    for (const [propertyKey, envMeta] of metadata.entries()) {
      const rawValue = process.env[envMeta.envKey];
      if (rawValue === void 0 || rawValue === "") {
        if (envMeta.defaultValue !== void 0) {
          this[propertyKey] = envMeta.defaultValue;
          continue;
        }
        if (envMeta.required) {
          this._errors.push(
            new import_types.ConfigError(
              envMeta.envKey,
              `Required environment variable ${envMeta.envKey} is not set`
            )
          );
          continue;
        }
        continue;
      }
      let value = rawValue;
      if (envMeta.transform) {
        try {
          value = envMeta.transform(rawValue);
        } catch (err) {
          this._errors.push(
            new import_types.ConfigError(
              envMeta.envKey,
              `Failed to transform ${envMeta.envKey}: ${err instanceof Error ? err.message : String(err)}`
            )
          );
          continue;
        }
      }
      if (envMeta.schema) {
        const result = envMeta.schema.safeParse(value);
        if (!result.success) {
          this._errors.push(
            new import_types.ConfigError(
              envMeta.envKey,
              `Validation failed for ${envMeta.envKey}: ${result.error.message}`
            )
          );
          continue;
        }
        value = result.data;
      }
      this[propertyKey] = value;
    }
    this._validated = true;
  }
  /**
   * Validates the config and throws if there are any errors.
   * Call this at app startup to fail fast on bad config.
   */
  validate() {
    if (this._errors.length > 0) {
      const messages = this._errors.map((e) => e.message).join("\n");
      throw new import_types.ConfigError(
        "MULTIPLE",
        `Configuration validation failed:
${messages}`
      );
    }
  }
  /**
   * Returns validation errors without throwing.
   */
  getErrors() {
    return [...this._errors];
  }
  /**
   * Whether the config has been validated successfully.
   */
  isValid() {
    return this._validated && this._errors.length === 0;
  }
};
var DatabaseConfigSchema = import_zod.z.object({
  url: import_zod.z.string().url(),
  poolSize: import_zod.z.number().int().min(1).max(100).default(10)
});
var AnthropicConfigSchema = import_zod.z.object({
  apiKey: import_zod.z.string().min(1),
  defaultModel: import_zod.z.enum(["claude-3-5-haiku-20241022", "claude-sonnet-4-20250514", "claude-opus-4-20250514"]).default("claude-sonnet-4-20250514"),
  maxTokens: import_zod.z.number().int().min(1).max(2e5).default(4096)
});
var RedisConfigSchema = import_zod.z.object({
  url: import_zod.z.string(),
  maxRetriesPerRequest: import_zod.z.number().int().min(0).default(3)
});
var PipedreamConfigSchema = import_zod.z.object({
  publicKey: import_zod.z.string().min(1),
  secretKey: import_zod.z.string().min(1),
  projectId: import_zod.z.string().min(1)
});
var DatabaseConfig = class extends BaseConfig {
  url;
  poolSize;
};
__decorateClass([
  Env("DATABASE_URL")
], DatabaseConfig.prototype, "url", 2);
__decorateClass([
  Env({ key: "DATABASE_POOL_SIZE", defaultValue: 10, schema: import_zod.z.coerce.number().int().min(1).max(100) })
], DatabaseConfig.prototype, "poolSize", 2);
var AnthropicConfig = class extends BaseConfig {
  apiKey;
  defaultModel;
  maxTokens;
};
__decorateClass([
  Env("ANTHROPIC_API_KEY")
], AnthropicConfig.prototype, "apiKey", 2);
__decorateClass([
  Env({
    key: "ANTHROPIC_DEFAULT_MODEL",
    defaultValue: "claude-sonnet-4-20250514"
  })
], AnthropicConfig.prototype, "defaultModel", 2);
__decorateClass([
  Env({
    key: "ANTHROPIC_MAX_TOKENS",
    defaultValue: 4096,
    schema: import_zod.z.coerce.number().int().min(1).max(2e5)
  })
], AnthropicConfig.prototype, "maxTokens", 2);
var RedisConfig = class extends BaseConfig {
  url;
  maxRetriesPerRequest;
};
__decorateClass([
  Env("REDIS_URL")
], RedisConfig.prototype, "url", 2);
__decorateClass([
  Env({
    key: "REDIS_MAX_RETRIES",
    defaultValue: 3,
    schema: import_zod.z.coerce.number().int().min(0)
  })
], RedisConfig.prototype, "maxRetriesPerRequest", 2);
var PipedreamConfig = class extends BaseConfig {
  publicKey;
  secretKey;
  projectId;
};
__decorateClass([
  Env("PIPEDREAM_PUBLIC_KEY")
], PipedreamConfig.prototype, "publicKey", 2);
__decorateClass([
  Env("PIPEDREAM_SECRET_KEY")
], PipedreamConfig.prototype, "secretKey", 2);
__decorateClass([
  Env("PIPEDREAM_PROJECT_ID")
], PipedreamConfig.prototype, "projectId", 2);
var AppConfig = class extends BaseConfig {
  nodeEnv;
  port;
  appUrl;
  maxStepsPerRun;
  encryptionKey;
  isDevelopment() {
    return this.nodeEnv === "development";
  }
  isProduction() {
    return this.nodeEnv === "production";
  }
  isTest() {
    return this.nodeEnv === "test";
  }
};
__decorateClass([
  Env({ key: "NODE_ENV", defaultValue: "development" })
], AppConfig.prototype, "nodeEnv", 2);
__decorateClass([
  Env({
    key: "PORT",
    defaultValue: 3e3,
    schema: import_zod.z.coerce.number().int().min(1).max(65535)
  })
], AppConfig.prototype, "port", 2);
__decorateClass([
  Env("NEXT_PUBLIC_APP_URL")
], AppConfig.prototype, "appUrl", 2);
__decorateClass([
  Env({
    key: "LLM_MAX_STEPS_PER_RUN",
    defaultValue: 10,
    schema: import_zod.z.coerce.number().int().min(1).max(100)
  })
], AppConfig.prototype, "maxStepsPerRun", 2);
__decorateClass([
  Env({
    key: "ENCRYPTION_KEY",
    required: true
  })
], AppConfig.prototype, "encryptionKey", 2);
var _appConfig = null;
var _databaseConfig = null;
var _anthropicConfig = null;
var _redisConfig = null;
var _pipedreamConfig = null;
function getAppConfig() {
  if (!_appConfig) {
    _appConfig = new AppConfig();
    _appConfig.validate();
  }
  return _appConfig;
}
function getDatabaseConfig() {
  if (!_databaseConfig) {
    _databaseConfig = new DatabaseConfig();
    _databaseConfig.validate();
  }
  return _databaseConfig;
}
function getAnthropicConfig() {
  if (!_anthropicConfig) {
    _anthropicConfig = new AnthropicConfig();
    _anthropicConfig.validate();
  }
  return _anthropicConfig;
}
function getRedisConfig() {
  if (!_redisConfig) {
    _redisConfig = new RedisConfig();
    _redisConfig.validate();
  }
  return _redisConfig;
}
function getPipedreamConfig() {
  if (!_pipedreamConfig) {
    _pipedreamConfig = new PipedreamConfig();
    _pipedreamConfig.validate();
  }
  return _pipedreamConfig;
}
function validateAllConfigs() {
  const configs = [
    new AppConfig(),
    new DatabaseConfig(),
    new AnthropicConfig()
    // Redis and Pipedream are optional for basic operation
  ];
  const errors = [];
  for (const config of configs) {
    errors.push(...config.getErrors());
  }
  if (errors.length > 0) {
    const messages = errors.map((e) => e.message).join("\n");
    throw new import_types.ConfigError(
      "MULTIPLE",
      `Configuration validation failed:
${messages}`
    );
  }
}
function toScreamingSnakeCase(str) {
  return str.replace(/([a-z])([A-Z])/g, "$1_$2").replace(/([A-Z])([A-Z][a-z])/g, "$1_$2").toUpperCase();
}
function envString(key, defaultValue) {
  const value = process.env[key];
  if (value === void 0 || value === "") {
    if (defaultValue !== void 0) return defaultValue;
    throw new import_types.ConfigError(key, `Required environment variable ${key} is not set`);
  }
  return value;
}
function envNumber(key, defaultValue) {
  const value = process.env[key];
  if (value === void 0 || value === "") {
    if (defaultValue !== void 0) return defaultValue;
    throw new import_types.ConfigError(key, `Required environment variable ${key} is not set`);
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    throw new import_types.ConfigError(key, `Environment variable ${key} must be a number, got: ${value}`);
  }
  return num;
}
function envBoolean(key, defaultValue) {
  const value = process.env[key];
  if (value === void 0 || value === "") {
    if (defaultValue !== void 0) return defaultValue;
    throw new import_types.ConfigError(key, `Required environment variable ${key} is not set`);
  }
  return value.toLowerCase() === "true" || value === "1";
}
function envArray(key, defaultValue) {
  const value = process.env[key];
  if (value === void 0 || value === "") {
    if (defaultValue !== void 0) return defaultValue;
    throw new import_types.ConfigError(key, `Required environment variable ${key} is not set`);
  }
  return value.split(",").map((s) => s.trim());
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AnthropicConfig,
  AnthropicConfigSchema,
  AppConfig,
  BaseConfig,
  DatabaseConfig,
  DatabaseConfigSchema,
  Env,
  PipedreamConfig,
  PipedreamConfigSchema,
  RedisConfig,
  RedisConfigSchema,
  envArray,
  envBoolean,
  envNumber,
  envString,
  getAnthropicConfig,
  getAppConfig,
  getDatabaseConfig,
  getPipedreamConfig,
  getRedisConfig,
  validateAllConfigs
});
