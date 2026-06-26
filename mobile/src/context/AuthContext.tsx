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
import type { Barbershop, Session } from '../types';

const SESSION_KEY = 'razorfy.session';
const TENANT_KEY = 'razorfy.tenant';

function makeStore(key: string) {
  return {
    get: () =>
      Platform.OS === 'web'
        ? Promise.resolve(globalThis.localStorage?.getItem(key) ?? null)
        : SecureStore.getItemAsync(key),
    set: (value: string) =>
      Platform.OS === 'web'
        ? Promise.resolve(globalThis.localStorage?.setItem(key, value))
        : SecureStore.setItemAsync(key, value),
    remove: () =>
      Platform.OS === 'web'
        ? Promise.resolve(globalThis.localStorage?.removeItem(key))
        : SecureStore.deleteItemAsync(key),
  };
}

const sessionStorage = makeStore(SESSION_KEY);
const tenantStorage = makeStore(TENANT_KEY);

type AuthContextValue = {
  session: Session | null;
  tenant: Barbershop | null;
  restoring: boolean;
  selectTenant: (tenant: Barbershop) => Promise<void>;
  clearTenant: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ require2fa: boolean; preAuthToken?: string }>;
  verify2fa: (preAuthToken: string, code: string) => Promise<void>;
  otpSend: (phone: string) => Promise<void>;
  otpVerify: (phone: string, code: string, name?: string) => Promise<void>;
  register: (
    name: string,
    phone: string,
    email: string | undefined,
    password: string,
    code: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [tenant, setTenant] = useState<Barbershop | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    Promise.all([sessionStorage.get(), tenantStorage.get()])
      .then(([storedSession, storedTenant]) => {
        if (storedTenant) {
          try { setTenant(JSON.parse(storedTenant) as Barbershop); } catch { /* ignora */ }
        }
        if (!storedSession) return;
        const parsed = JSON.parse(storedSession) as Session;
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

  const selectTenant = useCallback(async (next: Barbershop) => {
    await tenantStorage.set(JSON.stringify(next));
    setTenant(next);
  }, []);

  const clearTenant = useCallback(async () => {
    await tenantStorage.remove();
    setTenant(null);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await api.login(email.trim(), password, tenant?.slug);
      // FA01: 2FA exigido → não persiste; devolve token intermediário para a tela de código.
      if ('status' in r && r.status === 'REQUIRE_2FA') {
        return { require2fa: true, preAuthToken: r.preAuthToken };
      }
      await persist(r as Session);
      return { require2fa: false };
    },
    [persist, tenant],
  );

  const verify2fa = useCallback(
    async (preAuthToken: string, code: string) => {
      await persist(await api.verify2fa(preAuthToken, code));
    },
    [persist],
  );

  // FEAT-077: OTP por telefone (escopado ao tenant conectado).
  const otpSend = useCallback(
    async (phone: string) => {
      if (!tenant) throw new Error('Conecte-se a uma barbearia primeiro.');
      await api.otpSend(tenant.id, phone);
    },
    [tenant],
  );

  const otpVerify = useCallback(
    async (phone: string, code: string, name?: string) => {
      if (!tenant) throw new Error('Conecte-se a uma barbearia primeiro.');
      await persist(await api.otpVerify(tenant.id, phone, code, name));
    },
    [persist, tenant],
  );

  const register = useCallback(
    async (name: string, phone: string, email: string | undefined, password: string, code: string) => {
      await persist(
        await api.register(name.trim(), phone.trim(), email?.trim() || undefined, password, code, tenant?.slug),
      );
    },
    [persist, tenant],
  );

  const logout = useCallback(async () => {
    await sessionStorage.remove();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, tenant, restoring, selectTenant, clearTenant, login, verify2fa, otpSend, otpVerify, register, logout }),
    [session, tenant, restoring, selectTenant, clearTenant, login, verify2fa, otpSend, otpVerify, register, logout],
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
