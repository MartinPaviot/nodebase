import { credentialsRouter } from '@/features/credentials/server/router';
import { createTRPCRouter } from '../init';
import { workflowsRouter } from '@/features/workflows/server/router';
import { executionsRouter } from '@/features/executions/server/router';
import { agentsRouter } from '@/features/agents/server/router';
import { scanRouter } from '@/features/scan/server/router';
import { optimizationRouter } from './optimization';
import { mailboxRouter } from '@/features/settings/server/mailbox-router';
import { observabilityRouter } from './observability';
import { briefingRouter } from './briefing';

export const appRouter = createTRPCRouter({
  workflows: workflowsRouter,
  credentials: credentialsRouter,
  executions: executionsRouter,
  agents: agentsRouter,
  scan: scanRouter,
  optimization: optimizationRouter,
  mailbox: mailboxRouter,
  observability: observabilityRouter,
  briefing: briefingRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;