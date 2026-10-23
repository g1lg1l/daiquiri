import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RuntimeConfig } from '@daiq/domain';
import type { Database } from './database.types';

export type DaiqClient = SupabaseClient<Database>;

/** Database API calls finish well within this (statements stop after 8 s). */
const API_TIMEOUT_MS = 30_000;

/**
 * Gives /rest/v1/ requests a deadline. Task writes go out one at a time, so a
 * request stuck on a dead connection would hold back every later one; with a
 * deadline it fails, the change is rolled back and shown as an error, and the
 * queue moves on. Storage uploads and auth keep the browser's own limits.
 */
export function fetchWithDeadline(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input);
  if (!url.includes('/rest/v1/')) return fetch(input, init);
  const deadline = AbortSignal.timeout(API_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
  return fetch(input, { ...init, signal });
}

export function createDaiqClient(
  config: Pick<RuntimeConfig, 'supabaseUrl' | 'supabaseKey'>,
): DaiqClient {
  return createClient<Database>(config.supabaseUrl, config.supabaseKey, {
    auth: {
      // supabase-js defaults to the implicit flow; PKCE keeps tokens out of URLs (ADR-0006).
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: { fetch: fetchWithDeadline },
  });
}
