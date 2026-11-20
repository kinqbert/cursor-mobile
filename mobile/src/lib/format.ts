import type { AgentV0, RunStatus } from './api/types';

/** "https://github.com/acme/web" or "github.com/acme/web" → "web". */
export function repoName(url?: string): string {
  if (!url) return 'No repo';
  const clean = url.replace(/\.git$/, '').replace(/\/+$/, '');
  return clean.split('/').pop() || clean;
}

/** "https://github.com/acme/web" → "acme/web". */
export function repoSlug(url?: string): string {
  if (!url) return '';
  const m = url.replace(/\.git$/, '').match(/(?:github\.com|gitlab\.[^/]+)\/([^/]+\/[^/]+)/);
  return m ? m[1] : repoName(url);
}

export function relativeTime(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function duration(ms?: number): string {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export type AgentPhase = 'working' | 'finished' | 'error' | 'expired' | 'cancelled';

export function agentPhase(status: string): AgentPhase {
  switch (status) {
    case 'CREATING':
    case 'RUNNING':
    case 'WAITING_FOR_BACKGROUND_WORK':
      return 'working';
    case 'ERROR':
      return 'error';
    case 'EXPIRED':
      return 'expired';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'finished';
  }
}

export function isActiveRun(status?: RunStatus) {
  return !!status && agentPhase(status) === 'working';
}

export function statusLabel(agent: AgentV0): string {
  switch (agentPhase(agent.status)) {
    case 'working':
      return agent.status === 'CREATING' ? 'Starting' : 'Working';
    case 'error':
      return 'Failed';
    case 'expired':
      return 'Expired';
    case 'cancelled':
      return 'Stopped';
    default:
      if (agent.target?.prUrl) return 'PR open';
      return agent.target?.branchName ? 'Pushed' : 'No Changes';
  }
}

/** Identifies a specific result so a new result after a follow-up shows as unread again. */
export function resultFingerprint(agent: Pick<AgentV0, 'status' | 'summary'>) {
  return `${agent.status}:${(agent.summary ?? '').length}:${(agent.summary ?? '').slice(0, 40)}`;
}
