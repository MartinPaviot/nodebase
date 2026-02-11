/**
 * Agent Resource
 *
 * Provides permission-checked access to Agent records.
 */

import { PermissionError } from "@nodebase/types";
import { prisma } from "../client";
import {
  BaseResource,
  type ResourceAuth,
  type QueryOptions,
  buildQueryOptions,
  workspaceScope,
} from "./base";

// Type for Agent from Prisma (simplified)
interface AgentData {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxStepsPerRun: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class AgentResource extends BaseResource<AgentData> {
  // ============================================
  // Static Factory Methods
  // ============================================

  /**
   * Find an agent by ID with permission check.
   */
  static async findById(
    id: string,
    auth: ResourceAuth
  ): Promise<AgentResource | null> {
    const agent = await prisma.agent.findUnique({
      where: { id },
    });

    if (!agent) return null;

    if (agent.workspaceId !== auth.workspaceId) {
      throw new PermissionError(auth.userId, "Agent", "read");
    }

    return new AgentResource(agent as AgentData, auth);
  }

  /**
   * Find all agents in the workspace.
   */
  static async findAll(
    auth: ResourceAuth,
    options?: QueryOptions
  ): Promise<AgentResource[]> {
    const agents = await prisma.agent.findMany({
      where: workspaceScope(auth),
      ...buildQueryOptions(options),
    });

    return agents.map((agent: any) => new AgentResource(agent as AgentData, auth));
  }

  /**
   * Find active agents in the workspace.
   */
  static async findActive(
    auth: ResourceAuth,
    options?: QueryOptions
  ): Promise<AgentResource[]> {
    const agents = await prisma.agent.findMany({
      where: {
        ...workspaceScope(auth),
        isActive: true,
      },
      ...buildQueryOptions(options),
    });

    return agents.map((agent: any) => new AgentResource(agent as AgentData, auth));
  }

  /**
   * Create a new agent.
   */
  static async create(
    auth: ResourceAuth,
    data: {
      name: string;
      description?: string;
      systemPrompt: string;
      model?: string;
      temperature?: number;
      maxStepsPerRun?: number;
    }
  ): Promise<AgentResource> {
    const agent = await prisma.agent.create({
      data: {
        ...data,
        workspaceId: auth.workspaceId,
        userId: auth.userId,
        model: data.model ?? "ANTHROPIC",
        temperature: data.temperature ?? 0.7,
        maxStepsPerRun: data.maxStepsPerRun ?? 10,
      },
    });

    return new AgentResource(agent as AgentData, auth);
  }

  /**
   * Count agents in the workspace.
   */
  static async count(auth: ResourceAuth): Promise<number> {
    return prisma.agent.count({
      where: workspaceScope(auth),
    });
  }

  // ============================================
  // Instance Methods
  // ============================================

  /**
   * Update the agent.
   */
  async update(
    data: Partial<{
      name: string;
      description: string;
      systemPrompt: string;
      model: string;
      temperature: number;
      maxStepsPerRun: number;
      isActive: boolean;
    }>
  ): Promise<AgentResource> {
    this.assertWrite();

    const updated = await prisma.agent.update({
      where: { id: this.id },
      data,
    });

    this._data = updated as AgentData;
    return this;
  }

  /**
   * Soft delete the agent (set isActive to false).
   */
  async deactivate(): Promise<AgentResource> {
    this.assertWrite();

    const updated = await prisma.agent.update({
      where: { id: this.id },
      data: { isActive: false },
    });

    this._data = updated as AgentData;
    return this;
  }

  /**
   * Hard delete the agent.
   */
  async delete(): Promise<void> {
    this.assertDelete();

    await prisma.agent.delete({
      where: { id: this.id },
    });
  }

  /**
   * Get agent's conversations.
   */
  async getConversations(options?: QueryOptions) {
    this.assertRead();

    return prisma.conversation.findMany({
      where: { agentId: this.id },
      ...buildQueryOptions(options),
    });
  }

  /**
   * Get agent's triggers.
   */
  async getTriggers() {
    this.assertRead();

    return prisma.agentTrigger.findMany({
      where: { agentId: this.id },
    });
  }

  // ============================================
  // Getters
  // ============================================

  get name(): string {
    return this._data.name;
  }

  get description(): string | null {
    return this._data.description;
  }

  get systemPrompt(): string {
    return this._data.systemPrompt;
  }

  get model(): string {
    return this._data.model;
  }

  get temperature(): number {
    return this._data.temperature;
  }

  get maxStepsPerRun(): number {
    return this._data.maxStepsPerRun;
  }

  get isActive(): boolean {
    return this._data.isActive;
  }

  get workspaceId(): string {
    return this._data.workspaceId;
  }

  // ============================================
  // Serialization
  // ============================================

  toJSON(): Record<string, unknown> {
    this.assertRead();

    return {
      id: this.id,
      name: this.name,
      description: this.description,
      systemPrompt: this.systemPrompt,
      model: this.model,
      temperature: this.temperature,
      maxStepsPerRun: this.maxStepsPerRun,
      isActive: this.isActive,
      workspaceId: this.workspaceId,
      createdAt: this._data.createdAt.toISOString(),
      updatedAt: this._data.updatedAt.toISOString(),
    };
  }
}
