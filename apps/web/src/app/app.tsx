import { AuthProvider, DataProvider, useAuth, type DaiqClient } from '@daiq/data';
import type { RuntimeConfig } from '@daiq/domain';
import { ThemeProvider, Toaster, TooltipProvider } from '@daiq/ui';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { RouterProvider } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Splash } from '../components/splash';
import { createAppRouter } from '../router';
import { persister, persistOptions } from './persistence';
import { createQueryClient } from './query-client';

function AppRouter({ config }: { config: RuntimeConfig }) {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const [router] = useState(() => createAppRouter(queryClient, config));
  const previousUser = useRef<string | null>(null);
  const userId = auth.status === 'signed-in' ? auth.userId : null;

  useEffect(() => {
    // Never let one user's cached data survive into another session.
    if (previousUser.current && previousUser.current !== userId) {
      queryClient.clear();
      void persister.removeClient();
    }
    previousUser.current = userId;
    void router.invalidate();
  }, [userId, queryClient, router]);

  if (auth.status === 'loading') return <Splash />;
  return <RouterProvider router={router} context={{ auth }} />;
}

export function App({ client, config }: { client: DaiqClient; config: RuntimeConfig }) {
  const [queryClient] = useState<QueryClient>(createQueryClient);
  return (
    <ThemeProvider>
      <TooltipProvider delay={450}>
        <DataProvider client={client}>
          <AuthProvider>
            <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
              <AppRouter config={config} />
              <Toaster />
            </PersistQueryClientProvider>
          </AuthProvider>
        </DataProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
