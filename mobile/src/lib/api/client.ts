import { fetch } from 'expo/fetch';

export const API_BASE = 'https://api.cursor.com';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let currentKey: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setApiKey(key: string | null) {
  currentKey = key;
}

export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export function authHeader(key = currentKey): Record<string, string> {
  if (!key) throw new ApiError(401, 'no_key', 'No Cursor API key configured');
  return { Authorization: `Bearer ${key}` };
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  key?: string; // override, used when validating a freshly pasted key
};

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    method: opts.method ?? 'GET',
    headers: {
      ...authHeader(opts.key ?? currentKey),
      Accept: 'application/json',
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  const json = text ? safeJson(text) : undefined;

  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string }; message?: string }) ?? {};
    const message = err.error?.message ?? err.message ?? `Request failed (${res.status})`;
    if (res.status === 401 && !opts.key) onUnauthorized?.();
    throw new ApiError(res.status, err.error?.code, message);
  }
  return json as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
