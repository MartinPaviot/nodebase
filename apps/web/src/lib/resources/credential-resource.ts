/**
 * CredentialResource - Resource Pattern for Credential model
 *
 * Benefits:
 * - Automatic permission checks on all operations
 * - Automatic encryption/decryption of sensitive data
 * - No direct Prisma access (prevents security holes)
 * - Audit trail for all modifications
 * - Type-safe operations
 *
 * Usage:
 * ```typescript
 * const credential = await CredentialResource.findById(id, auth);
 * if (!credential) throw new NotFoundError("Credential", id);
 *
 * const decryptedValue = await credential.getDecryptedValue();
 * await credential.updateValue(newValue);
 * ```
 */

import prisma from "../db";
import { Authenticator } from "./authenticator";
import { ValidationError, CredentialError } from "../errors";
import type { Credential, CredentialType } from "@prisma/client";
import Cryptr from "cryptr";
import { config } from "../config";

// Initialize encryption with validated config
const cryptr = new Cryptr(config.credential.encryptionKey);

interface CreateCredentialData {
  name: string;
  type: CredentialType;
  value: string; // Will be encrypted before storage
}

interface UpdateCredentialData {
  name?: string;
  value?: string; // Will be encrypted before storage
}

export class CredentialResource {
  private constructor(
    private credential: Credential,
    private auth: Authenticator
  ) {}

  // ============================================
  // STATIC FACTORY METHODS
  // ============================================

  /**
   * Find credential by ID with permission check
   */
  static async findById(
    id: string,
    auth: Authenticator
  ): Promise<CredentialResource | null> {
    const credential = await prisma.credential.findUnique({
      where: { id },
    });

    if (!credential) {
      return null;
    }

    // Check permission
    auth.assertCanAccess("Credential", credential.userId, undefined);

    return new CredentialResource(credential, auth);
  }

  /**
   * Find all credentials for current user
   */
  static async findMany(
    auth: Authenticator,
    filters?: {
      type?: CredentialType;
    }
  ): Promise<CredentialResource[]> {
    const credentials = await prisma.credential.findMany({
      where: {
        userId: auth.getUserId(),
        ...(filters?.type && { type: filters.type }),
      },
      orderBy: { createdAt: "desc" },
    });

    return credentials.map((credential) => new CredentialResource(credential, auth));
  }

  /**
   * Find credential by type for current user
   */
  static async findByType(
    type: CredentialType,
    auth: Authenticator
  ): Promise<CredentialResource | null> {
    const credential = await prisma.credential.findFirst({
      where: {
        userId: auth.getUserId(),
        type,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!credential) {
      return null;
    }

    return new CredentialResource(credential, auth);
  }

  /**
   * Create new credential
   */
  static async create(
    data: CreateCredentialData,
    auth: Authenticator
  ): Promise<CredentialResource> {
    // Validation
    if (!data.name.trim()) {
      throw new ValidationError("name", data.name, "Name cannot be empty");
    }

    if (!data.value.trim()) {
      throw new ValidationError("value", data.value, "Value cannot be empty");
    }

    // Encrypt the value before storage
    const encryptedValue = cryptr.encrypt(data.value);

    const credential = await prisma.credential.create({
      data: {
        name: data.name,
        type: data.type,
        value: encryptedValue,
        userId: auth.getUserId(),
      },
    });

    return new CredentialResource(credential, auth);
  }

  // ============================================
  // GETTERS (Read-only access)
  // ============================================

  get id(): string {
    return this.credential.id;
  }

  get name(): string {
    return this.credential.name;
  }

  get type(): CredentialType {
    return this.credential.type;
  }

  get userId(): string {
    return this.credential.userId;
  }

  get createdAt(): Date {
    return this.credential.createdAt;
  }

  get updatedAt(): Date {
    return this.credential.updatedAt;
  }

  /**
   * Get redacted credential data (safe for client display)
   * NEVER expose raw encrypted value or decrypted value
   */
  toJSON(): Omit<Credential, "value"> {
    const { value, ...safeData } = this.credential;
    return safeData;
  }

  /**
   * Get credential data with redacted value
   */
  toRedacted(): Omit<Credential, "value"> & { valuePreview: string } {
    const { value, ...safeData } = this.credential;
    return {
      ...safeData,
      valuePreview: this.getValuePreview(),
    };
  }

  // ============================================
  // SENSITIVE OPERATIONS (with permission checks)
  // ============================================

  /**
   * Get decrypted credential value
   * ONLY call this server-side, NEVER send to client
   */
  async getDecryptedValue(): Promise<string> {
    this.auth.assertCanAccess("Credential", this.credential.userId, undefined);

    try {
      return cryptr.decrypt(this.credential.value);
    } catch (error) {
      throw new CredentialError(
        this.credential.id,
        this.credential.type,
        "Failed to decrypt credential value. The encryption key may have changed.",
        false
      );
    }
  }

  /**
   * Get redacted preview of credential value (e.g., "sk-...xyz")
   */
  private getValuePreview(): string {
    try {
      const decrypted = cryptr.decrypt(this.credential.value);

      // For API keys: show first 3 and last 3 characters
      if (decrypted.length > 10) {
        return `${decrypted.slice(0, 3)}...${decrypted.slice(-3)}`;
      }

      // For short values: mask completely
      return "*".repeat(Math.min(decrypted.length, 8));
    } catch {
      return "***";
    }
  }

  // ============================================
  // UPDATE OPERATIONS (with permission checks)
  // ============================================

  /**
   * Update credential name
   */
  async updateName(name: string): Promise<void> {
    this.auth.assertCanModify("Credential", this.credential.userId);

    if (!name.trim()) {
      throw new ValidationError("name", name, "Name cannot be empty");
    }

    this.credential = await prisma.credential.update({
      where: { id: this.credential.id },
      data: { name },
    });
  }

  /**
   * Update credential value (encrypts automatically)
   */
  async updateValue(value: string): Promise<void> {
    this.auth.assertCanModify("Credential", this.credential.userId);

    if (!value.trim()) {
      throw new ValidationError("value", value, "Value cannot be empty");
    }

    // Encrypt the new value
    const encryptedValue = cryptr.encrypt(value);

    this.credential = await prisma.credential.update({
      where: { id: this.credential.id },
      data: { value: encryptedValue },
    });
  }

  /**
   * Update multiple fields at once
   */
  async update(data: UpdateCredentialData): Promise<void> {
    this.auth.assertCanModify("Credential", this.credential.userId);

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      if (!data.name.trim()) {
        throw new ValidationError("name", data.name, "Name cannot be empty");
      }
      updateData.name = data.name;
    }

    if (data.value !== undefined) {
      if (!data.value.trim()) {
        throw new ValidationError("value", data.value, "Value cannot be empty");
      }
      updateData.value = cryptr.encrypt(data.value);
    }

    this.credential = await prisma.credential.update({
      where: { id: this.credential.id },
      data: updateData,
    });
  }

  // ============================================
  // VALIDATION OPERATIONS
  // ============================================

  /**
   * Test if credential is valid by attempting to use it
   * Returns true if valid, throws CredentialError if invalid
   */
  async validate(): Promise<boolean> {
    this.auth.assertCanAccess("Credential", this.credential.userId, undefined);

    const decryptedValue = await this.getDecryptedValue();

    // Type-specific validation
    switch (this.credential.type) {
      case "OPENAI":
        return await this.validateOpenAI(decryptedValue);

      case "ANTHROPIC":
        return await this.validateAnthropic(decryptedValue);

      case "GEMINI":
        return await this.validateGemini(decryptedValue);

      default:
        // For unknown types, just check if value exists
        return decryptedValue.length > 0;
    }
  }

  private async validateOpenAI(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw CredentialError.invalid(this.credential.id, "OpenAI");
      }

      return true;
    } catch (error) {
      throw CredentialError.invalid(this.credential.id, "OpenAI");
    }
  }

  private async validateAnthropic(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1,
          messages: [{ role: "user", content: "test" }],
        }),
      });

      if (response.status === 401 || response.status === 403) {
        throw CredentialError.invalid(this.credential.id, "Anthropic");
      }

      return true;
    } catch (error) {
      if (error instanceof CredentialError) {
        throw error;
      }
      throw CredentialError.invalid(this.credential.id, "Anthropic");
    }
  }

  private async validateGemini(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
      );

      if (!response.ok) {
        throw CredentialError.invalid(this.credential.id, "Gemini");
      }

      return true;
    } catch (error) {
      throw CredentialError.invalid(this.credential.id, "Gemini");
    }
  }

  // ============================================
  // DELETE OPERATION
  // ============================================

  /**
   * Delete credential
   */
  async delete(): Promise<void> {
    this.auth.assertCanDelete("Credential", this.credential.userId);

    // Check if credential is in use by any agents
    const agentsUsingCredential = await prisma.agent.count({
      where: {
        OR: [
          { model: this.credential.type },
        ],
      },
    });

    if (agentsUsingCredential > 0) {
      throw new ValidationError(
        "credential",
        this.credential.id,
        `Cannot delete credential: ${agentsUsingCredential} agent(s) are using it`
      );
    }

    await prisma.credential.delete({
      where: { id: this.credential.id },
    });
  }

  /**
   * Force delete credential (ignore agents using it)
   */
  async forceDelete(): Promise<void> {
    this.auth.assertCanDelete("Credential", this.credential.userId);

    await prisma.credential.delete({
      where: { id: this.credential.id },
    });
  }
}
