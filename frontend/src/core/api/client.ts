import type { Barbershop, ConnectResult } from '../types'

// Base da API. Mantida idêntica ao App.tsx original.
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

type ApiError = { message?: string }

// Cliente HTTP central. Em 401 autenticado, encerra a sessão e emite `razorfy:unauthorized`.
export async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) {
    // Token expirado/inválido numa chamada autenticada: encerra a sessão e volta ao login.
    if (response.status === 401 && token) {
      localStorage.removeItem('razorfy.session')
      window.dispatchEvent(new Event('razorfy:unauthorized'))
    }
    const body = (await response.json().catch(() => ({}))) as ApiError
    throw new Error(body.message || 'Não foi possível concluir a solicitação.')
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

// FEAT-074: extrai código de conexão de texto cru ou deep-link (barberflow://connect/X, .../c/X).
export function parseConnectionCode(raw: string): string {
  const t = raw.trim()
  const m = t.match(/(?:\/c\/|\/connect\/)([A-Za-z0-9]+)/)
  return (m ? m[1] : t).trim().toUpperCase()
}

// Conecta pelo código: backend valida formato/existência/atividade.
export async function connectByCode(code: string): Promise<Barbershop> {
  const r = await request<ConnectResult>(`/tenants/connect/${encodeURIComponent(code)}`)
  return { id: r.tenantId, name: r.name, slug: r.slug, connectionCode: r.connectionCode, logoUrl: r.logoUrl }
}
