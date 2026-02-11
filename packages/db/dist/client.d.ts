export { PrismaClient } from '@prisma/client';

/**
 * @nodebase/db - Prisma Client
 *
 * Singleton Prisma client for database access.
 * Import this from @nodebase/db/client
 */

declare const prisma: any;

export { prisma as default, prisma };
