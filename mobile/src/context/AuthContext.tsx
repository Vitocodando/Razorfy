import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import { api } from '../services/api';
import type { Session } from '../types';

const SESSION_KEY = 'razorfy.session';

const sessionStorage = {
  get: () =>
    Platform.OS === 'web'
      ? Promise.resolve(globalThis.localStorage?.getItem(SESSION_KEY) ?? null)
      : SecureStore.getItemAsync(SESSION_KEY),
  set: (value: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(globalThis.localStorage?.setItem(SESSION_KEY, value))
      : SecureStore.setItemAsync(SESSION_KEY, value),
  remove: () =>
    Platform.OS === 'web'
      ? Promise.resolve(globalThis.localStorage?.removeItem(SESSION_KEY))
      : SecureStore.deleteItemAsync(SESSION_KEY),
};

type AuthContextValue = {
  session: Session | null;
  restoring: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    phone: string,
    password: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    sessionStorage
      .get()
      .then((stored) => {
        if (!stored) return;
        const parsed = JSON.parse(stored) as Session;
        if (new Date(parsed.expiresAt).getTime() > Date.now()) {
          setSession(parsed);
        } else {
          return sessionStorage.remove();
        }
      })
      .catch(() => sessionStorage.remove())
      .finally(() => setRestoring(false));
  }, []);

  const persist = useCallback(async (nextSession: Session) => {
    await sessionStorage.set(JSON.stringify(nextSession));
    setSession(nextSession);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      await persist(await api.login(email.trim(), password));
    },
    [persist],
  );

  const register = useCallback(
    async (name: string, email: string, phone: string, password: string) => {
      await persist(
        await api.register(name.trim(), email.trim(), phone.trim(), password),
      );
    },
    [persist],
  );

  const logout = useCallback(async () => {
    await sessionStorage.remove();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, restoring, login, register, logout }),
    [session, restoring, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }
  return context;
}
