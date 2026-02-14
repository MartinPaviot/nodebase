/**
 * IntegrationResource - Resource Pattern for Integration model
 *
 * Benefits:
 * - Automatic permission checks (user owns the integration)
 * - Secure credential handling (never expose raw credentials)
 * - Type-safe operations
 *
 * Usage:
 * ```typescript
 * const integration = await IntegrationResource.findById(id, auth);
 * if (!integration) throw new NotFoundError("Integration", id);
 *
 * const isConnected = integration.isConnected();
 * await integration.disconnect();
 * ```
 */

import prisma from "../db";
import { Authenticator } from "./authenticator";
import { NotFoundError, ValidationError } from "../errors";
import type { Integration, IntegrationType } from "@prisma/client";

export class IntegrationResource {
  private constructor(
    private integration: Integration,
    private auth: Authenticator
  ) {}

  // ============================================
  // STATIC FACTORY METHODS
  // ============================================

  /**
   * Find integration by ID with permission check
   */
  static async findById(
    id: string,
    auth: Authenticator
  ): Promise<IntegrationResource | null> {
    const integration = await prisma.integration.findUnique({
      where: { id },
    });

    if (!integration) {
      return null;
    }

    // Check permission - user must own the integration
    auth.assertCanAccess("Integration", integration.userId);

    return new IntegrationResource(integration, auth);
  }

  /**
   * Find all integrations for current user
   */
  static async findMany(
    auth: Authenticator,
    filters?: {
      type?: IntegrationType;
    }
  ): Promise<IntegrationResource[]> {
    const integrations = await prisma.integration.findMany({
      where: {
        userId: auth.getUserId(),
        ...(filters?.type ? { type: filters.type } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return integrations.map((integration) => new IntegrationResource(integration, auth));
  }

  /**
   * Find integration by type for current user
   */
  static async findByType(
    type: IntegrationType,
    auth: Authenticator
  ): Promise<IntegrationResource | null> {
    const integration = await prisma.integration.findFirst({
      where: {
        userId: auth.getUserId(),
        type,
      },
    });

    if (!integration) {
      return null;
    }

    return new IntegrationResource(integration, auth);
  }

  /**
   * Create new integration
   */
  static async create(
    data: {
      type: IntegrationType;
      accessToken: string;
      refreshToken?: string;
      expiresAt?: Date;
      scopes?: string[];
      accountEmail?: string;
      accountName?: string;
    },
    auth: Authenticator
  ): Promise<IntegrationResource> {
    if (!data.accessToken.trim()) {
      throw new ValidationError("accessToken", data.accessToken, "Access token cannot be empty");
    }

    const integration = await prisma.integration.create({
      data: {
        userId: auth.getUserId(),
        type: data.type,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        scopes: data.scopes ?? [],
        accountEmail: data.accountEmail,
        accountName: data.accountName,
      },
    });

    return new IntegrationResource(integration, auth);
  }

  // ============================================
  // GETTERS (Read-only access)
  // ============================================

  get id(): string {
    return this.integration.id;
  }

  get userId(): string {
    return this.integration.userId;
  }

  get type(): IntegrationType {
    return this.integration.type;
  }

  get scopes(): string[] {
    return this.integration.scopes;
  }

  get expiresAt(): Date | null {
    return this.integration.expiresAt;
  }

  get createdAt(): Date {
    return this.integration.createdAt;
  }

  get accountEmail(): string | null {
    return this.integration.accountEmail;
  }

  get accountName(): string | null {
    return this.integration.accountName;
  }

  /**
   * Check if token is expired
   */
  isExpired(): boolean {
    if (!this.integration.expiresAt) {
      return false;
    }
    return new Date() >= this.integration.expiresAt;
  }

  /**
   * Check if integration is connected and valid
   */
  isConnected(): boolean {
    return !this.isExpired();
  }

  /**
   * Get access token (ONLY for server-side API calls)
   * NEVER expose this to the frontend
   */
  getAccessToken(): string {
    this.auth.assertCanAccess("Integration", this.integration.userId);

    if (!this.isConnected()) {
      throw new ValidationError(
        "integration",
        this.integration.id,
        "Integration is not connected or token is expired"
      );
    }

    return this.integration.accessToken;
  }

  /**
   * Get refresh token (ONLY for token refresh operations)
   */
  getRefreshToken(): string | null {
    this.auth.assertCanAccess("Integration", this.integration.userId);
    return this.integration.refreshToken;
  }

  /**
   * Get safe representation (without sensitive data) for frontend
   */
  toJSON(): Omit<Integration, "accessToken" | "refreshToken"> {
    const { accessToken, refreshToken, ...safe } = this.integration;
    return safe;
  }

  // ============================================
  // UPDATE OPERATIONS (with permission checks)
  // ============================================

  /**
   * Update access token (e.g., after refresh)
   */
  async updateTokens(data: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }): Promise<void> {
    this.auth.assertCanModify("Integration", this.integration.userId);

    if (!data.accessToken.trim()) {
      throw new ValidationError("accessToken", data.accessToken, "Access token cannot be empty");
    }

    this.integration = await prisma.integration.update({
      where: { id: this.integration.id },
      data: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
      },
    });
  }

  // ============================================
  // DELETE OPERATION
  // ============================================

  /**
   * Delete integration (hard delete / disconnect)
   */
  async delete(): Promise<void> {
    this.auth.assertCanDelete("Integration", this.integration.userId);

    await prisma.integration.delete({
      where: { id: this.integration.id },
    });
  }
}
