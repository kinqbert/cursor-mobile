import { type AgentV0, cursor, isWorking } from './cursor';
import type { Env } from './env';
import { sendPush } from './push';

/**
 * Sends the "Finished / Failed" notification for an agent's latest run.
 * Deduplicated per run id, so the stream watcher, the cron diff and webhooks can all
 * call this without double notifications.
 */
export async function notifyRunEnded(env: Env, agentId: string, statusHint?: string, fallbackName?: string) {
  const agent = await cursor.agent(env, agentId);
  const runId = agent.latestRunId ?? `no-run:${statusHint}`;
  const dedupeKey = `sent:${agentId}:${runId}`;
  if (await env.STATE.get(dedupeKey)) return false;

  const run = agent.latestRunId ? await cursor.run(env, agentId, agent.latestRunId).catch(() => null) : null;
  const status = run && !isWorking(run.status) ? run.status : (statusHint ?? run?.status ?? 'FINISHED');
  if (status === 'CANCELLED') {
    await env.STATE.put(dedupeKey, '1', { expirationTtl: 7 * 86400 });
    return false; // you stopped it yourself — no need to notify
  }

  const name = agent.name || fallbackName || 'Agent';
  const prUrl = run?.git?.branches.find((b) => b.prUrl)?.prUrl;
  const stats = prUrl ? await prStats(env, prUrl) : null;
  const firstLine = (run?.result ?? '').split('\n').find((l) => l.trim())?.replace(/[#*`>]/g, '').trim() ?? '';

  const headline = status === 'ERROR' ? 'Failed' : status === 'EXPIRED' ? 'Expired' : 'Finished';
  const parts = [headline];
  if (stats) parts.push(`+${stats.additions} −${stats.deletions} · ${stats.files} ${stats.files === 1 ? 'file' : 'files'}`);
  else if (prUrl) parts.push('PR ready');
  const body = [parts.join(' · '), firstLine].filter(Boolean).join('\n').slice(0, 240);

  await sendPush(env, {
    title: name,
    body,
    channelId: 'agents',
    categoryId: prUrl ? 'agentdonepr' : 'agentdone',
    data: { agentId, prUrl, status },
  });
  await env.STATE.put(dedupeKey, '1', { expirationTtl: 7 * 86400 });
  return true;
}

async function prStats(env: Env, prUrl: string) {
  if (!env.GITHUB_TOKEN) return null;
  const m = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!m) return null;
  const res = await fetch(`https://api.github.com/repos/${m[1]}/${m[2]}/pulls/${m[3]}`, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'cursor-mobile-push',
    },
  });
  if (!res.ok) return null;
  const pr = (await res.json()) as { additions: number; deletions: number; changed_files: number };
  return { additions: pr.additions, deletions: pr.deletions, files: pr.changed_files };
}

/**
 * Live-Activity-style summary: one silent notification ("3 Active") that is replaced in
 * place (Android `tag`) whenever the set of running agents changes.
 */
export async function updateActiveSummary(env: Env, agents: AgentV0[]) {
  const active = agents.filter((a) => isWorking(a.status));
  const signature = active.map((a) => a.id).sort().join(',');
  const prev = await env.STATE.get('active-signature');
  if (prev === signature || (prev === null && !signature)) return;
  await env.STATE.put('active-signature', signature);

  const now = Date.now();
  const lines = active
    .slice(0, 4)
    .map((a) => `${a.name} · ${minutes(now - new Date(a.createdAt).getTime())}`);
  if (active.length > 4) lines.push(`${active.length - 4} more`);

  await sendPush(env, {
    title: active.length ? `${active.length} Active` : 'No active agents',
    body: active.length ? lines.join('\n') : 'All agents have finished.',
    channelId: 'active',
    tag: 'active-agents',
    priority: 'normal',
    data: { kind: 'active' },
  });
}

function minutes(ms: number) {
  const m = Math.max(1, Math.round(ms / 60000));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
