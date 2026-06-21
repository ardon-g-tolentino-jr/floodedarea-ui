import React from 'react';
import { api, JWT_STORAGE_KEY } from '../api/client';
import type { UserRole } from '../types';

const SESSION_KEY = 'baha_auth_v1';

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
  logout: () => void;
}

export function useAuth(): UseAuthResult {
  const [auth, setAuth] = React.useState<AuthState | null>(loadSession);

  const save = React.useCallback((resp: AuthResponse, fallback?: { name?: string; picture?: string }): void => {
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
  }, []);

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

  return { auth, loginWithGoogle, logout };
}
