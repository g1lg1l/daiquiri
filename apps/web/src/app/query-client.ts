import { toDaiqError } from '@daiq/data';
import { toast } from '@daiq/ui';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { logger } from '../lib/logger';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { silent?: boolean };
  }
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        logger.error('query.failed', error, { key: query.queryKey });
        // Background refresh failures keep the cached data on screen; say so once.
        if (query.state.data !== undefined)
          toast.error(toDaiqError(error).message, { id: 'query-refresh' });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        logger.error('mutation.failed', error, { key: mutation.options.mutationKey });
        if (!mutation.meta?.silent) toast.error(toDaiqError(error).message);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 24 * 60 * 60_000,
        retry: (failureCount, error) => toDaiqError(error).code === 'network' && failureCount < 3,
      },
    },
  });
}
