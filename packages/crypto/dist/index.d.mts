/**
 * @elevay/crypto
 *
 * AES-256-GCM encryption with key rotation support.
 * All credentials MUST be encrypted before storage.
 */
interface EncryptedData {
    version: number;
    iv: string;
    salt: string;
    authTag: string;
    data: string;
}
interface CryptoConfig {
    /** Primary encryption key */
    primaryKey: string;
    /** Previous keys for decryption during rotation */
    previousKeys?: string[];
}
declare class Crypto {
    private primaryKey;
    private previousKeys;
    constructor(config: CryptoConfig);
    /**
     * Encrypts plaintext using AES-256-GCM.
     * Returns a base64-encoded JSON string that can be safely stored.
     */
    encrypt(plaintext: string): Promise<string>;
    /**
     * Decrypts ciphertext. Supports key rotation by trying previous keys.
     */
    decrypt(ciphertext: string): Promise<string>;
    /**
     * Re-encrypts data with the current primary key.
     * Use this during key rotation to migrate old credentials.
     */
    reEncrypt(ciphertext: string): Promise<string>;
    /**
     * Checks if data needs re-encryption (encrypted with old key).
     */
    needsReEncryption(ciphertext: string): Promise<boolean>;
    private parseEncryptedData;
    private tryDecrypt;
}
declare function initCrypto(config: CryptoConfig): Crypto;
declare function getCrypto(): Crypto;
/**
 * Redacts sensitive values from an object for safe logging/display.
 * Never expose unredacted credentials to the frontend.
 */
declare function redact<T extends Record<string, unknown>>(obj: T, options?: {
    replacement?: string;
    preserveLength?: boolean;
}): T;
/**
 * Masks a string, showing only the first and last few characters.
 * Useful for displaying partial API keys.
 */
declare function mask(value: string, options?: {
    showFirst?: number;
    showLast?: number;
}): string;
/**
 * Checks if a value looks like a credential (for validation).
 */
declare function looksLikeCredential(value: string): boolean;
/**
 * Creates a SHA-256 hash of a value.
 * Useful for creating deterministic IDs from credentials without storing them.
 */
declare function hash(value: string): string;
/**
 * Creates a short hash (first 16 chars) for display purposes.
 */
declare function shortHash(value: string): string;
/**
 * Generates a cryptographically secure random string.
 */
declare function generateRandomString(length?: number): string;
/**
 * Generates a cryptographically secure random bytes buffer.
 */
declare function generateRandomBytes(length?: number): Buffer;
/**
 * Generates a secure encryption key (for initial setup).
 */
declare function generateEncryptionKey(): string;

export { Crypto, type CryptoConfig, type EncryptedData, generateEncryptionKey, generateRandomBytes, generateRandomString, getCrypto, hash, initCrypto, looksLikeCredential, mask, redact, shortHash };
