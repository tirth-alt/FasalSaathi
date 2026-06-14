import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { loadSession, saveSession, clearSession } from './session';
import type { Session } from './session';
import * as api from '../api';
import type { ProfilePayload } from '../api';
import { ApiError } from '../api/client';
import type { SafeFarmer } from '../api/types';

type Status = 'loading' | 'unauthed' | 'onboarding' | 'ready';

type AuthState = {
  status: Status;
  farmer: SafeFarmer | null;
  token: string | null;
  signup: (input: { phone: string; password: string; full_name?: string }) => Promise<void>;
  login: (input: { phone: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  completeProfile: (payload: ProfilePayload) => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function statusFor(farmer: SafeFarmer | null): Status {
  if (!farmer) return 'unauthed';
  return farmer.onboarding_complete ? 'ready' : 'onboarding';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [farmer, setFarmer] = useState<SafeFarmer | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Boot: restore the saved session and fetch the farmer profile.
  useEffect(() => {
    (async () => {
      const session = await loadSession();
      if (!session?.access_token) {
        setStatus('unauthed');
        return;
      }
      try {
        const { farmer } = await api.getMe(session.access_token);
        setToken(session.access_token);
        setFarmer(farmer);
        setStatus(statusFor(farmer));
      } catch {
        // Token expired/invalid — drop it and show login.
        await clearSession();
        setStatus('unauthed');
      }
    })();
  }, []);

  const applySession = async (session: Session, f: SafeFarmer) => {
    await saveSession(session);
    setToken(session.access_token);
    setFarmer(f);
    setStatus(statusFor(f));
  };

  const signup: AuthState['signup'] = async (input) => {
    const res = await api.signup(input);
    await applySession(res.session, res.user);
  };

  const login: AuthState['login'] = async (input) => {
    const res = await api.login(input);
    await applySession(res.session, res.user);
  };

  const logout: AuthState['logout'] = async () => {
    await clearSession();
    setToken(null);
    setFarmer(null);
    setStatus('unauthed');
  };

  const completeProfile: AuthState['completeProfile'] = async (payload) => {
    if (!token) throw new ApiError(401, 'unauthorized', 'Not logged in');
    const updated = await api.saveProfile(token, payload);
    setFarmer(updated);
    setStatus(statusFor(updated));
  };

  const refresh: AuthState['refresh'] = async () => {
    if (!token) return;
    const { farmer } = await api.getMe(token);
    setFarmer(farmer);
    setStatus(statusFor(farmer));
  };

  const value = useMemo<AuthState>(
    () => ({ status, farmer, token, signup, login, logout, completeProfile, refresh }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, farmer, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
