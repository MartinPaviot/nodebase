/**
 * Retry with Exponential Backoff
 *
 * Pattern from lib/connectors/USAGE_GUIDE.md.
 * Uses isRetryableError() from lib/errors.ts.
 */

import { isRetryableError } from "@/lib/errors";

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 30000,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: Partial<RetryOptions>,
): Promise<T> {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  const shouldRetry = options.shouldRetry ?? isRetryableError;

  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= options.maxRetries || !shouldRetry(error)) {
        throw error;
      }

      const delay = Math.min(
        options.baseDelayMs * Math.pow(2, attempt),
        options.maxDelayMs,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
