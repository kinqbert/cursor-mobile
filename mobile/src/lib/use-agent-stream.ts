import { useEffect, useEffectEvent, useState } from 'react';

import { streamAgent } from './api/stream';
import type { RunStatus, StreamEvent, ToolCallEvent } from './api/types';

export type LiveItem =
  | { kind: 'text'; text: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'tool'; call: ToolCallEvent };

export type LiveState = {
  items: LiveItem[];
  status: RunStatus | null;
  error: string | null;
};

const EMPTY: LiveState = { items: [], status: null, error: null };

/**
 * Live view of the agent's current run via SSE. Active only while `enabled`.
 * Without Last-Event-ID the server replays the newest run from its start, so the
 * live items always describe the whole current turn.
 * `onRunEnd` fires when a run reaches a terminal status.
 */
export function useAgentStream(agentId: string, enabled: boolean, onRunEnd: () => void) {
  const [state, setState] = useState<LiveState>(EMPTY);
  const runEnded = useEffectEvent(onRunEnd);

  useEffect(() => {
    if (!enabled) return;
    let reset = true;
    const unsubscribe = streamAgent(agentId, {
      onEvent: (e) => {
        if (e.type === 'heartbeat') return;
        setState((prev) => {
          // A leading status event starts each (re)connection: the replay that follows
          // contains the whole run, so drop what we had accumulated.
          const base = reset && e.type === 'status' ? { ...EMPTY } : prev;
          if (e.type === 'status') reset = false;
          return reduce(base, e);
        });
        if (e.type === 'status' && isTerminal(e.data.status)) runEnded();
      },
      onError: (err) =>
        setState((s) => ({ ...s, error: err instanceof Error ? err.message : 'Stream error' })),
    });
    return () => {
      unsubscribe();
      setState(EMPTY);
    };
  }, [agentId, enabled]);

  return state;
}

function reduce(s: LiveState, e: StreamEvent): LiveState {
  switch (e.type) {
    case 'status':
      return { ...s, status: e.data.status, error: null };
    case 'assistant':
    case 'thinking': {
      const kind = e.type === 'assistant' ? 'text' : 'thinking';
      const items = [...s.items];
      const last = items[items.length - 1];
      if (last && last.kind === kind) items[items.length - 1] = { kind, text: last.text + e.data.text };
      else items.push({ kind, text: e.data.text });
      return { ...s, items };
    }
    case 'tool_call': {
      const idx = s.items.findIndex((it) => it.kind === 'tool' && it.call.callId === e.data.callId);
      const items = [...s.items];
      if (idx >= 0) {
        const prev = items[idx] as Extract<LiveItem, { kind: 'tool' }>;
        items[idx] = { kind: 'tool', call: { ...prev.call, ...e.data } };
      } else items.push({ kind: 'tool', call: e.data });
      return { ...s, items };
    }
    case 'error':
      return { ...s, error: e.data.message };
    default:
      return s;
  }
}

export function isTerminal(status?: RunStatus | null) {
  return status === 'FINISHED' || status === 'ERROR' || status === 'CANCELLED' || status === 'EXPIRED';
}
