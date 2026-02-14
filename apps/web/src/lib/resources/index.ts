/**
 * Resource Pattern Exports
 *
 * All data access goes through Resource classes for:
 * - Automatic permission checks
 * - No direct Prisma access in routes
 * - Type-safe operations
 * - Audit trail
 */

export { AgentResource } from "./agent-resource";
export { ConversationResource } from "./conversation-resource";
export { IntegrationResource } from "./integration-resource";
export {
  AgentTraceResource,
  type TraceMetrics,
  type TraceStep,
  type ToolCall,
} from "./agent-trace-resource";
export { Authenticator } from "./authenticator";
export * from "../errors";
