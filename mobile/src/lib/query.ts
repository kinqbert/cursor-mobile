import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

import { ApiError } from './api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, err) => {
        if (err instanceof ApiError && [400, 401, 403, 404, 409].includes(err.status)) return false;
        return count < 2;
      },
    },
  },
});

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
