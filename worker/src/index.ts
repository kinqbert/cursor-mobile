import { cursor, isTerminal, isWorking, waitForTerminal } from './cursor';
import type { Env } from './env';
import { notifyRunEnded, updateActiveSummary } from './notify';
import { addToken, getTokens, removeTokens, sendPush } from './push';

const STATE_KEY = 'agent-status';
const MAX_WATCHED = 8; // keeps us well under 50 subrequests per invocation on the free plan
const WATCH_MS = 55_000; // next cron fires at +60s, so coverage is near-continuous

export default {
  /**
   * Every minute:
   * 1. List agents and diff against last tick → notify agents that stopped working
   *    (fallback path, ≤60 s latency, also catches anything the streams missed).
   * 2. Update the "N Active" summary notification when the set changes.
   * 3. Hold each running agent's SSE stream for ~55 s → notify the instant it ends.
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

    const running = agents.filter((a) => isWorking(a.status)).slice(0, MAX_WATCHED);
    const deadline = started + WATCH_MS;
    await Promise.all(
      running.map(async (a) => {
        const status = await waitForTerminal(env, a.id, deadline);
        if (status) await notifyRunEnded(env, a.id, status, a.name).catch(logError);
      }),
    );
  },

  async fetch(req: Request, env: Env): Promise<Response> {
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
