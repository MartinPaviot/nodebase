import { auth } from '@/lib/auth';
import { polarClient } from '@/lib/polar';
import { initTRPC, TRPCError } from '@trpc/server';
import { cache } from 'react';
import superjson from "superjson";
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';

/**
 * TRPC Context - receives the HTTP request from fetchRequestHandler
 * This extracts headers from the request to use for authentication
 * NOTE: Do NOT use cache() here - it doesn't work correctly in API route handlers
 */
export const createTRPCContext = async (opts?: FetchCreateContextFnOptions) => {
  // Extract headers from the incoming HTTP request
  const headers = opts?.req?.headers
    ? new Headers(opts.req.headers)
    : new Headers();

  return { headers };
};

// Type of the context for TypeScript
type Context = Awaited<ReturnType<typeof createTRPCContext>>;

// Cache customer state per request to avoid multiple Polar API calls
const getCustomerState = cache(async (userId: string) => {
  return polarClient.customers.getStateExternal({
    externalId: userId,
  });
});

const t = initTRPC.context<Context>().create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  transformer: superjson,
});

// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  // Use headers from context (extracted from the HTTP request)
  const session = await auth.api.getSession({
    headers: ctx.headers,
  });

  if (!session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Unauthorized",
    });
  }

  return next({ ctx: { ...ctx, auth: session } });
});

export const premiumProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    // Use cached function to avoid multiple Polar API calls per request
    const customer = await getCustomerState(ctx.auth.user.id);

    if (
      !customer.activeSubscriptions ||
      customer.activeSubscriptions.length === 0
    ) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Active subscription required",
      });
    }

    return next({ ctx: { ...ctx, customer } });
  },
);