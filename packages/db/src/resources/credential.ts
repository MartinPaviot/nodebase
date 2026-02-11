/**
 * Credential Resource
 *
 * Provides permission-checked access to encrypted credentials.
 * NEVER returns decrypted credentials - use getCrypto() separately.
 */

import { PermissionError, type ConnectorCategory } from "@nodebase/types";
import { prisma } from "../client";
import {
  BaseResource,
  type ResourceAuth,
  type QueryOptions,
  buildQueryOptions,
  workspaceScope,
} from "./base";

interface CredentialData {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  type: string;
  encryptedData: string;
  expiresAt: Date | null;
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

    if (credential.workspaceId !== auth.workspaceId) {
      throw new PermissionError(auth.userId, "Credential", "read");
    }

    return new CredentialResource(credential as CredentialData, auth);
  }

  /**
   * Find all credentials in the workspace.
   */
  static async findAll(
    auth: ResourceAuth,
    options?: QueryOptions
  ): Promise<CredentialResource[]> {
    const credentials = await prisma.credential.findMany({
      where: workspaceScope(auth),
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
    type: string,
    options?: QueryOptions
  ): Promise<CredentialResource[]> {
    const credentials = await prisma.credential.findMany({
      where: {
        ...workspaceScope(auth),
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
   * NOTE: Data should already be encrypted before calling this.
   */
  static async create(
    auth: ResourceAuth,
    data: {
      name: string;
      type: string;
      encryptedData: string;
      expiresAt?: Date;
    }
  ): Promise<CredentialResource> {
    const credential = await prisma.credential.create({
      data: {
        ...data,
        workspaceId: auth.workspaceId,
        userId: auth.userId,
      },
    });

    return new CredentialResource(credential as CredentialData, auth);
  }

  /**
   * Check if a credential exists for a type.
   */
  static async exists(auth: ResourceAuth, type: string): Promise<boolean> {
    const count = await prisma.credential.count({
      where: {
        ...workspaceScope(auth),
        type,
      },
    });

    return count > 0;
  }

  // ============================================
  // Instance Methods
  // ============================================

  /**
   * Update credential metadata (not the encrypted data).
   */
  async updateMetadata(data: { name?: string; expiresAt?: Date }): Promise<CredentialResource> {
    this.assertWrite();

    const updated = await prisma.credential.update({
      where: { id: this.id },
      data,
    });

    this._data = updated as CredentialData;
    return this;
  }

  /**
   * Update the encrypted data (for key rotation).
   */
  async updateEncryptedData(encryptedData: string): Promise<CredentialResource> {
    this.assertWrite();

    const updated = await prisma.credential.update({
      where: { id: this.id },
      data: { encryptedData },
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

  /**
   * Check if the credential is expired.
   */
  isExpired(): boolean {
    if (!this._data.expiresAt) return false;
    return this._data.expiresAt < new Date();
  }

  // ============================================
  // Getters
  // ============================================

  get name(): string {
    return this._data.name;
  }

  get type(): string {
    return this._data.type;
  }

  get workspaceId(): string {
    return this._data.workspaceId;
  }

  get userId(): string {
    return this._data.userId;
  }

  get expiresAt(): Date | null {
    return this._data.expiresAt;
  }

  /**
   * Get encrypted data for decryption.
   * Should only be used by the connector layer.
   */
  getEncryptedData(): string {
    this.assertRead();
    return this._data.encryptedData;
  }

  // ============================================
  // Serialization
  // ============================================

  /**
   * Returns metadata only - NEVER includes encrypted data.
   */
  toJSON(): Record<string, unknown> {
    this.assertRead();

    return {
      id: this.id,
      name: this.name,
      type: this.type,
      workspaceId: this.workspaceId,
      userId: this.userId,
      expiresAt: this._data.expiresAt?.toISOString() ?? null,
      isExpired: this.isExpired(),
      createdAt: this._data.createdAt.toISOString(),
      updatedAt: this._data.updatedAt.toISOString(),
    };
  }
}
