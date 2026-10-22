import { z } from 'zod';

function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
}

/** True when the key must never reach a browser (service role / secret key). */
export function isPrivilegedSupabaseKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  const payload = key.split('.')[1];
  if (!payload) return false;
  try {
    const claims: unknown = JSON.parse(base64UrlDecode(payload));
    return (
      typeof claims === 'object' &&
      claims !== null &&
      'role' in claims &&
      claims.role === 'service_role'
    );
  } catch {
    return false;
  }
}

/** Runtime configuration loaded from /config.json (see ADR-0012). */
export const runtimeConfigSchema = z.object({
  supabaseUrl: z.url(),
  supabaseKey: z
    .string()
    .min(20)
    .refine((key) => !isPrivilegedSupabaseKey(key), {
      message: 'A service-role/secret key must never be exposed to the browser',
    }),
  demo: z.boolean().default(false),
  sentryDsn: z.url().optional(),
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;
