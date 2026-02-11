/**
 * @nodebase/db
 *
 * Database access layer with Resource pattern for permission-checked queries.
 * NEVER expose raw Prisma models - always use Resource classes.
 */

export { prisma, PrismaClient } from "./client";

// Resource Pattern exports
export { BaseResource, type ResourceAuth } from "./resources/base";
export { AgentResource } from "./resources/agent";
export { ScanResource } from "./resources/scan";
export { CredentialResource } from "./resources/credential";
export { AgentRunResource } from "./resources/agent-run";
