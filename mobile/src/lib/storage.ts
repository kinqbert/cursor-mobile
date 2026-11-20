import * as SecureStore from 'expo-secure-store';
import KV from 'expo-sqlite/kv-store';

// Secrets live in the Android Keystore-backed SecureStore.
const SECRET_KEYS = {
  cursorApiKey: 'cursor_api_key',
  githubToken: 'github_token',
  workerUrl: 'worker_url',
  workerSecret: 'worker_secret',
} as const;

export type SecretName = keyof typeof SECRET_KEYS;

export const secrets = {
  get: (name: SecretName) => SecureStore.getItemAsync(SECRET_KEYS[name]),
  set: (name: SecretName, value: string) => SecureStore.setItemAsync(SECRET_KEYS[name], value),
  remove: (name: SecretName) => SecureStore.deleteItemAsync(SECRET_KEYS[name]),
};

// Non-secret local state (pins, read markers, caches) in a synchronous SQLite KV store.
export const kv = {
  getJSON<T>(key: string, fallback: T): T {
    try {
      const raw = KV.getItemSync(key);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  setJSON(key: string, value: unknown) {
    KV.setItemSync(key, JSON.stringify(value));
  },
  remove(key: string) {
    KV.removeItemSync(key);
  },
};
