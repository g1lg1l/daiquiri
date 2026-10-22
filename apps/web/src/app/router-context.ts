import type { AuthState } from '@daiq/data';
import type { RuntimeConfig } from '@daiq/domain';
import type { QueryClient } from '@tanstack/react-query';
import { redirect, type ParsedLocation } from '@tanstack/react-router';

export interface RouterContext {
  queryClient: QueryClient;
  config: RuntimeConfig;
  auth: AuthState;
}

/** Guard for routes that need a signed-in user. */
export function requireAuth({
  context,
  location,
}: {
  context: RouterContext;
  location: ParsedLocation;
}) {
  if (context.auth.status !== 'signed-in') {
    throw redirect({ to: '/login', search: { redirect: location.href } });
  }
  return { auth: context.auth };
}
