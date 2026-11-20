import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cursor } from './api/endpoints';
import type { AgentV0, Repository } from './api/types';
import { agentPhase } from './format';
import { qk } from './query';
import { kv } from './storage';

export function useAgents() {
  return useQuery({
    queryKey: qk.agents,
    queryFn: () => cursor.listAgents().then((r) => r.agents),
    // Poll faster while something is running.
    refetchInterval: (q) =>
      q.state.data?.some((a) => agentPhase(a.status) === 'working') ? 8_000 : 30_000,
  });
}

export function useAgentSummary(id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.agentV0(id),
    queryFn: () => cursor.agentV0(id),
    initialData: () => qc.getQueryData<AgentV0[]>(qk.agents)?.find((a) => a.id === id),
    refetchInterval: (q) => (q.state.data && agentPhase(q.state.data.status) === 'working' ? 5_000 : false),
  });
}

export function useModels() {
  return useQuery({ queryKey: qk.models, queryFn: cursor.models, staleTime: 60 * 60_000 });
}

const REPO_CACHE = 'repos-cache';
const REPO_TTL = 6 * 60 * 60_000;

/** /v1/repositories allows 1 call/min and 30/hour, so cache it on disk for hours. */
export function useRepositories() {
  return useQuery({
    queryKey: qk.repos,
    queryFn: async () => {
      const cached = kv.getJSON<{ at: number; items: Repository[] } | null>(REPO_CACHE, null);
      if (cached && Date.now() - cached.at < REPO_TTL) return cached.items;
      try {
        const items = await cursor.repositories();
        kv.setJSON(REPO_CACHE, { at: Date.now(), items });
        return items;
      } catch (e) {
        if (cached) return cached.items; // rate-limited: fall back to stale cache
        throw e;
      }
    },
    staleTime: REPO_TTL,
    retry: false,
  });
}

export function refreshRepositoriesCache() {
  kv.remove(REPO_CACHE);
}

export function useArchiveAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cursor.archive(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.agents });
      const prev = qc.getQueryData<AgentV0[]>(qk.agents);
      qc.setQueryData<AgentV0[]>(qk.agents, (list) => list?.filter((a) => a.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => ctx?.prev && qc.setQueryData(qk.agents, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.agents }),
  });
}
