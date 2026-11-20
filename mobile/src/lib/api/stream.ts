import { fetch } from 'expo/fetch';

import { API_BASE, ApiError, authHeader } from './client';
import type { StreamEvent } from './types';

type Handlers = {
  onEvent: (event: StreamEvent) => void;
  onError?: (err: unknown) => void;
  /** Called when the server ends the stream for good (done / archived). */
  onClose?: () => void;
};

/**
 * Subscribes to `GET /v1/agents/{id}/stream` (SSE) and keeps it alive:
 * reconnects with Last-Event-ID after drops (Cursor closes streams on deploys).
 * Returns an unsubscribe function.
 */
export function streamAgent(agentId: string, handlers: Handlers): () => void {
  const controller = new AbortController();
  let lastEventId: string | undefined;
  let stopped = false;
  let attempt = 0;

  const run = async () => {
    while (!stopped) {
      try {
        const res = await fetch(`${API_BASE}/v1/agents/${agentId}/stream`, {
          headers: {
            ...authHeader(),
            Accept: 'text/event-stream',
            ...(lastEventId ? { 'Last-Event-ID': lastEventId } : {}),
          },
          signal: controller.signal,
        });

        if (res.status === 410) {
          // Resume point expired — restart from the newest run.
          lastEventId = undefined;
          continue;
        }
        if (res.status === 409) {
          // Agent archived.
          handlers.onClose?.();
          return;
        }
        if (!res.ok || !res.body) {
          throw new ApiError(res.status, undefined, `Stream failed (${res.status})`);
        }

        attempt = 0;
        let finished = false;
        await readSse(res.body, (evt) => {
          if (evt.id) lastEventId = evt.id;
          const parsed = toStreamEvent(evt.event, evt.data);
          if (!parsed) return;
          handlers.onEvent(parsed);
          if (parsed.type === 'done') finished = true;
        });
        if (finished) {
          handlers.onClose?.();
          return;
        }
      } catch (err) {
        if (stopped) return;
        handlers.onError?.(err);
      }
      // Back off: 0.5s, 1s, 2s … capped at 15s.
      attempt += 1;
      await sleep(Math.min(15000, 500 * 2 ** (attempt - 1)));
    }
  };

  run();
  return () => {
    stopped = true;
    controller.abort();
  };
}

type RawEvent = { event: string; data: string; id?: string };

async function readSse(body: ReadableStream<Uint8Array>, onEvent: (e: RawEvent) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = 'message';
  let data: string[] = [];
  let id: string | undefined;

  const flush = () => {
    if (data.length) onEvent({ event, data: data.join('\n'), id });
    event = 'message';
    data = [];
    id = undefined;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      let line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line === '') {
        flush();
      } else if (line.startsWith(':')) {
        // comment / keepalive
      } else {
        const colon = line.indexOf(':');
        const field = colon >= 0 ? line.slice(0, colon) : line;
        const val = colon >= 0 ? line.slice(colon + 1).replace(/^ /, '') : '';
        if (field === 'event') event = val;
        else if (field === 'data') data.push(val);
        else if (field === 'id') id = val;
      }
    }
  }
  flush();
}

function toStreamEvent(type: string, raw: string): StreamEvent | null {
  let data: unknown = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    return null;
  }
  switch (type) {
    case 'status':
    case 'assistant':
    case 'thinking':
    case 'tool_call':
    case 'result':
    case 'error':
    case 'done':
    case 'heartbeat':
      return { type, data } as StreamEvent;
    default:
      return null; // interaction_update and future event types are ignored
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
