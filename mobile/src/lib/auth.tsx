import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { setApiKey, setUnauthorizedHandler } from './api/client';
import { persister, queryClient } from './query';
import { cursor } from './api/endpoints';
import type { ApiKeyInfo } from './api/types';
import { kv, secrets } from './storage';

type AuthState = {
  ready: boolean;
  signedIn: boolean;
  account: ApiKeyInfo | null;
  signIn: (key: string) => Promise<ApiKeyInfo>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);
const ACCOUNT_KEY = 'account';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [account, setAccount] = useState<ApiKeyInfo | null>(() => kv.getJSON(ACCOUNT_KEY, null));

  useEffect(() => {
    secrets.get('cursorApiKey').then((key) => {
      setApiKey(key);
      setSignedIn(!!key);
      setReady(true);
    });
  }, []);

  const signOut = useCallback(async () => {
    await secrets.remove('cursorApiKey');
    kv.remove(ACCOUNT_KEY);
    setApiKey(null);
    queryClient.clear();
    persister.removeClient();
    setAccount(null);
    setSignedIn(false);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const signIn = useCallback(async (raw: string) => {
    const key = raw.trim();
    const info = await cursor.me(key); // throws on an invalid key
    await secrets.set('cursorApiKey', key);
    kv.setJSON(ACCOUNT_KEY, info);
    setApiKey(key);
    setAccount(info);
    setSignedIn(true);
    return info;
  }, []);

  const value = useMemo(
    () => ({ ready, signedIn, account, signIn, signOut }),
    [ready, signedIn, account, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
