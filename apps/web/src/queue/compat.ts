/**
 * Compatibility Layer
 *
 * Provides drop-in replacements for Inngest's step and publish functions
 * to avoid breaking existing executors during migration.
 */

/**
 * Stub publish function.
 * TODO: Implement Redis PubSub + SSE (Pattern #7)
 */
export const stubPublish = async (_message: unknown): Promise<void> => {
  // For now, just log. Will be replaced by Redis PubSub.
  // console.log("[PublishStub]", message);
};

/**
 * Stub step tools.
 * Provides compatibility with Inngest's step API.
 */
export const stubStep = {
  /**
   * Run a function with a step name.
   * In Inngest, this allows retry of individual steps.
   * With BullMQ, the whole job is retried, so we just execute directly.
   */
  run: async <T>(
    _stepName: string,
    fn: () => Promise<T> | T,
  ): Promise<T> => {
    return await fn();
  },

  /**
   * Wrap AI calls with telemetry.
   * In Inngest, this captures tokens/cost/etc.
   * For now, we just execute directly.
   * TODO: Implement AI event logging (Pattern #6)
   */
  ai: {
    wrap: async <TArgs extends unknown[], TResult>(
      _stepName: string,
      fn: (...args: TArgs) => Promise<TResult>,
      ...args: TArgs
    ): Promise<TResult> => {
      // TODO: Add telemetry/logging here
      return await fn(...args);
    },
  },
};
