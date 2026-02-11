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

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Crypto: () => Crypto,
  generateEncryptionKey: () => generateEncryptionKey,
  generateRandomBytes: () => generateRandomBytes,
  generateRandomString: () => generateRandomString,
  getCrypto: () => getCrypto,
  hash: () => hash,
  initCrypto: () => initCrypto,
  looksLikeCredential: () => looksLikeCredential,
  mask: () => mask,
  redact: () => redact,
  shortHash: () => shortHash
});
module.exports = __toCommonJS(index_exports);
var import_crypto = require("crypto");
var import_util = require("util");
var import_types = require("@nodebase/types");
var import_crypto2 = require("crypto");
var scryptAsync = (0, import_util.promisify)(import_crypto.scrypt);
var ALGORITHM = "aes-256-gcm";
var IV_LENGTH = 16;
var SALT_LENGTH = 32;
var KEY_LENGTH = 32;
var AUTH_TAG_LENGTH = 16;
var CURRENT_VERSION = 1;
var Crypto = class {
  primaryKey;
  previousKeys;
  constructor(config) {
    if (!config.primaryKey || config.primaryKey.length < 32) {
      throw new import_types.CredentialError(
        "ENCRYPTION_KEY",
        "Encryption key must be at least 32 characters"
      );
    }
    this.primaryKey = config.primaryKey;
    this.previousKeys = config.previousKeys ?? [];
  }
  /**
   * Encrypts plaintext using AES-256-GCM.
   * Returns a base64-encoded JSON string that can be safely stored.
   */
  async encrypt(plaintext) {
    const iv = (0, import_crypto.randomBytes)(IV_LENGTH);
    const salt = (0, import_crypto.randomBytes)(SALT_LENGTH);
    const key = await scryptAsync(this.primaryKey, salt, KEY_LENGTH);
    const cipher = (0, import_crypto.createCipheriv)(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH
    });
    let encrypted = cipher.update(plaintext, "utf8", "base64");
    encrypted += cipher.final("base64");
    const authTag = cipher.getAuthTag();
    const result = {
      version: CURRENT_VERSION,
      iv: iv.toString("base64"),
      salt: salt.toString("base64"),
      authTag: authTag.toString("base64"),
      data: encrypted
    };
    return Buffer.from(JSON.stringify(result)).toString("base64");
  }
  /**
   * Decrypts ciphertext. Supports key rotation by trying previous keys.
   */
  async decrypt(ciphertext) {
    const parsed = this.parseEncryptedData(ciphertext);
    const primaryResult = await this.tryDecrypt(parsed, this.primaryKey);
    if (primaryResult !== null) {
      return primaryResult;
    }
    for (const previousKey of this.previousKeys) {
      const result = await this.tryDecrypt(parsed, previousKey);
      if (result !== null) {
        return result;
      }
    }
    throw new import_types.CredentialError(
      "DECRYPTION_FAILED",
      "Failed to decrypt data with any available key"
    );
  }
  /**
   * Re-encrypts data with the current primary key.
   * Use this during key rotation to migrate old credentials.
   */
  async reEncrypt(ciphertext) {
    const plaintext = await this.decrypt(ciphertext);
    return this.encrypt(plaintext);
  }
  /**
   * Checks if data needs re-encryption (encrypted with old key).
   */
  async needsReEncryption(ciphertext) {
    const parsed = this.parseEncryptedData(ciphertext);
    const primaryResult = await this.tryDecrypt(parsed, this.primaryKey);
    return primaryResult === null;
  }
  parseEncryptedData(ciphertext) {
    try {
      const decoded = Buffer.from(ciphertext, "base64").toString("utf8");
      return JSON.parse(decoded);
    } catch {
      throw new import_types.CredentialError(
        "PARSE_ERROR",
        "Invalid encrypted data format"
      );
    }
  }
  async tryDecrypt(data, encryptionKey) {
    try {
      const iv = Buffer.from(data.iv, "base64");
      const salt = Buffer.from(data.salt, "base64");
      const authTag = Buffer.from(data.authTag, "base64");
      const encrypted = Buffer.from(data.data, "base64");
      const key = await scryptAsync(encryptionKey, salt, KEY_LENGTH);
      const decipher = (0, import_crypto.createDecipheriv)(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH
      });
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString("utf8");
    } catch {
      return null;
    }
  }
};
var _cryptoInstance = null;
function initCrypto(config) {
  _cryptoInstance = new Crypto(config);
  return _cryptoInstance;
}
function getCrypto() {
  if (!_cryptoInstance) {
    throw new import_types.CredentialError(
      "CRYPTO_NOT_INITIALIZED",
      "Crypto not initialized. Call initCrypto() first."
    );
  }
  return _cryptoInstance;
}
var SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /bearer/i,
  /authorization/i,
  /credential/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
  /client[_-]?secret/i
];
var SENSITIVE_KEYS = /* @__PURE__ */ new Set([
  "apiKey",
  "api_key",
  "secretKey",
  "secret_key",
  "password",
  "token",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "bearerToken",
  "bearer_token",
  "authorization",
  "privateKey",
  "private_key",
  "clientSecret",
  "client_secret",
  "encryptionKey",
  "encryption_key"
]);
function redact(obj, options) {
  const { replacement = "***REDACTED***", preserveLength = false } = options ?? {};
  const redactValue = (value) => {
    if (preserveLength) {
      return "*".repeat(Math.min(value.length, 20));
    }
    return replacement;
  };
  const processValue = (key, value) => {
    if (value === null || value === void 0) {
      return value;
    }
    const isSensitiveKey = SENSITIVE_KEYS.has(key) || SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
    if (typeof value === "string") {
      return isSensitiveKey ? redactValue(value) : value;
    }
    if (Array.isArray(value)) {
      return value.map((item, index) => processValue(String(index), item));
    }
    if (typeof value === "object") {
      return redactObject(value);
    }
    return value;
  };
  const redactObject = (input) => {
    const result = {};
    for (const [key, value] of Object.entries(input)) {
      result[key] = processValue(key, value);
    }
    return result;
  };
  return redactObject(obj);
}
function mask(value, options) {
  const { showFirst = 4, showLast = 4 } = options ?? {};
  if (value.length <= showFirst + showLast) {
    return "*".repeat(value.length);
  }
  const first = value.slice(0, showFirst);
  const last = value.slice(-showLast);
  const middle = "*".repeat(Math.min(value.length - showFirst - showLast, 8));
  return `${first}${middle}${last}`;
}
function looksLikeCredential(value) {
  const patterns = [
    /^sk-[a-zA-Z0-9]{32,}$/,
    // OpenAI style
    /^[a-z]{2,4}_[a-zA-Z0-9]{20,}$/,
    // Generic prefix_key
    /^[A-Za-z0-9_-]{32,}$/,
    // Long alphanumeric
    /^Bearer [a-zA-Z0-9._-]+$/,
    // Bearer token
    /^ghp_[a-zA-Z0-9]{36}$/,
    // GitHub PAT
    /^xox[baprs]-[a-zA-Z0-9-]+$/
    // Slack token
  ];
  return patterns.some((pattern) => pattern.test(value));
}
function hash(value) {
  return (0, import_crypto2.createHash)("sha256").update(value).digest("hex");
}
function shortHash(value) {
  return hash(value).slice(0, 16);
}
function generateRandomString(length = 32) {
  return (0, import_crypto.randomBytes)(Math.ceil(length / 2)).toString("hex").slice(0, length);
}
function generateRandomBytes(length = 32) {
  return (0, import_crypto.randomBytes)(length);
}
function generateEncryptionKey() {
  return (0, import_crypto.randomBytes)(32).toString("base64");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Crypto,
  generateEncryptionKey,
  generateRandomBytes,
  generateRandomString,
  getCrypto,
  hash,
  initCrypto,
  looksLikeCredential,
  mask,
  redact,
  shortHash
});
