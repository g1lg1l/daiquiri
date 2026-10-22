import type { RuntimeConfig } from '@daiq/domain';
import type { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { RouteError } from './components/route-error';
import { routeTree } from './routeTree.gen';

/** "/daiquiri/" → "/daiquiri"; "/" → "/" (GitHub Pages sub-path support). */
const basepath = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export function createAppRouter(queryClient: QueryClient, config: RuntimeConfig) {
  return createRouter({
    routeTree,
    basepath,
    context: { queryClient, config, auth: { status: 'loading' } },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RouteError,
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
