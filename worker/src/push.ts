import type { Env } from './env';

export type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  categoryId?: string;
  tag?: string;
  priority?: 'default' | 'normal' | 'high';
  ttl?: number;
};

const TOKENS = 'tokens';

export async function getTokens(env: Env): Promise<string[]> {
  return (await env.STATE.get<string[]>(TOKENS, 'json')) ?? [];
}

export async function addToken(env: Env, token: string) {
  const tokens = await getTokens(env);
  if (!tokens.includes(token)) await env.STATE.put(TOKENS, JSON.stringify([...tokens, token]));
}

export async function removeTokens(env: Env, remove: string[]) {
  if (!remove.length) return;
  const tokens = await getTokens(env);
  await env.STATE.put(TOKENS, JSON.stringify(tokens.filter((t) => !remove.includes(t))));
}

/** Sends through the Expo Push Service (which forwards to FCM). */
export async function sendPush(env: Env, msg: PushMessage) {
  const tokens = await getTokens(env);
  if (!tokens.length) return { sent: 0 };
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(tokens.map((to) => ({ to, priority: 'high', ...msg }))),
  });
  const json = (await res.json()) as {
    data?: { status: 'ok' | 'error'; details?: { error?: string } }[];
    errors?: unknown;
  };
  // Drop tokens of uninstalled apps.
  const dead = (json.data ?? [])
    .map((r, i) => (r.details?.error === 'DeviceNotRegistered' ? tokens[i] : null))
    .filter((t): t is string => !!t);
  await removeTokens(env, dead);
  if (!res.ok || json.errors) console.error('Expo push error', JSON.stringify(json));
  return { sent: tokens.length - dead.length, response: json };
}
