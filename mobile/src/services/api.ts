import { Platform } from 'react-native';
import type {
  Appointment,
  Barber,
  Barbershop,
  ConnectResult,
  LoginResponse,
  ServiceItem,
  Session,
  TwoFaSetup,
  Wallet,
} from '../types';

const defaultApiUrl = Platform.select({
  android: 'http://10.0.2.2:8080/api/v1',
  default: 'http://localhost:8080/api/v1',
});

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl;

type ApiErrorBody = {
  code?: string;
  message?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      'Não foi possível acessar a API. Confira o endereço configurado e a conexão de rede.',
      0,
      'NETWORK_ERROR',
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new ApiError(
      body.message ?? 'Não foi possível concluir a solicitação.',
      response.status,
      body.code,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Discovery de barbearias (multi-tenant)
  barbershops: (q?: string) =>
    request<Barbershop[]>(`/barbershops${q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`),

  barbershop: (slug: string) => request<Barbershop>(`/barbershops/${encodeURIComponent(slug)}`),

  // FEAT-074: conexão por código (QR/manual). Backend trim+uppercase + valida formato/existência/atividade.
  connect: async (code: string): Promise<Barbershop> => {
    const r = await request<ConnectResult>(`/tenants/connect/${encodeURIComponent(code)}`);
    return { id: r.tenantId, name: r.name, slug: r.slug, connectionCode: r.connectionCode, logoUrl: r.logoUrl };
  },

  // FEAT-078: identifier = e-mail ou telefone.
  login: (identifier: string, password: string, tenantSlug?: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, tenantSlug }),
    }),

  // FEAT-076: troca preAuthToken + código TOTP pelo JWT final.
  verify2fa: (preAuthToken: string, code: string) =>
    request<Session>('/auth/login/verify-2fa', { method: 'POST', body: JSON.stringify({ code }) }, preAuthToken),

  // FEAT-077: autenticação por telefone (OTP).
  otpSend: (tenantId: string, phone: string) =>
    request<{ message: string; expiresInSeconds: number; action: string }>(
      `/tenants/${tenantId}/auth/otp/send`,
      { method: 'POST', body: JSON.stringify({ phone }) },
    ),
  otpVerify: (tenantId: string, phone: string, code: string, name?: string) =>
    request<Session & { isNewUser: boolean }>(
      `/tenants/${tenantId}/auth/otp/verify`,
      { method: 'POST', body: JSON.stringify({ phone, code, name }) },
    ),

  setup2fa: (token: string) => request<TwoFaSetup>('/users/me/2fa/setup', { method: 'POST' }, token),
  enable2fa: (token: string, code: string) =>
    request<void>('/users/me/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) }, token),
  disable2fa: (token: string, currentPassword: string, code: string) =>
    request<void>('/users/me/2fa', { method: 'DELETE', body: JSON.stringify({ currentPassword, code }) }, token),
  me: (token: string) => request<{ is2faEnabled: boolean; hasPassword: boolean }>('/users/me', {}, token),

  register: (name: string, identifier: string, password: string, tenantSlug?: string) =>
    request<Session>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, identifier, password, tenantSlug }),
    }),

  // Catálogo contextualizado por tenant (legado sem tenantId → tenant default).
  services: (tenantId?: string) =>
    request<ServiceItem[]>(tenantId ? `/tenants/${tenantId}/services` : '/services'),

  barbers: (tenantId?: string) =>
    request<Barber[]>(tenantId ? `/tenants/${tenantId}/barbers` : '/barbers'),

  availability: (barberId: string, date: string, duration: number, tenantId?: string) =>
    request<{ availableStarts: string[] }>(
      tenantId
        ? `/tenants/${tenantId}/barbers/${barberId}/availability?date=${date}&duration=${duration}`
        : `/barbers/${barberId}/availability?date=${date}&duration=${duration}`,
    ),

  wallet: (token: string) => request<Wallet>('/wallet', {}, token),

  appointments: (token: string) =>
    request<Appointment[]>('/appointments/mine', {}, token),

  createAppointment: (
    token: string,
    body: {
      barberId: string;
      serviceIds: string[];
      startTimestamp: string;
      useCashback: boolean;
      cashbackAmountToApply: number;
      paymentMethod: 'ONLINE_PIX' | 'PRESENTIAL';
    },
  ) =>
    request<Appointment>(
      '/appointments',
      { method: 'POST', body: JSON.stringify(body) },
      token,
    ),

  cancelAppointment: (token: string, appointmentId: string) =>
    request<Appointment>(
      `/appointments/${appointmentId}/cancel`,
      { method: 'POST' },
      token,
    ),

  confirmMockPayment: (appointmentId: string) =>
    request<{ appointmentId: string; status: string }>(
      '/payments/webhooks/mock',
      {
        method: 'POST',
        body: JSON.stringify({
          appointmentId,
          paymentReference: `PIX-MOBILE-${Date.now()}`,
        }),
      },
    ),

  createReview: (
    token: string,
    body: { appointmentId: string; rating: number; comment?: string },
  ) =>
    request<{ id: string; rating: number; comment: string | null; createdAt: string }>(
      '/reviews',
      { method: 'POST', body: JSON.stringify(body) },
      token,
    ),

  barberRating: (barberId: string) =>
    request<{ average: number; count: number }>(`/barbers/${barberId}/rating`),
};
