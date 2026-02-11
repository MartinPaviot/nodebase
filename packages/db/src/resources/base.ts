/**
 * Base Resource Pattern
 *
 * All database models must be accessed through Resource classes that:
 * 1. Check permissions before any operation
 * 2. Provide a clean API for common operations
 * 3. Handle soft deletes and workspace scoping
 */

import { PermissionError, type WorkspaceId, type UserId } from "@nodebase/types";
import { prisma } from "../client";

// ============================================
// Auth Interface
// ============================================

export interface ResourceAuth {
  userId: UserId;
  workspaceId: WorkspaceId;
  role: "owner" | "admin" | "member" | "viewer";
}

// ============================================
// Permission Checks
// ============================================

export function canRead(auth: ResourceAuth, resourceWorkspaceId: WorkspaceId): boolean {
  return auth.workspaceId === resourceWorkspaceId;
}

export function canWrite(auth: ResourceAuth, resourceWorkspaceId: WorkspaceId): boolean {
  return (
    auth.workspaceId === resourceWorkspaceId &&
    ["owner", "admin", "member"].includes(auth.role)
  );
}

export function canDelete(auth: ResourceAuth, resourceWorkspaceId: WorkspaceId): boolean {
  return (
    auth.workspaceId === resourceWorkspaceId &&
    ["owner", "admin"].includes(auth.role)
  );
}

export function canManage(auth: ResourceAuth, resourceWorkspaceId: WorkspaceId): boolean {
  return (
    auth.workspaceId === resourceWorkspaceId &&
    ["owner", "admin"].includes(auth.role)
  );
}

// ============================================
// Base Resource Class
// ============================================

export abstract class BaseResource<T extends { id: string; workspaceId?: string | null }> {
  protected _data: T;
  protected _auth: ResourceAuth;

  constructor(data: T, auth: ResourceAuth) {
    this._data = data;
    this._auth = auth;
  }

  /**
   * Get the underlying data (read-only).
   */
  get data(): Readonly<T> {
    return Object.freeze({ ...this._data });
  }

  /**
   * Get the resource ID.
   */
  get id(): string {
    return this._data.id;
  }

  /**
   * Check if the current user can read this resource.
   */
  canRead(): boolean {
    const wsId = this._data.workspaceId ?? this._auth.workspaceId;
    return canRead(this._auth, wsId);
  }

  /**
   * Check if the current user can write to this resource.
   */
  canWrite(): boolean {
    const wsId = this._data.workspaceId ?? this._auth.workspaceId;
    return canWrite(this._auth, wsId);
  }

  /**
   * Check if the current user can delete this resource.
   */
  canDelete(): boolean {
    const wsId = this._data.workspaceId ?? this._auth.workspaceId;
    return canDelete(this._auth, wsId);
  }

  /**
   * Assert read permission or throw.
   */
  protected assertRead(): void {
    if (!this.canRead()) {
      throw new PermissionError(this._auth.userId, this.constructor.name, "read");
    }
  }

  /**
   * Assert write permission or throw.
   */
  protected assertWrite(): void {
    if (!this.canWrite()) {
      throw new PermissionError(this._auth.userId, this.constructor.name, "write");
    }
  }

  /**
   * Assert delete permission or throw.
   */
  protected assertDelete(): void {
    if (!this.canDelete()) {
      throw new PermissionError(this._auth.userId, this.constructor.name, "delete");
    }
  }

  /**
   * Convert to a plain object safe for JSON serialization.
   */
  abstract toJSON(): Record<string, unknown>;
}

// ============================================
// Query Builder Helper
// ============================================

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: Record<string, "asc" | "desc">;
}

export function buildQueryOptions(options: QueryOptions = {}): {
  take?: number;
  skip?: number;
  orderBy?: Record<string, "asc" | "desc">;
} {
  return {
    ...(options.limit && { take: options.limit }),
    ...(options.offset && { skip: options.offset }),
    ...(options.orderBy && { orderBy: options.orderBy }),
  };
}

// ============================================
// Workspace Scope Helper
// ============================================

export function workspaceScope(auth: ResourceAuth): { workspaceId: string } {
  return { workspaceId: auth.workspaceId };
}
