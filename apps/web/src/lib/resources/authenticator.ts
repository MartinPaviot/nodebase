/**
 * Authenticator - Handles permission checks for Resource Pattern
 * Inspired by Dust.tt's resource protection model
 */

import { PermissionError } from "../errors";

export interface AuthContext {
  userId: string;
  workspaceId?: string;
  isAdmin?: boolean;
}

export class Authenticator {
  constructor(private auth: AuthContext) {}

  /**
   * Get current user ID
   */
  getUserId(): string {
    return this.auth.userId;
  }

  /**
   * Get current workspace ID
   */
  getWorkspaceId(): string | undefined {
    return this.auth.workspaceId;
  }

  /**
   * Check if user is admin
   */
  isAdmin(): boolean {
    return this.auth.isAdmin || false;
  }

  /**
   * Check if user can access a resource
   * Resource is accessible if:
   * - User is the owner (userId matches)
   * - User is in the same workspace
   * - User is admin
   */
  canAccess(resourceUserId: string, resourceWorkspaceId?: string): boolean {
    // Admin can access everything
    if (this.isAdmin()) {
      return true;
    }

    // Owner can access their own resources
    if (this.auth.userId === resourceUserId) {
      return true;
    }

    // Workspace members can access workspace resources
    if (
      this.auth.workspaceId &&
      resourceWorkspaceId &&
      this.auth.workspaceId === resourceWorkspaceId
    ) {
      return true;
    }

    return false;
  }

  /**
   * Assert user can access resource (throws if not)
   */
  assertCanAccess(
    resource: string,
    resourceUserId: string,
    resourceWorkspaceId?: string
  ): void {
    if (!this.canAccess(resourceUserId, resourceWorkspaceId)) {
      throw new PermissionError(resource, "access", this.auth.userId);
    }
  }

  /**
   * Check if user can modify a resource
   * Only owner or admin can modify
   */
  canModify(resourceUserId: string): boolean {
    return this.isAdmin() || this.auth.userId === resourceUserId;
  }

  /**
   * Assert user can modify resource (throws if not)
   */
  assertCanModify(resource: string, resourceUserId: string): void {
    if (!this.canModify(resourceUserId)) {
      throw new PermissionError(resource, "modify", this.auth.userId);
    }
  }

  /**
   * Check if user can delete a resource
   * Only owner or admin can delete
   */
  canDelete(resourceUserId: string): boolean {
    return this.isAdmin() || this.auth.userId === resourceUserId;
  }

  /**
   * Assert user can delete resource (throws if not)
   */
  assertCanDelete(resource: string, resourceUserId: string): void {
    if (!this.canDelete(resourceUserId)) {
      throw new PermissionError(resource, "delete", this.auth.userId);
    }
  }
}

/**
 * Create authenticator from session
 */
export function createAuthenticator(session: {
  user: {
    id: string;
    // Add other fields as needed
  };
}): Authenticator {
  return new Authenticator({
    userId: session.user.id,
    // workspaceId: session.user.workspaceId, // Add when workspace support is ready
    // isAdmin: session.user.role === "ADMIN", // Add when role support is ready
  });
}
