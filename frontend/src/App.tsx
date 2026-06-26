import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, InputHTMLAttributes, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

// ---------- Tipos ----------

type User = { id: string; name: string; email: string; phone: string | null; role: string; tenantId?: string }
type Session = { accessToken: string; user: User }
type Barbershop = { id: string; name: string; slug: string; connectionCode?: string; logoUrl?: string | null }
type ConnectResult = { tenantId: string; name: string; slug: string; connectionCode: string; logoUrl: string | null }

// Extrai código de conexão de texto cru ou deep-link (barberflow://connect/X, .../c/X).
function parseConnectionCode(raw: string): string {
  const t = raw.trim()
  const m = t.match(/(?:\/c\/|\/connect\/)([A-Za-z0-9]+)/)
  return (m ? m[1] : t).trim().toUpperCase()
}

// Conecta pelo código: backend valida formato/existência/atividade.
async function connectByCode(code: string): Promise<Barbershop> {
  const r = await request<ConnectResult>(`/tenants/connect/${encodeURIComponent(code)}`)
  return { id: r.tenantId, name: r.name, slug: r.slug, connectionCode: r.connectionCode, logoUrl: r.logoUrl }
}
type ServiceItem = { id: string; name: string; durationMinutes: number; price: number; iconId?: string | null }
type ServiceIconItem = { id: string; name: string; type: 'GLOBAL' | 'CUSTOM'; svgContent: string }
type Barber = { id: string; name: string }
type Appointment = {
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
type ExpressBlock = {
  blockId: string
  startTimestamp: string
  endTimestamp: string
  reason: string | null
}
type Review = { id: string; rating: number; comment: string | null; clientName?: string; createdAt: string }
type ReviewSummary = { average: number; count: number; reviews: Review[] }
type BarberGoal = {
  id: string
  periodStart: string
  periodEnd: string
  targetAppointments: number
  completed: number
  progressPct: number
}
type ClientNote = {
  id: string
  noteText: string
  authorId: string
  authorName: string
  createdAt: string
  updatedAt: string
}
type Transaction = {
  id: string
  type: string
  amount: number
  description: string
  createdAt: string
  balanceAfter: number
}
type Wallet = {
  balance: number
  reservedBalance: number
  availableBalance: number
  transactions: Transaction[]
}
type BarberSlotData = {
  dayOfWeek: number
  startTime: string
  endTime: string
  lunchStart: string | null
  lunchEnd: string | null
}
type CouponItem = {
  id: string
  code: string
  discountType: 'PERCENTAGE' | 'FIXED_VALUE'
  discountValue: number
  maxUsesGlobal: number | null
  currentUses: number
  expiresAt: string
}
type VacationBlock = {
  id: string
  barberId: string
  startDate: string
  endDate: string
  barber?: Barber
}
type AdminAlert = {
  id: string
  alertType: string
  status: 'PENDING' | 'RESOLVED'
  createdAt: string
  appointment: {
    appointmentId?: string
    id?: string
    client: { id: string; name: string; phone: string | null }
    barber: { id: string; name: string }
    services: { serviceName: string; name?: string }[]
    review?: { rating: number; comment: string | null }
  }
}
type AdminHeatmap = {
  barberId: string
  barberName: string
  workingMinutes: number
  busyMinutes: number
  idleMinutes: number
  occupancyPct: number
}
type DailyAdminReport = {
  reportDate: string
  grossRevenue: number
  netRevenue: number
  concludedAppointments: number
  noShowAppointments: number
  averageTicket: number
  estimatedLtv: number
  idleMinutes: number
  occupancyPct: number
  heatmap: AdminHeatmap[]
}
type AdminGrid = {
  date: string
  barbers: (Barber & { onVacation: boolean })[]
  appointments: Appointment[]
}
type AdminDashboard = {
  report: DailyAdminReport
  alerts: AdminAlert[]
  grid: AdminGrid
}
type ApiError = { message?: string }

// ---------- Constantes e utilitários ----------

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const CATEGORIES = ['Cabelo', 'Barba', 'Sobrancelha', 'Especiais'] as const
type Category = (typeof CATEGORIES)[number]

const WEEKDAYS = [
  { day: 1, label: 'Segunda-feira' },
  { day: 2, label: 'Terça-feira' },
  { day: 3, label: 'Quarta-feira' },
  { day: 4, label: 'Quinta-feira' },
  { day: 5, label: 'Sexta-feira' },
  { day: 6, label: 'Sábado' },
  { day: 7, label: 'Domingo' },
]

function categoryOf(service: ServiceItem): Category {
  const name = service.name.toLowerCase()
  if (name.includes('+') || name.includes('premium') || name.includes('combo')) return 'Especiais'
  if (name.includes('sobrancelha')) return 'Sobrancelha'
  if (name.includes('barba')) return 'Barba'
  return 'Cabelo'
}

const CATEGORY_META: Record<Category, { icon: string; description: string }> = {
  Cabelo: { icon: 'content_cut', description: 'Cortes e acabamentos' },
  Barba: { icon: 'face', description: 'Barba e bigode' },
  Sobrancelha: { icon: 'visibility', description: 'Design de sobrancelha' },
  Especiais: { icon: 'auto_awesome', description: 'Combos e premium' },
}

// Ícones vetoriais custom por categoria: diamante (Especiais/premium) e bigode (Barba).
// Demais categorias usam Material Symbols. width/height 1em + currentColor herdam a classe.
function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  if (category === 'Especiais') {
    return (
      <svg viewBox="0 -5.47 56.254 56.254" width="1em" height="1em" fill="currentColor" className={className} aria-hidden="true">
        <path d="M494.211,354.161l1.174-1.366H482.552L469.8,367.5h12.94Zm-8.4,13.336H510.05l-6.589-7.664-5.528-6.429-8.354,9.713Zm-15.856,2.329,24.1,25.356L482.53,369.826Zm40.824,0h-2.1l-8.829,0H485.083l12.774,28.1.082.178,12.17-26.8Zm-8.94,25.322,24.057-25.32H513.337Zm24.215-27.65L513.3,352.8H500.478l12.642,14.7Z" transform="translate(-469.802 -352.795)"/>
      </svg>
    )
  }
  if (category === 'Barba') {
    return (
      <svg viewBox="0 0 1280 763" width="1em" height="1em" fill="currentColor" preserveAspectRatio="xMidYMid meet" className={className} aria-hidden="true">
        <g transform="translate(0,763) scale(0.1,-0.1)">
          <path d="M247 7573 c-3 -16 -17 -82 -31 -148 -83 -392 -154 -909 -192 -1395 -22 -271 -25 -962 -6 -1185 60 -694 181 -1179 402 -1615 123 -240 265 -435 441 -605 118 -114 150 -138 499 -380 1295 -897 2200 -1425 3055 -1780 994 -413 1883 -551 2643 -409 352 65 1010 236 1522 394 1521 471 2684 1053 3266 1634 176 176 260 288 349 465 69 138 71 145 200 826 218 1153 322 1854 381 2565 22 261 25 825 6 985 -19 153 -55 326 -87 415 -27 74 -123 255 -131 247 -3 -2 -54 -152 -113 -333 -399 -1207 -703 -1924 -896 -2114 -109 -107 -263 -209 -485 -320 -376 -188 -878 -359 -1233 -420 -217 -37 -185 -47 -510 157 -672 420 -985 567 -1372 646 -157 31 -463 31 -611 -1 -313 -67 -624 -235 -775 -417 l-61 -74 -50 59 c-28 32 -93 98 -146 146 -79 72 -115 96 -206 140 -257 123 -480 169 -811 168 -223 -1 -329 -11 -550 -55 -556 -110 -1209 -383 -1807 -754 l-121 -76 -66 22 c-218 72 -574 270 -936 521 -315 218 -888 657 -937 719 -110 137 -314 867 -498 1778 -22 112 -43 208 -46 213 -3 4 -22 8 -43 8 -34 0 -39 -3 -44 -27z m6873 -3153 c672 -52 1270 -168 1856 -361 l152 -50 -13 -42 c-133 -439 -392 -796 -680 -937 -142 -69 -216 -85 -400 -84 l-160 0 -295 76 c-505 131 -731 168 -1008 168 -252 0 -410 -28 -727 -125 -311 -95 -540 -122 -792 -94 -444 49 -785 298 -992 723 -55 112 -121 281 -121 310 0 7 74 36 178 69 602 193 1284 314 1997 357 183 10 820 4 1005 -10z"/>
        </g>
      </svg>
    )
  }
  return <Icon name={CATEGORY_META[category].icon} className={className} />
}

// FEAT-082: renderiza SVG de ícone de serviço. O conteúdo já foi sanitizado no backend
// (anti-XSS), por isso o dangerouslySetInnerHTML é seguro e justificado aqui.
function SafeSvg({ svg, className }: { svg: string; className?: string }) {
  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  CONFIRMED: { label: 'Confirmado', color: 'bg-green-100 text-green-800' },
  PENDING_PAYMENT: { label: 'Aguardando pagamento', color: 'bg-yellow-100 text-yellow-800' },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
  EXPIRED_PAYMENT: { label: 'Pagamento expirado', color: 'bg-red-100 text-red-800' },
  CANCELLED_OVERBOOKING: { label: 'Cancelado (overbooking)', color: 'bg-red-100 text-red-800' },
  CONCLUDED: { label: 'Concluído', color: 'bg-blue-100 text-blue-800' },
  NO_SHOW: { label: 'No-show', color: 'bg-red-100 text-red-900' },
}

const TRANSACTION_META: Record<string, { label: string; icon: string; sign: string; color: string }> = {
  CREDIT: { label: 'Crédito', icon: 'add_circle', sign: '+', color: 'text-green-700' },
  DEBIT: { label: 'Débito', icon: 'remove_circle', sign: '-', color: 'text-red-700' },
  RESERVE: { label: 'Reservado', icon: 'lock', sign: '-', color: 'text-yellow-700' },
  RELEASE: { label: 'Liberado', icon: 'lock_open', sign: '+', color: 'text-yellow-700' },
  PENALTY_NO_SHOW: { label: 'Penalidade', icon: 'gpp_bad', sign: '-', color: 'text-red-800' },
}

function dateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}


function today() {
  return dateInputValue(new Date())
}

function tomorrow() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return dateInputValue(date)
}

function canCancelFrontend(startTimestamp: string): boolean {
  return new Date(startTimestamp).getTime() - Date.now() >= 2 * 60 * 60 * 1000
}

// Sugestão de cashback: paga serviços completos em ordem crescente de preço enquanto o saldo
// cobrir; para no primeiro que não couber. Cashback nunca abate parcialmente um serviço.
function suggestCashback(
  services: { id: string; name: string; price: number }[],
  available: number,
): { services: { id: string; name: string; price: number }[]; amount: number } {
  const sorted = [...services].sort((a, b) => a.price - b.price)
  const picked: typeof sorted = []
  let sum = 0
  for (const s of sorted) {
    if (sum + s.price <= available + 1e-6) {
      picked.push(s)
      sum += s.price
    } else {
      break
    }
  }
  return { services: picked, amount: Number(sum.toFixed(2)) }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
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

// ---------- Navegação do app ----------

const CLIENT_NAV_ITEMS = [
  { key: 'home' as const, label: 'Início', icon: 'home' },
  { key: 'appointments' as const, label: 'Meus Horários', icon: 'event' },
  { key: 'wallet' as const, label: 'Carteira', icon: 'account_balance_wallet' },
  { key: 'settings' as const, label: 'Conta', icon: 'settings' },
]

const BARBER_NAV_ITEMS = [
  { key: 'agenda' as const, label: 'Agenda', icon: 'calendar_today' },
  { key: 'schedule' as const, label: 'Expediente', icon: 'tune' },
  { key: 'settings' as const, label: 'Conta', icon: 'settings' },
]

const ADMIN_NAV_ITEMS = [
  { key: 'admin' as const, label: 'Comando', icon: 'dashboard' },
]

type NavKey = 'home' | 'appointments' | 'wallet' | 'agenda' | 'schedule' | 'admin' | 'settings'

type NavItem = { key: NavKey; label: string; icon: string }

function AppShell({
  active,
  navItems,
  onNavigate,
  onLogout,
  children,
}: {
  active: NavKey
  navItems: NavItem[]
  onNavigate: (key: NavKey) => void
  onLogout: () => void
  children: ReactNode
}) {
  return (
    <div className="bg-background text-on-background min-h-screen">
      {/* Menu lateral (desktop) */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-surface-container-lowest border-r border-on-surface/10 flex-col z-40">
        <div className="h-20 flex items-center gap-2 px-6 border-b border-on-surface/10">
          <img src="/razorfy.png" alt="Razorfy" className="h-10 object-contain" />
          <span className="text-[20px] font-bold italic uppercase tracking-tighter text-on-surface">Razorfy</span>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto" aria-label="Menu principal">
          {navItems.map((item) => {
            const isActive = active === item.key
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors ${
                  isActive ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <Icon name={item.icon} filled={isActive} className="text-[22px]" />
                <span className="text-[14px] font-semibold">{item.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="p-3 border-t border-on-surface/10">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors">
            <Icon name="logout" />
            <span className="text-[14px] font-semibold">Sair</span>
          </button>
        </div>
      </aside>

      <div className="lg:pl-64 flex flex-col min-h-screen">{children}</div>

      {/* Menu inferior (mobile) */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-on-surface/10 z-50 grid grid-flow-col auto-cols-fr pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
        aria-label="Menu principal"
      >
        {navItems.map((item) => {
          const isActive = active === item.key
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex flex-col items-center justify-center gap-1 h-16 group"
            >
              {isActive && <span className="absolute top-0 h-[3px] w-9 rounded-b-full bg-primary" />}
              <span
                className={`flex items-center justify-center h-8 w-14 rounded-full transition-colors ${
                  isActive ? 'bg-primary-fixed' : 'group-hover:bg-surface-container'
                }`}
              >
                <Icon name={item.icon} filled={isActive} className={`text-[22px] ${isActive ? 'text-primary' : 'text-on-surface-variant'}`} />
              </span>
              <span className={`text-[11px] font-semibold ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

// ---------- Componentes do design system ----------

function Icon({ name, filled = false, className = '' }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${filled ? 'filled' : ''} ${className}`}>
      {name}
    </span>
  )
}

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="bg-error-container text-on-error-container p-2 rounded-lg border border-error/20 flex items-start gap-2">
      <Icon name="error" filled className="shrink-0 text-[20px]" />
      <p className="text-[12px] font-medium pt-[2px]">{message}</p>
    </div>
  )
}

function SuccessBanner({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="bg-green-50 text-green-800 p-2 rounded-lg border border-green-200 flex items-start gap-2">
      <Icon name="check_circle" filled className="shrink-0 text-[20px]" />
      <p className="text-[12px] font-medium pt-[2px]">{message}</p>
    </div>
  )
}

function FloatingField(props: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, id, ...rest } = props
  return (
    <div className="relative w-full">
      <input
        id={id}
        placeholder=" "
        className="peer w-full h-14 px-4 pt-5 pb-1 bg-surface-container-lowest border border-on-surface/10 rounded-lg focus:outline-none focus:border-secondary focus:border-2 transition-all text-[16px] text-on-surface"
        {...rest}
      />
      <label
        htmlFor={id}
        className="absolute left-4 top-[18px] text-on-surface-variant text-[16px] transition-all duration-200 pointer-events-none origin-top-left peer-focus:-translate-y-3 peer-focus:scale-75 peer-focus:text-secondary peer-[:not(:placeholder-shown)]:-translate-y-3 peer-[:not(:placeholder-shown)]:scale-75"
      >
        {label}
      </label>
    </div>
  )
}

function PrimaryButton({ children, disabled, onClick, type = 'button', className = '' }: {
  children: ReactNode
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
  className?: string
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`w-full h-14 bg-primary text-on-primary text-[14px] font-semibold uppercase tracking-widest rounded-lg border-b-2 border-on-primary-fixed-variant hover:bg-primary-container active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed transition-all ${className}`}
    >
      {children}
    </button>
  )
}

function TopBar({ title, onBack, onLogout, right }: { title?: string; onBack?: () => void; onLogout?: () => void; right?: ReactNode }) {
  return (
    <header className="w-full bg-surface border-b border-on-surface/10 sticky top-0 z-40">
      <div className="max-w-[1200px] mx-auto flex justify-between items-center px-4 md:px-8 h-16">
        {onBack ? (
          <button aria-label="Voltar" onClick={onBack} className="flex items-center justify-center p-2 -ml-2 text-on-surface hover:bg-surface-container-high rounded-full transition-colors">
            <Icon name="arrow_back" />
          </button>
        ) : (
          <img src="/razorfy.png" alt="Razorfy" className="h-10 object-contain" />
        )}
        <div className="text-[20px] font-bold uppercase tracking-tight text-on-surface">{title ?? 'Razorfy'}</div>
        {onLogout ? (
          <button aria-label="Sair" onClick={onLogout} className="flex items-center justify-center p-2 -mr-2 text-primary hover:bg-surface-container-high rounded-full transition-colors">
            <Icon name="logout" />
          </button>
        ) : right ? (
          <div className="flex items-center justify-end -mr-1">{right}</div>
        ) : (
          <div className="w-10" />
        )}
      </div>
    </header>
  )
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className="rounded-full bg-secondary-fixed text-on-secondary-container flex items-center justify-center font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: 'bg-surface-container text-on-surface-variant' }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.color}`}>
      {meta.label}
    </span>
  )
}

// ---------- App ----------

function App() {
  const [session, setSession] = useState<Session | null>(() => {
    const saved = localStorage.getItem('razorfy.session')
    if (!saved) return null
    const parsed = JSON.parse(saved) as Session
    return parsed?.user ? parsed : null
  })
  const [screen, setScreen] = useState<'home' | 'calendar'>('home')
  const [nav, setNav] = useState<NavKey>(() => {
    const saved = localStorage.getItem('razorfy.session')
    if (!saved) return 'home'
    const parsed = JSON.parse(saved) as Session
    if (parsed?.user?.role === 'ADMIN') return 'admin'
    return parsed?.user?.role === 'BARBER' ? 'agenda' : 'home'
  })
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [tenant, setTenant] = useState<Barbershop | null>(() => {
    const saved = localStorage.getItem('razorfy.tenant')
    return saved ? (JSON.parse(saved) as Barbershop) : null
  })

  const selectTenant = (t: Barbershop) => { localStorage.setItem('razorfy.tenant', JSON.stringify(t)); setTenant(t) }
  const clearTenant = () => { localStorage.removeItem('razorfy.tenant'); setTenant(null) }

  const signIn = (nextSession: Session) => {
    localStorage.setItem('razorfy.session', JSON.stringify(nextSession))
    setSession(nextSession)
    setNav(nextSession.user.role === 'ADMIN' ? 'admin' : nextSession.user.role === 'BARBER' ? 'agenda' : 'home')
  }

  const signOut = () => {
    localStorage.removeItem('razorfy.session')
    setSession(null)
    setScreen('home')
    setNav('home')
    setSelectedServices([])
  }

  const updateSessionUser = (patch: Partial<User>) => {
    setSession((prev) => {
      if (!prev) return prev
      const next = { ...prev, user: { ...prev.user, ...patch } }
      localStorage.setItem('razorfy.session', JSON.stringify(next))
      return next
    })
  }

  // Sessão expirada (401 em chamada autenticada): volta ao login automaticamente.
  useEffect(() => {
    const onUnauthorized = () => signOut()
    window.addEventListener('razorfy:unauthorized', onUnauthorized)
    return () => window.removeEventListener('razorfy:unauthorized', onUnauthorized)
  }, [])

  // Deep-link da barbearia: /c/:code (FEAT-074, conexão por código) ou /app/:slug (legado).
  const [deepLink, setDeepLink] = useState<{ resolving: boolean }>(() => ({
    resolving: /^\/(c|app)\/[^/]+\/?$/.test(window.location.pathname),
  }))
  useEffect(() => {
    const path = window.location.pathname
    const byCode = path.match(/^\/c\/([^/]+)\/?$/)
    const bySlug = path.match(/^\/app\/([^/]+)\/?$/)
    if (!byCode && !bySlug) return
    const resolve = byCode
      ? connectByCode(parseConnectionCode(decodeURIComponent(byCode[1])))
      : request<Barbershop>(`/barbershops/${decodeURIComponent(bySlug![1])}`)
    resolve
      .then((shop) => selectTenant(shop))
      .catch(() => { /* código/slug inválido ou inativo → cai na tela de conexão */ })
      .finally(() => {
        window.history.replaceState({}, '', '/')
        setDeepLink({ resolving: false })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Callback do OAuth Google: troca o authorization code por sessão.
  const [oauth, setOauth] = useState<{ exchanging: boolean; error: string }>(() => {
    const params = new URLSearchParams(window.location.search)
    const isCallback = window.location.pathname.includes('/auth/google/callback')
    return { exchanging: isCallback && params.has('code'), error: '' }
  })
  const [googleWhatsapp, setGoogleWhatsapp] = useState<string | null>(null) // FEAT-083: preAuthToken

  useEffect(() => {
    if (!window.location.pathname.includes('/auth/google/callback')) return
    const params = new URLSearchParams(window.location.search)
    const savedState = sessionStorage.getItem('razorfy.oauth.state')
    sessionStorage.removeItem('razorfy.oauth.state')
    window.history.replaceState({}, '', '/')

    if (params.get('error')) {
      queueMicrotask(() => setOauth({ exchanging: false, error: 'Login com Google cancelado.' }))
      return
    }
    const code = params.get('code')
    if (!code) return
    if (!savedState || savedState !== params.get('state')) {
      queueMicrotask(() => setOauth({ exchanging: false, error: 'Sessão de login inválida. Tente novamente.' }))
      return
    }
    request<Session | { status: 'REQUIRE_WHATSAPP'; preAuthToken: string }>('/auth/google', { method: 'POST', body: JSON.stringify({ code, tenantSlug: tenant?.slug }) })
      .then((r) => {
        // FEAT-083: novo usuário Google → falta validar WhatsApp.
        if ('status' in r && r.status === 'REQUIRE_WHATSAPP') {
          setGoogleWhatsapp(r.preAuthToken)
          setOauth({ exchanging: false, error: '' })
          return
        }
        signIn(r as Session); setOauth({ exchanging: false, error: '' })
      })
      .catch((e) => setOauth({ exchanging: false, error: e instanceof Error ? e.message : 'Falha no login com Google.' }))
  }, [])

  if (oauth.exchanging) {
    return (
      <div className="bg-background min-h-screen flex flex-col items-center justify-center gap-4">
        <Icon name="progress_activity" className="text-[40px] text-primary animate-spin" />
        <p className="text-[16px] text-on-surface-variant">Entrando com Google...</p>
      </div>
    )
  }

  // FEAT-083: novo usuário Google precisa validar o WhatsApp antes de concluir o cadastro.
  if (googleWhatsapp && tenant) {
    return (
      <GoogleWhatsappScreen
        preAuthToken={googleWhatsapp}
        tenantId={tenant.id}
        onAuthenticated={(s) => { setGoogleWhatsapp(null); signIn(s) }}
        onCancel={() => setGoogleWhatsapp(null)}
      />
    )
  }

  if (deepLink.resolving) {
    return (
      <div className="bg-background min-h-screen flex flex-col items-center justify-center gap-4">
        <Icon name="progress_activity" className="text-[40px] text-primary animate-spin" />
        <p className="text-[16px] text-on-surface-variant">Abrindo a barbearia...</p>
      </div>
    )
  }

  // Backoffice mestre (FEAT-075): rota obscura /platform, sem discovery de tenant.
  const isPlatformRoute = window.location.pathname.startsWith('/platform')

  // DEV autenticado → console da plataforma, ignorando o gate de tenant.
  if (session && session.user.role === 'DEV') {
    return <PlatformConsole session={session} onSignOut={signOut} />
  }

  if (!session) {
    if (isPlatformRoute) return <DevLoginScreen onAuthenticated={signIn} />
    if (!tenant) return <TenantDiscovery onSelect={selectTenant} />
    return <AuthScreen onAuthenticated={signIn} initialError={oauth.error} tenant={tenant} onChangeTenant={clearTenant} />
  }

  const activeTenantId = session.user.tenantId ?? tenant?.id

  // Fluxo de agendamento (etapa 2) ocupa a tela toda, sem menu
  if (screen === 'calendar') {
    return (
      <CalendarPage
        session={session}
        tenantId={activeTenantId}
        selectedServiceIds={selectedServices}
        onBack={() => setScreen('home')}
        onBooked={() => setSelectedServices([])}
      />
    )
  }

  const navItems: NavItem[] = session.user.role === 'ADMIN'
    ? ADMIN_NAV_ITEMS
    : session.user.role === 'BARBER'
      ? BARBER_NAV_ITEMS
      : CLIENT_NAV_ITEMS

  const page =
    nav === 'admin' ? (
      <AdminCommandCenter session={session} />
    ) : nav === 'home' ? (
      <HomePage
        tenantId={activeTenantId}
        selectedServices={selectedServices}
        onToggleService={(id) =>
          setSelectedServices((current) =>
            current.includes(id) ? current.filter((s) => s !== id) : [...current, id],
          )
        }
        onSchedule={() => setScreen('calendar')}
        onLogout={signOut}
      />
    ) : nav === 'appointments' ? (
      <AppointmentsPage session={session} />
    ) : nav === 'wallet' ? (
      <WalletPage session={session} />
    ) : nav === 'agenda' ? (
      <BarberAgendaPage session={session} />
    ) : nav === 'schedule' ? (
      <BarberSchedulePage session={session} />
    ) : nav === 'settings' ? (
      <SettingsPage session={session} onSignOut={signOut} onDisconnect={() => { clearTenant(); signOut() }} onProfileChange={(u) => updateSessionUser(u)} />
    ) : null

  return (
    <AppShell active={nav} navItems={navItems} onNavigate={setNav} onLogout={signOut}>
      {page}
    </AppShell>
  )
}

// ---------- Backoffice mestre (DEV / plataforma) — FEAT-075 ----------

type PlatformAdminContact = { name: string; email: string; phone: string | null }
type PlatformTenant = {
  tenantId: string
  name: string
  connectionCode: string
  isActive: boolean
  createdAt: string
  adminContact: PlatformAdminContact | null
}
type PlatformList = { content: PlatformTenant[]; totalPages: number; totalElements: number }

// Login restrito do proprietário da plataforma (sem seleção de barbearia).
function DevLoginScreen({ onAuthenticated }: { onAuthenticated: (s: Session) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending2fa, setPending2fa] = useState<string | null>(null)

  function accept(s: Session) {
    if (s.user.role !== 'DEV') { setError('Esta área é exclusiva da plataforma.'); setBusy(false); return }
    onAuthenticated(s)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const r = await request<Session | { status: 'REQUIRE_2FA'; preAuthToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) })
      if ('status' in r && r.status === 'REQUIRE_2FA') { setPending2fa(r.preAuthToken); setBusy(false); return }
      accept(r as Session)
    } catch (c) {
      setError(c instanceof Error ? c.message : 'Falha no login.')
      setBusy(false)
    }
  }

  if (pending2fa) {
    return <TwoFactorLoginScreen preAuthToken={pending2fa} onAuthenticated={accept} onCancel={() => { setPending2fa(null); setBusy(false) }} />
  }

  return (
    <div className="min-h-screen bg-[#0b0b0f] flex flex-col items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-[360px] flex flex-col gap-3">
        <div className="text-center mb-2">
          <Icon name="shield_person" className="text-[40px] text-primary" />
          <h1 className="text-[20px] font-bold text-white mt-2">Backoffice Razorfy</h1>
          <p className="text-[12px] text-white/50">Acesso restrito ao proprietário da plataforma.</p>
        </div>
        {error && <ErrorBanner message={error} />}
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoFocus placeholder="E-mail da plataforma" className="h-12 px-4 rounded-xl bg-white/5 border border-white/15 text-white text-[14px] placeholder:text-white/30 focus:outline-none focus:border-primary" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Senha" className="h-12 px-4 rounded-xl bg-white/5 border border-white/15 text-white text-[14px] placeholder:text-white/30 focus:outline-none focus:border-primary" />
        <button disabled={busy || !email || !password} className="h-12 rounded-xl bg-primary text-on-primary font-bold text-[14px] disabled:opacity-50 flex items-center justify-center gap-2">
          {busy ? <Icon name="progress_activity" className="animate-spin text-[20px]" /> : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

function PlatformConsole({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const token = session.accessToken
  const [data, setData] = useState<PlatformList | null>(null)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const size = 20

  const load = (p = page) => {
    setLoading(true)
    request<PlatformList>(`/platform/tenants?page=${p}&size=${size}`, {}, token)
      .then(setData)
      .catch((c) => setError(c instanceof Error ? c.message : 'Falha ao carregar barbearias.'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load(page); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page])

  async function toggleStatus(t: PlatformTenant) {
    const next = !t.isActive
    if (next === false && !confirm(`Bloquear "${t.name}"? Todos os usuários desta barbearia perdem acesso imediatamente.`)) return
    setError(''); setSuccess('')
    try {
      await request(`/platform/tenants/${t.tenantId}/status`, { method: 'PATCH', body: JSON.stringify({ isActive: next }) }, token)
      setSuccess(next ? `${t.name} reativada.` : `${t.name} bloqueada.`)
      load()
    } catch (c) {
      setError(c instanceof Error ? c.message : 'Não foi possível alterar o status.')
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-white">
      <header className="flex items-center justify-between px-5 h-16 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Icon name="shield_person" className="text-primary text-[24px]" />
          <span className="font-bold text-[15px]">Backoffice Razorfy</span>
          <span className="text-[11px] text-white/40 ml-2">{data?.totalElements ?? 0} barbearias</span>
        </div>
        <button onClick={onSignOut} className="text-[13px] text-white/60 hover:text-white inline-flex items-center gap-1.5">
          <Icon name="logout" className="text-[18px]" />Sair
        </button>
      </header>

      <main className="max-w-[960px] mx-auto p-5 flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}
        {success && <div className="rounded-lg bg-primary/15 border border-primary/30 text-primary px-4 py-2 text-[13px]">{success}</div>}

        <div className="flex items-center justify-between">
          <h1 className="text-[18px] font-bold">Barbearias (Tenants)</h1>
          <button onClick={() => setShowForm((v) => !v)} className="h-10 px-4 rounded-lg bg-primary text-on-primary font-bold text-[13px] inline-flex items-center gap-2">
            <Icon name={showForm ? 'close' : 'add'} className="text-[18px]" />
            {showForm ? 'Cancelar' : 'Nova barbearia'}
          </button>
        </div>

        {showForm && (
          <PlatformCreateForm
            token={token}
            onCreated={(msg) => { setShowForm(false); setSuccess(msg); setPage(0); load(0) }}
          />
        )}

        {loading ? (
          <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />)}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {data?.content.map((t) => (
              <div key={t.tenantId} className="flex items-center gap-3 p-4 rounded-lg bg-white/5 border border-white/10">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.isActive ? 'bg-emerald-400' : 'bg-red-500'}`} title={t.isActive ? 'Ativa' : 'Bloqueada'} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[14px] truncate">{t.name}</p>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/70">{t.connectionCode}</span>
                  </div>
                  <p className="text-[11px] text-white/40 truncate">
                    {t.adminContact ? `${t.adminContact.name} · ${t.adminContact.email}` : 'sem admin'}
                  </p>
                </div>
                <button
                  onClick={() => toggleStatus(t)}
                  className={`h-9 px-3 rounded-lg text-[12px] font-semibold inline-flex items-center gap-1.5 ${t.isActive ? 'border border-red-500/40 text-red-400 hover:bg-red-500/10' : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400'}`}
                >
                  <Icon name={t.isActive ? 'block' : 'check_circle'} className="text-[16px]" />
                  {t.isActive ? 'Bloquear' : 'Reativar'}
                </button>
              </div>
            ))}
            {data && data.content.length === 0 && <p className="text-white/40 text-[13px] text-center py-8">Nenhuma barbearia cadastrada.</p>}
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="h-9 px-3 rounded-lg bg-white/5 text-[13px] disabled:opacity-30">Anterior</button>
            <span className="text-[12px] text-white/50">Página {page + 1} de {data.totalPages}</span>
            <button disabled={page + 1 >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="h-9 px-3 rounded-lg bg-white/5 text-[13px] disabled:opacity-30">Próxima</button>
          </div>
        )}
      </main>
    </div>
  )
}

function PlatformCreateForm({ token, onCreated }: { token: string; onCreated: (msg: string) => void }) {
  const [f, setF] = useState({ name: '', slug: '', connectionCode: '', adminName: '', email: '', phone: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const r = await request<{ message: string }>('/platform/tenants', {
        method: 'POST',
        body: JSON.stringify({
          tenant: { name: f.name.trim(), slug: f.slug.trim(), connectionCode: f.connectionCode.trim() },
          adminUser: { name: f.adminName.trim(), email: f.email.trim(), phone: f.phone.trim(), initialPassword: f.password },
        }),
      }, token)
      onCreated(r.message)
    } catch (c) {
      setError(c instanceof Error ? c.message : 'Não foi possível criar a barbearia.')
    } finally { setBusy(false) }
  }

  const input = 'h-11 px-3 rounded-lg bg-white/5 border border-white/15 text-white text-[13px] placeholder:text-white/30 focus:outline-none focus:border-primary'
  return (
    <form onSubmit={submit} className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3">
      {error && <ErrorBanner message={error} />}
      <p className="text-[12px] font-semibold text-white/60 uppercase tracking-wider">Estabelecimento</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input className={input} placeholder="Nome" value={f.name} onChange={(e) => set('name', e.target.value)} />
        <input className={input} placeholder="slug (ex: navalha-classica)" value={f.slug} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
        <input className={input} placeholder="CÓDIGO" maxLength={10} value={f.connectionCode} onChange={(e) => set('connectionCode', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
      </div>
      <p className="text-[12px] font-semibold text-white/60 uppercase tracking-wider mt-1">Dono (Admin)</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className={input} placeholder="Nome do dono" value={f.adminName} onChange={(e) => set('adminName', e.target.value)} />
        <input className={input} type="email" placeholder="E-mail" value={f.email} onChange={(e) => set('email', e.target.value)} />
        <input className={input} placeholder="Telefone (+55...)" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        <input className={input} type="password" placeholder="Senha inicial (mín. 8)" value={f.password} onChange={(e) => set('password', e.target.value)} />
      </div>
      <button disabled={busy} className="h-11 rounded-lg bg-primary text-on-primary font-bold text-[13px] disabled:opacity-50 inline-flex items-center justify-center gap-2 mt-1">
        {busy ? <Icon name="progress_activity" className="animate-spin text-[18px]" /> : <><Icon name="add_business" className="text-[18px]" />Criar barbearia + admin</>}
      </button>
    </form>
  )
}

// ---------- Autenticação ----------

async function startGoogleLogin(onError: (message: string) => void) {
  try {
    const state = crypto.randomUUID()
    sessionStorage.setItem('razorfy.oauth.state', state)
    const { url } = await request<{ url: string }>(`/auth/google/url?state=${encodeURIComponent(state)}`)
    window.location.href = url
  } catch (cause) {
    onError(cause instanceof Error ? cause.message : 'Não foi possível iniciar o login com Google.')
  }
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.98 10.72A5.4 5.4 0 0 1 3.7 9c0-.6.1-1.18.28-1.72V4.94H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.06l3.02-2.34Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.94L3.98 7.28C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  )
}

function GoogleButton({ label, onError }: { label: string; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => { setBusy(true); startGoogleLogin((m) => { setBusy(false); onError(m) }) }}
      className="w-full h-14 flex items-center justify-center gap-3 bg-surface-container-lowest border border-on-surface/20 rounded-lg text-[14px] font-semibold text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50"
    >
      <GoogleGlyph />
      {busy ? 'Redirecionando...' : label}
    </button>
  )
}

function AuthDivider() {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-on-surface/15" />
      <span className="text-[12px] font-medium text-on-surface-variant">ou</span>
      <div className="flex-1 h-px bg-on-surface/15" />
    </div>
  )
}

// FEAT-074: conexão por código/QR (substitui busca aberta). RN02 case-insensitive (uppercase mask).
function TenantDiscovery({ onSelect }: { onSelect: (t: Barbershop) => void }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)

  const submit = async (raw: string) => {
    const c = parseConnectionCode(raw)
    if (!c) { setError('Digite o código de conexão.'); return }
    setLoading(true)
    setError('')
    try {
      onSelect(await connectByCode(c))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível conectar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background min-h-screen flex flex-col items-center p-4">
      <main className="w-full max-w-[420px] flex flex-col items-center pt-10">
        <img alt="Razorfy" src="/razorfy.png" className="w-28 h-28 object-contain mb-4 drop-shadow-sm" />
        <h1 className="text-[24px] font-bold text-on-surface mb-1 text-center">Conecte-se à barbearia</h1>
        <p className="text-[14px] text-on-surface-variant mb-6 text-center">Informe o código de conexão ou escaneie o QR Code fornecido pela barbearia.</p>

        {scanning ? (
          <QrScanner
            onDetected={(text) => { setScanning(false); submit(text) }}
            onClose={() => setScanning(false)}
          />
        ) : (
          <>
            <form className="w-full" onSubmit={(e) => { e.preventDefault(); submit(code) }}>
              <input
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="EX: BARBA55"
                maxLength={10}
                className="w-full h-14 px-4 mb-3 bg-surface-container-lowest border border-on-surface/15 rounded-xl text-[20px] tracking-[0.25em] font-bold text-center text-on-surface focus:outline-none focus:border-secondary uppercase"
              />
              {error && <div className="w-full mb-3"><ErrorBanner message={error} /></div>}
              <button
                type="submit"
                disabled={loading || !code}
                className="w-full h-12 rounded-xl bg-primary text-on-primary font-bold text-[15px] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Icon name="progress_activity" className="animate-spin text-[20px]" /> : 'Conectar'}
              </button>
            </form>
            <button
              onClick={() => { setError(''); setScanning(true) }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container text-on-surface text-[14px] font-semibold hover:bg-surface-container-high transition-colors"
            >
              <Icon name="qr_code_scanner" className="text-[20px]" />
              Escanear QR Code
            </button>
          </>
        )}
      </main>
    </div>
  )
}

// Scanner QR via BarcodeDetector nativo. Fallback gracioso: se indisponível, fecha e usa código manual.
function QrScanner({ onDetected, onClose }: { onDetected: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const BD = (window as unknown as { BarcodeDetector?: new (o?: { formats?: string[] }) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector
    if (!BD) { setError('Câmera/leitor de QR não suportado neste navegador. Digite o código manualmente.'); return }
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    const detector = new BD({ formats: ['qr_code'] })
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return }
        const v = videoRef.current
        if (!v) return
        v.srcObject = stream
        await v.play()
        const tick = async () => {
          if (stopped || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) { onDetected(codes[0].rawValue); return }
          } catch { /* frame sem leitura */ }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch {
        setError('Não foi possível acessar a câmera. Verifique as permissões ou digite o código.')
      }
    })()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="w-full flex flex-col items-center">
      {error ? (
        <ErrorBanner message={error} />
      ) : (
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <div className="absolute inset-8 border-2 border-white/80 rounded-xl pointer-events-none" />
        </div>
      )}
      <button
        onClick={onClose}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container text-on-surface text-[14px] font-semibold hover:bg-surface-container-high transition-colors"
      >
        <Icon name="keyboard" className="text-[20px]" />
        Digitar código
      </button>
    </div>
  )
}

// FEAT-076 FA01: tela de verificação 2FA no login (após credenciais válidas).
function TwoFactorLoginScreen({ preAuthToken, onAuthenticated, onCancel }: {
  preAuthToken: string
  onAuthenticated: (session: Session) => void
  onCancel: () => void
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const s = await request<Session>('/auth/login/verify-2fa', { method: 'POST', body: JSON.stringify({ code }) }, preAuthToken)
      onAuthenticated(s)
    } catch (c) {
      setError(c instanceof Error ? c.message : 'Código inválido.')
      setLoading(false)
    }
  }

  return (
    <div className="bg-background min-h-screen flex flex-col items-center justify-center p-4">
      <main className="w-full max-w-[360px] flex flex-col items-center">
        <Icon name="encrypted" className="text-[44px] text-primary mb-3" />
        <h1 className="text-[20px] font-bold text-on-surface text-center">Verificação em duas etapas</h1>
        <p className="text-[13px] text-on-surface-variant text-center mb-5">Digite o código de 6 dígitos do seu app autenticador.</p>
        <form className="w-full flex flex-col gap-3" onSubmit={submit}>
          <ErrorBanner message={error} />
          <input
            autoFocus
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            className="h-14 px-4 rounded-xl bg-surface-container-lowest border border-on-surface/15 text-[26px] tracking-[0.5em] font-bold text-center text-on-surface focus:outline-none focus:border-secondary"
          />
          <PrimaryButton type="submit" disabled={loading || code.length !== 6}>
            {loading ? 'Verificando...' : 'Verificar'}
          </PrimaryButton>
          <button type="button" onClick={onCancel} className="text-[13px] text-on-surface-variant hover:text-on-surface mt-1">Voltar ao login</button>
        </form>
      </main>
    </div>
  )
}

// FEAT-078: login/cadastro por telefone (OTP via WhatsApp), paridade com o app.
function PhoneOtpScreen({ tenantId, onAuthenticated, onCancel }: {
  tenantId: string
  onAuthenticated: (session: Session) => void
  onCancel: () => void
}) {
  const [stage, setStage] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('') // dígitos
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function send(e: FormEvent) {
    e.preventDefault()
    if (phone.length < 10) { setError('Informe um telefone válido com DDD.'); return }
    setLoading(true); setError('')
    try {
      await request(`/tenants/${tenantId}/auth/otp/send`, { method: 'POST', body: JSON.stringify({ phone }) })
      setStage('code'); setCode('')
    } catch (c) { setError(c instanceof Error ? c.message : 'Não foi possível enviar o código.') }
    finally { setLoading(false) }
  }
  async function verify(e: FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const s = await request<Session>(`/tenants/${tenantId}/auth/otp/verify`, { method: 'POST', body: JSON.stringify({ phone, code, name: name.trim() || undefined }) })
      onAuthenticated(s)
    } catch (c) { setError(c instanceof Error ? c.message : 'Código inválido.'); setLoading(false) }
  }

  return (
    <div className="bg-background min-h-screen flex flex-col items-center justify-center p-4">
      <main className="w-full max-w-[360px] flex flex-col items-center">
        <Icon name="sms" className="text-[44px] text-primary mb-3" />
        {stage === 'phone' ? (
          <form className="w-full flex flex-col gap-3" onSubmit={send}>
            <h1 className="text-[20px] font-bold text-on-surface text-center">Entrar com telefone</h1>
            <p className="text-[13px] text-on-surface-variant text-center mb-1">Enviaremos um código por WhatsApp.</p>
            <ErrorBanner message={error} />
            <input autoFocus inputMode="numeric" value={maskPhoneBR(phone)} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="62 9 8888-7777" className="h-12 px-4 rounded-xl bg-surface-container-lowest border border-on-surface/15 text-[15px] text-on-surface focus:outline-none focus:border-secondary" />
            <PrimaryButton type="submit" disabled={loading}>{loading ? 'Enviando...' : 'Enviar código'}</PrimaryButton>
            <button type="button" onClick={onCancel} className="text-[13px] text-on-surface-variant hover:text-on-surface mt-1">Voltar</button>
          </form>
        ) : (
          <form className="w-full flex flex-col gap-3" onSubmit={verify}>
            <h1 className="text-[20px] font-bold text-on-surface text-center">Digite o código</h1>
            <p className="text-[13px] text-on-surface-variant text-center mb-1">Enviado para {maskPhoneBR(phone)} via WhatsApp.</p>
            <ErrorBanner message={error} />
            <input autoFocus inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} className="h-14 px-4 rounded-xl bg-surface-container-lowest border border-on-surface/15 text-[24px] tracking-[0.4em] font-bold text-center text-on-surface focus:outline-none focus:border-secondary" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (se for seu primeiro acesso)" className="h-12 px-4 rounded-xl bg-surface-container-lowest border border-on-surface/15 text-[15px] text-on-surface focus:outline-none focus:border-secondary" />
            <PrimaryButton type="submit" disabled={loading || code.length !== 6}>{loading ? 'Verificando...' : 'Verificar'}</PrimaryButton>
            <button type="button" onClick={() => { setStage('phone'); setError('') }} className="text-[13px] text-on-surface-variant hover:text-on-surface mt-1">Reenviar / trocar número</button>
          </form>
        )}
      </main>
    </div>
  )
}

// FEAT-083: máscara BR 99 9 9999-9999 a partir de dígitos crus (DDD+9+8).
function maskPhoneBR(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 3) return `${d.slice(0, 2)} ${d.slice(2)}`
  if (d.length <= 7) return `${d.slice(0, 2)} ${d.slice(2, 3)} ${d.slice(3)}`
  return `${d.slice(0, 2)} ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`
}

// FEAT-083: novo usuário Google valida WhatsApp (telefone → OTP → conclui cadastro).
function GoogleWhatsappScreen({ preAuthToken, tenantId, onAuthenticated, onCancel }: {
  preAuthToken: string
  tenantId: string
  onAuthenticated: (session: Session) => void
  onCancel: () => void
}) {
  const [stage, setStage] = useState<'phone' | 'code'>('phone')
  const [digits, setDigits] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function send(e: FormEvent) {
    e.preventDefault()
    if (digits.length !== 11) { setError('Informe o WhatsApp completo (DDD + número).'); return }
    setLoading(true); setError('')
    try {
      await request(`/tenants/${tenantId}/auth/otp/send`, { method: 'POST', body: JSON.stringify({ phone: digits }) })
      setStage('code'); setCode('')
    } catch (c) { setError(c instanceof Error ? c.message : 'Não foi possível enviar o código.') }
    finally { setLoading(false) }
  }
  async function verify(e: FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const s = await request<Session>('/auth/otp/verify-google', { method: 'POST', body: JSON.stringify({ phone: digits, code }) }, preAuthToken)
      onAuthenticated(s)
    } catch (c) { setError(c instanceof Error ? c.message : 'Código inválido.'); setLoading(false) }
  }

  return (
    <div className="bg-background min-h-screen flex flex-col items-center justify-center p-4">
      <main className="w-full max-w-[360px] flex flex-col items-center">
        <Icon name="sms" className="text-[44px] text-primary mb-3" />
        {stage === 'phone' ? (
          <form className="w-full flex flex-col gap-3" onSubmit={send}>
            <h1 className="text-[20px] font-bold text-on-surface text-center">Falta pouco!</h1>
            <p className="text-[13px] text-on-surface-variant text-center mb-1">Qual o seu WhatsApp? Enviaremos um código para confirmar.</p>
            <ErrorBanner message={error} />
            <input autoFocus inputMode="numeric" value={maskPhoneBR(digits)} onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="62 9 8888-7777" className="h-12 px-4 rounded-xl bg-surface-container-lowest border border-on-surface/15 text-[15px] text-on-surface focus:outline-none focus:border-secondary" />
            <PrimaryButton type="submit" disabled={loading || digits.length !== 11}>{loading ? 'Enviando...' : 'Enviar código'}</PrimaryButton>
            <button type="button" onClick={onCancel} className="text-[13px] text-on-surface-variant hover:text-on-surface mt-1">Cancelar</button>
          </form>
        ) : (
          <form className="w-full flex flex-col gap-3" onSubmit={verify}>
            <h1 className="text-[20px] font-bold text-on-surface text-center">Digite o código</h1>
            <p className="text-[13px] text-on-surface-variant text-center mb-1">Enviado para {maskPhoneBR(digits)} via WhatsApp.</p>
            <ErrorBanner message={error} />
            <input autoFocus inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} className="h-14 px-4 rounded-xl bg-surface-container-lowest border border-on-surface/15 text-[24px] tracking-[0.4em] font-bold text-center text-on-surface focus:outline-none focus:border-secondary" />
            <PrimaryButton type="submit" disabled={loading || code.length !== 6}>{loading ? 'Verificando...' : 'Concluir cadastro'}</PrimaryButton>
            <button type="button" onClick={() => { setStage('phone'); setError('') }} className="text-[13px] text-on-surface-variant hover:text-on-surface mt-1">Trocar número</button>
          </form>
        )}
      </main>
    </div>
  )
}

function AuthScreen({ onAuthenticated, initialError = '', tenant, onChangeTenant }: {
  onAuthenticated: (session: Session) => void
  initialError?: string
  tenant: Barbershop
  onChangeTenant: () => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [pending2fa, setPending2fa] = useState<string | null>(null) // preAuthToken
  const [showOtp, setShowOtp] = useState(false) // FEAT-078: login por telefone (OTP)
  const [regPhone, setRegPhone] = useState('') // FEAT-083: telefone do cadastro (dígitos)
  const [regCode, setRegCode] = useState('')
  const [pendingReg, setPendingReg] = useState<{ name: string; email?: string; password: string } | null>(null)

  useEffect(() => {
    request<{ enabled: boolean }>('/auth/google/status')
      .then((s) => setGoogleEnabled(s.enabled))
      .catch(() => setGoogleEnabled(false))
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)

    // FEAT-083: cadastro por senha → envia OTP do telefone antes de criar.
    if (mode === 'register') {
      if (regPhone.length < 10) { setError('Informe o telefone (WhatsApp) com DDD.'); return }
      setLoading(true)
      const data = {
        name: form.get('name') as string,
        email: (form.get('email') as string)?.trim() || undefined,
        password: form.get('password') as string,
      }
      try {
        await request(`/tenants/${tenant.id}/auth/otp/send`, { method: 'POST', body: JSON.stringify({ phone: regPhone }) })
        setPendingReg(data); setRegCode('')
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o código.')
      } finally { setLoading(false) }
      return
    }

    setLoading(true)
    const body = { identifier: form.get('identifier'), password: form.get('password'), tenantSlug: tenant.slug }
    try {
      const result = await request<Session | { status: 'REQUIRE_2FA'; preAuthToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify(body) })
      if ('status' in result && result.status === 'REQUIRE_2FA') {
        setPending2fa(result.preAuthToken)
        return
      }
      onAuthenticated(result as Session)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao autenticar.')
    } finally {
      setLoading(false)
    }
  }

  // FEAT-083: conclui o cadastro validando o OTP do telefone.
  async function submitRegisterCode(e: FormEvent) {
    e.preventDefault()
    if (!pendingReg || regCode.length !== 6) return
    setLoading(true); setError('')
    try {
      const s = await request<Session>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...pendingReg, phone: regPhone, code: regCode, tenantSlug: tenant.slug }),
      })
      onAuthenticated(s)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Código inválido.')
      setLoading(false)
    }
  }

  if (pending2fa) {
    return <TwoFactorLoginScreen preAuthToken={pending2fa} onAuthenticated={onAuthenticated} onCancel={() => { setPending2fa(null); setError('') }} />
  }

  // FEAT-083: etapa de código do cadastro por senha.
  if (pendingReg) {
    return (
      <div className="bg-background min-h-screen flex flex-col items-center justify-center p-4">
        <main className="w-full max-w-[360px] flex flex-col items-center">
          <Icon name="sms" className="text-[44px] text-primary mb-3" />
          <h1 className="text-[20px] font-bold text-on-surface text-center">Confirme seu WhatsApp</h1>
          <p className="text-[13px] text-on-surface-variant text-center mb-4">Enviamos um código para {maskPhoneBR(regPhone)}.</p>
          <form className="w-full flex flex-col gap-3" onSubmit={submitRegisterCode}>
            <ErrorBanner message={error} />
            <input autoFocus inputMode="numeric" value={regCode} onChange={(e) => setRegCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} className="h-14 px-4 rounded-xl bg-surface-container-lowest border border-on-surface/15 text-[24px] tracking-[0.4em] font-bold text-center text-on-surface focus:outline-none focus:border-secondary" />
            <PrimaryButton type="submit" disabled={loading || regCode.length !== 6}>{loading ? 'Criando conta...' : 'Concluir cadastro'}</PrimaryButton>
            <button type="button" onClick={() => { setPendingReg(null); setError('') }} className="text-[13px] text-on-surface-variant hover:text-on-surface mt-1">Voltar</button>
          </form>
        </main>
      </div>
    )
  }

  if (showOtp) {
    return <PhoneOtpScreen tenantId={tenant.id} onAuthenticated={onAuthenticated} onCancel={() => { setShowOtp(false); setError('') }} />
  }

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      className="absolute right-4 top-4 text-on-surface-variant hover:text-on-surface transition-colors"
      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
    >
      <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
    </button>
  )

  if (mode === 'login') {
    return (
      <div className="bg-background min-h-screen flex flex-col items-center justify-center p-4">
        <main className="w-full max-w-[400px] flex flex-col items-center">
          <div className="mb-6 w-44 h-44 flex items-center justify-center">
            <img alt="Razorfy" src="/razorfy.png" className="object-contain w-full h-full drop-shadow-sm" />
          </div>
          <h1 className="text-on-background text-[20px] font-semibold text-center mb-4">
            Seu estilo. Seu horário. Do seu jeito.
          </h1>
          <button onClick={onChangeTenant} className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container text-on-surface text-[13px] font-semibold hover:bg-surface-container-high transition-colors">
            <Icon name="storefront" className="text-[16px] text-primary" />
            {tenant.name}
            <span className="text-[11px] text-on-surface-variant">· trocar</span>
          </button>
          <form className="w-full flex flex-col gap-4" onSubmit={submit}>
            <ErrorBanner message={error} />
            <FloatingField label="E-mail ou telefone" id="identifier" name="identifier" type="text" required />
            <div className="relative w-full">
              <FloatingField label="Senha" id="password" name="password" type={showPassword ? 'text' : 'password'} required />
              {passwordToggle}
            </div>
            <PrimaryButton type="submit" disabled={loading} className="mt-1">
              {loading ? 'Entrando...' : 'Entrar'}
            </PrimaryButton>
            {googleEnabled && (
              <>
                <AuthDivider />
                <GoogleButton label="Entrar com Google" onError={setError} />
              </>
            )}
          </form>
          <div className="mt-8 text-center">
            <button onClick={() => { setMode('register'); setError('') }} className="text-on-surface-variant text-[16px]">
              Não tem uma conta?{' '}
              <span className="text-[14px] font-semibold text-secondary underline decoration-2 underline-offset-4 hover:text-primary transition-colors">Cadastre-se</span>
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen flex flex-col items-center">
      <header className="w-full max-w-md mx-auto px-4 h-16 flex items-center">
        <button onClick={() => { setMode('login'); setError('') }} className="p-2 -ml-2 text-on-surface hover:bg-surface-container-high rounded-full transition-colors" aria-label="Voltar">
          <Icon name="arrow_back" />
        </button>
        <div className="flex-1" />
        <div className="text-[24px] font-bold italic uppercase tracking-tighter text-on-surface">Razorfy</div>
      </header>
      <main className="w-full max-w-md px-4 pt-8 pb-8 flex-1 flex flex-col justify-center">
        <div className="mb-8">
          <h1 className="text-[28px] md:text-[32px] font-bold text-on-surface mb-2">Crie sua conta</h1>
          <p className="text-[16px] text-on-surface-variant">Junte-se à barbearia mais afiada da cidade.</p>
        </div>
        <form className="space-y-6 flex-1 flex flex-col" onSubmit={submit}>
          <ErrorBanner message={error} />
          <div className="space-y-4">
            <FloatingField label="Nome completo" id="name" name="name" type="text" minLength={3} required />
            <FloatingField label="Telefone (WhatsApp)" id="phone" name="phone" type="tel" inputMode="tel" value={maskPhoneBR(regPhone)} onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} required />
            <FloatingField label="E-mail (opcional)" id="email" name="email" type="email" />
            <div className="relative w-full">
              <FloatingField label="Senha (mínimo 8 caracteres)" id="password" name="password" type={showPassword ? 'text' : 'password'} minLength={8} required />
              {passwordToggle}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar conta'}
            </PrimaryButton>
            <button type="button" onClick={() => { setError(''); setShowOtp(true) }} className="inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-on-surface/15 text-on-surface text-[14px] font-semibold hover:bg-surface-container transition-colors">
              <Icon name="sms" className="text-[18px] text-primary" />
              Cadastrar com telefone (WhatsApp)
            </button>
            {googleEnabled && (
              <>
                <AuthDivider />
                <GoogleButton label="Cadastrar com Google" onError={setError} />
              </>
            )}
          </div>
          <div className="mt-auto pt-8 text-center">
            <p className="text-[16px] text-on-surface-variant">
              Já tem uma conta?{' '}
              <button type="button" onClick={() => { setMode('login'); setError('') }} className="text-primary font-bold hover:underline">Faça login</button>
            </p>
          </div>
        </form>
      </main>
    </div>
  )
}

// ---------- Home / Catálogo ----------

function HomePage({
  tenantId,
  selectedServices,
  onToggleService,
  onSchedule,
  onLogout,
}: {
  tenantId?: string
  selectedServices: string[]
  onToggleService: (id: string) => void
  onSchedule: () => void
  onLogout: () => void
}) {
  const [services, setServices] = useState<ServiceItem[]>([])
  const [iconMap, setIconMap] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const path = tenantId ? `/tenants/${tenantId}/services` : '/services'
    request<ServiceItem[]>(path)
      .then(setServices)
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false))
    // FEAT-082: ícones por serviço (globais + da barbearia)
    if (tenantId) {
      request<ServiceIconItem[]>(`/tenants/${tenantId}/icons`)
        .then((list) => setIconMap(Object.fromEntries(list.map((i) => [i.id, i.svgContent]))))
        .catch(() => { /* ícones são opcionais */ })
    }
  }, [])

  const availableCategories = CATEGORIES.filter((c) => services.some((s) => categoryOf(s) === c))

  const chosen = services.filter((service) => selectedServices.includes(service.id))
  const total = chosen.reduce((sum, service) => sum + Number(service.price), 0)
  const duration = chosen.reduce((sum, service) => sum + service.durationMinutes, 0)

  return (
    <div className="flex flex-col min-h-screen pb-48 lg:pb-28">
      <div className="lg:hidden">
        <TopBar onLogout={onLogout} />
      </div>
      <main className="flex-grow w-full max-w-[1100px] mx-auto px-4 md:px-8 py-4 lg:py-8">
        <div className="mb-6">
          <h1 className="text-[28px] md:text-[32px] font-bold text-on-surface mb-2 tracking-tight">01 · Escolha os serviços</h1>
          <p className="text-[16px] text-on-surface-variant">Selecione um ou mais serviços, de qualquer categoria, para continuar.</p>
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 h-36 animate-pulse" />
            ))}
          </div>
        ) : !services.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icon name="content_cut" className="text-[64px] text-surface-variant mb-4" />
            <h3 className="text-[24px] font-bold text-on-surface mb-1">Nenhum serviço disponível</h3>
            <p className="text-[16px] text-on-surface-variant max-w-md">Volte mais tarde ou fale com a barbearia.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {availableCategories.map((c) => (
              <section key={c} id={`categoria-${c}`} className="scroll-mt-20 lg:scroll-mt-6" aria-label={c}>
                <div className="flex items-center gap-2 mb-3 border-b border-on-surface/10 pb-2">
                  <CategoryIcon category={c} className="text-primary text-[22px]" />
                  <h2 className="text-[22px] font-bold text-on-surface">{c}</h2>
                  <span className="text-[12px] font-medium text-on-surface-variant">{CATEGORY_META[c].description}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {services.filter((s) => categoryOf(s) === c).map((service) => {
                    const selected = selectedServices.includes(service.id)
                    return (
                      <button
                        key={service.id}
                        onClick={() => onToggleService(service.id)}
                        className={`bg-surface-container-lowest rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-md text-left group ${
                          selected ? 'border-2 border-primary bg-primary-fixed' : 'border border-on-surface/10'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {service.iconId && iconMap[service.iconId] && (
                              <SafeSvg svg={iconMap[service.iconId]} className="[&>svg]:w-7 [&>svg]:h-7 text-primary shrink-0" />
                            )}
                            <h3 className="text-[20px] font-semibold text-on-surface leading-tight">{service.name}</h3>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            selected ? 'border-primary bg-primary' : 'border-on-surface/20 group-hover:border-primary'
                          }`}>
                            {selected && <Icon name="check" filled className="text-on-primary text-[16px]" />}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-6 pt-2 border-t border-on-surface/10">
                          <div className="flex items-center text-tertiary gap-1">
                            <Icon name="schedule" className="text-[18px]" />
                            <span className="text-[12px] font-medium">{service.durationMinutes} min</span>
                          </div>
                          <span className="text-[14px] font-semibold text-on-surface">{money.format(service.price)}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* CTA fixo */}
      <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 lg:left-64 bg-surface-container-lowest border-t-2 border-on-surface z-40 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="max-w-[1100px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex flex-col text-center sm:text-left">
            <span className="text-[14px] font-semibold text-on-surface">
              {selectedServices.length
                ? `${selectedServices.length} serviço${selectedServices.length > 1 ? 's' : ''} selecionado${selectedServices.length > 1 ? 's' : ''}`
                : 'Nenhum serviço selecionado'}
            </span>
            {selectedServices.length > 0 && (
              <span className="text-[12px] font-medium text-on-surface-variant">
                {duration} min • <strong className="text-primary">{money.format(total)}</strong>
              </span>
            )}
          </div>
          <button
            onClick={onSchedule}
            disabled={!selectedServices.length}
            className="w-full sm:w-auto bg-primary text-on-primary text-[14px] font-semibold uppercase tracking-widest px-8 py-3 rounded-lg border-2 border-primary hover:bg-on-primary-fixed-variant hover:border-on-primary-fixed-variant disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm active:scale-95"
          >
            Agendar
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Meus Horários (CLIENT) ----------

function AppointmentsPage({ session }: { session: Session }) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    request<Appointment[]>('/appointments/mine', {}, session.accessToken)
      .then(setAppointments)
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false))
  }, [session.accessToken])

  async function handleCancel(id: string) {
    setCancellingId(id)
    try {
      const updated = await request<Appointment>(`/appointments/${id}/cancel`, { method: 'POST' }, session.accessToken)
      setAppointments((prev) => prev.map((a) => (a.appointmentId === id ? updated : a)))
      setConfirmId(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cancelar.')
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="flex flex-col min-h-screen pb-20 lg:pb-4">
      <div className="lg:hidden">
        <TopBar title="Meus Horários" />
      </div>
      <main className="flex-grow w-full max-w-[900px] mx-auto px-4 md:px-8 py-4 lg:py-8">
        <div className="mb-6 hidden lg:block">
          <h1 className="text-[28px] font-bold text-on-surface tracking-tight">Meus Horários</h1>
          <p className="text-[16px] text-on-surface-variant">Histórico e agendamentos futuros.</p>
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 h-28 animate-pulse" />
            ))}
          </div>
        ) : !appointments.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icon name="event_available" className="text-[64px] text-surface-variant mb-4" />
            <h3 className="text-[20px] font-bold text-on-surface mb-1">Nenhum agendamento encontrado</h3>
            <p className="text-[16px] text-on-surface-variant">Seu próximo visual vai aparecer aqui.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {appointments.map((appt) => {
              const canCancel = (appt.status === 'CONFIRMED' || appt.status === 'PENDING_PAYMENT') && canCancelFrontend(appt.startTimestamp)
              const isConfirming = confirmId === appt.appointmentId
              return (
                <div key={appt.appointmentId} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-[14px] font-semibold text-on-surface">{appt.barberName}</p>
                      <p className="text-[12px] text-on-surface-variant">
                        {new Date(appt.startTimestamp).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {' — '}
                        {new Date(appt.endTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <StatusBadge status={appt.status} />
                  </div>
                  <p className="text-[12px] text-on-surface-variant mb-2">{appt.services.map((s) => s.name).join(' + ')}</p>
                  <div className="flex items-center justify-between border-t border-on-surface/10 pt-2">
                    <span className="text-[13px] font-semibold text-on-surface">{money.format(appt.amountToPay)}</span>
                    {(appt.status === 'CONFIRMED' || appt.status === 'PENDING_PAYMENT') && (
                      isConfirming ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmId(null)}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-on-surface-variant border border-on-surface/20 hover:bg-surface-container"
                          >
                            Não
                          </button>
                          <button
                            onClick={() => handleCancel(appt.appointmentId)}
                            disabled={!!cancellingId}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-error text-on-error hover:opacity-80 disabled:opacity-40"
                          >
                            {cancellingId === appt.appointmentId ? 'Cancelando...' : 'Confirmar cancelamento'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => canCancel ? setConfirmId(appt.appointmentId) : undefined}
                          disabled={!canCancel}
                          title={!canCancel ? 'Cancelamento disponível apenas com 2h de antecedência' : undefined}
                          className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-primary border border-primary hover:bg-primary-fixed disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          Cancelar
                        </button>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

// ---------- Carteira Digital (CLIENT) ----------

function WalletPage({ session }: { session: Session }) {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    request<Wallet>('/wallet', {}, session.accessToken)
      .then(setWallet)
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false))
  }, [session.accessToken])

  return (
    <div className="flex flex-col min-h-screen pb-20 lg:pb-4">
      <div className="lg:hidden">
        <TopBar title="Carteira" />
      </div>
      <main className="flex-grow w-full max-w-[900px] mx-auto px-4 md:px-8 py-4 lg:py-8">
        <div className="mb-6 hidden lg:block">
          <h1 className="text-[28px] font-bold text-on-surface tracking-tight">Carteira de Cashback</h1>
          <p className="text-[16px] text-on-surface-variant">Saldo e extrato de fidelidade.</p>
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

        {loading ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-surface-container-lowest rounded-xl animate-pulse" />)}
            </div>
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-surface-container-lowest rounded-xl animate-pulse" />)}
            </div>
          </div>
        ) : wallet ? (
          <>
            {/* Saldos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-primary text-on-primary rounded-xl p-4">
                <p className="text-[12px] font-medium opacity-80 mb-1">Disponível</p>
                <p className="text-[24px] font-bold">{money.format(wallet.availableBalance)}</p>
              </div>
              <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4">
                <p className="text-[12px] font-medium text-on-surface-variant mb-1">Saldo Total</p>
                <p className="text-[20px] font-bold text-on-surface">{money.format(wallet.balance)}</p>
              </div>
              <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4">
                <p className="text-[12px] font-medium text-on-surface-variant mb-1">Reservado</p>
                <p className="text-[20px] font-bold text-on-surface">{money.format(wallet.reservedBalance)}</p>
              </div>
            </div>

            {/* Extrato */}
            <h2 className="text-[16px] font-semibold text-on-surface mb-3">Extrato</h2>
            {wallet.transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center bg-surface-container-low rounded-xl">
                <Icon name="receipt_long" className="text-[48px] text-on-surface-variant mb-2" />
                <p className="text-[14px] text-on-surface-variant">Nenhuma transação registrada.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {wallet.transactions.map((tx) => {
                  const meta = TRANSACTION_META[tx.type] ?? { label: tx.type, icon: 'payments', sign: '', color: 'text-on-surface' }
                  return (
                    <div key={tx.id} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl px-4 py-3 flex items-center gap-3">
                      <Icon name={meta.icon} className={`text-[22px] shrink-0 ${meta.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-on-surface truncate">{tx.description}</p>
                        <p className="text-[11px] text-on-surface-variant">
                          {new Date(tx.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <span className={`text-[14px] font-bold shrink-0 ${meta.color}`}>
                        {meta.sign}{money.format(Math.abs(tx.amount))}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  )
}

// ---------- Calendário (CLIENT — agendamento com cashback) ----------

// Mapa nome do barbeiro → retrato (gerado via Higgsfield). Match por substring do nome.
const BARBER_IMAGES: { match: string; src: string }[] = [
  { match: 'rafael', src: '/barbers/rafael.png' },
  { match: 'bruno', src: '/barbers/bruno.png' },
]
function barberImageFor(name?: string): string | undefined {
  if (!name) return undefined
  const lower = name.toLowerCase()
  return BARBER_IMAGES.find((b) => lower.includes(b.match))?.src
}

// Hero com efeito parallax: a imagem e o rótulo se deslocam em camadas conforme o mouse.
function BarberParallax({ name, image, subtitle }: { name: string; image?: string; subtitle: string }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  function handleMove(e: ReactMouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    setOffset({
      x: (e.clientX - rect.left) / rect.width - 0.5,
      y: (e.clientY - rect.top) / rect.height - 0.5,
    })
  }

  return (
    <div
      onMouseMove={handleMove}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
      className="relative h-52 lg:h-64 rounded-2xl overflow-hidden bg-surface-container-high shadow-md select-none [perspective:1000px]"
    >
      {image ? (
        <img
          key={image}
          src={image}
          alt={name}
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-200 ease-out will-change-transform"
          style={{ transform: `scale(1.18) translate3d(${offset.x * -26}px, ${offset.y * -26}px, 0)` }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary-fixed to-surface-container-highest">
          <Icon name="group" className="text-[72px] text-on-secondary-container/50" />
        </div>
      )}

      {/* Vinheta para legibilidade do texto */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent pointer-events-none" />

      {/* Rótulo em camada de profundidade (move no sentido oposto da imagem) */}
      <div
        className="absolute bottom-0 left-0 right-0 p-4 transition-transform duration-200 ease-out pointer-events-none"
        style={{ transform: `translate3d(${offset.x * 14}px, ${offset.y * 14}px, 0)` }}
      >
        <p className="text-white text-[22px] font-bold drop-shadow-md leading-tight">{name}</p>
        <p className="text-white/80 text-[12px] font-medium">{subtitle}</p>
      </div>
    </div>
  )
}

function CalendarPage({
  session,
  tenantId,
  selectedServiceIds,
  onBack,
  onBooked,
}: {
  session: Session
  tenantId?: string
  selectedServiceIds: string[]
  onBack: () => void
  onBooked: () => void
}) {
  const tenantPath = tenantId ? `/tenants/${tenantId}` : ''
  const [services, setServices] = useState<ServiceItem[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [barberId, setBarberId] = useState<string>('')
  const [date, setDate] = useState(tomorrow)
  const [slots, setSlots] = useState<Map<string, string[]>>(new Map())
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [startTimestamp, setStartTimestamp] = useState('')
  const [useCashback, setUseCashback] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [result, setResult] = useState<Appointment | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const chosen = services.filter((service) => selectedServiceIds.includes(service.id))
  const duration = chosen.reduce((sum, service) => sum + service.durationMinutes, 0)
  const total = chosen.reduce((sum, service) => sum + Number(service.price), 0)

  useEffect(() => {
    Promise.all([
      request<ServiceItem[]>(`${tenantPath}/services`),
      request<Barber[]>(`${tenantPath}/barbers`),
      request<Wallet>('/wallet', {}, session.accessToken).catch(() => null),
    ]).then(([serviceData, barberData, walletData]) => {
      setServices(serviceData)
      setBarbers(barberData)
      if (walletData) setWallet(walletData)
    }).catch((cause) => setError(cause.message))
  }, [session.accessToken])

  useEffect(() => {
    if (!date || !duration || !barbers.length) return
    queueMicrotask(() => {
      setStartTimestamp('')
      setSlots(new Map())
      setSlotsLoading(true)
    })
    const candidates = barberId ? barbers.filter((b) => b.id === barberId) : barbers
    Promise.all(
      candidates.map((barber) =>
        request<{ availableStarts: string[] }>(`${tenantPath}/barbers/${barber.id}/availability?date=${date}&duration=${duration}`)
          .then((data) => ({ barberId: barber.id, starts: data.availableStarts }))
          .catch(() => ({ barberId: barber.id, starts: [] as string[] })),
      ),
    ).then((results) => {
      const merged = new Map<string, string[]>()
      for (const { barberId: id, starts } of results) {
        for (const start of starts) {
          merged.set(start, [...(merged.get(start) ?? []), id])
        }
      }
      setSlots(merged)
      setSlotsLoading(false)
    })
  }, [barberId, date, duration, barbers])

  const times = useMemo(() => [...slots.keys()].sort(), [slots])

  // Sugestão: cashback paga os serviços completos mais baratos que o saldo cobrir.
  const suggestion = wallet ? suggestCashback(chosen, wallet.availableBalance) : { services: [], amount: 0 }
  const canUseCashback = suggestion.amount > 0
  const cashbackApplied = useCashback ? suggestion.amount : 0
  const finalTotal = Math.max(0, total - cashbackApplied)
  const normalizedCouponCode = couponCode.trim().toUpperCase()

  async function book() {
    if (!startTimestamp) return setError('Escolha um horário disponível.')
    const availableBarbers = slots.get(startTimestamp) ?? []
    const chosenBarberId = barberId || availableBarbers[0]
    if (!chosenBarberId) return setError('Horário indisponível. Escolha outro.')
    if (useCashback && !canUseCashback) {
      return setError('Saldo de cashback insuficiente para pagar qualquer serviço por completo.')
    }
    if (useCashback && normalizedCouponCode) {
      return setError('Cupom e cashback não podem ser usados no mesmo agendamento.')
    }
    setError('')
    setLoading(true)
    try {
      const appointment = await request<Appointment>('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          barberId: chosenBarberId,
          serviceIds: selectedServiceIds,
          startTimestamp,
          useCashback,
          cashbackAmountToApply: useCashback ? suggestion.amount : null,
          couponCode: normalizedCouponCode || null,
          paymentMethod: 'PRESENTIAL',
        }),
      }, session.accessToken)
      setResult(appointment)
      onBooked()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o agendamento.')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="bg-background min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-primary text-on-primary flex items-center justify-center mb-6">
          <Icon name="check" filled className="text-[40px]" />
        </div>
        <p className="text-[12px] font-medium tracking-widest text-on-surface-variant mb-2">TUDO CERTO</p>
        <h1 className="text-[28px] md:text-[32px] font-bold text-on-surface mb-2">Horário confirmado.</h1>
        <p className="text-[16px] text-on-surface-variant mb-8">Agora é só chegar e deixar o resto com a gente. O pagamento é no balcão.</p>
        <div className="w-full max-w-sm bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 mb-8 grid grid-cols-1 gap-3 text-left">
          <div><small className="text-[12px] text-on-surface-variant block">Profissional</small><strong className="text-[16px] text-on-surface">{result.barberName}</strong></div>
          <div><small className="text-[12px] text-on-surface-variant block">Quando</small><strong className="text-[16px] text-on-surface">{new Date(result.startTimestamp).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong></div>
          {result.cashbackUsed > 0 && (
            <div><small className="text-[12px] text-on-surface-variant block">Cashback aplicado</small><strong className="text-[16px] text-green-700">-{money.format(result.cashbackUsed)}</strong></div>
          )}
          {(result.couponDiscount ?? 0) > 0 && (
            <div><small className="text-[12px] text-on-surface-variant block">Cupom {result.couponCode}</small><strong className="text-[16px] text-green-700">-{money.format(result.couponDiscount ?? 0)}</strong></div>
          )}
          <div><small className="text-[12px] text-on-surface-variant block">Valor a pagar</small><strong className="text-[16px] text-on-surface">{money.format(result.amountToPay)}</strong></div>
        </div>
        <div className="w-full max-w-sm">
          <PrimaryButton onClick={onBack}>Fazer novo agendamento</PrimaryButton>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background text-on-background min-h-screen pb-32 flex flex-col items-center">
      <TopBar onBack={onBack} />
      <main className="w-full max-w-[1200px] px-4 md:px-8 pt-6 flex-1">
        <div className="mb-6">
          <h1 className="text-[28px] md:text-[32px] font-bold text-on-surface mb-1">02 · Escolha o profissional e horário</h1>
          <p className="text-[16px] text-on-surface-variant">
            {chosen.map((s) => s.name).join(' + ')} • {duration} min • {money.format(total)}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Coluna: profissional */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <h2 className="text-[20px] font-semibold text-on-surface border-b border-on-surface/10 pb-2">Profissional</h2>
            {(() => {
              const sel = barbers.find((b) => b.id === barberId)
              const name = barberId === '' ? 'Sem preferência' : sel?.name ?? '—'
              const image = barberId === '' ? undefined : barberImageFor(sel?.name)
              const subtitle = barberId === '' ? 'Qualquer profissional disponível' : 'Profissional selecionado'
              return <BarberParallax name={name} image={image} subtitle={subtitle} />
            })()}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              <button
                onClick={() => setBarberId('')}
                className={`flex items-center gap-4 p-4 bg-surface-container-lowest rounded-xl text-left transition-all hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary ${
                  barberId === '' ? 'border-2 border-primary' : 'border border-on-surface/10'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0">
                  <Icon name="group" className="text-tertiary" />
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-on-surface">Sem preferência</div>
                  <div className="text-[14px] text-on-surface-variant mt-1">Qualquer profissional disponível</div>
                </div>
              </button>
              {barbers.map((barber) => (
                <button
                  key={barber.id}
                  onClick={() => setBarberId(barber.id)}
                  className={`flex items-center gap-4 p-4 bg-surface-container-lowest rounded-xl text-left transition-all hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary ${
                    barberId === barber.id ? 'border-2 border-primary' : 'border border-on-surface/10'
                  }`}
                >
                  {barberImageFor(barber.name) ? (
                    <img
                      src={barberImageFor(barber.name)}
                      alt={barber.name}
                      className="w-12 h-12 rounded-full object-cover object-top shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-secondary-fixed text-on-secondary-container flex items-center justify-center shrink-0 font-bold">
                      {barber.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="text-[14px] font-semibold text-on-surface">{barber.name}</div>
                    <div className="text-[14px] text-on-surface-variant mt-1">Barbeiro</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Coluna: data e horários */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <h2 className="text-[20px] font-semibold text-on-surface border-b border-on-surface/10 pb-2">Data e horário</h2>
            <label className="flex flex-col gap-1 max-w-xs">
              <span className="text-[12px] font-medium text-on-surface-variant">Data</span>
              <input
                type="date"
                min={dateInputValue(new Date())}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-14 px-4 bg-surface-container-lowest border border-on-surface/10 rounded-lg focus:outline-none focus:border-secondary focus:border-2 text-[16px] text-on-surface"
              />
            </label>

            {slotsLoading ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-12 bg-surface-container-high rounded-lg animate-pulse" />
                ))}
              </div>
            ) : !times.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-center bg-surface-container-low rounded-xl">
                <Icon name="event_busy" className="text-[48px] text-on-surface-variant mb-2" />
                <p className="text-[16px] text-on-surface-variant">Não há horários livres para esta data.<br />Tente outro dia.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {times.map((time) => (
                  <button
                    key={time}
                    onClick={() => setStartTimestamp(time)}
                    className={`h-12 rounded-lg text-[14px] font-semibold transition-colors ${
                      startTimestamp === time
                        ? 'bg-primary text-on-primary border-2 border-primary'
                        : 'bg-surface-container-lowest text-on-surface border border-on-surface/10 hover:border-primary'
                    }`}
                  >
                    {new Date(time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </button>
                ))}
              </div>
            )}

            <div className="bg-surface-container-lowest rounded-xl p-3 border border-on-surface/10">
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-on-surface-variant">Cupom</span>
                <input
                  value={couponCode}
                  onChange={(e) => {
                    const next = e.target.value.toUpperCase()
                    setCouponCode(next)
                    if (next.trim()) setUseCashback(false)
                  }}
                  maxLength={20}
                  placeholder="CLIENTE20"
                  className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px] text-on-surface uppercase focus:outline-none focus:border-secondary"
                />
              </label>
            </div>

            {/* Cashback — sugestão paga serviços completos (mais baratos primeiro) */}
            {wallet && wallet.availableBalance > 0 && (
              <div className="bg-surface-container-low rounded-xl p-3 border border-on-surface/10">
                <label className={`flex items-start gap-3 ${canUseCashback && !normalizedCouponCode ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                  <input
                    type="checkbox"
                    checked={useCashback}
                    disabled={!canUseCashback || Boolean(normalizedCouponCode)}
                    onChange={(e) => setUseCashback(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-primary"
                  />
                  <span className="text-[13px] font-semibold text-on-surface">
                    Usar cashback ({money.format(wallet.availableBalance)} disponível)
                    {canUseCashback ? (
                      <span className="block text-[11px] font-normal text-on-surface-variant mt-0.5">
                        Sugestão: pagar {suggestion.services.map((s) => s.name).join(' + ')} com cashback
                        {' '}({money.format(suggestion.amount)}).
                        {finalTotal > 0
                          ? ` Restante a pagar no balcão: ${money.format(finalTotal)}.`
                          : ' Cobre todos os serviços selecionados.'}
                      </span>
                    ) : (
                      <span className="block text-[11px] font-normal text-on-surface-variant mt-0.5">
                        Saldo insuficiente para pagar qualquer serviço por completo.
                      </span>
                    )}
                  </span>
                </label>
              </div>
            )}

            {error && <ErrorBanner message={error} />}
          </div>
        </div>
      </main>

      {/* CTA fixo */}
      <div className="fixed bottom-0 left-0 w-full bg-surface-container-lowest border-t-2 border-on-surface z-40 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex flex-col text-center sm:text-left">
            <span className="text-[14px] font-semibold text-on-surface">
              {startTimestamp
                ? new Date(startTimestamp).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })
                : 'Escolha um horário'}
            </span>
            <span className="text-[12px] font-medium text-on-surface-variant">
              {duration} min •{' '}
              {useCashback && cashbackApplied > 0 ? (
                <>
                  <s className="opacity-50">{money.format(total)}</s>{' '}
                  <strong className="text-primary">{money.format(finalTotal)}</strong>
                  {' '}<span className="text-[11px]">(−{money.format(cashbackApplied)} cashback)</span>
                </>
              ) : (
                <strong className="text-primary">{money.format(total)}</strong>
              )}
            </span>
          </div>
          <button
            onClick={book}
            disabled={!startTimestamp || loading}
            className="w-full sm:w-auto bg-primary text-on-primary text-[14px] font-semibold uppercase tracking-widest px-8 py-3 rounded-lg border-2 border-primary hover:bg-on-primary-fixed-variant hover:border-on-primary-fixed-variant disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm active:scale-95"
          >
            {loading ? 'Reservando...' : 'Confirmar agendamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Agenda do Barbeiro ----------

type AgendaFilter = 'hoje' | 'semana' | 'mes' | 'custom'
type AgendaStatus = 'all' | 'pending' | 'concluded' | 'cancelled'

const AGENDA_PERIOD_CHIPS: { key: Exclude<AgendaFilter, 'custom'>; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mês' },
]

const AGENDA_STATUS_CHIPS: { key: AgendaStatus; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'concluded', label: 'Concluídos' },
  { key: 'cancelled', label: 'Cancelados' },
]

// Agrupa os status do domínio nas categorias visíveis ao barbeiro.
const AGENDA_STATUS_GROUPS: Record<Exclude<AgendaStatus, 'all'>, string[]> = {
  pending: ['CONFIRMED', 'PENDING_PAYMENT'],
  concluded: ['CONCLUDED'],
  cancelled: ['CANCELLED', 'EXPIRED_PAYMENT', 'CANCELLED_OVERBOOKING'],
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function agendaRange(filter: AgendaFilter, customDate: string): { start: Date; end: Date } {
  const now = new Date()
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
  const dayEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

  if (filter === 'custom' && customDate) {
    const [y, m, d] = customDate.split('-').map(Number)
    const base = new Date(y, m - 1, d)
    return { start: dayStart(base), end: dayEnd(base) }
  }

  if (filter === 'semana') {
    const dow = now.getDay() === 0 ? 6 : now.getDay() - 1 // Monday=0
    const start = dayStart(now); start.setDate(start.getDate() - dow)
    const end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  if (filter === 'mes') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    return { start, end }
  }

  // hoje
  return { start: dayStart(now), end: dayEnd(now) }
}

function BarberAgendaPage({ session }: { session: Session }) {
  const barberId = session.user.id
  const token = session.accessToken
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filter, setFilter] = useState<AgendaFilter>('hoje')
  const [customDate, setCustomDate] = useState('')
  const [statusFilter, setStatusFilter] = useState<AgendaStatus>('all')
  const [concludingId, setConcludingId] = useState<string | null>(null)
  const [callingId, setCallingId] = useState<string | null>(null)

  const [blocks, setBlocks] = useState<ExpressBlock[]>([])
  const [goals, setGoals] = useState<BarberGoal[]>([])
  const [reviews, setReviews] = useState<ReviewSummary | null>(null)
  const [blockMenuOpen, setBlockMenuOpen] = useState(false)
  const [creatingBlock, setCreatingBlock] = useState(false)
  const [notesFor, setNotesFor] = useState<{ clientId: string; clientName: string } | null>(null)

  function loadBlocks() {
    request<ExpressBlock[]>(`/barbers/${barberId}/express-blocks?date=${today()}`, {}, token)
      .then(setBlocks)
      .catch(() => {})
  }

  useEffect(() => {
    request<Appointment[]>('/appointments/mine', {}, token)
      .then(setAppointments)
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false))
    loadBlocks()
    request<BarberGoal[]>(`/barbers/${barberId}/goals`, {}, token).then(setGoals).catch(() => {})
    request<ReviewSummary>(`/reviews?barberId=${barberId}`, {}, token).then(setReviews).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, barberId])

  const filtered = useMemo(() => {
    const { start, end } = agendaRange(filter, customDate)
    const allowed = statusFilter === 'all' ? null : AGENDA_STATUS_GROUPS[statusFilter]
    return appointments
      .filter((a) => {
        const t = new Date(a.startTimestamp).getTime()
        if (t < start.getTime() || t > end.getTime()) return false
        if (allowed && !allowed.includes(a.status)) return false
        return true
      })
      .sort((a, b) => new Date(a.startTimestamp).getTime() - new Date(b.startTimestamp).getTime())
  }, [appointments, filter, customDate, statusFilter])

  async function handleConclude(id: string) {
    setConcludingId(id)
    try {
      const updated = await request<Appointment>(`/appointments/${id}/conclude`, { method: 'POST' }, token)
      setAppointments((prev) => prev.map((a) => (a.appointmentId === id ? updated : a)))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir o atendimento.')
    } finally {
      setConcludingId(null)
    }
  }

  async function handleCreateBlock(durationMinutes: 15 | 30 | 60) {
    setError(''); setSuccess(''); setCreatingBlock(true)
    try {
      await request<ExpressBlock>(`/barbers/${barberId}/express-blocks`, {
        method: 'POST', body: JSON.stringify({ durationMinutes }),
      }, token)
      setSuccess(`Agenda bloqueada por ${durationMinutes} minutos.`)
      setBlockMenuOpen(false)
      loadBlocks()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível bloquear a agenda.')
      setBlockMenuOpen(false)
    } finally {
      setCreatingBlock(false)
    }
  }

  async function handleDeleteBlock(blockId: string) {
    try {
      await request(`/barbers/${barberId}/express-blocks/${blockId}`, { method: 'DELETE' }, token)
      setBlocks((prev) => prev.filter((b) => b.blockId !== blockId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível remover o bloqueio.')
    }
  }

  async function handleCall(id: string) {
    setError(''); setSuccess(''); setCallingId(id)
    try {
      await request(`/appointments/${id}/call-client`, { method: 'POST' }, token)
      setSuccess('Cliente chamado! Notificação enviada.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível chamar o cliente.')
    } finally {
      setCallingId(null)
    }
  }

  const activeGoal = goals[0]
  const customLabel = customDate
    ? new Date(customDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    : 'Data'

  return (
    <div className="flex flex-col min-h-screen pb-20 lg:pb-4">
      <div className="lg:hidden">
        <TopBar title="Minha Agenda" right={<Avatar name={session.user.name} size={36} />} />
      </div>
      <main className="flex-grow w-full max-w-[900px] mx-auto px-4 md:px-8 py-4 lg:py-8">
        <div className="mb-4 hidden lg:block">
          <h1 className="text-[28px] font-bold text-on-surface tracking-tight">Minha Agenda</h1>
        </div>

        {/* Resumo: avaliações, meta e bloqueio express */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {/* Avaliações */}
          <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-3">
            <p className="text-[11px] font-medium text-on-surface-variant mb-0.5">Avaliações</p>
            <div className="flex items-center gap-1.5">
              <Icon name="star" filled className="text-[20px] text-yellow-500" />
              <span className="text-[18px] font-bold text-on-surface">{reviews ? reviews.average.toFixed(1) : '—'}</span>
              <span className="text-[12px] text-on-surface-variant">({reviews?.count ?? 0})</span>
            </div>
          </div>
          {/* Meta */}
          <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-3">
            <p className="text-[11px] font-medium text-on-surface-variant mb-1">Meta do período</p>
            {activeGoal ? (
              <>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[14px] font-bold text-on-surface">{activeGoal.completed}/{activeGoal.targetAppointments}</span>
                  <span className="text-[11px] text-on-surface-variant">{activeGoal.progressPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${activeGoal.progressPct}%` }} />
                </div>
              </>
            ) : (
              <span className="text-[12px] text-on-surface-variant">Nenhuma meta definida</span>
            )}
          </div>
          {/* Bloqueio express */}
          <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-3 relative">
            <p className="text-[11px] font-medium text-on-surface-variant mb-1">Pausa rápida</p>
            <button
              onClick={() => setBlockMenuOpen((v) => !v)}
              disabled={creatingBlock}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-secondary-fixed text-on-secondary-container hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              <Icon name="block" className="text-[16px]" />
              {creatingBlock ? 'Bloqueando...' : 'Bloquear agenda'}
            </button>
            {blockMenuOpen && (
              <div className="absolute z-20 left-3 right-3 mt-1 bg-surface-container-lowest border border-on-surface/15 rounded-lg shadow-lg p-1 flex gap-1">
                {[15, 30, 60].map((d) => (
                  <button
                    key={d}
                    onClick={() => handleCreateBlock(d as 15 | 30 | 60)}
                    className="flex-1 px-2 py-1.5 rounded-md text-[12px] font-semibold text-on-surface hover:bg-primary-fixed transition-colors"
                  >
                    {d}min
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bloqueios ativos hoje */}
        {blocks.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {blocks.map((b) => (
              <span key={b.blockId} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-surface-container-high text-on-surface-variant">
                <Icon name="block" className="text-[15px]" />
                {new Date(b.startTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {'–'}
                {new Date(b.endTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                <button onClick={() => handleDeleteBlock(b.blockId)} aria-label="Remover bloqueio" className="hover:text-primary">
                  <Icon name="close" className="text-[15px]" />
                </button>
              </span>
            ))}
          </div>
        )}

        {success && <div className="mb-4"><SuccessBanner message={success} /></div>}

        {/* Filtros de período + data personalizada */}
        <div className="flex items-center gap-2 mb-3 overflow-x-auto">
          {AGENDA_PERIOD_CHIPS.map(({ key, label }) => {
            const isActive = filter === key
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                {label}
              </button>
            )
          })}
          {/* Botão calendário (datas personalizadas) — input nativo sobreposto */}
          <label
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              filter === 'custom'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
            title="Escolher data específica"
          >
            <Icon name="calendar_month" className="text-[18px]" />
            {filter === 'custom' && <span>{customLabel}</span>}
            <input
              type="date"
              value={customDate}
              onChange={(e) => { setCustomDate(e.target.value); setFilter('custom') }}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label="Data específica"
            />
          </label>
        </div>

        {/* Subfiltros de status */}
        <div className="flex flex-wrap gap-2 mb-5">
          {AGENDA_STATUS_CHIPS.map(({ key, label }) => {
            const isActive = statusFilter === key
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-colors ${
                  isActive
                    ? 'border-secondary text-secondary bg-secondary-fixed/40'
                    : 'border-on-surface/15 text-on-surface-variant hover:border-on-surface/30 hover:text-on-surface'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-container-lowest rounded-2xl p-4 h-28 animate-pulse shadow-sm" />
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icon name="event_busy" className="text-[64px] text-surface-variant mb-4" />
            <h3 className="text-[20px] font-bold text-on-surface mb-1">Nenhum atendimento neste filtro</h3>
            <p className="text-[16px] text-on-surface-variant">Tente outro período ou status.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((appt) => {
              const start = new Date(appt.startTimestamp)
              const end = new Date(appt.endTimestamp)
              return (
                <div
                  key={appt.appointmentId}
                  className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow border border-on-surface/5"
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={appt.clientName ?? '?'} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[16px] font-bold text-on-surface truncate">{appt.clientName ?? '—'}</p>
                        <StatusBadge status={appt.status} />
                      </div>
                      <p className="flex items-center gap-1 text-[13px] font-medium text-on-surface-variant mt-0.5">
                        <Icon name="schedule" className="text-[16px]" />
                        <span>
                          {start.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                          {' · '}
                          {start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {' — '}
                          {end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-on-surface/10 flex flex-col gap-1.5">
                    {appt.services.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-[13px]">
                        <span className="text-on-surface-variant truncate pr-2">{s.name}</span>
                        <span className="text-on-surface font-semibold whitespace-nowrap">{money.format(s.price)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[12px] text-on-surface-variant">Total</span>
                      <span className="text-[15px] font-bold text-on-surface">{money.format(appt.amountToPay)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {appt.clientId && (
                        <button
                          onClick={() => setNotesFor({ clientId: appt.clientId!, clientName: appt.clientName ?? 'Cliente' })}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg text-[12px] font-semibold text-on-surface-variant border border-on-surface/15 hover:bg-surface-container transition-colors"
                        >
                          <Icon name="sticky_note_2" className="text-[15px]" />
                          Notas
                        </button>
                      )}
                      {appt.status === 'CONFIRMED' && (
                        <button
                          onClick={() => handleCall(appt.appointmentId)}
                          disabled={callingId === appt.appointmentId}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg text-[12px] font-semibold text-secondary border border-secondary hover:bg-secondary-fixed/40 disabled:opacity-40 transition-colors"
                        >
                          <Icon name="campaign" className="text-[15px]" />
                          {callingId === appt.appointmentId ? 'Chamando...' : 'Chamar'}
                        </button>
                      )}
                      {appt.status === 'CONFIRMED' && (
                        <button
                          onClick={() => handleConclude(appt.appointmentId)}
                          disabled={concludingId === appt.appointmentId}
                          className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-primary text-on-primary hover:bg-primary-container disabled:opacity-40 transition-colors shadow-sm active:scale-95"
                        >
                          {concludingId === appt.appointmentId ? 'Concluindo...' : 'Concluir'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      {notesFor && (
        <ClientNotesModal session={session} client={notesFor} onClose={() => setNotesFor(null)} />
      )}
    </div>
  )
}

function ClientNotesModal({
  session,
  client,
  onClose,
}: {
  session: Session
  client: { clientId: string; clientName: string }
  onClose: () => void
}) {
  const [notes, setNotes] = useState<ClientNote[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    request<ClientNote[]>(`/clients/${client.clientId}/notes`, {}, session.accessToken)
      .then(setNotes)
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false))
  }, [client.clientId, session.accessToken])

  async function addNote() {
    if (!text.trim()) return
    setSaving(true); setError('')
    try {
      const note = await request<ClientNote>(`/clients/${client.clientId}/notes`, {
        method: 'POST', body: JSON.stringify({ noteText: text.trim() }),
      }, session.accessToken)
      // POST retorna sem authorName; recarrega a lista para padronizar.
      setNotes((prev) => [{ ...note, authorName: session.user.name }, ...prev])
      setText('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a nota.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-surface-container-lowest w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-on-surface/10">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={client.clientName} size={36} />
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-on-surface truncate">{client.clientName}</p>
              <p className="text-[11px] text-on-surface-variant">Prancheta de notas</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-1 text-on-surface-variant hover:text-on-surface">
            <Icon name="close" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-2 overflow-y-auto flex-1">
          {error && <ErrorBanner message={error} />}
          <div className="flex gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Preferências, alergias, observações..."
              rows={2}
              className="flex-1 px-3 py-2 bg-surface-container border border-on-surface/10 rounded-lg text-[13px] text-on-surface resize-none focus:outline-none focus:border-secondary"
            />
            <button
              onClick={addNote}
              disabled={saving || !text.trim()}
              className="px-3 rounded-lg text-[12px] font-semibold bg-primary text-on-primary disabled:opacity-40 transition-opacity"
            >
              {saving ? '...' : 'Salvar'}
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col gap-2 mt-2">
              {[1, 2].map((i) => <div key={i} className="h-14 bg-surface-container rounded-lg animate-pulse" />)}
            </div>
          ) : notes.length === 0 ? (
            <p className="text-[13px] text-on-surface-variant text-center py-6">Nenhuma nota ainda.</p>
          ) : (
            <div className="flex flex-col gap-2 mt-1">
              {notes.map((n) => (
                <div key={n.id} className="bg-surface-container rounded-lg p-3">
                  <p className="text-[13px] text-on-surface whitespace-pre-wrap break-words">{n.noteText}</p>
                  <p className="text-[11px] text-on-surface-variant mt-1">
                    {n.authorName} · {new Date(n.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- Centro de Comando (ADMIN) ----------

type AdminTab = 'overview' | 'coupons' | 'vacations' | 'barbers' | 'services' | 'rules' | 'connection' | 'analytics'

type AnalyticsRange = 'LAST_7_DAYS' | 'LAST_14_DAYS' | 'CURRENT_MONTH'
type AnalyticsData = {
  range: AnalyticsRange
  generalTimeline: { date: string; formattedDate: string; revenue: number }[]
  barberBreakdown: { barberId: string; barberName: string; revenue: number }[]
  dayOfWeekBreakdown: { dayIndex: number; dayName: string; revenue: number }[]
}
type GlobalSettingsData = { noShowToleranceMinutes: number; defaultCashbackPct: number }

type AdminBarberRow = {
  barberId: string
  name: string
  email: string
  phone: string | null
  isActive: boolean
  totalAppointmentsConcluded: number
}
type AdminServiceRow = {
  serviceId: string
  name: string
  price: number
  durationMinutes: number
  isActive: boolean
  iconId?: string | null
  totalAppointments: number
}

type MeResponse = {
  userId: string
  name: string
  email: string
  phone: string | null
  notificationPushEnabled: boolean
  notificationWhatsappEnabled: boolean
  role: string
  hasPassword: boolean
  is2faEnabled: boolean
}

function SettingsPage({ session, onSignOut, onDisconnect, onProfileChange }: {
  session: Session
  onSignOut: () => void
  onDisconnect: () => void
  onProfileChange: (patch: Partial<User>) => void
}) {
  const token = session.accessToken
  const [me, setMe] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [profile, setProfile] = useState({ name: '', phone: '', push: true, whatsapp: true })
  const [pwd, setPwd] = useState({ current: '', next: '' })
  const [delPwd, setDelPwd] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    request<MeResponse>('/users/me', {}, token)
      .then((data) => {
        setMe(data)
        setProfile({ name: data.name, phone: data.phone ?? '', push: data.notificationPushEnabled, whatsapp: data.notificationWhatsappEnabled })
      })
      .catch((c) => setError(c.message))
      .finally(() => setLoading(false))
  }, [token])

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(''); setSuccess('')
    try {
      const r = await request<MeResponse>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone || undefined,
          notificationPushEnabled: profile.push,
          notificationWhatsappEnabled: profile.whatsapp,
        }),
      }, token)
      setMe(r)
      onProfileChange({ name: r.name, phone: r.phone })
      setSuccess('Perfil atualizado.')
    } catch (c) {
      setError(c instanceof Error ? c.message : 'Não foi possível salvar.')
    } finally { setBusy(false) }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(''); setSuccess('')
    try {
      await request('/users/me/password', { method: 'PUT', body: JSON.stringify({ currentPassword: pwd.current, newPassword: pwd.next }) }, token)
      setPwd({ current: '', next: '' })
      setSuccess('Senha alterada.')
    } catch (c) {
      setError(c instanceof Error ? c.message : 'Não foi possível trocar a senha.')
    } finally { setBusy(false) }
  }

  async function deleteAccount() {
    setBusy(true); setError('')
    try {
      await request('/users/me', { method: 'DELETE', body: JSON.stringify({ currentPassword: delPwd }) }, token)
      onSignOut()
    } catch (c) {
      setError(c instanceof Error ? c.message : 'Não foi possível excluir a conta.')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen pb-20 lg:pb-4">
      <div className="lg:hidden"><TopBar title="Conta" /></div>
      <main className="flex-grow w-full max-w-[640px] mx-auto px-4 md:px-8 py-4 lg:py-8 flex flex-col gap-5">
        <div className="hidden lg:block">
          <h1 className="text-[28px] font-bold text-on-surface tracking-tight">Configurações</h1>
        </div>
        {error && <ErrorBanner message={error} />}
        {success && <SuccessBanner message={success} />}

        {loading || !me ? (
          <div className="h-40 bg-surface-container-lowest rounded-xl animate-pulse" />
        ) : (
          <>
            {/* Perfil + notificações */}
            <form onSubmit={saveProfile} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 flex flex-col gap-3">
              <h2 className="text-[15px] font-bold text-on-surface">Perfil</h2>
              <label className="text-[12px] text-on-surface-variant">Nome
                <input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} minLength={3} required className="h-11 px-3 mt-1 w-full bg-surface-container border border-on-surface/10 rounded-lg text-[13px] text-on-surface" />
              </label>
              <label className="text-[12px] text-on-surface-variant">E-mail (não editável)
                <input value={me.email} disabled className="h-11 px-3 mt-1 w-full bg-surface-container-high border border-on-surface/10 rounded-lg text-[13px] text-on-surface-variant" />
              </label>
              <label className="text-[12px] text-on-surface-variant">Telefone
                <input value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="+55..." className="h-11 px-3 mt-1 w-full bg-surface-container border border-on-surface/10 rounded-lg text-[13px] text-on-surface" />
              </label>
              <label className="flex items-center justify-between gap-3 py-1">
                <span className="text-[13px] text-on-surface">Notificações Push</span>
                <input type="checkbox" checked={profile.push} onChange={(e) => setProfile((p) => ({ ...p, push: e.target.checked }))} className="w-4 h-4 accent-primary" />
              </label>
              <label className="flex items-center justify-between gap-3 py-1">
                <span className="text-[13px] text-on-surface">Notificações WhatsApp</span>
                <input type="checkbox" checked={profile.whatsapp} onChange={(e) => setProfile((p) => ({ ...p, whatsapp: e.target.checked }))} className="w-4 h-4 accent-primary" />
              </label>
              <button disabled={busy} className="h-11 rounded-lg bg-primary text-on-primary text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40">Salvar perfil</button>
            </form>

            {/* Senha */}
            {me.hasPassword && (
              <form onSubmit={savePassword} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 flex flex-col gap-3">
                <h2 className="text-[15px] font-bold text-on-surface">Trocar senha</h2>
                <input type="password" value={pwd.current} onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))} placeholder="Senha atual" required className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                <input type="password" value={pwd.next} onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} placeholder="Nova senha (mín. 6)" minLength={6} required className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                <button disabled={busy} className="h-11 rounded-lg bg-secondary text-on-secondary text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40">Alterar senha</button>
              </form>
            )}

            {/* Segurança — 2FA TOTP (FEAT-076) */}
            {me.hasPassword && (
              <TwoFactorSettings
                token={token}
                enabled={me.is2faEnabled}
                onChange={(v) => setMe((m) => (m ? { ...m, is2faEnabled: v } : m))}
              />
            )}

            {/* Desconectar barbearia (FEAT-074 RN04) — apenas cliente */}
            {me.role === 'CLIENT' && (
              <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 flex flex-col gap-3">
                <h2 className="text-[15px] font-bold text-on-surface">Barbearia conectada</h2>
                <p className="text-[12px] text-on-surface-variant">Desconectar encerra sua sessão e volta para a tela de conexão por código.</p>
                <button onClick={onDisconnect} className="h-11 rounded-lg border border-on-surface/20 text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant hover:bg-surface-container-high inline-flex items-center justify-center gap-2">
                  <Icon name="link_off" className="text-[18px]" />
                  Desconectar barbearia
                </button>
              </div>
            )}

            {/* Excluir conta (apenas cliente) */}
            {me.role === 'CLIENT' && (
              <div className="bg-surface-container-lowest border border-error/30 rounded-xl p-4 flex flex-col gap-3">
                <h2 className="text-[15px] font-bold text-error">Excluir minha conta</h2>
                <p className="text-[12px] text-on-surface-variant">Sua conta será anonimizada (LGPD) e o saldo de cashback será perdido permanentemente. Cancele agendamentos futuros antes.</p>
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)} className="h-11 rounded-lg border border-error text-error text-[12px] font-semibold uppercase tracking-wider hover:bg-error-container">Excluir conta</button>
                ) : (
                  <>
                    <input type="password" value={delPwd} onChange={(e) => setDelPwd(e.target.value)} placeholder="Confirme com sua senha" className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                    <div className="flex gap-2">
                      <button onClick={() => { setConfirmDelete(false); setDelPwd('') }} className="flex-1 h-11 rounded-lg border border-on-surface/20 text-[12px] font-semibold text-on-surface-variant">Cancelar</button>
                      <button onClick={deleteAccount} disabled={busy || !delPwd} className="flex-1 h-11 rounded-lg bg-error text-on-error text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40">Confirmar exclusão</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

// FEAT-076: card de Segurança (2FA) em Configurações. Ativação exige provar o 1º código (RN02).
function TwoFactorSettings({ token, enabled, onChange }: {
  token: string
  enabled: boolean
  onChange: (v: boolean) => void
}) {
  const [setupData, setSetupData] = useState<{ otpAuthUri: string; manualSecretKey: string } | null>(null)
  const [code, setCode] = useState('')
  const [disablePwd, setDisablePwd] = useState('')
  const [showDisable, setShowDisable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, 6)

  async function startSetup() {
    setBusy(true); setError('')
    try {
      setSetupData(await request<{ otpAuthUri: string; manualSecretKey: string }>('/users/me/2fa/setup', { method: 'POST' }, token))
    } catch (c) { setError(c instanceof Error ? c.message : 'Falha ao iniciar 2FA.') } finally { setBusy(false) }
  }
  async function confirmEnable(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await request('/users/me/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) }, token)
      setSetupData(null); setCode(''); onChange(true)
    } catch (c) { setError(c instanceof Error ? c.message : 'Código inválido.') } finally { setBusy(false) }
  }
  async function disable(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await request('/users/me/2fa', { method: 'DELETE', body: JSON.stringify({ currentPassword: disablePwd, code }) }, token)
      setShowDisable(false); setDisablePwd(''); setCode(''); onChange(false)
    } catch (c) { setError(c instanceof Error ? c.message : 'Não foi possível desativar.') } finally { setBusy(false) }
  }

  const input = 'h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]'
  return (
    <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-on-surface">Verificação em duas etapas</h2>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${enabled ? 'bg-emerald-500/15 text-emerald-600' : 'bg-on-surface/10 text-on-surface-variant'}`}>
          {enabled ? 'Ativa' : 'Inativa'}
        </span>
      </div>
      <p className="text-[12px] text-on-surface-variant">Proteja sua conta exigindo um código do app autenticador (Google Authenticator, Authy) ao entrar.</p>
      {error && <ErrorBanner message={error} />}

      {!enabled && !setupData && (
        <button onClick={startSetup} disabled={busy} className="h-11 rounded-lg bg-secondary text-on-secondary text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40 inline-flex items-center justify-center gap-2">
          <Icon name="add_moderator" className="text-[18px]" />Habilitar 2FA
        </button>
      )}

      {!enabled && setupData && (
        <form onSubmit={confirmEnable} className="flex flex-col items-center gap-3">
          <p className="text-[12px] text-on-surface-variant self-start">1. Escaneie o QR Code no seu app autenticador:</p>
          <div className="bg-white p-3 rounded-xl"><QRCodeCanvas value={setupData.otpAuthUri} size={172} level="M" /></div>
          <p className="text-[11px] text-on-surface-variant self-start">Ou insira manualmente a chave:</p>
          <code className="text-[12px] font-mono bg-surface-container px-3 py-1.5 rounded-lg break-all w-full text-center">{setupData.manualSecretKey}</code>
          <p className="text-[12px] text-on-surface-variant self-start">2. Digite o código gerado para confirmar:</p>
          <input autoFocus inputMode="numeric" value={code} onChange={(e) => setCode(onlyDigits(e.target.value))} placeholder="000000" maxLength={6} className={`${input} w-full text-center text-[20px] tracking-[0.4em] font-bold`} />
          <div className="flex gap-2 w-full">
            <button type="button" onClick={() => { setSetupData(null); setCode('') }} className="flex-1 h-11 rounded-lg border border-on-surface/20 text-[12px] font-semibold text-on-surface-variant">Cancelar</button>
            <button disabled={busy || code.length !== 6} className="flex-1 h-11 rounded-lg bg-primary text-on-primary text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40">Ativar</button>
          </div>
        </form>
      )}

      {enabled && !showDisable && (
        <button onClick={() => { setShowDisable(true); setError('') }} className="h-11 rounded-lg border border-error text-error text-[12px] font-semibold uppercase tracking-wider hover:bg-error-container">Desativar 2FA</button>
      )}
      {enabled && showDisable && (
        <form onSubmit={disable} className="flex flex-col gap-2">
          <p className="text-[12px] text-on-surface-variant">Confirme com sua senha e um código atual do app:</p>
          <input type="password" value={disablePwd} onChange={(e) => setDisablePwd(e.target.value)} placeholder="Senha atual" required className={input} />
          <input inputMode="numeric" value={code} onChange={(e) => setCode(onlyDigits(e.target.value))} placeholder="Código (6 dígitos)" maxLength={6} required className={input} />
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowDisable(false); setDisablePwd(''); setCode('') }} className="flex-1 h-11 rounded-lg border border-on-surface/20 text-[12px] font-semibold text-on-surface-variant">Cancelar</button>
            <button disabled={busy || !disablePwd || code.length !== 6} className="flex-1 h-11 rounded-lg bg-error text-on-error text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40">Confirmar</button>
          </div>
        </form>
      )}
    </div>
  )
}

function AdminCommandCenter({ session }: { session: Session }) {
  const token = session.accessToken
  const [date, setDate] = useState(today())
  const [tab, setTab] = useState<AdminTab>('overview')
  // FEAT-080: dashboard/grid via React Query — revalidação passiva (window focus + polling).
  // queryKey inclui a data → troca de data refaz só esta query (invalidação granular, RN03).
  const { data: dashboard = null, isLoading: dashboardLoading } = useQuery({
    queryKey: ['admin-dashboard', date],
    queryFn: () => request<AdminDashboard>(`/admin/dashboard?date=${date}`, {}, token),
  })
  const queryClient = useQueryClient()
  // RN03: invalida só a query do dashboard (grid/alertas) após ações que a afetam.
  const refreshDashboard = () => queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })

  // FEAT-081: analytics financeiro (BFF) com filtro temporal; React Query (window-focus/polling).
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('LAST_7_DAYS')
  const { data: analytics = null, isLoading: analyticsLoading } = useQuery({
    queryKey: ['admin-analytics', analyticsRange],
    queryFn: () => request<AnalyticsData>(`/admin/analytics?range=${analyticsRange}`, {}, token),
  })
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [coupons, setCoupons] = useState<CouponItem[]>([])
  const [vacations, setVacations] = useState<VacationBlock[]>([])
  const [adminBarbers, setAdminBarbers] = useState<AdminBarberRow[]>([])
  const [adminServices, setAdminServices] = useState<AdminServiceRow[]>([])
  const [rulesForm, setRulesForm] = useState<GlobalSettingsData>({ noShowToleranceMinutes: 15, defaultCashbackPct: 10 })
  const [shop, setShop] = useState<{ id: string; name: string; slug: string; connectionCode: string; logoUrl: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [couponForm, setCouponForm] = useState({
    code: '',
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_VALUE',
    discountValue: '10',
    maxUsesGlobal: '',
    expiresAt: dateTimeLocalInDays(30),
  })
  const [vacationForm, setVacationForm] = useState({ barberId: '', startDate: tomorrow(), endDate: tomorrow() })
  const [barberForm, setBarberForm] = useState({ name: '', email: '', phone: '', initialPassword: '' })
  const [serviceForm, setServiceForm] = useState({ name: '', durationMinutes: '30', price: '35', iconId: '' })
  const [icons, setIcons] = useState<ServiceIconItem[]>([])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [barberList, couponList, vacationList, adminBarberList, adminServiceList, settingsData, iconList] = await Promise.all([
        request<Barber[]>('/barbers'),
        request<CouponItem[]>('/admin/coupons', {}, token),
        request<VacationBlock[]>('/admin/vacation-blocks', {}, token),
        request<AdminBarberRow[]>('/admin/barbers', {}, token),
        request<AdminServiceRow[]>('/admin/services', {}, token),
        request<GlobalSettingsData>('/admin/global-settings', {}, token),
        request<ServiceIconItem[]>('/admin/icons', {}, token),
      ])
      setBarbers(barberList)
      setCoupons(couponList)
      setVacations(vacationList)
      setAdminBarbers(adminBarberList)
      setAdminServices(adminServiceList)
      setRulesForm({ noShowToleranceMinutes: settingsData.noShowToleranceMinutes, defaultCashbackPct: Number(settingsData.defaultCashbackPct) })
      setIcons(iconList)
      setVacationForm((prev) => ({ ...prev, barberId: prev.barberId || barberList[0]?.id || '' }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o painel administrativo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadAll()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // FEAT-074: carrega código de conexão sob demanda ao abrir a aba Conexão.
  useEffect(() => {
    if (tab !== 'connection' || shop) return
    request<{ id: string; name: string; slug: string; connectionCode: string; logoUrl: string | null }>('/admin/barbershop', {}, token)
      .then(setShop)
      .catch((c) => setError(c instanceof Error ? c.message : 'Não foi possível carregar a conexão.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  async function reloadDate(nextDate: string) {
    setDate(nextDate)
  }

  async function createCouponSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true); setError(''); setSuccess('')
    try {
      await request<CouponItem>('/admin/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: couponForm.code.trim().toUpperCase(),
          discountType: couponForm.discountType,
          discountValue: Number(couponForm.discountValue),
          maxUsesGlobal: couponForm.maxUsesGlobal ? Number(couponForm.maxUsesGlobal) : null,
          expiresAt: new Date(couponForm.expiresAt).toISOString(),
        }),
      }, token)
      setSuccess('Cupom criado.')
      setCouponForm((prev) => ({ ...prev, code: '' }))
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o cupom.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteCoupon(id: string) {
    setSaving(true); setError(''); setSuccess('')
    try {
      await request(`/admin/coupons/${id}`, { method: 'DELETE' }, token)
      setSuccess('Cupom removido.')
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível remover o cupom.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleBarberStatus(barberId: string, isActive: boolean) {
    setSaving(true); setError(''); setSuccess('')
    try {
      const r = await request<{ name: string; newStatus: boolean; orphanedAppointments: { appointmentId: string }[] }>(
        `/admin/barbers/${barberId}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }, token,
      )
      const orphans = r.orphanedAppointments?.length ?? 0
      setSuccess(
        `${r.name} ${r.newStatus ? 'ativado' : 'inativado'}.` +
        (orphans > 0 ? ` Atenção: ${orphans} agendamento(s) futuro(s) confirmado(s) a realocar.` : ''),
      )
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível alterar o barbeiro.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleServiceStatus(serviceId: string, isActive: boolean) {
    setSaving(true); setError(''); setSuccess('')
    try {
      const r = await request<{ message: string }>(
        `/admin/services/${serviceId}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }, token,
      )
      setSuccess(r.message)
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível alterar o serviço.')
    } finally {
      setSaving(false)
    }
  }

  async function saveRules(event: FormEvent) {
    event.preventDefault()
    setSaving(true); setError(''); setSuccess('')
    try {
      const r = await request<GlobalSettingsData>('/admin/global-settings', {
        method: 'PUT',
        body: JSON.stringify({
          noShowToleranceMinutes: Number(rulesForm.noShowToleranceMinutes),
          defaultCashbackPct: Number(rulesForm.defaultCashbackPct),
        }),
      }, token)
      setRulesForm({ noShowToleranceMinutes: r.noShowToleranceMinutes, defaultCashbackPct: Number(r.defaultCashbackPct) })
      setSuccess('Regras da barbearia atualizadas.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar as regras.')
    } finally {
      setSaving(false)
    }
  }

  async function createBarberSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true); setError(''); setSuccess('')
    try {
      const r = await request<{ name: string }>('/admin/barbers', {
        method: 'POST',
        body: JSON.stringify({
          name: barberForm.name.trim(),
          email: barberForm.email.trim(),
          phone: barberForm.phone.trim(),
          initialPassword: barberForm.initialPassword,
        }),
      }, token)
      setSuccess(`Barbeiro ${r.name} criado.`)
      setBarberForm({ name: '', email: '', phone: '', initialPassword: '' })
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o barbeiro.')
    } finally {
      setSaving(false)
    }
  }

  async function createServiceSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true); setError(''); setSuccess('')
    try {
      const r = await request<{ name: string }>('/admin/services', {
        method: 'POST',
        body: JSON.stringify({
          name: serviceForm.name.trim(),
          durationMinutes: Number(serviceForm.durationMinutes),
          price: Number(serviceForm.price),
          ...(serviceForm.iconId ? { iconId: serviceForm.iconId } : {}),
        }),
      }, token)
      setSuccess(`Serviço ${r.name} criado.`)
      setServiceForm({ name: '', durationMinutes: '30', price: '35', iconId: '' })
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o serviço.')
    } finally {
      setSaving(false)
    }
  }

  // FEAT-082: upload de SVG customizado (lê o arquivo como texto e envia).
  async function uploadIcon(file: File) {
    if (file.type !== 'image/svg+xml' && !file.name.toLowerCase().endsWith('.svg')) {
      setError('Envie um arquivo .svg.'); return
    }
    setSaving(true); setError(''); setSuccess('')
    try {
      const svgContent = await file.text()
      const r = await request<{ id: string; message: string }>('/admin/icons', {
        method: 'POST',
        body: JSON.stringify({ name: file.name.replace(/\.svg$/i, '').slice(0, 50) || 'Ícone', svgContent }),
      }, token)
      const list = await request<ServiceIconItem[]>('/admin/icons', {}, token)
      setIcons(list)
      setServiceForm((p) => ({ ...p, iconId: r.id }))
      setSuccess(r.message)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o ícone.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteBarberRow(barberId: string) {
    setSaving(true); setError(''); setSuccess('')
    try {
      await request(`/admin/barbers/${barberId}`, { method: 'DELETE' }, token)
      setSuccess('Barbeiro excluído.')
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível excluir o barbeiro.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteServiceRow(serviceId: string) {
    setSaving(true); setError(''); setSuccess('')
    try {
      await request(`/admin/services/${serviceId}`, { method: 'DELETE' }, token)
      setSuccess('Serviço excluído.')
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível excluir o serviço.')
    } finally {
      setSaving(false)
    }
  }

  async function createVacation(event: FormEvent) {
    event.preventDefault()
    setSaving(true); setError(''); setSuccess('')
    try {
      await request<VacationBlock>('/admin/vacation-blocks', {
        method: 'POST',
        body: JSON.stringify(vacationForm),
      }, token)
      setSuccess('Férias cadastradas.')
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar férias.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteVacation(id: string) {
    setSaving(true); setError(''); setSuccess('')
    try {
      await request(`/admin/vacation-blocks/${id}`, { method: 'DELETE' }, token)
      setSuccess('Férias removidas.')
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível remover férias.')
    } finally {
      setSaving(false)
    }
  }

  async function applyNoShow(appointmentId: string) {
    setSaving(true); setError(''); setSuccess('')
    try {
      await request(`/admin/appointments/${appointmentId}/no-show`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cliente ultrapassou a tolerância limite de 15 minutos e não avisou.' }),
      }, token)
      setSuccess('No-show aplicado e carteira zerada quando havia saldo.')
      void refreshDashboard()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível aplicar No-Show.')
    } finally {
      setSaving(false)
    }
  }

  async function resolveAlert(id: string) {
    setSaving(true); setError(''); setSuccess('')
    try {
      await request(`/admin/alerts/${id}/resolve`, { method: 'PATCH' }, token)
      setSuccess('Alerta resolvido.')
      void refreshDashboard()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível resolver o alerta.')
    } finally {
      setSaving(false)
    }
  }

  async function runWinBack() {
    setSaving(true); setError(''); setSuccess('')
    try {
      const result = await request<{ published: number; skipped: number; failures: number }>('/admin/campaigns/win-back/run', {
        method: 'POST',
        body: JSON.stringify({ date }),
      }, token)
      setSuccess(`Win-back enfileirado: ${result.published} enviado(s), ${result.skipped} ignorado(s), ${result.failures} falha(s).`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível executar o Win-back.')
    } finally {
      setSaving(false)
    }
  }

  const report = dashboard?.report
  const grid = dashboard?.grid
  const alerts = dashboard?.alerts ?? []

  return (
    <div className="flex flex-col min-h-screen pb-20 lg:pb-4">
      <div className="lg:hidden">
        <TopBar title="Comando" right={<Avatar name={session.user.name} size={36} />} />
      </div>
      <main className="flex-grow w-full max-w-[1200px] mx-auto px-4 md:px-8 py-4 lg:py-8">
        <div className="hidden lg:flex items-end justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[28px] font-bold text-on-surface tracking-tight">Centro de Comando</h1>
            <p className="text-[14px] text-on-surface-variant">Visão executiva e ações operacionais do dia.</p>
          </div>
          <label className="flex items-center gap-2 text-[12px] font-semibold text-on-surface-variant">
            <Icon name="calendar_month" className="text-[18px]" />
            <input type="date" value={date} onChange={(e) => reloadDate(e.target.value)} className="h-10 px-3 bg-surface-container-lowest border border-on-surface/10 rounded-lg text-[13px] text-on-surface" />
          </label>
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
        {success && <div className="mb-4"><SuccessBanner message={success} /></div>}

        {(loading || dashboardLoading) && !dashboard ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-surface-container-lowest rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <AdminMetric icon="payments" label="Receita líquida" value={money.format(report?.netRevenue ?? 0)} />
              <AdminMetric icon="receipt_long" label="Ticket médio" value={money.format(report?.averageTicket ?? 0)} />
              <AdminMetric icon="person_search" label="LTV estimado" value={money.format(report?.estimatedLtv ?? 0)} />
              <AdminMetric icon="event_busy" label="Ociosidade" value={`${report?.idleMinutes ?? 0} min`} tone={(report?.idleMinutes ?? 0) > 0 ? 'warn' : 'normal'} />
            </div>

            {alerts.length > 0 && (
              <div className="mb-4 bg-error-container border border-error/25 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="warning" filled className="text-error" />
                  <h2 className="text-[15px] font-bold text-on-error-container">Radar de detratores</h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {alerts.map((alert) => {
                    const phone = alert.appointment.client.phone
                    const whatsapp = phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : null
                    return (
                      <div key={alert.id} className="bg-surface-container-lowest border border-error/20 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-on-surface truncate">{alert.appointment.client.name}</p>
                            <p className="text-[12px] text-on-surface-variant truncate">{alert.appointment.barber.name} · {alert.appointment.review?.rating ?? '?'} estrelas</p>
                          </div>
                          <button onClick={() => resolveAlert(alert.id)} disabled={saving} className="p-1 text-on-surface-variant hover:text-primary" aria-label="Resolver alerta">
                            <Icon name="done" className="text-[18px]" />
                          </button>
                        </div>
                        <p className="text-[12px] text-on-surface mt-2">{alert.appointment.review?.comment || 'Sem comentário.'}</p>
                        {whatsapp && (
                          <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-[12px] font-semibold text-secondary">
                            <Icon name="chat" className="text-[15px]" />
                            WhatsApp
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-4 overflow-x-auto">
              {[
                { key: 'overview' as const, label: 'Grid', icon: 'view_timeline' },
                { key: 'coupons' as const, label: 'Cupons', icon: 'sell' },
                { key: 'vacations' as const, label: 'Férias', icon: 'beach_access' },
                { key: 'barbers' as const, label: 'Barbeiros', icon: 'group' },
                { key: 'services' as const, label: 'Serviços', icon: 'content_cut' },
                { key: 'analytics' as const, label: 'Análises', icon: 'monitoring' },
                { key: 'rules' as const, label: 'Regras', icon: 'tune' },
                { key: 'connection' as const, label: 'Conexão', icon: 'qr_code_2' },
              ].map((item) => (
                <button key={item.key} onClick={() => setTab(item.key)} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold whitespace-nowrap border transition-colors ${tab === item.key ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest text-on-surface-variant border-on-surface/10 hover:text-on-surface'}`}>
                  <Icon name={item.icon} className="text-[16px]" />
                  {item.label}
                </button>
              ))}
            </div>

            {tab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
                <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-on-surface/10 flex items-center justify-between">
                    <h2 className="text-[15px] font-bold text-on-surface">Grid global</h2>
                    <button onClick={runWinBack} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-secondary-fixed text-on-secondary-container disabled:opacity-40">
                      <Icon name="campaign" className="text-[15px]" />
                      Win-back
                    </button>
                  </div>
                  <div className="divide-y divide-on-surface/10">
                    {(grid?.appointments ?? []).length === 0 ? (
                      <p className="p-4 text-[13px] text-on-surface-variant">Nenhum agendamento neste dia.</p>
                    ) : (
                      grid!.appointments.map((appt) => (
                        <div key={appt.appointmentId} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                          <div className="w-20 shrink-0">
                            <p className="text-[18px] font-bold text-on-surface">{timeLabel(appt.startTimestamp)}</p>
                            <p className="text-[11px] text-on-surface-variant">{timeLabel(appt.endTimestamp)}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[14px] font-bold text-on-surface truncate">{appt.clientName ?? 'Cliente'}</p>
                              <StatusBadge status={appt.status} />
                            </div>
                            <p className="text-[12px] text-on-surface-variant truncate">{appt.barberName} · {appt.services.map((s) => s.name).join(', ')}</p>
                          </div>
                          <div className="flex items-center gap-2 justify-between md:justify-end">
                            <span className="text-[13px] font-bold text-on-surface">{money.format(appt.amountToPay)}</span>
                            {appt.status === 'CONFIRMED' && (
                              <button onClick={() => applyNoShow(appt.appointmentId)} disabled={saving} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[12px] font-semibold text-error border border-error/35 hover:bg-error-container disabled:opacity-40">
                                <Icon name="person_cancel" className="text-[15px]" />
                                No-show
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4">
                  <h2 className="text-[15px] font-bold text-on-surface mb-3">Mapa de ociosidade</h2>
                  <div className="flex flex-col gap-3">
                    {(report?.heatmap ?? []).map((row) => (
                      <div key={row.barberId}>
                        <div className="flex justify-between text-[12px] mb-1">
                          <span className="font-semibold text-on-surface">{row.barberName}</span>
                          <span className="text-on-surface-variant">{row.occupancyPct}%</span>
                        </div>
                        <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                          <div className="h-full bg-secondary rounded-full" style={{ width: `${Math.min(row.occupancyPct, 100)}%` }} />
                        </div>
                        <p className="text-[11px] text-on-surface-variant mt-1">{row.idleMinutes} min livres</p>
                      </div>
                    ))}
                    {(grid?.barbers ?? []).filter((b) => b.onVacation).map((barber) => (
                      <p key={barber.id} className="inline-flex items-center gap-1 text-[12px] text-on-surface-variant">
                        <Icon name="beach_access" className="text-[15px]" />
                        {barber.name} em férias
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'coupons' && (
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
                <form onSubmit={createCouponSubmit} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 flex flex-col gap-3">
                  <h2 className="text-[15px] font-bold text-on-surface">Novo cupom</h2>
                  <input value={couponForm.code} onChange={(e) => setCouponForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="CLIENTE20" className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <select value={couponForm.discountType} onChange={(e) => setCouponForm((p) => ({ ...p, discountType: e.target.value as 'PERCENTAGE' | 'FIXED_VALUE' }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]">
                    <option value="PERCENTAGE">Percentual</option>
                    <option value="FIXED_VALUE">Valor fixo</option>
                  </select>
                  <input type="number" min="0.01" step="0.01" value={couponForm.discountValue} onChange={(e) => setCouponForm((p) => ({ ...p, discountValue: e.target.value }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <input type="number" min="1" value={couponForm.maxUsesGlobal} onChange={(e) => setCouponForm((p) => ({ ...p, maxUsesGlobal: e.target.value }))} placeholder="Limite global opcional" className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <input type="datetime-local" value={couponForm.expiresAt} onChange={(e) => setCouponForm((p) => ({ ...p, expiresAt: e.target.value }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <button disabled={saving || !couponForm.code} className="h-11 rounded-lg bg-primary text-on-primary text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40">Criar</button>
                </form>
                <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl overflow-hidden">
                  {coupons.map((coupon) => (
                    <div key={coupon.id} className="p-4 border-b last:border-b-0 border-on-surface/10 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-bold text-on-surface">{coupon.code}</p>
                        <p className="text-[12px] text-on-surface-variant">{coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}%` : money.format(coupon.discountValue)} · {coupon.currentUses}/{coupon.maxUsesGlobal ?? '∞'} usos · vence {new Date(coupon.expiresAt).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <button onClick={() => deleteCoupon(coupon.id)} disabled={saving} className="p-2 text-on-surface-variant hover:text-error" aria-label="Remover cupom"><Icon name="delete" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'vacations' && (
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
                <form onSubmit={createVacation} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 flex flex-col gap-3">
                  <h2 className="text-[15px] font-bold text-on-surface">Bloquear férias</h2>
                  <select value={vacationForm.barberId} onChange={(e) => setVacationForm((p) => ({ ...p, barberId: e.target.value }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]">
                    {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <input type="date" value={vacationForm.startDate} onChange={(e) => setVacationForm((p) => ({ ...p, startDate: e.target.value }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <input type="date" value={vacationForm.endDate} onChange={(e) => setVacationForm((p) => ({ ...p, endDate: e.target.value }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <button disabled={saving || !vacationForm.barberId} className="h-11 rounded-lg bg-primary text-on-primary text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40">Cadastrar</button>
                </form>
                <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl overflow-hidden">
                  {vacations.length === 0 ? (
                    <p className="p-4 text-[13px] text-on-surface-variant">Nenhum bloqueio de férias.</p>
                  ) : vacations.map((block) => (
                    <div key={block.id} className="p-4 border-b last:border-b-0 border-on-surface/10 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-bold text-on-surface">{block.barber?.name ?? 'Barbeiro'}</p>
                        <p className="text-[12px] text-on-surface-variant">{dateOnlyLabel(block.startDate)} até {dateOnlyLabel(block.endDate)}</p>
                      </div>
                      <button onClick={() => deleteVacation(block.id)} disabled={saving} className="p-2 text-on-surface-variant hover:text-error" aria-label="Remover férias"><Icon name="delete" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'barbers' && (
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
                <form onSubmit={createBarberSubmit} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 flex flex-col gap-3 h-fit">
                  <h2 className="text-[15px] font-bold text-on-surface">Novo barbeiro</h2>
                  <input required placeholder="Nome" value={barberForm.name} onChange={(e) => setBarberForm((p) => ({ ...p, name: e.target.value }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <input required type="email" placeholder="E-mail" value={barberForm.email} onChange={(e) => setBarberForm((p) => ({ ...p, email: e.target.value }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <input required placeholder="Telefone (+55...)" value={barberForm.phone} onChange={(e) => setBarberForm((p) => ({ ...p, phone: e.target.value }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <input required type="password" placeholder="Senha inicial" value={barberForm.initialPassword} onChange={(e) => setBarberForm((p) => ({ ...p, initialPassword: e.target.value }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <button disabled={saving} className="h-11 rounded-lg bg-primary text-on-primary text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40">Cadastrar</button>
                </form>
                <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl overflow-hidden">
                  {adminBarbers.length === 0 ? (
                    <p className="p-4 text-[13px] text-on-surface-variant">Nenhum barbeiro cadastrado.</p>
                  ) : adminBarbers.map((b) => (
                    <div key={b.barberId} className="p-4 border-b last:border-b-0 border-on-surface/10 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold text-on-surface flex items-center gap-2">
                          {b.name}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${b.isActive ? 'bg-green-100 text-green-800' : 'bg-surface-container-high text-on-surface-variant'}`}>
                            {b.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </p>
                        <p className="text-[12px] text-on-surface-variant truncate">{b.email} · {b.totalAppointmentsConcluded} concluídos</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleBarberStatus(b.barberId, !b.isActive)}
                          disabled={saving}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors disabled:opacity-40 ${b.isActive ? 'text-error border-error/40 hover:bg-error-container' : 'text-green-700 border-green-300 hover:bg-green-50'}`}
                        >
                          {b.isActive ? 'Inativar' : 'Ativar'}
                        </button>
                        {b.totalAppointmentsConcluded === 0 && (
                          <button onClick={() => deleteBarberRow(b.barberId)} disabled={saving} className="p-2 text-on-surface-variant hover:text-error" aria-label="Excluir barbeiro" title="Excluir (sem histórico)"><Icon name="delete" /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'services' && (
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
                <form onSubmit={createServiceSubmit} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 flex flex-col gap-3 h-fit">
                  <h2 className="text-[15px] font-bold text-on-surface">Novo serviço</h2>
                  <input required placeholder="Nome" value={serviceForm.name} onChange={(e) => setServiceForm((p) => ({ ...p, name: e.target.value }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <label className="text-[12px] text-on-surface-variant">Duração (min)
                    <input required type="number" min="1" value={serviceForm.durationMinutes} onChange={(e) => setServiceForm((p) => ({ ...p, durationMinutes: e.target.value }))} className="h-11 px-3 mt-1 w-full bg-surface-container border border-on-surface/10 rounded-lg text-[13px] text-on-surface" />
                  </label>
                  <label className="text-[12px] text-on-surface-variant">Preço (R$)
                    <input required type="number" min="0" step="0.01" value={serviceForm.price} onChange={(e) => setServiceForm((p) => ({ ...p, price: e.target.value }))} className="h-11 px-3 mt-1 w-full bg-surface-container border border-on-surface/10 rounded-lg text-[13px] text-on-surface" />
                  </label>

                  {/* FEAT-082: galeria de ícones + upload de SVG */}
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-on-surface-variant">Ícone</span>
                    <label className="text-[11px] font-semibold text-secondary cursor-pointer hover:text-primary">
                      Enviar SVG
                      <input type="file" accept=".svg,image/svg+xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadIcon(f); e.target.value = '' }} />
                    </label>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {icons.map((ic) => (
                      <button
                        key={ic.id}
                        type="button"
                        title={ic.name}
                        onClick={() => setServiceForm((p) => ({ ...p, iconId: p.iconId === ic.id ? '' : ic.id }))}
                        className={`aspect-square rounded-lg border flex items-center justify-center p-1.5 transition-colors ${serviceForm.iconId === ic.id ? 'border-primary bg-primary/10 text-primary' : 'border-on-surface/15 text-on-surface-variant hover:border-on-surface/40'}`}
                      >
                        <SafeSvg svg={ic.svgContent} className="[&>svg]:w-full [&>svg]:h-full block w-full h-full" />
                      </button>
                    ))}
                  </div>
                  {icons.length > 0 && <p className="text-[10px] text-on-surface-variant">Dica: SVGs com <code>fill=&quot;currentColor&quot;</code> herdam a cor do tema (claro/escuro).</p>}

                  <button disabled={saving} className="h-11 rounded-lg bg-primary text-on-primary text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40">Cadastrar</button>
                </form>
                <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl overflow-hidden">
                  {adminServices.length === 0 ? (
                    <p className="p-4 text-[13px] text-on-surface-variant">Nenhum serviço cadastrado.</p>
                  ) : adminServices.map((s) => (
                    <div key={s.serviceId} className="p-4 border-b last:border-b-0 border-on-surface/10 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-3">
                        {(() => { const ic = icons.find((i) => i.id === s.iconId); return ic ? <SafeSvg svg={ic.svgContent} className="[&>svg]:w-6 [&>svg]:h-6 text-primary shrink-0" /> : null })()}
                        <div className="min-w-0">
                        <p className="text-[14px] font-bold text-on-surface flex items-center gap-2">
                          {s.name}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-surface-container-high text-on-surface-variant'}`}>
                            {s.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </p>
                        <p className="text-[12px] text-on-surface-variant truncate">{money.format(s.price)} · {s.durationMinutes} min · {s.totalAppointments} agendamentos</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleServiceStatus(s.serviceId, !s.isActive)}
                          disabled={saving}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors disabled:opacity-40 ${s.isActive ? 'text-error border-error/40 hover:bg-error-container' : 'text-green-700 border-green-300 hover:bg-green-50'}`}
                        >
                          {s.isActive ? 'Inativar' : 'Ativar'}
                        </button>
                        {s.totalAppointments === 0 && (
                          <button onClick={() => deleteServiceRow(s.serviceId)} disabled={saving} className="p-2 text-on-surface-variant hover:text-error" aria-label="Excluir serviço" title="Excluir (sem histórico)"><Icon name="delete" /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'analytics' && (
              <AnalyticsPanel
                range={analyticsRange}
                onRange={setAnalyticsRange}
                data={analytics}
                loading={analyticsLoading}
              />
            )}

            {tab === 'rules' && (
              <form onSubmit={saveRules} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 flex flex-col gap-4 max-w-md">
                <h2 className="text-[15px] font-bold text-on-surface">Regras da barbearia</h2>
                <p className="text-[12px] text-on-surface-variant">Parâmetros globais do sistema. Alterações têm efeito imediato (cache invalidado).</p>
                <label className="text-[12px] text-on-surface-variant">Tolerância de No-Show (minutos, 5–60)
                  <input type="number" min={5} max={60} required value={rulesForm.noShowToleranceMinutes} onChange={(e) => setRulesForm((p) => ({ ...p, noShowToleranceMinutes: Number(e.target.value) }))} className="h-11 px-3 mt-1 w-full bg-surface-container border border-on-surface/10 rounded-lg text-[13px] text-on-surface" />
                </label>
                <label className="text-[12px] text-on-surface-variant">Taxa padrão de cashback (%, 0–100)
                  <input type="number" min={0} max={100} step="0.01" required value={rulesForm.defaultCashbackPct} onChange={(e) => setRulesForm((p) => ({ ...p, defaultCashbackPct: Number(e.target.value) }))} className="h-11 px-3 mt-1 w-full bg-surface-container border border-on-surface/10 rounded-lg text-[13px] text-on-surface" />
                </label>
                <button disabled={saving} className="h-11 rounded-lg bg-primary text-on-primary text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40">Salvar regras</button>
              </form>
            )}

            {tab === 'connection' && (
              <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-6 flex flex-col items-center gap-4 max-w-md">
                <h2 className="text-[15px] font-bold text-on-surface self-start">Código de conexão</h2>
                <p className="text-[12px] text-on-surface-variant self-start">Compartilhe este código ou QR Code para que clientes conectem o app à sua barbearia.</p>
                {!shop ? (
                  <div className="h-48 w-full bg-surface-container rounded-xl animate-pulse" />
                ) : (
                  <>
                    <div className="bg-white p-4 rounded-xl">
                      <QRCodeCanvas id="razorfy-qr" value={connectUrl(shop.connectionCode)} size={200} level="M" includeMargin={false} />
                    </div>
                    <p className="text-[28px] font-bold tracking-[0.3em] text-on-surface">{shop.connectionCode}</p>
                    <div className="flex gap-2 w-full">
                      <button
                        onClick={() => { navigator.clipboard?.writeText(shop.connectionCode); setSuccess('Código copiado.') }}
                        className="flex-1 h-11 rounded-lg border border-on-surface/20 text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant hover:bg-surface-container-high inline-flex items-center justify-center gap-2"
                      >
                        <Icon name="content_copy" className="text-[18px]" />Copiar
                      </button>
                      <button
                        onClick={() => downloadQr('razorfy-qr', `qrcode-${shop.connectionCode}.png`)}
                        className="flex-1 h-11 rounded-lg bg-primary text-on-primary text-[12px] font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-2"
                      >
                        <Icon name="download" className="text-[18px]" />Baixar QR
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

// URL universal de conexão (deep-link web/QR). Cliente escaneia → app.barberflow.com/c/CODE.
function connectUrl(code: string): string {
  const base = (import.meta.env.VITE_CONNECT_BASE_URL as string | undefined) ?? window.location.origin
  return `${base.replace(/\/$/, '')}/c/${code}`
}

// Exporta canvas do QR como PNG.
function downloadQr(canvasId: string, filename: string) {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null
  if (!canvas) return
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = filename
  a.click()
}

// FEAT-081: painel de gráficos financeiros (recharts) com filtro temporal.
function AnalyticsPanel({ range, onRange, data, loading }: {
  range: AnalyticsRange
  onRange: (r: AnalyticsRange) => void
  data: AnalyticsData | null
  loading: boolean
}) {
  const ranges: { key: AnalyticsRange; label: string }[] = [
    { key: 'LAST_7_DAYS', label: '7 dias' },
    { key: 'LAST_14_DAYS', label: '14 dias' },
    { key: 'CURRENT_MONTH', label: 'Mês atual' },
  ]
  const brl = (v: number) => money.format(v)
  // RF03: dias da semana ordenados do maior para o menor faturamento (barras horizontais).
  const dowSorted = data ? [...data.dayOfWeekBreakdown].sort((a, b) => b.revenue - a.revenue) : []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {ranges.map((r) => (
          <button
            key={r.key}
            onClick={() => onRange(r.key)}
            className={`h-9 px-3 rounded-lg text-[12px] font-semibold border transition-colors ${range === r.key ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest text-on-surface-variant border-on-surface/10 hover:text-on-surface'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="h-72 bg-surface-container-lowest rounded-xl animate-pulse" />
      ) : !data ? (
        <p className="text-[14px] text-on-surface-variant py-8 text-center">Sem dados para o período.</p>
      ) : (
        <>
          {/* RF01: faturamento geral cronológico (linha) */}
          <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4">
            <h2 className="text-[15px] font-bold text-on-surface mb-3">Faturamento geral</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.generalTimeline} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="formattedDate" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => brl(Number(value))} />
                <Line type="monotone" dataKey="revenue" name="Faturamento" stroke="#b8412f" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* RF02: faturamento por barbeiro (barras verticais) */}
            <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4">
              <h2 className="text-[15px] font-bold text-on-surface mb-3">Por barbeiro</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.barberBreakdown} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="barberName" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => brl(Number(value))} />
                  <Bar dataKey="revenue" name="Faturamento" fill="#2f6fb8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* RF03: faturamento por dia da semana (barras horizontais, maior→menor) */}
            <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4">
              <h2 className="text-[15px] font-bold text-on-surface mb-3">Por dia da semana</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart layout="vertical" data={dowSorted} margin={{ top: 8, right: 12, bottom: 4, left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="dayName" tick={{ fontSize: 11 }} width={88} />
                  <Tooltip formatter={(value) => brl(Number(value))} />
                  <Bar dataKey="revenue" name="Faturamento" fill="#3f9d6a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function AdminMetric({ icon, label, value, tone = 'normal' }: { icon: string; label: string; value: string; tone?: 'normal' | 'warn' }) {
  return (
    <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4">
      <div className="flex items-center gap-2 text-on-surface-variant mb-2">
        <Icon name={icon} className={`text-[18px] ${tone === 'warn' ? 'text-error' : 'text-secondary'}`} />
        <span className="text-[11px] font-semibold">{label}</span>
      </div>
      <p className="text-[22px] font-bold text-on-surface tracking-tight">{value}</p>
    </div>
  )
}

function timeLabel(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function dateOnlyLabel(value: string) {
  const day = value.slice(0, 10)
  return new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function dateTimeLocalInDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

// ---------- Configuração de Expediente (BARBER) ----------

type SlotState = {
  active: boolean
  startTime: string
  endTime: string
  lunchStart: string
  lunchEnd: string
}

function BarberSchedulePage({ session }: { session: Session }) {
  const defaultSlots: Record<number, SlotState> = Object.fromEntries(
    WEEKDAYS.map(({ day }) => [day, { active: false, startTime: '09:00', endTime: '18:00', lunchStart: '12:00', lunchEnd: '13:00' }])
  )
  const [slots, setSlots] = useState<Record<number, SlotState>>(defaultSlots)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    request<BarberSlotData[]>(`/barbers/${session.user.id}/slots`, {}, session.accessToken)
      .then((data) => {
        setSlots((prev) => {
          const next = { ...prev }
          for (const s of data) {
            next[s.dayOfWeek] = {
              active: true,
              startTime: s.startTime,
              endTime: s.endTime,
              lunchStart: s.lunchStart ?? '12:00',
              lunchEnd: s.lunchEnd ?? '13:00',
            }
          }
          return next
        })
      })
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false))
  }, [session.user.id, session.accessToken])

  function updateSlot(day: number, field: keyof SlotState, value: string | boolean) {
    setSlots((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
  }

  async function save() {
    setError('')
    setSuccess('')
    setSaving(true)
    const body: BarberSlotData[] = WEEKDAYS
      .filter(({ day }) => slots[day].active)
      .map(({ day }) => ({
        dayOfWeek: day,
        startTime: slots[day].startTime,
        endTime: slots[day].endTime,
        lunchStart: slots[day].lunchStart || null,
        lunchEnd: slots[day].lunchEnd || null,
      }))
    try {
      await request(`/barbers/${session.user.id}/slots`, { method: 'PUT', body: JSON.stringify(body) }, session.accessToken)
      setSuccess('Expediente salvo com sucesso!')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen pb-20 lg:pb-4">
      <div className="lg:hidden">
        <TopBar title="Meu Expediente" />
      </div>
      <main className="flex-grow w-full max-w-[900px] mx-auto px-4 md:px-8 py-4 lg:py-8">
        <div className="mb-6 hidden lg:block">
          <h1 className="text-[28px] font-bold text-on-surface tracking-tight">Meu Expediente</h1>
          <p className="text-[16px] text-on-surface-variant">Configure os dias e horários de atendimento.</p>
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
        {success && <div className="mb-4"><SuccessBanner message={success} /></div>}

        {loading ? (
          <div className="flex flex-col gap-3">
            {WEEKDAYS.map(({ day }) => (
              <div key={day} className="h-20 bg-surface-container-lowest rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {WEEKDAYS.map(({ day, label }) => {
              const slot = slots[day]
              return (
                <div
                  key={day}
                  className={`bg-surface-container-lowest border rounded-xl p-4 transition-colors ${
                    slot.active ? 'border-secondary/40' : 'border-on-surface/10 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={slot.active}
                        onChange={(e) => updateSlot(day, 'active', e.target.checked)}
                        className="w-4 h-4 accent-secondary"
                      />
                      <span className="text-[14px] font-semibold text-on-surface">{label}</span>
                    </label>
                  </div>
                  {slot.active && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-on-surface-variant font-medium">Entrada</span>
                        <input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) => updateSlot(day, 'startTime', e.target.value)}
                          className="h-10 px-2 bg-surface-container border border-on-surface/10 rounded-lg text-[13px] focus:outline-none focus:border-secondary"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-on-surface-variant font-medium">Saída</span>
                        <input
                          type="time"
                          value={slot.endTime}
                          onChange={(e) => updateSlot(day, 'endTime', e.target.value)}
                          className="h-10 px-2 bg-surface-container border border-on-surface/10 rounded-lg text-[13px] focus:outline-none focus:border-secondary"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-on-surface-variant font-medium">Almoço início</span>
                        <input
                          type="time"
                          value={slot.lunchStart}
                          onChange={(e) => updateSlot(day, 'lunchStart', e.target.value)}
                          className="h-10 px-2 bg-surface-container border border-on-surface/10 rounded-lg text-[13px] focus:outline-none focus:border-secondary"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-on-surface-variant font-medium">Almoço fim</span>
                        <input
                          type="time"
                          value={slot.lunchEnd}
                          onChange={(e) => updateSlot(day, 'lunchEnd', e.target.value)}
                          className="h-10 px-2 bg-surface-container border border-on-surface/10 rounded-lg text-[13px] focus:outline-none focus:border-secondary"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-6 max-w-xs">
          <PrimaryButton onClick={save} disabled={saving || loading}>
            {saving ? 'Salvando...' : 'Salvar expediente'}
          </PrimaryButton>
        </div>
      </main>
    </div>
  )
}

export default App
