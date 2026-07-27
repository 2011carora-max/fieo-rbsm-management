import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppSettings, User } from '@/types';
import { getSettings, saveSettings } from '@/data/repository';
import { supabase, supabaseConfigError } from '@/lib/supabaseClient';

interface AuthContextValue {
  user: User | null;
  settings: AppSettings | null;
  loading: boolean;
  /** Set only if initialization itself failed or exceeded the timeout — lets the UI show a retry screen instead of hanging. */
  initError: string | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  updateSettings: (s: AppSettings) => Promise<void>;
  retryInit: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INIT_TIMEOUT_MS = 10_000;

async function loadProfile(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) {
      // RLS failure, network error, etc. Log it, but never throw — a missing
      // profile should route to Login, not crash the app.
      console.error('loadProfile: query failed', error);
      return null;
    }
    if (!data) return null; // profile row genuinely doesn't exist
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      password: '',
      role: data.role,
      regionalOffice: data.regional_office ?? undefined,
      active: data.active,
      createdAt: data.created_at,
    };
  } catch (err) {
    console.error('loadProfile: unexpected error', err);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  // Prevents onAuthStateChange from racing the initial load, and prevents a
  // second concurrent profile fetch for the same user id.
  const initialLoadDone = useRef(false);
  const inFlightProfileFetch = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    initialLoadDone.current = false;

    async function applyAuthUser(authUser: { id: string } | null | undefined) {
      if (!authUser) {
        if (mounted) setUser(null);
        return;
      }
      if (inFlightProfileFetch.current === authUser.id) return; // already loading this same user
      inFlightProfileFetch.current = authUser.id;
      const profile = await loadProfile(authUser.id);
      inFlightProfileFetch.current = null;
      if (!mounted) return;
      // Missing or deactivated profile -> treated as logged out, sends the
      // user back to Login rather than hanging.
      setUser(profile && profile.active ? profile : null);
    }

    async function initialize() {
      try {
        if (supabaseConfigError) throw new Error(supabaseConfigError);
        const { data, error } = await supabase.auth.getSession();
        if (error) console.error('AuthProvider: getSession failed', error);
        const authUser = data?.session?.user ?? null;

        await applyAuthUser(authUser);

        if (authUser) {
          try {
            setSettings(await getSettings());
          } catch (err) {
            // Settings are secondary to auth — never let a settings failure
            // block the app from finishing initialization.
            console.error('AuthProvider: getSettings failed during init', err);
          }
        }
      } catch (err) {
        console.error('AuthProvider: initialization failed', err);
        if (mounted) setInitError(err instanceof Error ? err.message : 'Failed to initialize session.');
      } finally {
        initialLoadDone.current = true;
        window.clearTimeout(timeoutId);
        if (mounted) setLoading(false);
      }
    }

    const timeoutId = window.setTimeout(() => {
      if (!mounted) return;
      console.error('AuthProvider: initialization exceeded timeout');
      setInitError('This is taking longer than expected. Your connection or Supabase project may be unreachable.');
      setLoading(false);
    }, INIT_TIMEOUT_MS);

    void initialize();

    // Keeps the profile/settings in sync with sign-in, sign-out, and token
    // refresh events. Guarded so it doesn't do redundant work while the
    // very first load is still in flight (avoids a race where both paths
    // fetch the same profile at once).
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!initialLoadDone.current && event !== 'SIGNED_OUT') return;
      try {
        await applyAuthUser(session?.user ?? null);
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            setSettings(await getSettings());
          } catch (err) {
            console.error('AuthProvider: getSettings failed after sign-in', err);
          }
        }
        if (event === 'SIGNED_OUT') setSettings(null);
      } catch (err) {
        console.error('AuthProvider: onAuthStateChange handler failed', err);
      }
    });

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryToken]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (err) {
      console.error('login: unexpected error', err);
      return { ok: false, error: err instanceof Error ? err.message : 'Login failed. Please try again.' };
    }
  }, []);

  const logout = useCallback(() => {
    supabase.auth.signOut().catch((err) => console.error('logout: signOut failed', err));
    setUser(null);
    setSettings(null);
  }, []);

  const updateSettings = useCallback(async (s: AppSettings) => {
    const saved = await saveSettings(s); // errors intentionally propagate to the caller (e.g. SettingsPage) to show a toast
    setSettings(saved);
  }, []);

  const retryInit = useCallback(() => {
    setInitError(null);
    setLoading(true);
    setRetryToken((t) => t + 1);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, settings, loading, initError, login, logout, updateSettings, retryInit }),
    [user, settings, loading, initError, login, logout, updateSettings, retryInit]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
