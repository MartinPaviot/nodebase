/**
 * @elevay/crypto
 *
 * AES-256-GCM encryption with key rotation support.
 * All credentials MUST be encrypted before storage.
 */

import { randomBytes, createCipheriv, createDecipheriv, scrypt } from "crypto";
import { promisify } from "util";
import { CredentialError } from "@elevay/types";

const scryptAsync = promisify(scrypt);

// ============================================
// Constants
// ============================================

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;
const VERSION_LENGTH = 1;

// Current encryption version (for key rotation)
const CURRENT_VERSION = 1;

// ============================================
// Types
// ============================================

export interface EncryptedData {
  version: number;
  iv: string;
  salt: string;
  authTag: string;
  data: string;
}

export interface CryptoConfig {
  /** Primary encryption key */
  primaryKey: string;
  /** Previous keys for decryption during rotation */
  previousKeys?: string[];
}

// ============================================
// Crypto Class
// ============================================

export class Crypto {
  private primaryKey: string;
  private previousKeys: string[];

  constructor(config: CryptoConfig) {
    if (!config.primaryKey || config.primaryKey.length < 32) {
      throw new CredentialError(
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
  async encrypt(plaintext: string): Promise<string> {
    const iv = randomBytes(IV_LENGTH);
    const salt = randomBytes(SALT_LENGTH);
    const key = (await scryptAsync(this.primaryKey, salt, KEY_LENGTH)) as Buffer;

    const cipher = createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    let encrypted = cipher.update(plaintext, "utf8", "base64");
    encrypted += cipher.final("base64");

    const authTag = cipher.getAuthTag();

    const result: EncryptedData = {
      version: CURRENT_VERSION,
      iv: iv.toString("base64"),
      salt: salt.toString("base64"),
      authTag: authTag.toString("base64"),
      data: encrypted,
    };

    return Buffer.from(JSON.stringify(result)).toString("base64");
  }

  /**
   * Decrypts ciphertext. Supports key rotation by trying previous keys.
   */
  async decrypt(ciphertext: string): Promise<string> {
    const parsed = this.parseEncryptedData(ciphertext);

    // Try primary key first
    const primaryResult = await this.tryDecrypt(parsed, this.primaryKey);
    if (primaryResult !== null) {
      return primaryResult;
    }

    // Try previous keys for rotation
    for (const previousKey of this.previousKeys) {
      const result = await this.tryDecrypt(parsed, previousKey);
      if (result !== null) {
        return result;
      }
    }

    throw new CredentialError(
      "DECRYPTION_FAILED",
      "Failed to decrypt data with any available key"
    );
  }

  /**
   * Re-encrypts data with the current primary key.
   * Use this during key rotation to migrate old credentials.
   */
  async reEncrypt(ciphertext: string): Promise<string> {
    const plaintext = await this.decrypt(ciphertext);
    return this.encrypt(plaintext);
  }

  /**
   * Checks if data needs re-encryption (encrypted with old key).
   */
  async needsReEncryption(ciphertext: string): Promise<boolean> {
    const parsed = this.parseEncryptedData(ciphertext);
    const primaryResult = await this.tryDecrypt(parsed, this.primaryKey);
    return primaryResult === null;
  }

  private parseEncryptedData(ciphertext: string): EncryptedData {
    try {
      const decoded = Buffer.from(ciphertext, "base64").toString("utf8");
      return JSON.parse(decoded) as EncryptedData;
    } catch {
      throw new CredentialError(
        "PARSE_ERROR",
        "Invalid encrypted data format"
      );
    }
  }

  private async tryDecrypt(
    data: EncryptedData,
    encryptionKey: string
  ): Promise<string | null> {
    try {
      const iv = Buffer.from(data.iv, "base64");
      const salt = Buffer.from(data.salt, "base64");
      const authTag = Buffer.from(data.authTag, "base64");
      const encrypted = Buffer.from(data.data, "base64");

      const key = (await scryptAsync(encryptionKey, salt, KEY_LENGTH)) as Buffer;

      const decipher = createDecipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });

      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString("utf8");
    } catch {
      return null;
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

let _cryptoInstance: Crypto | null = null;

export function initCrypto(config: CryptoConfig): Crypto {
  _cryptoInstance = new Crypto(config);
  return _cryptoInstance;
}

export function getCrypto(): Crypto {
  if (!_cryptoInstance) {
    throw new CredentialError(
      "CRYPTO_NOT_INITIALIZED",
      "Crypto not initialized. Call initCrypto() first."
    );
  }
  return _cryptoInstance;
}

// ============================================
// Redaction Utilities
// ============================================

const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /bearer/i,
  /authorization/i,
  /credential/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
  /client[_-]?secret/i,
];

const SENSITIVE_KEYS = new Set([
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
  "encryption_key",
]);

/**
 * Redacts sensitive values from an object for safe logging/display.
 * Never expose unredacted credentials to the frontend.
 */
export function redact<T extends Record<string, unknown>>(
  obj: T,
  options?: { replacement?: string; preserveLength?: boolean }
): T {
  const { replacement = "***REDACTED***", preserveLength = false } = options ?? {};

  const redactValue = (value: string): string => {
    if (preserveLength) {
      return "*".repeat(Math.min(value.length, 20));
    }
    return replacement;
  };

  const processValue = (key: string, value: unknown): unknown => {
    if (value === null || value === undefined) {
      return value;
    }

    // Check if key is sensitive
    const isSensitiveKey =
      SENSITIVE_KEYS.has(key) ||
      SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));

    if (typeof value === "string") {
      return isSensitiveKey ? redactValue(value) : value;
    }

    if (Array.isArray(value)) {
      return value.map((item, index) => processValue(String(index), item));
    }

    if (typeof value === "object") {
      return redactObject(value as Record<string, unknown>);
    }

    return value;
  };

  const redactObject = (input: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      result[key] = processValue(key, value);
    }

    return result;
  };

  return redactObject(obj) as T;
}

/**
 * Masks a string, showing only the first and last few characters.
 * Useful for displaying partial API keys.
 */
export function mask(value: string, options?: { showFirst?: number; showLast?: number }): string {
  const { showFirst = 4, showLast = 4 } = options ?? {};

  if (value.length <= showFirst + showLast) {
    return "*".repeat(value.length);
  }

  const first = value.slice(0, showFirst);
  const last = value.slice(-showLast);
  const middle = "*".repeat(Math.min(value.length - showFirst - showLast, 8));

  return `${first}${middle}${last}`;
}

/**
 * Checks if a value looks like a credential (for validation).
 */
export function looksLikeCredential(value: string): boolean {
  // Common patterns for API keys and tokens
  const patterns = [
    /^sk-[a-zA-Z0-9]{32,}$/, // OpenAI style
    /^[a-z]{2,4}_[a-zA-Z0-9]{20,}$/, // Generic prefix_key
    /^[A-Za-z0-9_-]{32,}$/, // Long alphanumeric
    /^Bearer [a-zA-Z0-9._-]+$/, // Bearer token
    /^ghp_[a-zA-Z0-9]{36}$/, // GitHub PAT
    /^xox[baprs]-[a-zA-Z0-9-]+$/, // Slack token
  ];

  return patterns.some((pattern) => pattern.test(value));
}

// ============================================
// Hash Utilities
// ============================================

import { createHash } from "crypto";

/**
 * Creates a SHA-256 hash of a value.
 * Useful for creating deterministic IDs from credentials without storing them.
 */
export function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Creates a short hash (first 16 chars) for display purposes.
 */
export function shortHash(value: string): string {
  return hash(value).slice(0, 16);
}

// ============================================
// Random Generation
// ============================================

/**
 * Generates a cryptographically secure random string.
 */
export function generateRandomString(length: number = 32): string {
  return randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
}

/**
 * Generates a cryptographically secure random bytes buffer.
 */
export function generateRandomBytes(length: number = 32): Buffer {
  return randomBytes(length);
}

/**
 * Generates a secure encryption key (for initial setup).
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("base64");
}
