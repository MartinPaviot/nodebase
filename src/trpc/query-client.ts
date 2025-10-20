import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from '@tanstack/react-query';
/**
 * Create a preconfigured QueryClient for use with React Query.
 *
 * The client uses a 30-second query staleTime and custom dehydration behavior:
 * a query will be considered for dehydration if `defaultShouldDehydrateQuery(query)` is true
 * or if the query's state status is `'pending'`. (Serialization hooks are left as placeholders.)
 *
 * @returns A `QueryClient` configured with the described default options.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
      },
      dehydrate: {
        // serializeData: superjson.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === 'pending',
      },
      hydrate: {
        // deserializeData: superjson.deserialize,
      },
    },
  });
}