import { fetch } from 'expo/fetch';
import { useSyncExternalStore } from 'react';

import { secrets } from './storage';

// GitHub token is optional: it powers the PR screen, diff stats and merging.
let token: string | null = null;
const listeners = new Set<() => void>();
secrets.get('githubToken').then((t) => {
  token = t;
  listeners.forEach((l) => l());
});

export async function setGithubToken(next: string | null) {
  if (next) await secrets.set('githubToken', next);
  else await secrets.remove('githubToken');
  token = next;
  listeners.forEach((l) => l());
}

export const hasGithubToken = () => !!token;

export function useHasGithub() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => !!token,
  );
}

export class GithubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function gh<T>(path: string, init: { method?: string; body?: unknown; key?: string } = {}): Promise<T> {
  const auth = init.key ?? token;
  if (!auth) throw new GithubError(401, 'GitHub token not configured');
  const res = await fetch(`https://api.github.com${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${auth}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new GithubError(res.status, json?.message ?? `GitHub error ${res.status}`);
  return json as T;
}

export type PrRef = { owner: string; repo: string; number: number };

export function parsePrUrl(url?: string): PrRef | null {
  const m = url?.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  return m ? { owner: m[1], repo: m[2], number: Number(m[3]) } : null;
}

export type GhUser = { login: string; avatar_url: string };

export type PullRequest = {
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  draft: boolean;
  merged: boolean;
  mergeable: boolean | null;
  mergeable_state: string; // clean | blocked | behind | dirty | unstable | draft | unknown
  additions: number;
  deletions: number;
  changed_files: number;
  commits: number;
  head: { sha: string; ref: string };
  base: { ref: string };
  user: GhUser;
  requested_reviewers: GhUser[];
  created_at: string;
};

export type CheckRun = {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | 'stale' | null;
  html_url: string;
};

export type PrFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
};

export type Review = { user: GhUser; state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING' };

export type Deployment = { id: number; environment: string; created_at: string; url: string };
export type DeploymentStatus = { state: string; environment_url?: string; target_url?: string; created_at: string };

const repoPath = (r: PrRef) => `/repos/${r.owner}/${r.repo}`;

export const github = {
  me: (key?: string) => gh<GhUser>('/user', { key }),
  pr: (r: PrRef) => gh<PullRequest>(`${repoPath(r)}/pulls/${r.number}`),
  files: (r: PrRef) => gh<PrFile[]>(`${repoPath(r)}/pulls/${r.number}/files?per_page=100`),
  reviews: (r: PrRef) => gh<Review[]>(`${repoPath(r)}/pulls/${r.number}/reviews?per_page=100`),
  checks: async (r: PrRef, sha: string) => {
    // Check runs (GitHub Actions etc.) plus legacy commit statuses (Vercel, CircleCI…).
    const [runs, status] = await Promise.all([
      gh<{ check_runs: CheckRun[] }>(`${repoPath(r)}/commits/${sha}/check-runs?per_page=100`),
      gh<{ statuses: { id: number; context: string; state: string; target_url: string }[] }>(
        `${repoPath(r)}/commits/${sha}/status`,
      ),
    ]);
    const fromStatuses: CheckRun[] = status.statuses.map((s) => ({
      id: s.id,
      name: s.context,
      status: s.state === 'pending' ? 'in_progress' : 'completed',
      conclusion: s.state === 'success' ? 'success' : s.state === 'pending' ? null : 'failure',
      html_url: s.target_url,
    }));
    return [...runs.check_runs, ...fromStatuses];
  },
  deployments: async (r: PrRef, sha: string) => {
    const deps = await gh<Deployment[]>(`${repoPath(r)}/deployments?sha=${sha}&per_page=10`);
    return Promise.all(
      deps.map(async (d) => {
        const statuses = await gh<DeploymentStatus[]>(`${repoPath(r)}/deployments/${d.id}/statuses?per_page=1`);
        return { ...d, latest: statuses[0] as DeploymentStatus | undefined };
      }),
    );
  },
  merge: (r: PrRef, sha: string, method: 'squash' | 'merge' | 'rebase' = 'squash') =>
    gh<{ merged: boolean; message: string }>(`${repoPath(r)}/pulls/${r.number}/merge`, {
      method: 'PUT',
      body: { merge_method: method, sha },
    }),
};

export type CheckSummary = { total: number; passed: number; failed: number; running: number };

export function summarizeChecks(runs: CheckRun[]): CheckSummary {
  // Keep the newest run per name (re-runs create duplicates).
  const byName = new Map<string, CheckRun>();
  for (const r of runs) if (!byName.has(r.name) || r.id > byName.get(r.name)!.id) byName.set(r.name, r);
  let passed = 0;
  let failed = 0;
  let running = 0;
  for (const r of byName.values()) {
    if (r.status !== 'completed') running++;
    else if (['success', 'neutral', 'skipped'].includes(r.conclusion ?? '')) passed++;
    else failed++;
  }
  return { total: byName.size, passed, failed, running };
}
