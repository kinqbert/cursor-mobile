import { cursor, isTerminal, isWorking, waitForTerminal } from './cursor';
import type { Env } from './env';
import { notifyRunEnded, updateActiveSummary } from './notify';
import { addToken, getTokens, removeTokens, sendPush } from './push';

const STATE_KEY = 'agent-status';
const WATCH_KEY = 'watching';
const WATCH_TTL_MS = 3 * 60 * 60_000; // give up on an explicitly watched agent after 3 h

type WatchEntry = { id: string; until: number };
const MAX_WATCHED = 8; // keeps us well under 50 subrequests per invocation on the free plan
const WATCH_MS = 55_000; // next cron fires at +60s, so coverage is near-continuous

export default {
  /**
   * Every minute:
   * 1. List agents and diff against last tick → notify agents that stopped working
   *    (fallback path, ≤60 s latency, also catches anything the streams missed).
   * 2. Update the "N Active" summary notification when the set changes.
   * 3. Check agents the app explicitly asked us to watch (launched / followed up from the
   *    phone) by their latest run, so even sub-minute runs are never missed.
   * 4. Hold each running agent's SSE stream for ~55 s → notify the instant it ends.
   */
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const started = Date.now();
    const agents = await cursor.listAgents(env);
    const prev = (await env.STATE.get<Record<string, string>>(STATE_KEY, 'json')) ?? {};
    const next: Record<string, string> = {};
    for (const a of agents) next[a.id] = a.status;

    for (const a of agents) {
      if (prev[a.id] && isWorking(prev[a.id]) && !isWorking(a.status)) {
        ctx.waitUntil(notifyRunEnded(env, a.id, a.status, a.name).catch(logError));
      }
    }

    // KV free tier allows 1,000 writes/day, so only write when something changed.
    if (JSON.stringify(prev) !== JSON.stringify(next)) await env.STATE.put(STATE_KEY, JSON.stringify(next));
    await updateActiveSummary(env, agents).catch(logError);

    const running = new Map(agents.filter((a) => isWorking(a.status)).map((a) => [a.id, a.name]));
    await checkWatched(env, running).catch(logError);

    const deadline = started + WATCH_MS;
    await Promise.all(
      [...running].slice(0, MAX_WATCHED).map(async ([id, name]) => {
        const status = await waitForTerminal(env, id, deadline);
        if (status) await notifyRunEnded(env, id, status, name).catch(logError);
      }),
    );
  },

  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/webhook' && req.method === 'POST') return handleWebhook(req, env);

    if (!authorized(req, env)) return json({ error: 'unauthorized' }, 401);

    switch (`${req.method} ${url.pathname}`) {
      case 'GET /health': {
        const tokens = await getTokens(env);
        return json({ ok: true, devices: tokens.length });
      }
      case 'POST /register': {
        const { token } = (await req.json()) as { token?: string };
        if (!token?.startsWith('ExponentPushToken[')) return json({ error: 'invalid token' }, 400);
        await addToken(env, token);
        return json({ ok: true });
      }
      case 'POST /unregister': {
        const { token } = (await req.json()) as { token?: string };
        if (token) await removeTokens(env, [token]);
        return json({ ok: true });
      }
      case 'POST /watch': {
        // Sent by the app right after launching an agent or sending a follow-up.
        const { agentId } = (await req.json()) as { agentId?: string };
        if (!agentId) return json({ error: 'agentId required' }, 400);
        const list = (await env.STATE.get<WatchEntry[]>(WATCH_KEY, 'json')) ?? [];
        const next = [...list.filter((w) => w.id !== agentId && w.until > Date.now()), { id: agentId, until: Date.now() + WATCH_TTL_MS }];
        await env.STATE.put(WATCH_KEY, JSON.stringify(next));
        // Hold the stream right away (waitUntil allows ~30 s); the cron takes over after.
        ctx.waitUntil(
          waitForTerminal(env, agentId, Date.now() + 28_000)
            .then((status) => (status ? notifyRunEnded(env, agentId, status) : false))
            .catch(logError),
        );
        return json({ ok: true });
      }
      case 'POST /test': {
        const result = await sendPush(env, {
          title: 'Cursor Mobile',
          body: 'Notifications are working ✓',
          channelId: 'agents',
          data: { kind: 'test' },
        });
        return json(result);
      }
      default:
        return json({ error: 'not found' }, 404);
    }
  },
} satisfies ExportedHandler<Env>;

/**
 * For agents the app asked us to watch: look at the latest run directly. Finished runs are
 * notified (deduped per run) and dropped; running ones are added to the stream-watch set.
 */
async function checkWatched(env: Env, running: Map<string, string | undefined>) {
  const list = (await env.STATE.get<WatchEntry[]>(WATCH_KEY, 'json')) ?? [];
  if (!list.length) return list;
  const keep: WatchEntry[] = [];
  for (const w of list.slice(0, 10)) {
    if (w.until < Date.now()) continue;
    try {
      const agent = await cursor.agent(env, w.id);
      const run = agent.latestRunId ? await cursor.run(env, w.id, agent.latestRunId) : null;
      if (run && isTerminal(run.status)) {
        await notifyRunEnded(env, w.id, run.status, agent.name);
      } else {
        keep.push(w);
        if (!running.has(w.id)) running.set(w.id, agent.name);
      }
    } catch (e) {
      logError(e);
      keep.push(w);
    }
  }
  keep.push(...list.slice(10));
  if (keep.length !== list.length) await env.STATE.put(WATCH_KEY, JSON.stringify(keep));
  return keep;
}

/** Optional: Cursor v0 webhooks (`webhook: { url, secret }` on agent creation). */
async function handleWebhook(req: Request, env: Env) {
  if (!env.WEBHOOK_SECRET) return json({ error: 'webhooks not configured' }, 404);
  const raw = await req.text();
  const signature = req.headers.get('X-Webhook-Signature') ?? '';
  if (!(await verifyHmac(env.WEBHOOK_SECRET, raw, signature))) return json({ error: 'bad signature' }, 401);
  const payload = JSON.parse(raw) as { id: string; status: string };
  if (isTerminal(payload.status)) await notifyRunEnded(env, payload.id, payload.status);
  return json({ ok: true });
}

async function verifyHmac(secret: string, body: string, signature: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expected = 'sha256=' + [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(expected, signature);
}

function authorized(req: Request, env: Env) {
  const header = req.headers.get('Authorization') ?? '';
  return !!env.APP_SECRET && timingSafeEqual(header, `Bearer ${env.APP_SECRET}`);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function logError(e: unknown) {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
}
