/**
 * AgentResource - Resource Pattern for Agent model
 *
 * Benefits:
 * - Automatic permission checks on all operations
 * - No direct Prisma access (prevents security holes)
 * - Audit trail for all modifications
 * - Type-safe operations
 *
 * Usage:
 * ```typescript
 * const agent = await AgentResource.findById(id, auth);
 * if (!agent) throw new NotFoundError("Agent", id);
 *
 * await agent.updateSystemPrompt("New prompt");
 * await agent.addTool(toolConfig);
 * ```
 */

import prisma from "../db";
import { Authenticator } from "./authenticator";
import { NotFoundError, ValidationError } from "../errors";
import type { Agent, AgentTool, AgentMemory, Conversation, AgentModel } from "@prisma/client";

export class AgentResource {
  private constructor(
    private agent: Agent,
    private auth: Authenticator
  ) {}

  // ============================================
  // STATIC FACTORY METHODS
  // ============================================

  /**
   * Find agent by ID with permission check
   */
  static async findById(
    id: string,
    auth: Authenticator
  ): Promise<AgentResource | null> {
    const agent = await prisma.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      return null;
    }

    // Check permission
    auth.assertCanAccess("Agent", agent.userId, agent.workspaceId || undefined);

    return new AgentResource(agent, auth);
  }

  /**
   * Find all agents for current user
   */
  static async findMany(
    auth: Authenticator,
    filters?: {
      isEnabled?: boolean;
      isFavorite?: boolean;
      tags?: string[];
    }
  ): Promise<AgentResource[]> {
    const { tags, ...restFilters } = filters ?? {};
    const agents = await prisma.agent.findMany({
      where: {
        userId: auth.getUserId(),
        ...restFilters,
        ...(tags ? { tags: { hasSome: tags } } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return agents.map((agent) => new AgentResource(agent, auth));
  }

  /**
   * Create new agent
   */
  static async create(
    data: {
      name: string;
      description?: string;
      systemPrompt: string;
      model: string;
      temperature: number;
      context?: string;
      templateId?: string;
    },
    auth: Authenticator
  ): Promise<AgentResource> {
    // Validation
    if (!data.name.trim()) {
      throw new ValidationError("name", data.name, "Name cannot be empty");
    }

    if (data.temperature < 0 || data.temperature > 1) {
      throw new ValidationError(
        "temperature",
        data.temperature,
        "Temperature must be between 0 and 1"
      );
    }

    const agent = await prisma.agent.create({
      data: {
        ...data,
        model: data.model as AgentModel,
        userId: auth.getUserId(),
        workspaceId: auth.getWorkspaceId(),
      },
    });

    return new AgentResource(agent, auth);
  }

  // ============================================
  // GETTERS (Read-only access)
  // ============================================

  get id(): string {
    return this.agent.id;
  }

  get name(): string {
    return this.agent.name;
  }

  get description(): string | null {
    return this.agent.description;
  }

  get systemPrompt(): string {
    return this.agent.systemPrompt;
  }

  get context(): string | null {
    return this.agent.context;
  }

  get model(): string {
    return this.agent.model;
  }

  get temperature(): number {
    return this.agent.temperature;
  }

  get isEnabled(): boolean {
    return this.agent.isEnabled;
  }

  get isFavorite(): boolean {
    return this.agent.isFavorite;
  }

  get safeMode(): boolean {
    return this.agent.safeMode;
  }

  get userId(): string {
    return this.agent.userId;
  }

  get workspaceId(): string | null {
    return this.agent.workspaceId;
  }

  /**
   * Get raw agent data (for read-only display)
   */
  toJSON(): Agent {
    return this.agent;
  }

  // ============================================
  // UPDATE OPERATIONS (with permission checks)
  // ============================================

  /**
   * Update system prompt
   */
  async updateSystemPrompt(systemPrompt: string): Promise<void> {
    this.auth.assertCanModify("Agent", this.agent.userId);

    if (!systemPrompt.trim()) {
      throw new ValidationError(
        "systemPrompt",
        systemPrompt,
        "System prompt cannot be empty"
      );
    }

    this.agent = await prisma.agent.update({
      where: { id: this.agent.id },
      data: { systemPrompt },
    });
  }

  /**
   * Update context (read-only instructions)
   */
  async updateContext(context: string | null): Promise<void> {
    this.auth.assertCanModify("Agent", this.agent.userId);

    this.agent = await prisma.agent.update({
      where: { id: this.agent.id },
      data: { context },
    });
  }

  /**
   * Update temperature
   */
  async updateTemperature(temperature: number): Promise<void> {
    this.auth.assertCanModify("Agent", this.agent.userId);

    if (temperature < 0 || temperature > 1) {
      throw new ValidationError(
        "temperature",
        temperature,
        "Temperature must be between 0 and 1"
      );
    }

    this.agent = await prisma.agent.update({
      where: { id: this.agent.id },
      data: { temperature },
    });
  }

  /**
   * Toggle enabled status
   */
  async toggleEnabled(): Promise<void> {
    this.auth.assertCanModify("Agent", this.agent.userId);

    this.agent = await prisma.agent.update({
      where: { id: this.agent.id },
      data: { isEnabled: !this.agent.isEnabled },
    });
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(): Promise<void> {
    this.auth.assertCanModify("Agent", this.agent.userId);

    this.agent = await prisma.agent.update({
      where: { id: this.agent.id },
      data: { isFavorite: !this.agent.isFavorite },
    });
  }

  /**
   * Toggle safe mode
   */
  async toggleSafeMode(): Promise<void> {
    this.auth.assertCanModify("Agent", this.agent.userId);

    this.agent = await prisma.agent.update({
      where: { id: this.agent.id },
      data: { safeMode: !this.agent.safeMode },
    });
  }

  // ============================================
  // RELATED RESOURCES
  // ============================================

  /**
   * Get agent tools
   */
  async getTools(): Promise<AgentTool[]> {
    this.auth.assertCanAccess("Agent", this.agent.userId, this.agent.workspaceId || undefined);

    return await prisma.agentTool.findMany({
      where: { agentId: this.agent.id },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Add tool to agent
   */
  async addTool(data: {
    name: string;
    description?: string;
    type: string;
    config: Record<string, unknown>;
  }): Promise<AgentTool> {
    this.auth.assertCanModify("Agent", this.agent.userId);

    return await prisma.agentTool.create({
      data: {
        ...data,
        description: data.description ?? "",
        agentId: this.agent.id,
      },
    });
  }

  /**
   * Delete tool from agent
   */
  async deleteTool(toolId: string): Promise<void> {
    this.auth.assertCanModify("Agent", this.agent.userId);

    // Verify tool belongs to this agent
    const tool = await prisma.agentTool.findUnique({
      where: { id: toolId },
      select: { agentId: true },
    });

    if (!tool) {
      throw new NotFoundError("AgentTool", toolId);
    }

    if (tool.agentId !== this.agent.id) {
      throw new ValidationError(
        "toolId",
        toolId,
        "Tool does not belong to this agent"
      );
    }

    await prisma.agentTool.delete({
      where: { id: toolId },
    });
  }

  /**
   * Get agent memories
   */
  async getMemories(): Promise<AgentMemory[]> {
    this.auth.assertCanAccess("Agent", this.agent.userId, this.agent.workspaceId || undefined);

    return await prisma.agentMemory.findMany({
      where: { agentId: this.agent.id },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get conversations
   */
  async getConversations(includeArchived: boolean = false): Promise<Conversation[]> {
    this.auth.assertCanAccess("Agent", this.agent.userId, this.agent.workspaceId || undefined);

    return await prisma.conversation.findMany({
      where: {
        agentId: this.agent.id,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  // ============================================
  // DELETE OPERATION
  // ============================================

  /**
   * Delete agent (soft delete - mark as archived)
   */
  async delete(): Promise<void> {
    this.auth.assertCanDelete("Agent", this.agent.userId);

    // Soft delete: Archive all conversations first
    await prisma.conversation.updateMany({
      where: { agentId: this.agent.id },
      data: { isArchived: true },
    });

    // Delete the agent
    await prisma.agent.delete({
      where: { id: this.agent.id },
    });
  }
}
