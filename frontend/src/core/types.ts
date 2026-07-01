// Tipos de domínio compartilhados entre core e módulos (extraídos do App.tsx monolítico).
export type User = { id: string; name: string; email: string; phone: string | null; role: string; tenantId?: string }
export type Session = { accessToken: string; user: User }
export type Barbershop = { id: string; name: string; slug: string; connectionCode?: string; logoUrl?: string | null }
export type ConnectResult = { tenantId: string; name: string; slug: string; connectionCode: string; logoUrl: string | null }

// Catálogo / agendamento
export type ServiceItem = { id: string; name: string; durationMinutes: number; price: number; iconId?: string | null }
export type ServiceIconItem = { id: string; name: string; type: 'GLOBAL' | 'CUSTOM'; svgContent: string }
export type Barber = { id: string; name: string }
export type Appointment = {
  appointmentId: string
  status: string
  startTimestamp: string
  endTimestamp: string
  barberId?: string
  barberName: string
  clientId?: string
  clientName?: string
  clientPhone?: string | null
  amountToPay: number
  totalPrice: number
  cashbackUsed: number
  couponCode?: string | null
  couponDiscount?: number
  services: { name: string; durationMinutes: number; price: number }[]
}

// Carteira / cashback
export type Transaction = {
  id: string
  type: string
  amount: number
  description: string
  createdAt: string
  balanceAfter: number
}
export type Wallet = {
  balance: number
  reservedBalance: number
  availableBalance: number
  transactions: Transaction[]
}

// Administração
export type CouponItem = {
  id: string
  code: string
  discountType: 'PERCENTAGE' | 'FIXED_VALUE'
  discountValue: number
  maxUsesGlobal: number | null
  currentUses: number
  expiresAt: string
}
export type VacationBlock = {
  id: string
  barberId: string
  startDate: string
  endDate: string
  barber?: Barber
}
