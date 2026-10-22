import { isPrivilegedSupabaseKey, runtimeConfigSchema } from './config';

const jwt = (claims: object) =>
  [
    'e30',
    btoa(JSON.stringify(claims)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'),
    'sig',
  ].join('.');

describe('runtime config', () => {
  it('accepts a publishable/anon key', () => {
    const parsed = runtimeConfigSchema.parse({
      supabaseUrl: 'https://demo.supabase.co',
      supabaseKey: jwt({ role: 'anon', iss: 'supabase' }),
    });
    expect(parsed.demo).toBe(false);
  });

  it('rejects service-role and secret keys', () => {
    expect(isPrivilegedSupabaseKey(jwt({ role: 'service_role' }))).toBe(true);
    expect(isPrivilegedSupabaseKey('sb_secret_abcdefghijklmnopqrstuvwxyz')).toBe(true);
    expect(isPrivilegedSupabaseKey('sb_publishable_abcdefghijklmnopqrstuvwxyz')).toBe(false);
    expect(
      runtimeConfigSchema.safeParse({
        supabaseUrl: 'https://demo.supabase.co',
        supabaseKey: jwt({ role: 'service_role' }),
      }).success,
    ).toBe(false);
  });
});
