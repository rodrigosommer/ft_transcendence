import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Locale } from '@wkb/shared';
import { api, onSessionExpired, RENEWAL_RACE_RETRIES, setAccessToken, wait } from '../api/client.js';
import { isLocale, setLocale } from '../i18n/index.js';

export interface SessionUser {
  id: number;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  createdAt: string;
  hasPassword: boolean;
  //Stays false until the first setup screen is completed or skipped.
  onboarded: boolean;
}

interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
}

type SessionProbe =
  // 'retry': another tab renewed the shared cookie at the same moment, so the session is fine and asking again shortly will show it
  | { authenticated: false; retry?: boolean }
  | ({ authenticated: true } & AuthResponse);

interface AuthContextValue {
  user: SessionUser | null;
  /* True when the session ended on its own instead of logging out. 
   The login screen reads it to say why the player is suddenly looking at it. */
  expired: boolean;
  //True until the initial silent refresh has settled
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string, locale: Locale) => Promise<void>;
  logout: () => Promise<void>;
  // Rereads the session after an OAuth redirect
  restore: () => Promise<boolean>;
  patchUser: (partial: Partial<SessionUser>) => void;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const renewalTimer = useRef<number | null>(null);
  /*Whether a session was ever established in this tab, it's what separates "your session ended" 
from "you were never signed in"; the first deserves an explanation on the login screen, 
the second is just the login screen.*/
  const hadSession = useRef(false);
  const adopt = useCallback((payload: AuthResponse) => {
    setAccessToken(payload.accessToken);
    setUser(payload.user);
    hadSession.current = true;
    // The account's language wins over whatever the browser was showing.
    if (isLocale(payload.user.locale)) 
      setLocale(payload.user.locale);
    //Renew one minute early, waiting for a 401 would work too, but it logs an error in the console
    if (renewalTimer.current !== null) 
      window.clearTimeout(renewalTimer.current);
    const aheadMs = Math.max(30, payload.expiresIn - 60) * 1000;
    renewalTimer.current = window.setTimeout(() => void restoreRef.current?.(), aheadMs);
  }, []);
  const restore = useCallback(async (): Promise<boolean> => {
    try {
      let probe = await api.get<SessionProbe>('/api/auth/session');
      for (let attempt = 0; !probe.authenticated && probe.retry && attempt < RENEWAL_RACE_RETRIES; attempt += 1)
      {
        await wait(250 * (attempt + 1));
        probe = await api.get<SessionProbe>('/api/auth/session');
      }
      if (!probe.authenticated)
      {
        setAccessToken(null);
        setUser(null);
        // This path is the renewal timer and it used to end a live session
        if (hadSession.current) 
          setExpired(true);
        hadSession.current = false;
        return false;
      }
      adopt(probe);
      return true;
    } catch {
      setAccessToken(null);
      setUser(null);
      return false;
    }
  }, [adopt]);
  // Kept in a ref so 'adopt' can schedule a renewal without depending on it
  const restoreRef = useRef<(() => Promise<boolean>) | null>(null);
  restoreRef.current = restore;
  // One silent probe on mount. A returning visitor still holds the cookie.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await restore();
      if (!cancelled) 
        setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [restore]);
  useEffect(
    () => () => {
      if (renewalTimer.current !== null) 
        window.clearTimeout(renewalTimer.current);
    },
    [],
  );
  useEffect(() => {
  /*The refresh cookie was rejected, so RequireAuth will redirect to login. 
  Before this would happen with no message, which was confusing mid-match*/
    onSessionExpired(() => {
      setUser(null);
      setExpired(true);
      hadSession.current = false;
    });
  }, []);
  const login = useCallback(
    async (email: string, password: string) => {
      adopt(await api.post<AuthResponse>('/api/auth/login', { email, password }));
      setExpired(false);
    },
    [adopt],
  );

  /* Creates the account and stops there; the server doesn't issue a token for a sign-up;
  the caller sends the new account to the sign-in screen. */
  const signup = useCallback(
    async (email: string, password: string, displayName: string, locale: Locale) => {
      await api.post('/api/auth/signup', { email, password, displayName, locale });
    },
    [],
  );
  const logout = useCallback(async () => {
    // Leaving on purpose is not an expiry
    setExpired(false);
    hadSession.current = false;
    try {
      await api.post('/api/auth/logout');
    } finally {
      if (renewalTimer.current !== null) 
        window.clearTimeout(renewalTimer.current);
      setAccessToken(null);
      setUser(null);
    }
  }, []);
  const patchUser = useCallback((partial: Partial<SessionUser>) => {
    setUser((current) => (current ? { ...current, ...partial } : current));
  }, []);
  const value = useMemo<AuthContextValue>(
    () => ({ user, expired, loading, login, signup, logout, restore, patchUser }),
    [user, expired, loading, login, signup, logout, restore, patchUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) 
    throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
