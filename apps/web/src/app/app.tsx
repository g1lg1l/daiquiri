import { AuthProvider, DataProvider, useAuth, type DaiqClient } from '@daiq/data';
import type { RuntimeConfig } from '@daiq/domain';
import { installPointerEffects, ThemeProvider, Toaster, TooltipProvider } from '@daiq/ui';
import { useIsMutating, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { RouterProvider } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Splash } from '../components/splash';
import { m } from '../i18n';
import { createAppRouter } from '../router';
import { persister, persistOptions } from './persistence';
import { createQueryClient } from './query-client';

function AppRouter({ config }: { config: RuntimeConfig }) {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const [router] = useState(() => createAppRouter(queryClient, config));
  const previousUser = useRef<string | null>(null);
  const userId = auth.status === 'signed-in' ? auth.userId : null;
  const ready = auth.status !== 'loading';

  useEffect(() => {
    // Re-running the guards while the session is still loading would redirect a
    // signed-in visitor to /login before the router even mounts.
    if (!ready) return;
    // Never let one user's cached data survive into another session.
    if (previousUser.current && previousUser.current !== userId) {
      queryClient.clear();
      void persister.removeClient();
    }
    previousUser.current = userId;
    void router.invalidate();
  }, [ready, userId, queryClient, router]);

  if (auth.status === 'loading') return <Splash />;
  return <RouterProvider router={router} context={{ auth }} />;
}

/**
 * Writes still on their way to the server are lost if the page goes away:
 * mark them on <html data-saving> and let the browser ask before leaving.
 */
function UnsavedChangesGuard() {
  const saving = useIsMutating() > 0;
  useEffect(() => {
    document.documentElement.dataset.saving = String(saving);
    if (!saving) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saving]);
  return null;
}

export function App({ client, config }: { client: DaiqClient; config: RuntimeConfig }) {
  const [queryClient] = useState<QueryClient>(createQueryClient);
  useEffect(() => installPointerEffects(), []);
  return (
    <ThemeProvider>
      <TooltipProvider delay={450}>
        <DataProvider client={client}>
          <AuthProvider>
            <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
              <AppRouter config={config} />
              <UnsavedChangesGuard />
              <Toaster labels={m.common.toast} />
            </PersistQueryClientProvider>
          </AuthProvider>
        </DataProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
