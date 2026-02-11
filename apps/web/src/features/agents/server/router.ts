import { generateSlug } from "random-word-slugs";
import prisma from "@/lib/db";
import {
  baseProcedure,
  createTRPCRouter,
  premiumProcedure,
  protectedProcedure,
} from "@/trpc/init";
import z from "zod";
import { PAGINATION } from "@/config/constants";
import { AgentModel, MemoryCategory, TriggerType, TemplateCategory, TemplateRole, TemplateUseCase, SwarmStatus, KnowledgeSourceType, NodeType, Prisma } from "@/generated/prisma";
import { executeSwarm, cancelSwarm } from "@/lib/swarm-executor";
import { indexDocument, searchKnowledge } from "@/lib/knowledge-base";

// ==================
// HELPER FUNCTIONS
// ==================

/**
 * Syncs flowData nodes to AgentTools for execution.
 *
 * Phase 9: Bridge Flow Editor → Execution
 * - Converts visual flowData nodes into executable AgentTools
 * - Only syncs "composioAction" nodes (workflow nodes remain manual)
 * - Deletes stale AgentTools that don't exist in flowData anymore
 */
async function syncFlowDataToAgentTools(
  agentId: string,
  flowData: {
    nodes: Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      data?: Record<string, unknown>;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      sourceHandle?: string;
      targetHandle?: string;
    }>;
  }
) {
  // Extract composioAction nodes from flowData
  const composioNodes = flowData.nodes.filter(node => node.type === "composioAction");

  // Get current AgentTools that were created from flowData (not manual workflows)
  const existingTools = await prisma.agentTool.findMany({
    where: {
      agentId,
      // Only tools from flowData sync (have composio config but no manual workflow)
      composioAppKey: { not: null },
      workflowId: null,
    },
  });

  // Determine which tools to delete (exist in DB but not in flowData)
  const flowNodeIds = new Set(composioNodes.map(n => n.id));
  const toolsToDelete = existingTools.filter(
    tool => !flowNodeIds.has(tool.name) // We use name as the flowNodeId identifier
  );

  // Delete stale tools
  if (toolsToDelete.length > 0) {
    await prisma.agentTool.deleteMany({
      where: {
        id: { in: toolsToDelete.map(t => t.id) },
      },
    });
  }

  // Create or update tools from flowData
  for (const node of composioNodes) {
    const composioAppKey = node.data?.composioAppKey as string | undefined;
    const composioActionName = node.data?.composioActionName as string | undefined;
    const label = node.data?.label as string | undefined;
    const description = node.data?.description as string | undefined;
    const composioConfig = node.data?.composioConfig as Record<string, unknown> | undefined;

    // Skip if missing required data
    if (!composioAppKey || !composioActionName) {
      console.warn(`[syncFlowDataToAgentTools] Skipping node ${node.id}: missing composioAppKey or composioActionName`);
      continue;
    }

    // Check if tool already exists (using node.id as name identifier)
    const existingTool = existingTools.find(t => t.name === node.id);

    if (existingTool) {
      // Update existing tool
      await prisma.agentTool.update({
        where: { id: existingTool.id },
        data: {
          composioAppKey,
          composioActionName,
          composioConfig: (composioConfig || {}) as Prisma.InputJsonValue,
          description: description || `${composioActionName} action`,
        },
      });
    } else {
      // Create new tool
      await prisma.agentTool.create({
        data: {
          agentId,
          name: node.id, // Use flowData node.id as identifier
          composioAppKey,
          composioActionName,
          composioConfig: (composioConfig || {}) as Prisma.InputJsonValue,
          description: description || `${composioActionName} action`,
        },
      });
    }
  }

  console.log(`[syncFlowDataToAgentTools] Synced ${composioNodes.length} composio nodes for agent ${agentId}`);
}

// ==================
// VALIDATION SCHEMAS
// ==================

const agentModelSchema = z.nativeEnum(AgentModel);

const createAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  systemPrompt: z.string().min(1).max(10000),
  context: z.string().max(10000).optional(),
  model: agentModelSchema.default("ANTHROPIC"),
  temperature: z.number().min(0).max(2).default(0.7),
  avatar: z.string().url().optional(),
  credentialId: z.string().optional(),
  safeMode: z.boolean().default(false),
});

const updateAgentSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  systemPrompt: z.string().min(1).max(10000).optional(),
  context: z.string().max(10000).nullish(),
  model: agentModelSchema.optional(),
  temperature: z.number().min(0).max(2).optional(),
  avatar: z.string().url().nullish(),
  credentialId: z.string().nullish(),
  safeMode: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
});

export const agentsRouter = createTRPCRouter({
  // ==================
  // AGENT CRUD
  // ==================

  create: premiumProcedure.input(createAgentSchema).mutation(({ ctx, input }) => {
    return prisma.agent.create({
      data: {
        name: input.name || generateSlug(2, { format: "title" }),
        description: input.description,
        systemPrompt: input.systemPrompt,
        context: input.context,
        model: input.model,
        temperature: input.temperature,
        avatar: input.avatar,
        credentialId: input.credentialId,
        safeMode: input.safeMode,
        userId: ctx.auth.user.id,
      },
    });
  }),

  update: protectedProcedure
    .input(updateAgentSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Verify ownership
      await prisma.agent.findUniqueOrThrow({
        where: { id, userId: ctx.auth.user.id },
      });

      return prisma.agent.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.systemPrompt !== undefined && { systemPrompt: data.systemPrompt }),
          ...(data.context !== undefined && { context: data.context }),
          ...(data.model !== undefined && { model: data.model }),
          ...(data.temperature !== undefined && { temperature: data.temperature }),
          ...(data.avatar !== undefined && { avatar: data.avatar }),
          ...(data.credentialId !== undefined && { credentialId: data.credentialId }),
          ...(data.safeMode !== undefined && { safeMode: data.safeMode }),
          ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
        },
      });
    }),

  // Save flow data (nodes and edges configuration)
  saveFlowData: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        flowData: z.object({
          nodes: z.array(
            z.object({
              id: z.string(),
              type: z.string(),
              position: z.object({ x: z.number(), y: z.number() }),
              data: z.record(z.unknown()).optional(),
            })
          ),
          edges: z.array(
            z.object({
              id: z.string(),
              source: z.string(),
              target: z.string(),
              sourceHandle: z.string().optional(),
              targetHandle: z.string().optional(),
            })
          ),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.id, userId: ctx.auth.user.id },
      });

      // Save flowData to agent
      const updatedAgent = await prisma.agent.update({
        where: { id: input.id },
        data: {
          flowData: input.flowData as unknown as Prisma.InputJsonValue,
        },
      });

      // Sync flowData to AgentTools for execution
      await syncFlowDataToAgentTools(input.id, input.flowData);

      return updatedAgent;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return prisma.agent.delete({
        where: {
          id: input.id,
          userId: ctx.auth.user.id,
        },
      });
    }),

  getOne: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return prisma.agent.findUniqueOrThrow({
        where: { id: input.id, userId: ctx.auth.user.id },
        include: {
          credential: {
            select: { id: true, name: true, type: true },
          },
          agentTools: {
            include: {
              workflow: {
                select: { id: true, name: true },
              },
            },
          },
          template: {
            select: { id: true, flowData: true },
          },
          _count: {
            select: { conversations: true },
          },
        },
      });
    }),

  getMany: protectedProcedure
    .input(
      z.object({
        page: z.number().default(PAGINATION.DEFAULT_PAGE),
        pageSize: z
          .number()
          .min(PAGINATION.MIN_PAGE_SIZE)
          .max(PAGINATION.MAX_PAGE_SIZE)
          .default(PAGINATION.DEFAULT_PAGE_SIZE),
        search: z.string().default(""),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search } = input;

      const [items, totalCount] = await Promise.all([
        prisma.agent.findMany({
          skip: (page - 1) * pageSize,
          take: pageSize,
          where: {
            userId: ctx.auth.user.id,
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          },
          orderBy: { updatedAt: "desc" },
          include: {
            _count: {
              select: { conversations: true },
            },
          },
        }),
        prisma.agent.count({
          where: {
            userId: ctx.auth.user.id,
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          },
        }),
      ]);

      const totalPages = Math.ceil(totalCount / pageSize);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return {
        items,
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      };
    }),

  // ==================
  // AGENT TOOLS (Workflows as tools)
  // ==================

  addTool: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        workflowId: z.string(),
        name: z.string().min(1).max(100),
        description: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify agent ownership
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      // Verify workflow ownership
      await prisma.workflow.findUniqueOrThrow({
        where: { id: input.workflowId, userId: ctx.auth.user.id },
      });

      return prisma.agentTool.create({
        data: {
          agentId: input.agentId,
          workflowId: input.workflowId,
          name: input.name,
          description: input.description,
        },
      });
    }),

  addComposioAction: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        composioAppKey: z.string(),
        composioActionName: z.string(),
        name: z.string().min(1).max(100),
        description: z.string().min(1).max(1000),
        config: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify agent ownership
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      return prisma.agentTool.create({
        data: {
          agentId: input.agentId,
          composioAppKey: input.composioAppKey,
          composioActionName: input.composioActionName,
          composioConfig: (input.config || {}) as Prisma.InputJsonValue,
          name: input.name,
          description: input.description,
        },
      });
    }),

  removeTool: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through agent
      const tool = await prisma.agentTool.findUniqueOrThrow({
        where: { id: input.id },
        include: { agent: true },
      });

      if (tool.agent.userId !== ctx.auth.user.id) {
        throw new Error("Unauthorized");
      }

      return prisma.agentTool.delete({
        where: { id: input.id },
      });
    }),

  // ==================
  // CONVERSATIONS
  // ==================

  createConversation: protectedProcedure
    .input(z.object({ agentId: z.string(), title: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      // Verify agent ownership
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      return prisma.conversation.create({
        data: {
          agentId: input.agentId,
          title: input.title,
        },
      });
    }),

  getConversation: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const conversation = await prisma.conversation.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          agent: {
            select: { id: true, name: true, avatar: true, userId: true },
          },
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      // Verify ownership through agent
      if (conversation.agent.userId !== ctx.auth.user.id) {
        throw new Error("Unauthorized");
      }

      return conversation;
    }),

  getConversations: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        page: z.number().default(PAGINATION.DEFAULT_PAGE),
        pageSize: z
          .number()
          .min(PAGINATION.MIN_PAGE_SIZE)
          .max(PAGINATION.MAX_PAGE_SIZE)
          .default(PAGINATION.DEFAULT_PAGE_SIZE),
      })
    )
    .query(async ({ ctx, input }) => {
      const { agentId, page, pageSize } = input;

      // Verify agent ownership
      await prisma.agent.findUniqueOrThrow({
        where: { id: agentId, userId: ctx.auth.user.id },
      });

      const [items, totalCount] = await Promise.all([
        prisma.conversation.findMany({
          skip: (page - 1) * pageSize,
          take: pageSize,
          where: { agentId },
          orderBy: [
            { isPinned: "desc" }, // Pinned first
            { updatedAt: "desc" },
          ],
          select: {
            id: true,
            title: true,
            isArchived: true,
            isPinned: true,
            shareToken: true,
            source: true,
            createdAt: true,
            updatedAt: true,
            messages: {
              take: 1,
              orderBy: { createdAt: "desc" },
              select: { createdAt: true },
            },
          },
        }),
        prisma.conversation.count({ where: { agentId } }),
      ]);

      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        items,
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      };
    }),

  // Get all conversations for the current user (across all agents)
  getAllConversations: protectedProcedure
    .input(
      z.object({
        page: z.number().default(PAGINATION.DEFAULT_PAGE),
        pageSize: z
          .number()
          .min(PAGINATION.MIN_PAGE_SIZE)
          .max(PAGINATION.MAX_PAGE_SIZE)
          .default(PAGINATION.DEFAULT_PAGE_SIZE),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize } = input;

      const [items, totalCount] = await Promise.all([
        prisma.conversation.findMany({
          skip: (page - 1) * pageSize,
          take: pageSize,
          where: {
            agent: { userId: ctx.auth.user.id },
            isArchived: false,
          },
          orderBy: [
            { isPinned: "desc" },
            { updatedAt: "desc" },
          ],
          select: {
            id: true,
            title: true,
            isArchived: true,
            isPinned: true,
            shareToken: true,
            source: true,
            createdAt: true,
            updatedAt: true,
            agentId: true,
            agent: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
            messages: {
              take: 1,
              orderBy: { createdAt: "desc" },
              select: { createdAt: true },
            },
          },
        }),
        prisma.conversation.count({
          where: {
            agent: { userId: ctx.auth.user.id },
            isArchived: false,
          },
        }),
      ]);

      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        items,
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      };
    }),

  deleteConversation: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const conversation = await prisma.conversation.findUniqueOrThrow({
        where: { id: input.id },
        include: { agent: true },
      });

      if (conversation.agent.userId !== ctx.auth.user.id) {
        throw new Error("Unauthorized");
      }

      return prisma.conversation.delete({
        where: { id: input.id },
      });
    }),

  // Rename conversation
  renameConversation: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      return prisma.conversation.update({
        where: { id: input.id, agent: { userId: ctx.auth.user.id } },
        data: { title: input.title },
      });
    }),

  // Toggle pin
  togglePinConversation: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const conv = await prisma.conversation.findFirst({
        where: { id: input.id, agent: { userId: ctx.auth.user.id } },
      });
      return prisma.conversation.update({
        where: { id: input.id },
        data: { isPinned: !conv?.isPinned },
      });
    }),

  // Toggle archive
  toggleArchiveConversation: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const conv = await prisma.conversation.findFirst({
        where: { id: input.id, agent: { userId: ctx.auth.user.id } },
      });
      return prisma.conversation.update({
        where: { id: input.id },
        data: { isArchived: !conv?.isArchived },
      });
    }),

  // Generate share link
  generateShareLink: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const token = globalThis.crypto.randomUUID();
      await prisma.conversation.update({
        where: { id: input.id, agent: { userId: ctx.auth.user.id } },
        data: { shareToken: token },
      });
      return { shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/shared/${token}` };
    }),

  // Remove share link
  removeShareLink: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.conversation.update({
        where: { id: input.id, agent: { userId: ctx.auth.user.id } },
        data: { shareToken: null },
      });
    }),

  // ==================
  // AGENT MEMORY
  // ==================

  getMemories: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      return prisma.agentMemory.findMany({
        where: { agentId: input.agentId },
        orderBy: { updatedAt: "desc" },
      });
    }),

  setMemory: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        key: z.string().min(1).max(100),
        value: z.string().min(1).max(10000),
        category: z.nativeEnum(MemoryCategory).default("GENERAL"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      return prisma.agentMemory.upsert({
        where: {
          agentId_key: {
            agentId: input.agentId,
            key: input.key,
          },
        },
        create: {
          agentId: input.agentId,
          key: input.key,
          value: input.value,
          category: input.category,
        },
        update: {
          value: input.value,
          category: input.category,
        },
      });
    }),

  deleteMemory: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const memory = await prisma.agentMemory.findUniqueOrThrow({
        where: { id: input.id },
        include: { agent: true },
      });

      if (memory.agent.userId !== ctx.auth.user.id) {
        throw new Error("Unauthorized");
      }

      return prisma.agentMemory.delete({ where: { id: input.id } });
    }),

  // ==================
  // KNOWLEDGE BASE (RAG)
  // ==================

  getKnowledgeDocuments: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      return prisma.knowledgeDocument.findMany({
        where: { agentId: input.agentId },
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { chunks: true } },
        },
      });
    }),

  uploadKnowledgeDocument: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        title: z.string().min(1).max(200),
        content: z.string().min(1).max(500000), // Allow up to 500KB of text
        source: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      // Create document first
      const doc = await prisma.knowledgeDocument.create({
        data: {
          agentId: input.agentId,
          title: input.title,
          content: input.content,
          source: input.source,
        },
      });

      // Index the document with embeddings (chunking + embedding generation)
      try {
        await indexDocument(doc.id);
      } catch (error) {
        // If indexing fails, delete the document and rethrow
        await prisma.knowledgeDocument.delete({ where: { id: doc.id } });
        throw error;
      }

      // Return with chunk count
      return prisma.knowledgeDocument.findUniqueOrThrow({
        where: { id: doc.id },
        include: {
          _count: { select: { chunks: true } },
        },
      });
    }),

  deleteKnowledgeDocument: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await prisma.knowledgeDocument.findUniqueOrThrow({
        where: { id: input.id },
        include: { agent: true },
      });

      if (doc.agent.userId !== ctx.auth.user.id) {
        throw new Error("Unauthorized");
      }

      // Chunks are deleted automatically via cascade
      return prisma.knowledgeDocument.delete({ where: { id: input.id } });
    }),

  searchKnowledge: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        query: z.string().min(1).max(1000),
        topK: z.number().min(1).max(20).default(5),
      })
    )
    .query(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      return searchKnowledge(input.agentId, input.query, input.topK);
    }),

  // Extended knowledge document creation with source types
  addKnowledgeDocument: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        title: z.string().min(1).max(200),
        content: z.string().min(1).max(500000),
        sourceType: z.nativeEnum(KnowledgeSourceType).default("TEXT"),
        source: z.string().optional(),
        externalUrl: z.string().url().optional(),
        externalId: z.string().optional(),
        fileSize: z.number().optional(),
        mimeType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      const doc = await prisma.knowledgeDocument.create({
        data: {
          agentId: input.agentId,
          title: input.title,
          content: input.content,
          sourceType: input.sourceType,
          source: input.source,
          externalUrl: input.externalUrl,
          externalId: input.externalId,
          fileSize: input.fileSize,
          mimeType: input.mimeType || "text/plain",
          syncStatus: "SYNCING",
          lastSyncedAt: new Date(),
        },
      });

      try {
        await indexDocument(doc.id);
        await prisma.knowledgeDocument.update({
          where: { id: doc.id },
          data: { syncStatus: "SYNCED" },
        });
      } catch (error) {
        await prisma.knowledgeDocument.update({
          where: { id: doc.id },
          data: {
            syncStatus: "ERROR",
            syncError: error instanceof Error ? error.message : "Unknown error",
          },
        });
        throw error;
      }

      return prisma.knowledgeDocument.findUniqueOrThrow({
        where: { id: doc.id },
        include: { _count: { select: { chunks: true } } },
      });
    }),

  addKnowledgeFromUrl: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        url: z.string().url(),
        crawlFullSite: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      const sourceType = input.crawlFullSite ? "WEBSITE_CRAWL" : "WEBSITE";
      const title = new URL(input.url).hostname;

      const doc = await prisma.knowledgeDocument.create({
        data: {
          agentId: input.agentId,
          title,
          content: "",
          sourceType,
          externalUrl: input.url,
          syncStatus: "SYNCING",
        },
      });

      try {
        const response = await fetch(input.url);
        const html = await response.text();
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        await prisma.knowledgeDocument.update({
          where: { id: doc.id },
          data: {
            content: text.substring(0, 500000),
            fileSize: text.length,
          },
        });

        await indexDocument(doc.id);

        await prisma.knowledgeDocument.update({
          where: { id: doc.id },
          data: { syncStatus: "SYNCED", lastSyncedAt: new Date() },
        });
      } catch (error) {
        await prisma.knowledgeDocument.update({
          where: { id: doc.id },
          data: {
            syncStatus: "ERROR",
            syncError: error instanceof Error ? error.message : "Failed to fetch URL",
          },
        });
        throw error;
      }

      return prisma.knowledgeDocument.findUniqueOrThrow({
        where: { id: doc.id },
        include: { _count: { select: { chunks: true } } },
      });
    }),

  resyncKnowledge: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await prisma.knowledgeDocument.findUniqueOrThrow({
        where: { id: input.id },
        include: { agent: true },
      });

      if (doc.agent.userId !== ctx.auth.user.id) {
        throw new Error("Unauthorized");
      }

      await prisma.knowledgeDocument.update({
        where: { id: input.id },
        data: { syncStatus: "SYNCING", syncError: null },
      });

      try {
        if ((doc.sourceType === "WEBSITE" || doc.sourceType === "WEBSITE_CRAWL") && doc.externalUrl) {
          const response = await fetch(doc.externalUrl);
          const html = await response.text();
          const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          await prisma.knowledgeDocument.update({
            where: { id: input.id },
            data: { content: text.substring(0, 500000), fileSize: text.length },
          });
        }

        await indexDocument(input.id);

        await prisma.knowledgeDocument.update({
          where: { id: input.id },
          data: { syncStatus: "SYNCED", lastSyncedAt: new Date() },
        });
      } catch (error) {
        await prisma.knowledgeDocument.update({
          where: { id: input.id },
          data: {
            syncStatus: "ERROR",
            syncError: error instanceof Error ? error.message : "Resync failed",
          },
        });
        throw error;
      }

      return prisma.knowledgeDocument.findUniqueOrThrow({
        where: { id: input.id },
        include: { _count: { select: { chunks: true } } },
      });
    }),

  getKnowledgeSettings: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      return prisma.knowledgeSettings.findUnique({
        where: { agentId: input.agentId },
      });
    }),

  updateKnowledgeSettings: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        searchFuzziness: z.number().min(0).max(100).optional(),
        maxResults: z.number().min(1).max(10).optional(),
        autoRefresh: z.boolean().optional(),
        refreshInterval: z.number().min(1).max(168).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      const { agentId, ...settings } = input;

      return prisma.knowledgeSettings.upsert({
        where: { agentId },
        create: {
          agentId,
          searchFuzziness: settings.searchFuzziness ?? 100,
          maxResults: settings.maxResults ?? 4,
          autoRefresh: settings.autoRefresh ?? true,
          refreshInterval: settings.refreshInterval ?? 24,
        },
        update: {
          ...(settings.searchFuzziness !== undefined && { searchFuzziness: settings.searchFuzziness }),
          ...(settings.maxResults !== undefined && { maxResults: settings.maxResults }),
          ...(settings.autoRefresh !== undefined && { autoRefresh: settings.autoRefresh }),
          ...(settings.refreshInterval !== undefined && { refreshInterval: settings.refreshInterval }),
        },
      });
    }),

  // ==================
  // TRIGGERS
  // ==================

  getTriggers: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      return prisma.agentTrigger.findMany({
        where: { agentId: input.agentId },
        orderBy: { createdAt: "desc" },
      });
    }),

  createTrigger: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        name: z.string().min(1).max(100),
        type: z.nativeEnum(TriggerType),
        config: z.record(z.string(), z.any()).default({}),
        cronExpression: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      // Generate webhook secret if it's a webhook trigger
      const webhookSecret =
        input.type === "WEBHOOK"
          ? globalThis.crypto.randomUUID().replace(/-/g, "")
          : undefined;

      return prisma.agentTrigger.create({
        data: {
          agentId: input.agentId,
          name: input.name,
          type: input.type,
          config: input.config as object,
          cronExpression: input.cronExpression,
          webhookSecret,
        },
      });
    }),

  updateTrigger: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        enabled: z.boolean().optional(),
        config: z.record(z.string(), z.any()).optional(),
        cronExpression: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const trigger = await prisma.agentTrigger.findUniqueOrThrow({
        where: { id: input.id },
        include: { agent: true },
      });

      if (trigger.agent.userId !== ctx.auth.user.id) {
        throw new Error("Unauthorized");
      }

      return prisma.agentTrigger.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.enabled !== undefined && { enabled: input.enabled }),
          ...(input.config !== undefined && {
            config: input.config as object,
          }),
          ...(input.cronExpression !== undefined && {
            cronExpression: input.cronExpression,
          }),
        },
      });
    }),

  deleteTrigger: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const trigger = await prisma.agentTrigger.findUniqueOrThrow({
        where: { id: input.id },
        include: { agent: true },
      });

      if (trigger.agent.userId !== ctx.auth.user.id) {
        throw new Error("Unauthorized");
      }

      return prisma.agentTrigger.delete({ where: { id: input.id } });
    }),

  // Get all triggers across all agents (for Automations page)
  getAllTriggers: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 50;

      const [items, total] = await Promise.all([
        prisma.agentTrigger.findMany({
          where: {
            agent: { userId: ctx.auth.user.id },
          },
          include: {
            agent: {
              select: { id: true, name: true, avatar: true },
            },
          },
          orderBy: [
            { enabled: "desc" },
            { lastRunAt: "desc" },
            { createdAt: "desc" },
          ],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.agentTrigger.count({
          where: {
            agent: { userId: ctx.auth.user.id },
          },
        }),
      ]);

      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  // ==================
  // TEMPLATES (Template Store)
  // ==================

  getTemplates: protectedProcedure
    .input(
      z.object({
        category: z.nativeEnum(TemplateCategory).optional(),
        role: z.nativeEnum(TemplateRole).optional(),
        useCase: z.nativeEnum(TemplateUseCase).optional(),
        featured: z.boolean().optional(),
        community: z.boolean().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const { category, role, useCase, featured, community, search } = input;

      return prisma.agentTemplate.findMany({
        where: {
          isPublic: true,
          ...(category && { category }),
          ...(role && { role }),
          ...(useCase && { useCase }),
          ...(featured && { isFeatured: true }),
          ...(community && { createdById: { not: null } }),
          ...(search && {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { tags: { hasSome: [search.toLowerCase()] } },
            ],
          }),
        },
        orderBy: [
          { isFeatured: "desc" },
          { usageCount: "desc" },
          { rating: "desc" },
        ],
      });
    }),

  getTemplate: baseProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return prisma.agentTemplate.findUniqueOrThrow({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          description: true,
          flowData: true,
          defaultTriggers: true,
          defaultTools: true,
        },
      });
    }),

  createFromTemplate: premiumProcedure
    .input(
      z.object({
        templateId: z.string(),
        name: z.string().min(1).max(100).optional(),
        credentialId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const template = await prisma.agentTemplate.findUniqueOrThrow({
        where: { id: input.templateId },
      });

      // Increment usage count
      await prisma.agentTemplate.update({
        where: { id: input.templateId },
        data: { usageCount: { increment: 1 } },
      });

      // Use transaction to create agent with all defaults
      return await prisma.$transaction(async (tx) => {
        // 1. Create the agent with template reference
        const agent = await tx.agent.create({
          data: {
            name: input.name || template.name,
            description: template.description,
            systemPrompt: template.systemPrompt,
            context: template.context,
            model: template.model,
            temperature: template.temperature,
            avatar: template.icon,
            credentialId: input.credentialId,
            userId: ctx.auth.user.id,
            templateId: input.templateId,
          },
        });

        // 2. Create default triggers from template
        const defaultTriggers = (template.defaultTriggers as Array<{
          type: string;
          name: string;
          config?: Record<string, unknown>;
          cronExpression?: string;
          enabled?: boolean;
        }>) || [];

        for (const trigger of defaultTriggers) {
          const webhookSecret = trigger.type === "WEBHOOK"
            ? globalThis.crypto.randomUUID().replace(/-/g, "")
            : undefined;

          await tx.agentTrigger.create({
            data: {
              agentId: agent.id,
              name: trigger.name,
              type: trigger.type as TriggerType,
              config: (trigger.config || {}) as Prisma.InputJsonValue,
              cronExpression: trigger.cronExpression,
              webhookSecret,
              enabled: trigger.enabled ?? true,
            },
          });
        }

        // 3. Create default tools (workflows + AgentTool links)
        const defaultTools = (template.defaultTools as Array<{
          name: string;
          description: string;
          workflowConfig?: {
            name: string;
            nodes?: Array<{
              id: string;
              type: string;
              position: { x: number; y: number };
              data?: Record<string, unknown>;
            }>;
            edges?: Array<{
              source: string;
              target: string;
            }>;
          };
        }>) || [];

        for (const tool of defaultTools) {
          if (tool.workflowConfig) {
            // Create the workflow
            const workflow = await tx.workflow.create({
              data: {
                name: tool.workflowConfig.name,
                userId: ctx.auth.user.id,
              },
            });

            // Create workflow nodes
            if (tool.workflowConfig.nodes && tool.workflowConfig.nodes.length > 0) {
              for (const node of tool.workflowConfig.nodes) {
                await tx.node.create({
                  data: {
                    id: `${workflow.id}-${node.id}`,
                    workflowId: workflow.id,
                    name: node.type,
                    type: node.type as NodeType,
                    position: node.position,
                    data: (node.data || {}) as Prisma.InputJsonValue,
                  },
                });
              }
            }

            // Create workflow connections
            if (tool.workflowConfig.edges && tool.workflowConfig.edges.length > 0) {
              for (const edge of tool.workflowConfig.edges) {
                await tx.connection.create({
                  data: {
                    workflowId: workflow.id,
                    fromNodeId: `${workflow.id}-${edge.source}`,
                    toNodeId: `${workflow.id}-${edge.target}`,
                  },
                });
              }
            }

            // Link workflow as agent tool
            await tx.agentTool.create({
              data: {
                agentId: agent.id,
                workflowId: workflow.id,
                name: tool.name,
                description: tool.description,
              },
            });
          }
        }

        return agent;
      });
    }),

  shareAsTemplate: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        category: z.nativeEnum(TemplateCategory),
        tags: z.array(z.string()).max(10).default([]),
        coverImage: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const agent = await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      // Create community template from agent
      return prisma.agentTemplate.create({
        data: {
          name: agent.name,
          description: agent.description || `A ${input.category.toLowerCase()} agent`,
          category: input.category,
          systemPrompt: agent.systemPrompt,
          context: agent.context,
          model: agent.model,
          temperature: agent.temperature,
          icon: agent.avatar,
          color: "#6366f1",
          coverImage: input.coverImage,
          isPublic: true,
          isFeatured: false,
          createdById: ctx.auth.user.id,
          createdByName: ctx.auth.user.name,
          tags: input.tags.map((t) => t.toLowerCase()),
        },
      });
    }),

  rateTemplate: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        rating: z.number().min(1).max(5),
      })
    )
    .mutation(async ({ input }) => {
      const template = await prisma.agentTemplate.findUniqueOrThrow({
        where: { id: input.templateId },
      });

      // Calculate new average rating
      const newReviewCount = template.reviewCount + 1;
      const newRating =
        (template.rating * template.reviewCount + input.rating) / newReviewCount;

      return prisma.agentTemplate.update({
        where: { id: input.templateId },
        data: {
          rating: newRating,
          reviewCount: newReviewCount,
        },
      });
    }),

  // ==================
  // EMBED WIDGET
  // ==================

  getEmbed: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      return prisma.agentEmbed.findUnique({
        where: { agentId: input.agentId },
      });
    }),

  upsertEmbed: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        enabled: z.boolean().default(true),
        allowedDomains: z.array(z.string()).default([]),
        displayName: z.string().max(50).optional(),
        welcomeMessage: z.string().max(500).optional(),
        logo: z.string().url().optional(),
        conversationStarters: z.array(z.string()).max(4).default([]),
        // Colors
        accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#6366f1"),
        backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#ffffff"),
        textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#1f2937"),
        userBubbleColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#6366f1"),
        botBubbleColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#f3f4f6"),
        // Position & Size
        position: z.enum(["BOTTOM_RIGHT", "BOTTOM_LEFT", "TOP_RIGHT", "TOP_LEFT"]).default("BOTTOM_RIGHT"),
        buttonSize: z.number().min(40).max(80).default(56),
        windowWidth: z.number().min(300).max(500).default(400),
        windowHeight: z.number().min(400).max(800).default(600),
        // Behavior
        autoOpen: z.boolean().default(false),
        autoOpenDelay: z.number().min(0).max(30).default(0),
        showBranding: z.boolean().default(true),
        collectEmail: z.boolean().default(false),
        requireEmail: z.boolean().default(false),
        // Custom CSS
        customCss: z.string().max(10000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      return prisma.agentEmbed.upsert({
        where: { agentId: input.agentId },
        create: {
          agentId: input.agentId,
          enabled: input.enabled,
          allowedDomains: input.allowedDomains,
          displayName: input.displayName,
          welcomeMessage: input.welcomeMessage,
          logo: input.logo,
          conversationStarters: input.conversationStarters,
          // Colors
          accentColor: input.accentColor,
          backgroundColor: input.backgroundColor,
          textColor: input.textColor,
          userBubbleColor: input.userBubbleColor,
          botBubbleColor: input.botBubbleColor,
          // Position & Size
          position: input.position,
          buttonSize: input.buttonSize,
          windowWidth: input.windowWidth,
          windowHeight: input.windowHeight,
          // Behavior
          autoOpen: input.autoOpen,
          autoOpenDelay: input.autoOpenDelay,
          showBranding: input.showBranding,
          collectEmail: input.collectEmail,
          requireEmail: input.requireEmail,
          // Custom CSS
          customCss: input.customCss,
        },
        update: {
          enabled: input.enabled,
          allowedDomains: input.allowedDomains,
          displayName: input.displayName,
          welcomeMessage: input.welcomeMessage,
          logo: input.logo,
          conversationStarters: input.conversationStarters,
          // Colors
          accentColor: input.accentColor,
          backgroundColor: input.backgroundColor,
          textColor: input.textColor,
          userBubbleColor: input.userBubbleColor,
          botBubbleColor: input.botBubbleColor,
          // Position & Size
          position: input.position,
          buttonSize: input.buttonSize,
          windowWidth: input.windowWidth,
          windowHeight: input.windowHeight,
          // Behavior
          autoOpen: input.autoOpen,
          autoOpenDelay: input.autoOpenDelay,
          showBranding: input.showBranding,
          collectEmail: input.collectEmail,
          requireEmail: input.requireEmail,
          // Custom CSS
          customCss: input.customCss,
        },
      });
    }),

  // ==================
  // MULTI-AGENT CONNECTIONS
  // ==================

  getConnections: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      return prisma.agentConnection.findMany({
        where: { sourceAgentId: input.agentId },
        include: {
          targetAgent: {
            select: { id: true, name: true, avatar: true, description: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  getAvailableAgentsForConnection: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get all agents owned by user except the current one
      // and those already connected
      const existingConnections = await prisma.agentConnection.findMany({
        where: { sourceAgentId: input.agentId },
        select: { targetAgentId: true },
      });

      const connectedIds = existingConnections.map((c) => c.targetAgentId);

      return prisma.agent.findMany({
        where: {
          userId: ctx.auth.user.id,
          id: {
            notIn: [input.agentId, ...connectedIds],
          },
        },
        select: { id: true, name: true, avatar: true, description: true },
        orderBy: { name: "asc" },
      });
    }),

  createConnection: protectedProcedure
    .input(
      z.object({
        sourceAgentId: z.string(),
        targetAgentId: z.string(),
        alias: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[a-z][a-z0-9_]*$/, {
            message:
              "Alias must start with a letter and contain only lowercase letters, numbers, and underscores",
          }),
        description: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership of both agents
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.sourceAgentId, userId: ctx.auth.user.id },
      });
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.targetAgentId, userId: ctx.auth.user.id },
      });

      return prisma.agentConnection.create({
        data: {
          sourceAgentId: input.sourceAgentId,
          targetAgentId: input.targetAgentId,
          alias: input.alias,
          description: input.description,
        },
        include: {
          targetAgent: {
            select: { id: true, name: true, avatar: true, description: true },
          },
        },
      });
    }),

  updateConnection: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        alias: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[a-z][a-z0-9_]*$/)
          .optional(),
        description: z.string().min(1).max(500).optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connection = await prisma.agentConnection.findUniqueOrThrow({
        where: { id: input.id },
        include: { sourceAgent: true },
      });

      if (connection.sourceAgent.userId !== ctx.auth.user.id) {
        throw new Error("Unauthorized");
      }

      return prisma.agentConnection.update({
        where: { id: input.id },
        data: {
          ...(input.alias !== undefined && { alias: input.alias }),
          ...(input.description !== undefined && {
            description: input.description,
          }),
          ...(input.enabled !== undefined && { enabled: input.enabled }),
        },
        include: {
          targetAgent: {
            select: { id: true, name: true, avatar: true, description: true },
          },
        },
      });
    }),

  deleteConnection: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const connection = await prisma.agentConnection.findUniqueOrThrow({
        where: { id: input.id },
        include: { sourceAgent: true },
      });

      if (connection.sourceAgent.userId !== ctx.auth.user.id) {
        throw new Error("Unauthorized");
      }

      return prisma.agentConnection.delete({ where: { id: input.id } });
    }),

  // ==================
  // AGENT SWARMS (Parallel Execution)
  // ==================

  getSwarms: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        page: z.number().default(PAGINATION.DEFAULT_PAGE),
        pageSize: z
          .number()
          .min(PAGINATION.MIN_PAGE_SIZE)
          .max(PAGINATION.MAX_PAGE_SIZE)
          .default(PAGINATION.DEFAULT_PAGE_SIZE),
      })
    )
    .query(async ({ ctx, input }) => {
      const { agentId, page, pageSize } = input;

      // Verify agent ownership
      await prisma.agent.findUniqueOrThrow({
        where: { id: agentId, userId: ctx.auth.user.id },
      });

      const [items, totalCount] = await Promise.all([
        prisma.agentSwarm.findMany({
          skip: (page - 1) * pageSize,
          take: pageSize,
          where: { agentId },
          orderBy: { createdAt: "desc" },
          include: {
            _count: { select: { tasks: true } },
          },
        }),
        prisma.agentSwarm.count({ where: { agentId } }),
      ]);

      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        items,
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      };
    }),

  getSwarm: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const swarm = await prisma.agentSwarm.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          agent: {
            select: { id: true, name: true, userId: true },
          },
          tasks: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      // Verify ownership through agent
      if (swarm.agent.userId !== ctx.auth.user.id) {
        throw new Error("Unauthorized");
      }

      return swarm;
    }),

  createSwarm: premiumProcedure
    .input(
      z.object({
        agentId: z.string(),
        name: z.string().min(1).max(100),
        taskTemplate: z.string().min(1).max(10000),
        items: z.array(z.record(z.string(), z.unknown())).min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify agent ownership
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      // Create swarm with tasks
      const swarm = await prisma.agentSwarm.create({
        data: {
          agentId: input.agentId,
          name: input.name,
          taskTemplate: input.taskTemplate,
          totalTasks: input.items.length,
          tasks: {
            create: input.items.map((itemInput) => ({
              input: itemInput as any,
            })),
          },
        },
        include: {
          _count: { select: { tasks: true } },
        },
      });

      // Execute in background
      executeSwarm(swarm.id).catch(console.error);

      return swarm;
    }),

  cancelSwarm: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const swarm = await prisma.agentSwarm.findUniqueOrThrow({
        where: { id: input.id },
        include: { agent: true },
      });

      if (swarm.agent.userId !== ctx.auth.user.id) {
        throw new Error("Unauthorized");
      }

      await cancelSwarm(input.id);

      return prisma.agentSwarm.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          _count: { select: { tasks: true } },
        },
      });
    }),

  deleteSwarm: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const swarm = await prisma.agentSwarm.findUniqueOrThrow({
        where: { id: input.id },
        include: { agent: true },
      });

      if (swarm.agent.userId !== ctx.auth.user.id) {
        throw new Error("Unauthorized");
      }

      // Don't allow deleting running swarms
      if (swarm.status === "RUNNING") {
        throw new Error("Cannot delete a running swarm. Cancel it first.");
      }

      return prisma.agentSwarm.delete({ where: { id: input.id } });
    }),

  // ==================
  // AGENT EMAIL ADDRESS (Inbound Email Trigger)
  // ==================

  getAgentEmailAddress: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      return prisma.agentEmailAddress.findUnique({
        where: { agentId: input.agentId },
      });
    }),

  createAgentEmailAddress: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        autoReply: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      // Check if email address already exists
      const existing = await prisma.agentEmailAddress.findUnique({
        where: { agentId: input.agentId },
      });

      if (existing) {
        throw new Error("Email address already exists for this agent");
      }

      // Generate a unique local part
      // Format: agent-{randomId}
      const randomId = globalThis.crypto.randomUUID().replace(/-/g, "").substring(0, 12);
      const localPart = `agent-${randomId}`;

      return prisma.agentEmailAddress.create({
        data: {
          agentId: input.agentId,
          localPart,
          autoReply: input.autoReply,
        },
      });
    }),

  updateAgentEmailAddress: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        autoReply: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      const emailAddress = await prisma.agentEmailAddress.findUnique({
        where: { agentId: input.agentId },
      });

      if (!emailAddress) {
        throw new Error("Email address not found for this agent");
      }

      return prisma.agentEmailAddress.update({
        where: { agentId: input.agentId },
        data: {
          ...(input.autoReply !== undefined && { autoReply: input.autoReply }),
        },
      });
    }),

  deleteAgentEmailAddress: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      return prisma.agentEmailAddress.delete({
        where: { agentId: input.agentId },
      });
    }),

  // ==================
  // MEETING RECORDINGS
  // ==================

  getMeetingRecordings: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      return prisma.meetingRecording.findMany({
        where: { agentId: input.agentId },
        orderBy: { scheduledAt: "desc" },
      });
    }),

  getMeetingRecording: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const recording = await prisma.meetingRecording.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          agent: {
            select: { id: true, name: true, userId: true },
          },
        },
      });

      // Verify ownership through agent
      if (recording.agent.userId !== ctx.auth.user.id) {
        throw new Error("Unauthorized");
      }

      return recording;
    }),

  scheduleMeetingRecording: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        title: z.string().min(1).max(200),
        meetingUrl: z.string().url(),
        scheduledAt: z.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      // Detect platform from URL
      let platform: "ZOOM" | "GOOGLE_MEET" | "MICROSOFT_TEAMS" | "OTHER" = "OTHER";
      if (input.meetingUrl.includes("zoom.us")) platform = "ZOOM";
      else if (input.meetingUrl.includes("meet.google.com")) platform = "GOOGLE_MEET";
      else if (input.meetingUrl.includes("teams.microsoft.com")) platform = "MICROSOFT_TEAMS";

      return prisma.meetingRecording.create({
        data: {
          agentId: input.agentId,
          title: input.title,
          meetingUrl: input.meetingUrl,
          meetingPlatform: platform,
          scheduledAt: input.scheduledAt,
        },
      });
    }),

  syncCalendarMeetings: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      const { syncCalendarMeetings } = await import("@/lib/meeting-recorder");
      return syncCalendarMeetings(input.agentId, ctx.auth.user.id);
    }),

  deleteMeetingRecording: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const recording = await prisma.meetingRecording.findUniqueOrThrow({
        where: { id: input.id },
        include: { agent: true },
      });

      if (recording.agent.userId !== ctx.auth.user.id) {
        throw new Error("Unauthorized");
      }

      return prisma.meetingRecording.delete({ where: { id: input.id } });
    }),

  // ==================
  // VOICE/PHONE AGENT (Twilio)
  // ==================

  getAgentPhoneNumber: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      return prisma.agentPhoneNumber.findUnique({
        where: { agentId: input.agentId },
      });
    }),

  searchAvailablePhoneNumbers: protectedProcedure
    .input(
      z.object({
        country: z.string().default("US"),
        areaCode: z.string().optional(),
        limit: z.number().min(1).max(20).default(5),
      })
    )
    .query(async ({ input }) => {
      const { searchAvailableNumbers } = await import("@/lib/integrations/twilio");
      return searchAvailableNumbers(input.country, input.areaCode, input.limit);
    }),

  purchasePhoneNumber: premiumProcedure
    .input(
      z.object({
        agentId: z.string(),
        areaCode: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      // Check if agent already has a phone number
      const existing = await prisma.agentPhoneNumber.findUnique({
        where: { agentId: input.agentId },
      });

      if (existing) {
        throw new Error("Agent already has a phone number");
      }

      const { purchasePhoneNumber } = await import("@/lib/integrations/twilio");
      return purchasePhoneNumber(input.agentId, input.areaCode);
    }),

  releasePhoneNumber: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      const { releasePhoneNumber } = await import("@/lib/integrations/twilio");
      await releasePhoneNumber(input.agentId);
      return { success: true };
    }),

  updatePhoneSettings: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        voiceEnabled: z.boolean().optional(),
        voiceGreeting: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      const { updatePhoneNumberSettings } = await import("@/lib/integrations/twilio");
      return updatePhoneNumberSettings(input.agentId, {
        voiceEnabled: input.voiceEnabled,
        voiceGreeting: input.voiceGreeting,
      });
    }),

  getCallHistory: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        page: z.number().default(PAGINATION.DEFAULT_PAGE),
        pageSize: z
          .number()
          .min(PAGINATION.MIN_PAGE_SIZE)
          .max(PAGINATION.MAX_PAGE_SIZE)
          .default(PAGINATION.DEFAULT_PAGE_SIZE),
      })
    )
    .query(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      const { getCallHistory } = await import("@/lib/integrations/twilio");
      const { items, totalCount } = await getCallHistory(
        input.agentId,
        input.page,
        input.pageSize
      );

      const totalPages = Math.ceil(totalCount / input.pageSize);

      return {
        items,
        page: input.page,
        pageSize: input.pageSize,
        totalCount,
        totalPages,
        hasNextPage: input.page < totalPages,
        hasPreviousPage: input.page > 1,
      };
    }),

  makeOutboundCall: premiumProcedure
    .input(
      z.object({
        agentId: z.string(),
        toNumber: z.string().min(10).max(20),
        message: z.string().min(1).max(1000).optional(),
        conversational: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      const { makeOutboundCall, makeOutboundCallWithConversation } = await import(
        "@/lib/integrations/twilio"
      );

      if (input.conversational) {
        const greeting = input.message || "Hello, this is an automated call. How can I help you today?";
        return makeOutboundCallWithConversation(input.agentId, input.toNumber, greeting);
      }

      const message = input.message || "Hello, this is an automated call from your agent.";
      return makeOutboundCall(input.agentId, input.toNumber, message);
    }),

  // ==================
  // ANALYTICS
  // ==================

  getAgentAnalytics: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        days: z.number().min(1).max(365).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify agent ownership
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      const { getAgentAnalytics } = await import("@/lib/agent-analytics");
      return getAgentAnalytics(input.agentId, input.days);
    }),

  getUserAnalytics: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(365).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const { getUserAnalytics } = await import("@/lib/agent-analytics");
      return getUserAnalytics(ctx.auth.user.id, input.days);
    }),

  submitFeedback: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        positive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify agent ownership
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      const { recordMetric } = await import("@/lib/agent-analytics");
      await recordMetric(input.agentId, {
        feedbackPositive: input.positive,
      });

      return { success: true };
    }),

  // ==================
  // ACTIVITY LOG
  // ==================

  getActivities: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ ctx, input }) => {
      return prisma.conversationActivity.findMany({
        where: {
          conversationId: input.conversationId,
          conversation: { agent: { userId: ctx.auth.user.id } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }),

  // ==================
  // APPROVALS (Safe Mode)
  // ==================

  getPendingApprovals: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(PAGINATION.DEFAULT_PAGE_SIZE),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? PAGINATION.DEFAULT_PAGE_SIZE;

      const [items, total] = await Promise.all([
        prisma.conversationActivity.findMany({
          where: {
            requiresConfirmation: true,
            confirmedAt: null,
            rejectedAt: null,
            conversation: { agent: { userId: ctx.auth.user.id } },
          },
          include: {
            conversation: {
              include: {
                agent: {
                  select: { id: true, name: true, avatar: true },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.conversationActivity.count({
          where: {
            requiresConfirmation: true,
            confirmedAt: null,
            rejectedAt: null,
            conversation: { agent: { userId: ctx.auth.user.id } },
          },
        }),
      ]);

      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  getApprovalHistory: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(PAGINATION.DEFAULT_PAGE_SIZE),
        status: z.enum(["approved", "rejected", "all"]).default("all"),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? PAGINATION.DEFAULT_PAGE_SIZE;
      const status = input?.status ?? "all";

      const statusFilter =
        status === "approved"
          ? { confirmedAt: { not: null } }
          : status === "rejected"
          ? { rejectedAt: { not: null } }
          : { OR: [{ confirmedAt: { not: null } }, { rejectedAt: { not: null } }] };

      const [items, total] = await Promise.all([
        prisma.conversationActivity.findMany({
          where: {
            requiresConfirmation: true,
            ...statusFilter,
            conversation: { agent: { userId: ctx.auth.user.id } },
          },
          include: {
            conversation: {
              include: {
                agent: {
                  select: { id: true, name: true, avatar: true },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.conversationActivity.count({
          where: {
            requiresConfirmation: true,
            ...statusFilter,
            conversation: { agent: { userId: ctx.auth.user.id } },
          },
        }),
      ]);

      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }),

  // ==================
  // PHASE 5: ANALYTICS & INSIGHTS (LangChain-inspired)
  // ==================

  getMetrics: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        timeframe: z.number().default(30), // days
      })
    )
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.timeframe);

      const traces = await prisma.agentTrace.findMany({
        where: {
          agentId: input.agentId,
          agent: { userId: ctx.auth.user.id },
          startedAt: { gte: since },
        },
      });

      const evaluations = await prisma.conversationEvaluation.findMany({
        where: {
          conversation: { agentId: input.agentId },
          evaluatedAt: { gte: since },
        },
      });

      // Calculate metrics
      const totalConversations = traces.length;
      const successRate =
        traces.filter((t) => t.status === "COMPLETED").length /
        Math.max(traces.length, 1);
      const avgCost =
        traces.reduce((sum, t) => sum + t.totalCost, 0) /
        Math.max(traces.length, 1);
      const avgLatency =
        traces.reduce((sum, t) => sum + (t.latencyMs || 0), 0) /
        Math.max(traces.length, 1);
      const avgSatisfaction =
        evaluations.reduce((sum, e) => sum + e.userSatisfactionScore, 0) /
        Math.max(evaluations.length, 1) || 3;
      const totalTokensIn = traces.reduce((sum, t) => sum + t.totalTokensIn, 0);
      const totalTokensOut = traces.reduce(
        (sum, t) => sum + t.totalTokensOut,
        0
      );
      const totalCost = traces.reduce((sum, t) => sum + t.totalCost, 0);

      return {
        totalConversations,
        successRate,
        avgCost,
        avgLatency,
        avgSatisfaction,
        totalFeedback: evaluations.length,
        totalTokensIn,
        totalTokensOut,
        totalCost,
      };
    }),

  getLatestInsights: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      return await prisma.agentInsight.findFirst({
        where: { agentId: input.agentId },
        orderBy: { generatedAt: "desc" },
      });
    }),

  getEvaluations: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        limit: z.number().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify ownership
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      return await prisma.conversationEvaluation.findMany({
        where: {
          conversation: { agentId: input.agentId },
        },
        orderBy: { evaluatedAt: "desc" },
        take: input.limit,
      });
    }),

  getFeedback: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        limit: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify ownership
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      return await prisma.agentFeedback.findMany({
        where: { agentId: input.agentId },
        orderBy: { timestamp: "desc" },
        take: input.limit,
      });
    }),

  getABTests: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      return await prisma.agentABTest.findMany({
        where: { agentId: input.agentId },
        include: { agent: { select: { name: true } } },
        orderBy: { startedAt: "desc" },
      });
    }),

  getModificationProposals: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      return await prisma.modificationProposal.findMany({
        where: { agentId: input.agentId },
        orderBy: { proposedAt: "desc" },
      });
    }),

  getPerformanceAnalysis: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      await prisma.agent.findUniqueOrThrow({
        where: { id: input.agentId, userId: ctx.auth.user.id },
      });

      // Use SelfModifier from @nodebase/core
      const { SelfModifier } = await import("@nodebase/core");
      const modifier = new SelfModifier();
      return await modifier.proposeModifications(input.agentId);
    }),

  approveModification: protectedProcedure
    .input(
      z.object({
        proposalId: z.string(),
        approved: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through proposal
      const proposal = await prisma.modificationProposal.findUniqueOrThrow({
        where: { id: input.proposalId },
        include: { agent: true },
      });

      if (proposal.agent.userId !== ctx.auth.user.id) {
        throw new Error("Unauthorized");
      }

      // Use SelfModifier from @nodebase/core
      const { SelfModifier } = await import("@nodebase/core");
      const modifier = new SelfModifier();
      await modifier.applyModification(input.proposalId, input.approved);
    }),
});
