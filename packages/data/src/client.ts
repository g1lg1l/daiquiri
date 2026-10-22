import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RuntimeConfig } from '@daiq/domain';
import type { Database } from './database.types';

export type DaiqClient = SupabaseClient<Database>;

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
  });
}
