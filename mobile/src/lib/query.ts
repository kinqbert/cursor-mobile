import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { focusManager, QueryClient } from '@tanstack/react-query';
import KV from 'expo-sqlite/kv-store';
import { AppState } from 'react-native';

import { ApiError } from './api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Keep data around for the on-disk cache, so screens render instantly on next open.
      gcTime: 7 * 24 * 60 * 60_000,
      retry: (count, err) => {
        if (err instanceof ApiError && [400, 401, 403, 404, 409].includes(err.status)) return false;
        return count < 2;
      },
    },
  },
});

/**
 * Persists the query cache to SQLite: the agent list and conversations show immediately on
 * launch / when opened again, and refresh in the background.
 */
export const persister = createSyncStoragePersister({
  storage: {
    getItem: (k) => KV.getItemSync(k),
    setItem: (k, v) => KV.setItemSync(k, v),
    removeItem: (k) => KV.removeItemSync(k),
  },
  key: 'query-cache-v1',
  throttleTime: 2_000,
});

const EPHEMERAL = new Set(['artifact-url', 'worker-config']);
export const persistOptions = {
  persister,
  maxAge: 7 * 24 * 60 * 60_000,
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (q: { queryKey: readonly unknown[]; state: { status: string } }) =>
      q.state.status === 'success' && !EPHEMERAL.has(String(q.queryKey[0])),
  },
};

// Refetch when the app comes back to the foreground.
AppState.addEventListener('change', (state) => {
  focusManager.setFocused(state === 'active');
});

export const qk = {
  agents: ['agents'] as const,
  agent: (id: string) => ['agent', id] as const,
  agentV0: (id: string) => ['agent-v0', id] as const,
  conversation: (id: string) => ['conversation', id] as const,
  runs: (id: string) => ['runs', id] as const,
  artifacts: (id: string) => ['artifacts', id] as const,
  models: ['models'] as const,
  repos: ['repos'] as const,
};
