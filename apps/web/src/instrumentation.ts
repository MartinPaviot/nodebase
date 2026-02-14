import * as Sentry from '@sentry/nextjs';
import { validateConfig } from './lib/config';

export async function register() {
  // Skip config validation during build phase (env vars may not be available)
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
  if (!isBuildPhase) {
    // Validate configuration - fail fast if config is invalid at runtime
    validateConfig();
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Sentry disabled for faster dev startup
    // await import('../sentry.server.config');

    // TODO: Initialize BullMQ workers
    // Disabled during development for faster startup
    // Uncomment when you need to test workflow execution
    /*
    if (process.env.REDIS_URL && process.env.ENCRYPTION_KEY) {
      const { initializeQueues } = await import('./queue/init');
      await initializeQueues();
    } else {
      console.warn('[Instrumentation] Skipping queue initialization - missing REDIS_URL or ENCRYPTION_KEY');
    }
    */
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Sentry disabled for faster dev startup
    // await import('../sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
