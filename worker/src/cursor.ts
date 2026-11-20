import type { Env } from './env';

const API = 'https://api.cursor.com';

export type AgentV0 = {
  id: string;
  name: string;
  status: string;
  source?: { repository?: string };
  target?: { prUrl?: string; url?: string };
  summary?: string;
  createdAt: string;
};

export type AgentV1 = { id: string; name?: string; latestRunId?: string; url: string };

export type Run = {
  id: string;
  status: string;
  durationMs?: number;
  result?: string;
  git?: { branches: { repoUrl: string; branch?: string; prUrl?: string }[] };
};

async function call<T>(env: Env, path: string): Promise<T> {
  const res = await fetch(API + path, {
    headers: { Authorization: `Bearer ${env.CURSOR_API_KEY}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Cursor ${path} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const cursor = {
  listAgents: (env: Env) => call<{ agents: AgentV0[] }>(env, '/v0/agents?limit=50').then((r) => r.agents),
  agent: (env: Env, id: string) => call<AgentV1>(env, `/v1/agents/${id}`),
  run: (env: Env, id: string, runId: string) => call<Run>(env, `/v1/agents/${id}/runs/${runId}`),
};

const WORKING = new Set(['CREATING', 'RUNNING', 'WAITING_FOR_BACKGROUND_WORK']);
export const isWorking = (status: string) => WORKING.has(status);
export const isTerminal = (status: string) =>
  ['FINISHED', 'ERROR', 'EXPIRED', 'CANCELLED'].includes(status);

/**
 * Holds the agent's SSE stream open until its run reaches a terminal status or the
 * deadline passes. Only scans for `status` events so CPU stays tiny (free plan: 10 ms).
 * Returns the terminal status, or null on timeout.
 */
export async function waitForTerminal(env: Env, agentId: string, deadline: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(0, deadline - Date.now()));
  try {
    const res = await fetch(`${API}/v1/agents/${agentId}/stream`, {
      headers: { Authorization: `Bearer ${env.CURSOR_API_KEY}`, Accept: 'text/event-stream' },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let event = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) return null;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).replace(/\r$/, '');
        buffer = buffer.slice(nl + 1);
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line === '') event = '';
        else if (event === 'status' && line.startsWith('data:')) {
          const m = line.match(/"status"\s*:\s*"([A-Z_]+)"/);
          if (m && isTerminal(m[1])) {
            controller.abort();
            return m[1];
          }
        }
      }
      // Don't let a huge tool-call payload grow the buffer unbounded.
      if (buffer.length > 64_000) buffer = buffer.slice(-1_000);
    }
  } catch {
    return null; // aborted at deadline or network error
  } finally {
    clearTimeout(timer);
  }
}
