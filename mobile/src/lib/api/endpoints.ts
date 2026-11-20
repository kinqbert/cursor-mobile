import { api } from './client';
import type {
  AgentV0,
  AgentV1,
  ApiKeyInfo,
  Artifact,
  ConversationMessage,
  CreateAgentRequest,
  CreateAgentResponse,
  ImageInput,
  ModelListItem,
  Repository,
  Run,
} from './types';

export const cursor = {
  me: (key?: string) => api<ApiKeyInfo>('/v1/me', { key }),

  models: () => api<{ items: ModelListItem[] }>('/v1/models').then((r) => r.items),

  /** Strictly rate limited (1/min, 30/hour) — callers must cache. */
  repositories: () => api<{ items: Repository[] }>('/v1/repositories').then((r) => r.items),

  // v0 list is used for the home screen because it includes repo, status, PR and
  // summary in one request (v1 list items only carry identity fields).
  listAgents: (cursorParam?: string, limit = 100) =>
    api<{ agents: AgentV0[]; nextCursor?: string }>('/v0/agents', {
      query: { limit, cursor: cursorParam },
    }),

  agentV0: (id: string) => api<AgentV0>(`/v0/agents/${id}`),
  agent: (id: string) => api<AgentV1>(`/v1/agents/${id}`),
  conversation: (id: string) =>
    api<{ id: string; messages: ConversationMessage[] }>(`/v0/agents/${id}/conversation`).then(
      (r) => r.messages,
    ),

  createAgent: (body: CreateAgentRequest) =>
    api<CreateAgentResponse>('/v1/agents', { method: 'POST', body }),

  runs: (id: string) => api<{ items: Run[]; nextCursor?: string }>(`/v1/agents/${id}/runs`, { query: { limit: 50 } }),
  run: (id: string, runId: string) => api<Run>(`/v1/agents/${id}/runs/${runId}`),

  followUp: (id: string, text: string, images?: ImageInput[]) =>
    api<{ run: Run }>(`/v1/agents/${id}/runs`, {
      method: 'POST',
      body: { prompt: { text, images } },
    }),

  steer: (id: string, text: string) =>
    api<{ delivery: 'steered' | 'queued'; runId?: string }>(`/v1/agents/${id}/runs`, {
      method: 'POST',
      body: { prompt: { text }, delivery: 'steer' },
    }),

  cancelRun: (id: string, runId: string) =>
    api<unknown>(`/v1/agents/${id}/runs/${runId}/cancel`, { method: 'POST' }),

  archive: (id: string) => api<{ id: string }>(`/v1/agents/${id}/archive`, { method: 'POST' }),
  unarchive: (id: string) => api<{ id: string }>(`/v1/agents/${id}/unarchive`, { method: 'POST' }),
  remove: (id: string) => api<{ id: string }>(`/v1/agents/${id}`, { method: 'DELETE' }),

  artifacts: (id: string) =>
    api<{ items: Artifact[] }>(`/v1/agents/${id}/artifacts`).then((r) => r.items),
  artifactUrl: (id: string, path: string) =>
    api<{ url: string; expiresAt: string }>(`/v1/agents/${id}/artifacts/download`, {
      query: { path },
    }),
};
