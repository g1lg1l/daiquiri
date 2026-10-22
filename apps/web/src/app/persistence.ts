import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { del, get, set } from 'idb-keyval';

/*
 * Persists the query cache in IndexedDB so a reload paints instantly from the
 * last known state while fresh data loads (performance.md). Cleared on sign-out.
 */
export const persister = createAsyncStoragePersister({
  key: 'daiq-query-cache',
  storage: {
    getItem: (key) => get<string>(key).then((value) => value ?? null),
    setItem: (key, value: string) => set(key, value),
    removeItem: (key) => del(key),
  },
  throttleTime: 1000,
});

export const persistOptions = {
  persister,
  maxAge: 24 * 60 * 60_000,
  buster: import.meta.env.VITE_BUILD_ID ?? 'dev',
};
