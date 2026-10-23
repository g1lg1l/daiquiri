import { DaiqError, type DaiqErrorCode } from '@daiq/domain';

interface PostgresLikeError {
  code?: string;
  message?: string;
  status?: number;
}

const sqlStateToCode: Record<string, DaiqErrorCode> = {
  '28000': 'unauthenticated',
  '42501': 'forbidden',
  P0002: 'not_found',
  '23505': 'conflict',
  '23503': 'validation',
  '23514': 'validation',
  '22023': 'validation',
  '22P02': 'validation',
  '53400': 'rate_limited',
  PT429: 'rate_limited',
  PGRST301: 'unauthenticated',
  PGRST116: 'not_found',
};

const fallbackMessage: Record<DaiqErrorCode, string> = {
  unauthenticated: 'Your session has expired. Please sign in again.',
  forbidden: 'You don’t have permission to do that.',
  not_found: 'That item no longer exists or you can’t access it.',
  conflict: 'That already exists.',
  validation: 'Some of the values are not valid.',
  rate_limited: 'Too many requests. Please wait a moment and try again.',
  network: 'You appear to be offline. Changes will retry when you reconnect.',
  unknown: 'Something unexpected happened. Please try again.',
};

/**
 * Maps Supabase/PostgREST/Auth errors to a typed DaiqError. Messages raised
 * explicitly by our SQL functions are user-facing and kept as-is.
 */
export function toDaiqError(error: unknown): DaiqError {
  if (error instanceof DaiqError) return error;
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return new DaiqError('network', fallbackMessage.network, { cause: error });
  }
  const pg = (typeof error === 'object' && error !== null ? error : {}) as PostgresLikeError;
  const code: DaiqErrorCode =
    (pg.code && sqlStateToCode[pg.code]) ||
    (pg.status === 401 ? 'unauthenticated' : pg.status === 429 ? 'rate_limited' : 'unknown');
  const raisedByUs =
    pg.code === 'P0002' ||
    pg.code === '53400' ||
    pg.code === 'PT429' ||
    pg.code === '42501' ||
    pg.code === '23514';
  const message = raisedByUs && pg.message ? pg.message : fallbackMessage[code];
  return new DaiqError(code, message, { cause: error });
}

interface SupabaseResult {
  data: unknown;
  error: unknown;
}

/*
 * The helpers take the whole response type R (a success | failure union) and
 * derive the data type from it. Inferring `T` from `{ data: T | null }` instead
 * silently yields `never` for inline `await` expressions.
 */

/**
 * Unwraps a Supabase response that must carry data (list queries, `.single()`,
 * RPCs with a result). Throws a DaiqError on failure.
 */
export function unwrap<R extends SupabaseResult>(response: R): NonNullable<R['data']> {
  if (response.error) throw toDaiqError(response.error);
  const { data } = response;
  if (data === null || data === undefined) throw new DaiqError('unknown', fallbackMessage.unknown);
  return data;
}

/** For `.maybeSingle()` and RPCs where no row is a valid answer. */
export function unwrapMaybe<R extends SupabaseResult>(response: R): R['data'] {
  if (response.error) throw toDaiqError(response.error);
  return response.data;
}

/** For writes without `.select()` and void RPCs: only checks for an error. */
export function ensureOk(response: { error: unknown }): void {
  if (response.error) throw toDaiqError(response.error);
}
