import { useSyncExternalStore } from 'react';

import { kv } from './storage';

/** Tiny persisted store backed by the SQLite KV, readable synchronously from React. */
function createPersisted<T>(key: string, initial: T) {
  let value = kv.getJSON<T>(key, initial);
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T | ((prev: T) => T)) {
      value = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
      kv.setJSON(key, value);
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

// Pinned agent ids.
const pins = createPersisted<string[]>('pins', []);
// agentId → fingerprint of the result the user last looked at (drives the blue "unread" dot).
const seen = createPersisted<Record<string, string>>('seen', {});
// Last used repo/branch/model in the composer.
export type ComposerPrefs = { repo?: string; branch?: string; modelId?: string; mode?: 'agent' | 'plan' };
const composerPrefs = createPersisted<ComposerPrefs>('composer-prefs', {});

// Set once on first launch: older activity never shows as "unread".
const baseline = createPersisted<string | null>('unread-baseline', null);
if (!baseline.get()) baseline.set(new Date().toISOString());
export const unreadBaseline = () => baseline.get() ?? '';

export function usePins() {
  const list = useSyncExternalStore(pins.subscribe, pins.get);
  return {
    pinned: list,
    isPinned: (id: string) => list.includes(id),
    toggle: (id: string) =>
      pins.set((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev])),
  };
}

export function useSeen() {
  const map = useSyncExternalStore(seen.subscribe, seen.get);
  return {
    seen: map,
    markSeen: (id: string, fingerprint: string) => {
      if (map[id] !== fingerprint) seen.set((prev) => ({ ...prev, [id]: fingerprint }));
    },
  };
}

export function useComposerPrefs() {
  const prefs = useSyncExternalStore(composerPrefs.subscribe, composerPrefs.get);
  return { prefs, update: (patch: ComposerPrefs) => composerPrefs.set((p) => ({ ...p, ...patch })) };
}
