import { Platform } from 'react-native';
import type {
  Appointment,
  Barber,
  ServiceItem,
  Session,
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
  login: (email: string, password: string) =>
    request<Session>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (name: string, email: string, phone: string, password: string) =>
    request<Session>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, phone, password }),
    }),

  services: () => request<ServiceItem[]>('/services'),

  barbers: () => request<Barber[]>('/barbers'),

  availability: (barberId: string, date: string, duration: number) =>
    request<{ availableStarts: string[] }>(
      `/barbers/${barberId}/availability?date=${date}&duration=${duration}`,
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
};
