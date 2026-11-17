'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from './api';
import type { MeResponse } from './types';

type Status = 'loading' | 'signed-out' | 'needs-profile' | 'ready';

interface AuthValue {
  status: Status;
  me: MeResponse | null;
  refresh: () => Promise<void>;
  /** Stores a token from the sign-in callback (or the dev sign-in) and reloads who we are. */
  acceptToken: (token: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ status: Status; me: MeResponse | null }>({ status: 'loading', me: null });

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setState({ status: 'signed-out', me: null });
      return;
    }
    try {
      const me = await api<MeResponse>('/me');
      setState({ status: me.profile ? 'ready' : 'needs-profile', me });
    } catch {
      // An expired or invalid token is the same as being signed out.
      setToken(null);
      setState({ status: 'signed-out', me: null });
    }
  }, []);

  useEffect(() => {
    // Loading who we are is a one-time sync with browser storage and the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthValue>(
    () => ({
      ...state,
      refresh,
      acceptToken: async (token) => {
        setToken(token);
        await refresh();
        // Heal a missed payment webhook once per sign-in; failures are not the player's problem.
        void api('/billing/sync', { method: 'POST', body: {} }).catch(() => undefined);
      },
      signOut: () => {
        setToken(null);
        setState({ status: 'signed-out', me: null });
      },
    }),
    [state, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}

/** Supabase magic-link sign-in over its REST API (no SDK). Configured only when both public variables are set. */
export const supabaseConfig = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
})();

export async function sendMagicLink(email: string): Promise<void> {
  if (!supabaseConfig) throw new Error('Sign-in is not configured');
  const redirect = encodeURIComponent(`${window.location.origin}/auth/callback`);
  const res = await fetch(`${supabaseConfig.url}/auth/v1/otp?redirect_to=${redirect}`, {
    method: 'POST',
    headers: { apikey: supabaseConfig.anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, create_user: true }),
  });
  if (!res.ok) throw new Error('Could not send the sign-in link');
}
