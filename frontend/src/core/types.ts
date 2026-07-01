// Tipos de domínio compartilhados entre core e módulos (extraídos do App.tsx monolítico).
export type User = { id: string; name: string; email: string; phone: string | null; role: string; tenantId?: string }
export type Session = { accessToken: string; user: User }
export type Barbershop = { id: string; name: string; slug: string; connectionCode?: string; logoUrl?: string | null }
export type ConnectResult = { tenantId: string; name: string; slug: string; connectionCode: string; logoUrl: string | null }
