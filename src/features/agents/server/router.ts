import { generateSlug } from "random-word-slugs";
import prisma from "@/lib/db";
import {
  createTRPCRouter,
  premiumProcedure,
  protectedProcedure,
} from "@/trpc/init";
import z from "zod";
import { PAGINATION } from "@/config/constants";
import { AgentModel } from "@/generated/prisma";

// Validation schemas
const agentModelSchema = z.nativeEnum(AgentModel);

const createAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  systemPrompt: z.string().min(1).max(10000),
  model: agentModelSchema.default("ANTHROPIC"),
  temperature: z.number().min(0).max(2).default(0.7),
  avatar: z.string().url().optional(),
  credentialId: z.string().optional(),
});

const updateAgentSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  systemPrompt: z.string().min(1).max(10000).optional(),
  model: agentModelSchema.optional(),
  temperature: z.number().min(0).max(2).optional(),
  avatar: z.string().url().nullish(),
  credentialId: z.string().nullish(),
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
        model: input.model,
        temperature: input.temperature,
        avatar: input.avatar,
        credentialId: input.credentialId,
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
          ...(data.model !== undefined && { model: data.model }),
          ...(data.temperature !== undefined && { temperature: data.temperature }),
          ...(data.avatar !== undefined && { avatar: data.avatar }),
          ...(data.credentialId !== undefined && { credentialId: data.credentialId }),
        },
      });
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
          orderBy: { updatedAt: "desc" },
          include: {
            messages: {
              take: 1,
              orderBy: { createdAt: "desc" },
              select: { content: true, createdAt: true },
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
});
