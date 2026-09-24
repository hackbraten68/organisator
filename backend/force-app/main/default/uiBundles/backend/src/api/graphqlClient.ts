/**
 * Thin GraphQL client: createDataSDK + sdk.graphql with centralized error
 * handling. Mutations are routed to sdk.graphql.mutate and everything else to
 * sdk.graphql.query (the SDK rejects an operation sent to the wrong method).
 * Use with gql-tagged queries and generated operation types for type-safe calls.
 *
 * Freshness: the SDK serves queries from a module-level OneStore cache
 * (300s TTL) while mutations bypass it without invalidating anything — so a
 * plain query after a mutation returns stale data until the TTL expires or
 * the page reloads. Every query therefore goes out with `no-cache`
 * (network read, still written back). This matches our explicit-fetch
 * architecture: we fetch on mount/save/tab change and hold no subscriptions,
 * so cache hits would only save remount requests in a low-traffic admin tool.
 */
import { createDataSDK } from '@salesforce/platform-sdk';

/**
 * True when the operation's first definition is a `mutation`. Strips GraphQL
 * comments first so a leading `# ...` line can't mask the keyword. Queries
 * (named or anonymous `{ ... }` shorthand) and subscriptions fall through to
 * query().
 */
function isMutation(operation: string): boolean {
  return /^\s*mutation\b/.test(operation.replace(/#[^\n\r]*/g, ''));
}

export async function executeGraphQL<TData, TVariables = Record<string, never>>(
  operation: string,
  variables?: TVariables
): Promise<TData> {
  const data = await createDataSDK();
  const result = isMutation(operation)
    ? await data.graphql!.mutate<TData, TVariables>({
        mutation: operation,
        variables: variables,
      })
    : await data.graphql!.query<TData, TVariables>({
        query: operation,
        variables: variables,
        // Bypass the OneStore read cache: mutations never invalidate it, so
        // without this every post-mutation refetch serves stale data.
        cacheControl: 'no-cache',
      });

  if (result.errors?.length) {
    const msg = result.errors.map(e => e.message).join('; ');
    throw new Error(`GraphQL Error: ${msg}`);
  }

  if (result.data == null) {
    throw new Error('GraphQL response data is null');
  }

  return result.data;
}
