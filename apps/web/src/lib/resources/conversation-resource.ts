/**
 * ConversationResource - Resource Pattern for Conversation model
 *
 * Benefits:
 * - Automatic permission checks (user owns the conversation's agent)
 * - No direct Prisma access
 * - Type-safe operations
 *
 * Usage:
 * ```typescript
 * const conversation = await ConversationResource.findById(id, auth);
 * if (!conversation) throw new NotFoundError("Conversation", id);
 *
 * await conversation.addMessage({ role: "user", content: "Hello" });
 * await conversation.archive();
 * ```
 */

import prisma from "../db";
import { Authenticator } from "./authenticator";
import { NotFoundError, ValidationError } from "../errors";
import type { Conversation, Message, ConversationActivity, MessageRole, ConversationSource, ActivityType } from "@prisma/client";

type ConversationWithAgent = Conversation & {
  agent: { userId: string; workspaceId: string | null };
};

export class ConversationResource {
  private constructor(
    private conversation: ConversationWithAgent,
    private auth: Authenticator
  ) {}

  // ============================================
  // STATIC FACTORY METHODS
  // ============================================

  /**
   * Find conversation by ID with permission check
   */
  static async findById(
    id: string,
    auth: Authenticator
  ): Promise<ConversationResource | null> {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        agent: {
          select: { userId: true, workspaceId: true },
        },
      },
    });

    if (!conversation) {
      return null;
    }

    // Check permission - user must own the agent
    auth.assertCanAccess(
      "Conversation",
      conversation.agent.userId,
      conversation.agent.workspaceId || undefined
    );

    return new ConversationResource(conversation, auth);
  }

  /**
   * Find all conversations for a specific agent
   */
  static async findByAgent(
    agentId: string,
    auth: Authenticator,
    options?: {
      includeArchived?: boolean;
      limit?: number;
    }
  ): Promise<ConversationResource[]> {
    // Verify agent ownership
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { userId: true, workspaceId: true },
    });

    if (!agent) {
      throw new NotFoundError("Agent", agentId);
    }

    auth.assertCanAccess("Agent", agent.userId, agent.workspaceId || undefined);

    const conversations = await prisma.conversation.findMany({
      where: {
        agentId,
        ...(options?.includeArchived ? {} : { isArchived: false }),
      },
      orderBy: { updatedAt: "desc" },
      take: options?.limit,
      include: {
        agent: {
          select: { userId: true, workspaceId: true },
        },
      },
    });

    return conversations.map((conv) => new ConversationResource(conv, auth));
  }

  /**
   * Create new conversation
   */
  static async create(
    data: {
      agentId: string;
      title?: string;
      source?: ConversationSource;
    },
    auth: Authenticator
  ): Promise<ConversationResource> {
    // Verify agent ownership
    const agent = await prisma.agent.findUnique({
      where: { id: data.agentId },
      select: { userId: true, workspaceId: true },
    });

    if (!agent) {
      throw new NotFoundError("Agent", data.agentId);
    }

    auth.assertCanModify("Agent", agent.userId);

    const conversation = await prisma.conversation.create({
      data: {
        agentId: data.agentId,
        title: data.title ?? "New conversation",
        source: data.source ?? "CHAT",
      },
      include: {
        agent: {
          select: { userId: true, workspaceId: true },
        },
      },
    });

    return new ConversationResource(conversation, auth);
  }

  // ============================================
  // GETTERS (Read-only access)
  // ============================================

  get id(): string {
    return this.conversation.id;
  }

  get agentId(): string {
    return this.conversation.agentId;
  }

  get title(): string | null {
    return this.conversation.title;
  }

  get source(): string {
    return this.conversation.source;
  }

  get isArchived(): boolean {
    return this.conversation.isArchived;
  }

  get createdAt(): Date {
    return this.conversation.createdAt;
  }

  get updatedAt(): Date {
    return this.conversation.updatedAt;
  }

  /**
   * Get raw conversation data (for read-only display)
   */
  toJSON(): Conversation {
    return this.conversation;
  }

  // ============================================
  // UPDATE OPERATIONS (with permission checks)
  // ============================================

  /**
   * Update conversation title
   */
  async updateTitle(title: string): Promise<void> {
    this.auth.assertCanModify("Conversation", this.conversation.agent.userId);

    if (!title.trim()) {
      throw new ValidationError("title", title, "Title cannot be empty");
    }

    this.conversation = await prisma.conversation.update({
      where: { id: this.conversation.id },
      data: { title },
      include: {
        agent: {
          select: { userId: true, workspaceId: true },
        },
      },
    });
  }

  /**
   * Archive conversation
   */
  async archive(): Promise<void> {
    this.auth.assertCanModify("Conversation", this.conversation.agent.userId);

    this.conversation = await prisma.conversation.update({
      where: { id: this.conversation.id },
      data: { isArchived: true },
      include: {
        agent: {
          select: { userId: true, workspaceId: true },
        },
      },
    });
  }

  /**
   * Unarchive conversation
   */
  async unarchive(): Promise<void> {
    this.auth.assertCanModify("Conversation", this.conversation.agent.userId);

    this.conversation = await prisma.conversation.update({
      where: { id: this.conversation.id },
      data: { isArchived: false },
      include: {
        agent: {
          select: { userId: true, workspaceId: true },
        },
      },
    });
  }

  // ============================================
  // RELATED RESOURCES
  // ============================================

  /**
   * Get all messages in conversation
   */
  async getMessages(options?: { limit?: number; offset?: number }): Promise<Message[]> {
    this.auth.assertCanAccess(
      "Conversation",
      this.conversation.agent.userId,
      this.conversation.agent.workspaceId || undefined
    );

    return await prisma.message.findMany({
      where: { conversationId: this.conversation.id },
      orderBy: { createdAt: "asc" },
      take: options?.limit,
      skip: options?.offset,
    });
  }

  /**
   * Add message to conversation
   */
  async addMessage(data: {
    role: MessageRole;
    content: string;
    toolName?: string;
    toolInput?: unknown;
    toolOutput?: unknown;
  }): Promise<Message> {
    this.auth.assertCanModify("Conversation", this.conversation.agent.userId);

    if (!data.content.trim()) {
      throw new ValidationError("content", data.content, "Message content cannot be empty");
    }

    const message = await prisma.message.create({
      data: {
        conversationId: this.conversation.id,
        role: data.role,
        content: data.content,
        toolName: data.toolName,
        toolInput: data.toolInput as never,
        toolOutput: data.toolOutput as never,
      },
    });

    // Update conversation updatedAt
    this.conversation = await prisma.conversation.update({
      where: { id: this.conversation.id },
      data: { updatedAt: new Date() },
      include: {
        agent: {
          select: { userId: true, workspaceId: true },
        },
      },
    });

    return message;
  }

  /**
   * Get conversation activities (approval requests, etc.)
   */
  async getActivities(options?: {
    type?: ActivityType;
    requiresConfirmation?: boolean;
  }): Promise<ConversationActivity[]> {
    this.auth.assertCanAccess(
      "Conversation",
      this.conversation.agent.userId,
      this.conversation.agent.workspaceId || undefined
    );

    return await prisma.conversationActivity.findMany({
      where: {
        conversationId: this.conversation.id,
        ...(options?.type ? { type: options.type } : {}),
        ...(options?.requiresConfirmation !== undefined ? { requiresConfirmation: options.requiresConfirmation } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Add activity (approval request, notification, etc.)
   */
  async addActivity(data: {
    type: ActivityType;
    title: string;
    details?: Record<string, unknown>;
    requiresConfirmation?: boolean;
  }): Promise<ConversationActivity> {
    this.auth.assertCanModify("Conversation", this.conversation.agent.userId);

    return await prisma.conversationActivity.create({
      data: {
        conversationId: this.conversation.id,
        type: data.type,
        title: data.title,
        details: data.details as never,
        requiresConfirmation: data.requiresConfirmation ?? false,
      },
    });
  }

  /**
   * Resolve activity
   */
  async resolveActivity(
    activityId: string,
    result: "approved" | "rejected"
  ): Promise<void> {
    this.auth.assertCanModify("Conversation", this.conversation.agent.userId);

    // Verify activity belongs to this conversation
    const activity = await prisma.conversationActivity.findUnique({
      where: { id: activityId },
      select: { conversationId: true },
    });

    if (!activity) {
      throw new NotFoundError("ConversationActivity", activityId);
    }

    if (activity.conversationId !== this.conversation.id) {
      throw new ValidationError(
        "activityId",
        activityId,
        "Activity does not belong to this conversation"
      );
    }

    await prisma.conversationActivity.update({
      where: { id: activityId },
      data: result === "approved"
        ? { confirmedAt: new Date() }
        : { rejectedAt: new Date() },
    });
  }

  // ============================================
  // DELETE OPERATION
  // ============================================

  /**
   * Delete conversation (hard delete)
   */
  async delete(): Promise<void> {
    this.auth.assertCanDelete("Conversation", this.conversation.agent.userId);

    await prisma.conversation.delete({
      where: { id: this.conversation.id },
    });
  }
}
