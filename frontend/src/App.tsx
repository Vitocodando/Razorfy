import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

type User = { id: string; name: string; email: string; phone: string; role: string }
type Session = { accessToken: string; user: User }
type ServiceItem = { id: string; name: string; durationMinutes: number; price: number }
type Barber = { id: string; name: string }
type Appointment = {
  appointmentId: string
  status: string
  startTimestamp: string
  endTimestamp: string
  barberName: string
  amountToPay: number
  services: { name: string; durationMinutes: number; price: number }[]
}
type ApiError = { message?: string }

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const CATEGORIES = ['Cabelo', 'Barba', 'Sobrancelha', 'Especiais'] as const
type Category = (typeof CATEGORIES)[number]

function categoryOf(service: ServiceItem): Category {
  const name = service.name.toLowerCase()
  if (name.includes('+') || name.includes('premium') || name.includes('combo')) return 'Especiais'
  if (name.includes('sobrancelha')) return 'Sobrancelha'
  if (name.includes('barba')) return 'Barba'
  return 'Cabelo'
}

function dateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function tomorrow() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return dateInputValue(date)
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
    const body = (await response.json().catch(() => ({}))) as ApiError
    throw new Error(body.message || 'Não foi possível concluir a solicitação.')
  }
  return response.json() as Promise<T>
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

function TopBar({ title, onBack, onLogout }: { title?: string; onBack?: () => void; onLogout?: () => void }) {
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
        <div className="text-[24px] font-bold italic uppercase tracking-tighter text-on-surface">{title ?? 'Razorfy'}</div>
        {onLogout ? (
          <button aria-label="Sair" onClick={onLogout} className="flex items-center justify-center p-2 -mr-2 text-primary hover:bg-surface-container-high rounded-full transition-colors">
            <Icon name="logout" />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>
    </header>
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
  const [selectedServices, setSelectedServices] = useState<string[]>([])

  const signIn = (nextSession: Session) => {
    localStorage.setItem('razorfy.session', JSON.stringify(nextSession))
    setSession(nextSession)
  }

  const signOut = () => {
    localStorage.removeItem('razorfy.session')
    setSession(null)
    setScreen('home')
    setSelectedServices([])
  }

  if (!session) return <AuthScreen onAuthenticated={signIn} />

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

  return (
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
  )
}

// ---------- Autenticação ----------

function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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
          </form>
          <div className="mt-8 text-center">
            <button onClick={() => { setMode('register'); setError('') }} className="text-on-surface-variant text-[16px] hover:text-primary transition-colors">
              Não tem uma conta?{' '}
              <span className="text-[14px] font-semibold text-secondary underline decoration-2 underline-offset-4">Cadastre-se</span>
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
  const [category, setCategory] = useState<Category>('Cabelo')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    request<ServiceItem[]>('/services')
      .then((data) => {
        setServices(data)
        const first = CATEGORIES.find((c) => data.some((s) => categoryOf(s) === c))
        if (first) setCategory(first)
      })
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false))
  }, [])

  const availableCategories = CATEGORIES.filter((c) => services.some((s) => categoryOf(s) === c))
  const visible = services.filter((s) => categoryOf(s) === category)

  const chosen = services.filter((service) => selectedServices.includes(service.id))
  const total = chosen.reduce((sum, service) => sum + Number(service.price), 0)
  const duration = chosen.reduce((sum, service) => sum + service.durationMinutes, 0)

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col pb-28">
      <TopBar onLogout={onLogout} />
      <main className="flex-grow w-full max-w-[1200px] mx-auto px-4 md:px-8 py-4">
        <div className="mb-6">
          <h1 className="text-[28px] md:text-[32px] font-bold text-on-surface mb-2 tracking-tight">01 · Escolha os serviços</h1>
          <p className="text-[16px] text-on-surface-variant">Selecione um ou mais serviços para continuar.</p>
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

        {/* Abas de categoria */}
        <div className="flex overflow-x-auto gap-2 pb-2 mb-4 no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
          {availableCategories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-[14px] font-semibold border-2 border-secondary transition-colors shrink-0 ${
                category === c ? 'bg-secondary text-on-secondary shadow-sm' : 'bg-transparent text-secondary hover:bg-surface-container'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Grade de serviços */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 h-36 animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icon name="content_cut" className="text-[64px] text-surface-variant mb-4" />
            <h3 className="text-[24px] font-bold text-on-surface mb-1">Nenhum serviço encontrado</h3>
            <p className="text-[16px] text-on-surface-variant max-w-md">Tente outra categoria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((service) => {
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
        )}
      </main>

      {/* CTA fixo */}
      <div className="fixed bottom-0 left-0 w-full bg-surface-container-lowest border-t-2 border-on-surface z-40 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
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

// ---------- Calendário ----------

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
  const [barberId, setBarberId] = useState<string>('') // '' = sem preferência
  const [date, setDate] = useState(tomorrow)
  const [slots, setSlots] = useState<Map<string, string[]>>(new Map())
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [startTimestamp, setStartTimestamp] = useState('')
  const [result, setResult] = useState<Appointment | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const chosen = services.filter((service) => selectedServiceIds.includes(service.id))
  const duration = chosen.reduce((sum, service) => sum + service.durationMinutes, 0)
  const total = chosen.reduce((sum, service) => sum + Number(service.price), 0)

  useEffect(() => {
    Promise.all([request<ServiceItem[]>('/services'), request<Barber[]>('/barbers')])
      .then(([serviceData, barberData]) => {
        setServices(serviceData)
        setBarbers(barberData)
      })
      .catch((cause) => setError(cause.message))
  }, [])

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

  async function book() {
    if (!startTimestamp) return setError('Escolha um horário disponível.')
    const availableBarbers = slots.get(startTimestamp) ?? []
    const chosenBarberId = barberId || availableBarbers[0]
    if (!chosenBarberId) return setError('Horário indisponível. Escolha outro.')
    setError('')
    setLoading(true)
    try {
      const appointment = await request<Appointment>('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          barberId: chosenBarberId,
          serviceIds: selectedServiceIds,
          startTimestamp,
          useCashback: false,
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
          <div><small className="text-[12px] text-on-surface-variant block">Valor</small><strong className="text-[16px] text-on-surface">{money.format(result.amountToPay)}</strong></div>
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
                  <div className="w-12 h-12 rounded-full bg-secondary-fixed text-on-secondary-container flex items-center justify-center shrink-0 font-bold">
                    {barber.name.slice(0, 2).toUpperCase()}
                  </div>
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
              {duration} min • <strong className="text-primary">{money.format(total)}</strong>
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

export default App
