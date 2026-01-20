import { credentialsRouter } from '@/features/credentials/server/router';
import { createTRPCRouter } from '../init';
import { workflowsRouter } from '@/features/workflows/server/router';
import { executionsRouter } from '@/features/executions/server/router';
import { agentsRouter } from '@/features/agents/server/router';

export const appRouter = createTRPCRouter({
  workflows: workflowsRouter,
  credentials: credentialsRouter,
  executions: executionsRouter,
  agents: agentsRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;