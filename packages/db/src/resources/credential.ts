/**
 * Credential Resource
 *
 * Provides permission-checked access to encrypted credentials.
 * NEVER returns decrypted credentials - use getCrypto() separately.
 */

import { PermissionError } from "@elevay/types";
import { prisma } from "../client";
import type { CredentialType } from "@prisma/client";
import {
  BaseResource,
  type ResourceAuth,
  type QueryOptions,
  buildQueryOptions,
} from "./base";

// Type matching actual Prisma Credential model
interface CredentialData {
  id: string;
  name: string;
  value: string; // encrypted
  type: CredentialType;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class CredentialResource extends BaseResource<CredentialData> {
  // ============================================
  // Static Factory Methods
  // ============================================

  /**
   * Find a credential by ID with permission check.
   */
  static async findById(
    id: string,
    auth: ResourceAuth
  ): Promise<CredentialResource | null> {
    const credential = await prisma.credential.findUnique({
      where: { id },
    });

    if (!credential) return null;

    if (credential.userId !== auth.userId) {
      throw new PermissionError(auth.userId, "Credential", "read");
    }

    return new CredentialResource(credential as CredentialData, auth);
  }

  /**
   * Find all credentials for the user.
   */
  static async findAll(
    auth: ResourceAuth,
    options?: QueryOptions
  ): Promise<CredentialResource[]> {
    const credentials = await prisma.credential.findMany({
      where: { userId: auth.userId },
      ...buildQueryOptions(options),
    });

    return credentials.map(
      (cred: any) => new CredentialResource(cred as CredentialData, auth)
    );
  }

  /**
   * Find credentials by type.
   */
  static async findByType(
    auth: ResourceAuth,
    type: CredentialType,
    options?: QueryOptions
  ): Promise<CredentialResource[]> {
    const credentials = await prisma.credential.findMany({
      where: {
        userId: auth.userId,
        type,
      },
      ...buildQueryOptions(options),
    });

    return credentials.map(
      (cred: any) => new CredentialResource(cred as CredentialData, auth)
    );
  }

  /**
   * Create a new credential.
   * NOTE: Value should already be encrypted before calling this.
   */
  static async create(
    auth: ResourceAuth,
    data: {
      name: string;
      type: CredentialType;
      value: string;
    }
  ): Promise<CredentialResource> {
    const credential = await prisma.credential.create({
      data: {
        name: data.name,
        type: data.type,
        value: data.value,
        userId: auth.userId,
      },
    });

    return new CredentialResource(credential as CredentialData, auth);
  }

  /**
   * Check if a credential exists for a type.
   */
  static async exists(auth: ResourceAuth, type: CredentialType): Promise<boolean> {
    const count = await prisma.credential.count({
      where: {
        userId: auth.userId,
        type,
      },
    });

    return count > 0;
  }

  // ============================================
  // Instance Methods
  // ============================================

  /**
   * Update credential name.
   */
  async updateName(name: string): Promise<CredentialResource> {
    this.assertWrite();

    const updated = await prisma.credential.update({
      where: { id: this.id },
      data: { name },
    });

    this._data = updated as CredentialData;
    return this;
  }

  /**
   * Update the encrypted value (for key rotation).
   */
  async updateValue(value: string): Promise<CredentialResource> {
    this.assertWrite();

    const updated = await prisma.credential.update({
      where: { id: this.id },
      data: { value },
    });

    this._data = updated as CredentialData;
    return this;
  }

  /**
   * Delete the credential.
   */
  async delete(): Promise<void> {
    this.assertDelete();

    await prisma.credential.delete({
      where: { id: this.id },
    });
  }

  // ============================================
  // Getters
  // ============================================

  get name(): string {
    return this._data.name;
  }

  get type(): CredentialType {
    return this._data.type;
  }

  get userId(): string {
    return this._data.userId;
  }

  /**
   * Get encrypted value for decryption.
   * Should only be used by the connector/crypto layer.
   */
  getEncryptedValue(): string {
    this.assertRead();
    return this._data.value;
  }

  // ============================================
  // Serialization
  // ============================================

  /**
   * Returns metadata only - NEVER includes encrypted value.
   */
  toJSON(): Record<string, unknown> {
    this.assertRead();

    return {
      id: this.id,
      name: this.name,
      type: this.type,
      userId: this.userId,
      createdAt: this._data.createdAt.toISOString(),
      updatedAt: this._data.updatedAt.toISOString(),
    };
  }
}
