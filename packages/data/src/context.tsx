import { createContext, useContext, type ReactNode } from 'react';
import type { DaiqClient } from './client';

const ClientContext = createContext<DaiqClient | null>(null);

export function DataProvider({ client, children }: { client: DaiqClient; children: ReactNode }) {
  return <ClientContext.Provider value={client}>{children}</ClientContext.Provider>;
}

export function useDaiqClient(): DaiqClient {
  const client = useContext(ClientContext);
  if (!client) throw new Error('useDaiqClient must be used inside <DataProvider>');
  return client;
}
