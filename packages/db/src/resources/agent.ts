/**
 * Agent Resource
 *
 * Provides permission-checked access to Agent records.
 */

import { PermissionError } from "@elevay/types";
import { prisma } from "../client";
import type { AgentModel } from "@prisma/client";
import {
  BaseResource,
  type ResourceAuth,
  type QueryOptions,
  buildQueryOptions,
} from "./base";

// Type matching Prisma Agent model
interface AgentData {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  context: string | null;
  model: AgentModel;
  temperature: number;
  safeMode: boolean;
  llmTier: string | null;
  maxStepsPerRun: number | null;
  evalRules: unknown;
  workspaceId: string | null;
  avatar: string | null;
  tags: string[];
  isEnabled: boolean;
  isFavorite: boolean;
  userId: string;
  templateId: string | null;
  credentialId: string | null;
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

    if (agent.workspaceId && agent.workspaceId !== auth.workspaceId) {
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
      where: { userId: auth.userId },
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
        userId: auth.userId,
        isEnabled: true,
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
      model?: AgentModel;
      temperature?: number;
      maxStepsPerRun?: number;
    }
  ): Promise<AgentResource> {
    const agent = await prisma.agent.create({
      data: {
        name: data.name,
        description: data.description,
        systemPrompt: data.systemPrompt,
        model: data.model ?? "ANTHROPIC",
        temperature: data.temperature ?? 0.7,
        maxStepsPerRun: data.maxStepsPerRun ?? 10,
        workspaceId: auth.workspaceId,
        userId: auth.userId,
      },
    });

    return new AgentResource(agent as AgentData, auth);
  }

  /**
   * Count agents in the workspace.
   */
  static async count(auth: ResourceAuth): Promise<number> {
    return prisma.agent.count({
      where: { userId: auth.userId },
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
      model: AgentModel;
      temperature: number;
      maxStepsPerRun: number;
      isEnabled: boolean;
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
   * Soft delete the agent (set isEnabled to false).
   */
  async deactivate(): Promise<AgentResource> {
    this.assertWrite();

    const updated = await prisma.agent.update({
      where: { id: this.id },
      data: { isEnabled: false },
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

  get model(): AgentModel {
    return this._data.model;
  }

  get temperature(): number {
    return this._data.temperature;
  }

  get maxStepsPerRun(): number | null {
    return this._data.maxStepsPerRun;
  }

  get isEnabled(): boolean {
    return this._data.isEnabled;
  }

  get workspaceId(): string | null {
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
      isEnabled: this.isEnabled,
      workspaceId: this.workspaceId,
      createdAt: this._data.createdAt.toISOString(),
      updatedAt: this._data.updatedAt.toISOString(),
    };
  }
}
