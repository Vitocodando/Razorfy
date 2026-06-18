import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, InputHTMLAttributes, MouseEvent as ReactMouseEvent, ReactNode } from 'react'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

// ---------- Tipos ----------

type User = { id: string; name: string; email: string; phone: string | null; role: string }
type Session = { accessToken: string; user: User }
type ServiceItem = { id: string; name: string; durationMinutes: number; price: number }
type Barber = { id: string; name: string }
type Appointment = {
  appointmentId: string
  status: string
  startTimestamp: string
  endTimestamp: string
  barberName: string
  clientId?: string
  clientName?: string
  amountToPay: number
  totalPrice: number
  cashbackUsed: number
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

const STATUS_META: Record<string, { label: string; color: string }> = {
  CONFIRMED: { label: 'Confirmado', color: 'bg-green-100 text-green-800' },
  PENDING_PAYMENT: { label: 'Aguardando pagamento', color: 'bg-yellow-100 text-yellow-800' },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
  EXPIRED_PAYMENT: { label: 'Pagamento expirado', color: 'bg-red-100 text-red-800' },
  CANCELLED_OVERBOOKING: { label: 'Cancelado (overbooking)', color: 'bg-red-100 text-red-800' },
  CONCLUDED: { label: 'Concluído', color: 'bg-blue-100 text-blue-800' },
}

const TRANSACTION_META: Record<string, { label: string; icon: string; sign: string; color: string }> = {
  CREDIT: { label: 'Crédito', icon: 'add_circle', sign: '+', color: 'text-green-700' },
  DEBIT: { label: 'Débito', icon: 'remove_circle', sign: '-', color: 'text-red-700' },
  RESERVE: { label: 'Reservado', icon: 'lock', sign: '-', color: 'text-yellow-700' },
  RELEASE: { label: 'Liberado', icon: 'lock_open', sign: '+', color: 'text-yellow-700' },
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
  return response.json() as Promise<T>
}

// ---------- Navegação do app ----------

const CLIENT_NAV_ITEMS = [
  { key: 'home' as const, label: 'Início', icon: 'home' },
  { key: 'appointments' as const, label: 'Meus Horários', icon: 'event' },
  { key: 'wallet' as const, label: 'Carteira', icon: 'account_balance_wallet' },
]

const BARBER_NAV_ITEMS = [
  { key: 'agenda' as const, label: 'Agenda', icon: 'calendar_today' },
  { key: 'schedule' as const, label: 'Expediente', icon: 'tune' },
]

type NavKey = 'home' | 'appointments' | 'wallet' | 'agenda' | 'schedule'

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
    return parsed?.user?.role === 'BARBER' ? 'agenda' : 'home'
  })
  const [selectedServices, setSelectedServices] = useState<string[]>([])

  const signIn = (nextSession: Session) => {
    localStorage.setItem('razorfy.session', JSON.stringify(nextSession))
    setSession(nextSession)
    setNav(nextSession.user.role === 'BARBER' ? 'agenda' : 'home')
  }

  const signOut = () => {
    localStorage.removeItem('razorfy.session')
    setSession(null)
    setScreen('home')
    setNav('home')
    setSelectedServices([])
  }

  // Sessão expirada (401 em chamada autenticada): volta ao login automaticamente.
  useEffect(() => {
    const onUnauthorized = () => signOut()
    window.addEventListener('razorfy:unauthorized', onUnauthorized)
    return () => window.removeEventListener('razorfy:unauthorized', onUnauthorized)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Callback do OAuth Google: troca o authorization code por sessão.
  const [oauth, setOauth] = useState<{ exchanging: boolean; error: string }>(() => {
    const params = new URLSearchParams(window.location.search)
    const isCallback = window.location.pathname.includes('/auth/google/callback')
    return { exchanging: isCallback && params.has('code'), error: '' }
  })

  useEffect(() => {
    if (!window.location.pathname.includes('/auth/google/callback')) return
    const params = new URLSearchParams(window.location.search)
    const savedState = sessionStorage.getItem('razorfy.oauth.state')
    sessionStorage.removeItem('razorfy.oauth.state')
    window.history.replaceState({}, '', '/')

    if (params.get('error')) {
      setOauth({ exchanging: false, error: 'Login com Google cancelado.' })
      return
    }
    const code = params.get('code')
    if (!code) return
    if (!savedState || savedState !== params.get('state')) {
      setOauth({ exchanging: false, error: 'Sessão de login inválida. Tente novamente.' })
      return
    }
    request<Session>('/auth/google', { method: 'POST', body: JSON.stringify({ code }) })
      .then((s) => { signIn(s); setOauth({ exchanging: false, error: '' }) })
      .catch((e) => setOauth({ exchanging: false, error: e instanceof Error ? e.message : 'Falha no login com Google.' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (oauth.exchanging) {
    return (
      <div className="bg-background min-h-screen flex flex-col items-center justify-center gap-4">
        <Icon name="progress_activity" className="text-[40px] text-primary animate-spin" />
        <p className="text-[16px] text-on-surface-variant">Entrando com Google...</p>
      </div>
    )
  }

  if (!session) return <AuthScreen onAuthenticated={signIn} initialError={oauth.error} />

  // Fluxo de agendamento (etapa 2) ocupa a tela toda, sem menu
  if (screen === 'calendar') {
    return (
      <CalendarPage
        session={session}
        selectedServiceIds={selectedServices}
        onBack={() => setScreen('home')}
        onBooked={() => setSelectedServices([])}
      />
    )
  }

  const navItems: NavItem[] = session.user.role === 'BARBER' ? BARBER_NAV_ITEMS : CLIENT_NAV_ITEMS

  const page =
    nav === 'home' ? (
      <HomePage
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
    ) : null

  return (
    <AppShell active={nav} navItems={navItems} onNavigate={setNav} onLogout={signOut}>
      {page}
    </AppShell>
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

function AuthScreen({ onAuthenticated, initialError = '' }: { onAuthenticated: (session: Session) => void; initialError?: string }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [googleEnabled, setGoogleEnabled] = useState(false)

  useEffect(() => {
    request<{ enabled: boolean }>('/auth/google/status')
      .then((s) => setGoogleEnabled(s.enabled))
      .catch(() => setGoogleEnabled(false))
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    const form = new FormData(event.currentTarget)
    const body = mode === 'register'
      ? {
          name: form.get('name'),
          email: form.get('email'),
          phone: form.get('phone'),
          password: form.get('password'),
        }
      : { email: form.get('email'), password: form.get('password') }
    try {
      const result = await request<Session>(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(body) })
      onAuthenticated(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao autenticar.')
    } finally {
      setLoading(false)
    }
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
          <h1 className="text-on-background text-[20px] font-semibold text-center mb-8">
            Seu estilo. Seu horário. Do seu jeito.
          </h1>
          <form className="w-full flex flex-col gap-4" onSubmit={submit}>
            <ErrorBanner message={error} />
            <FloatingField label="E-mail" id="email" name="email" type="email" required />
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
            <FloatingField label="E-mail" id="email" name="email" type="email" required />
            <FloatingField label="Telefone (ex: +5511999999999)" id="phone" name="phone" type="tel" pattern="^\+?[1-9]\d{1,14}$" required />
            <div className="relative w-full">
              <FloatingField label="Senha (mínimo 8 caracteres)" id="password" name="password" type={showPassword ? 'text' : 'password'} minLength={8} required />
              {passwordToggle}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar conta'}
            </PrimaryButton>
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
  selectedServices,
  onToggleService,
  onSchedule,
  onLogout,
}: {
  selectedServices: string[]
  onToggleService: (id: string) => void
  onSchedule: () => void
  onLogout: () => void
}) {
  const [services, setServices] = useState<ServiceItem[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    request<ServiceItem[]>('/services')
      .then(setServices)
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false))
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
                  <Icon name={CATEGORY_META[c].icon} className="text-primary text-[22px]" />
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
                          <h3 className="text-[20px] font-semibold text-on-surface leading-tight">{service.name}</h3>
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
  selectedServiceIds,
  onBack,
  onBooked,
}: {
  session: Session
  selectedServiceIds: string[]
  onBack: () => void
  onBooked: () => void
}) {
  const [services, setServices] = useState<ServiceItem[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [barberId, setBarberId] = useState<string>('')
  const [date, setDate] = useState(tomorrow)
  const [slots, setSlots] = useState<Map<string, string[]>>(new Map())
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [startTimestamp, setStartTimestamp] = useState('')
  const [useCashback, setUseCashback] = useState(false)
  const [result, setResult] = useState<Appointment | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const chosen = services.filter((service) => selectedServiceIds.includes(service.id))
  const duration = chosen.reduce((sum, service) => sum + service.durationMinutes, 0)
  const total = chosen.reduce((sum, service) => sum + Number(service.price), 0)

  useEffect(() => {
    Promise.all([
      request<ServiceItem[]>('/services'),
      request<Barber[]>('/barbers'),
      request<Wallet>('/wallet', {}, session.accessToken).catch(() => null),
    ]).then(([serviceData, barberData, walletData]) => {
      setServices(serviceData)
      setBarbers(barberData)
      if (walletData) setWallet(walletData)
    }).catch((cause) => setError(cause.message))
  }, [session.accessToken])

  useEffect(() => {
    if (!date || !duration || !barbers.length) return
    setStartTimestamp('')
    setSlots(new Map())
    setSlotsLoading(true)
    const candidates = barberId ? barbers.filter((b) => b.id === barberId) : barbers
    Promise.all(
      candidates.map((barber) =>
        request<{ availableStarts: string[] }>(`/barbers/${barber.id}/availability?date=${date}&duration=${duration}`)
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

  async function book() {
    if (!startTimestamp) return setError('Escolha um horário disponível.')
    const availableBarbers = slots.get(startTimestamp) ?? []
    const chosenBarberId = barberId || availableBarbers[0]
    if (!chosenBarberId) return setError('Horário indisponível. Escolha outro.')
    if (useCashback && !canUseCashback) {
      return setError('Saldo de cashback insuficiente para pagar qualquer serviço por completo.')
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

            {/* Cashback — sugestão paga serviços completos (mais baratos primeiro) */}
            {wallet && wallet.availableBalance > 0 && (
              <div className="bg-surface-container-low rounded-xl p-3 border border-on-surface/10">
                <label className={`flex items-start gap-3 ${canUseCashback ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                  <input
                    type="checkbox"
                    checked={useCashback}
                    disabled={!canUseCashback}
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
