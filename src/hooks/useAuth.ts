import React from 'react';
import { api, JWT_STORAGE_KEY } from '../api/client';
import type { UserRole } from '../types';

const SESSION_KEY = 'baha_auth_v1';
// Persisted in localStorage (not sessionStorage) so a guest keeps the same identity across tabs
// and reloads — this is what lets the "one active report per person" spam guard apply to guests.
const GUEST_DEVICE_KEY = 'baha_guest_id_v1';

/** Stable per-device id for no-login guest sessions. Created once and reused. */
function getDeviceId(): string {
  try {
    let id = localStorage.getItem(GUEST_DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(GUEST_DEVICE_KEY, id);
    }
    return id;
  } catch {
    // Private mode / storage blocked: fall back to an ephemeral id (spam guard is best-effort).
    return crypto.randomUUID();
  }
}

export interface AuthState {
  userId: number;
  email: string;
  name: string;
  picture?: string;
  role: UserRole;
}

interface AuthResponse {
  token: string;
  userId: number;
  email: string;
  name: string;
  picture?: string | null;
  role: UserRole;
  isNew: boolean;
}

function loadSession(): AuthState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthState) : null;
  } catch {
    return null;
  }
}

/** Decode a Google ID-token JWT payload without an extra dependency. */
export function decodeGoogleJwt(token: string): { email?: string; name?: string; picture?: string } {
  try {
    const part = token.split('.')[1] ?? '';
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as { email?: string; name?: string; picture?: string };
  } catch {
    return {};
  }
}

export interface UseAuthResult {
  auth: AuthState | null;
  loginWithGoogle: (credential: string) => Promise<void>;
  /** Ensure there is *some* session for low-stakes writes (report/confirm): reuse the current one,
   *  else silently mint a no-login guest session. Returns null if provisioning fails. */
  ensureGuest: () => Promise<AuthState | null>;
  logout: () => void;
}

export function useAuth(): UseAuthResult {
  const [auth, setAuth] = React.useState<AuthState | null>(loadSession);

  const save = React.useCallback((resp: AuthResponse, fallback?: { name?: string; picture?: string }): AuthState => {
    sessionStorage.setItem(JWT_STORAGE_KEY, resp.token);
    const state: AuthState = {
      userId: resp.userId,
      email: resp.email,
      name: resp.name || fallback?.name || resp.email,
      picture: resp.picture ?? fallback?.picture,
      role: resp.role,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    setAuth(state);
    return state;
  }, []);

  const ensureGuest = React.useCallback(async (): Promise<AuthState | null> => {
    // The token lives in sessionStorage and is read there by the API client, so an existing session
    // (full or guest) is enough — no need to re-mint.
    const existing = loadSession();
    if (existing) return existing;
    try {
      const resp = await api.post<AuthResponse>('/auth/guest', { deviceId: getDeviceId() });
      return save(resp);
    } catch {
      return null;
    }
  }, [save]);

  const loginWithGoogle = React.useCallback(
    async (credential: string): Promise<void> => {
      const profile = decodeGoogleJwt(credential);
      const resp = await api.post<AuthResponse>('/auth/google', { idToken: credential });
      save(resp, { name: profile.name, picture: profile.picture });
    },
    [save]
  );

  const logout = React.useCallback((): void => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(JWT_STORAGE_KEY);
    setAuth(null);
  }, []);

  return { auth, loginWithGoogle, ensureGuest, logout };
}
