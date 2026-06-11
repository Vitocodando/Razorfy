import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

type User = { id: string; name: string; email: string; phone: string; role: string }
type Session = { accessToken: string; user: User }
type ServiceItem = { id: string; name: string; durationMinutes: number; price: number }
type Barber = { id: string; name: string }
type Wallet = { balance: number; reservedBalance: number; availableBalance: number }
type Appointment = {
  appointmentId: string
  status: string
  totalPrice: number
  cashbackUsed: number
  amountToPay: number
  startTimestamp: string
  endTimestamp: string
  barberName: string
  services: { name: string; durationMinutes: number; price: number }[]
  paymentPayload?: { qrCodeBase64: string; copyPasteCode: string }
}
type ApiError = { message?: string }

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateTime = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function tomorrow() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return dateInputValue(date)
}

function dateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

function App() {
  const [session, setSession] = useState<Session | null>(() => {
    const saved = localStorage.getItem('razorfy.session')
    return saved ? JSON.parse(saved) : null
  })
  const [tab, setTab] = useState<'book' | 'appointments' | 'wallet'>('book')

  const signIn = (nextSession: Session) => {
    localStorage.setItem('razorfy.session', JSON.stringify(nextSession))
    setSession(nextSession)
  }

  const signOut = () => {
    localStorage.removeItem('razorfy.session')
    setSession(null)
  }

  if (!session) return <AuthScreen onAuthenticated={signIn} />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav>
          <button className={tab === 'book' ? 'active' : ''} onClick={() => setTab('book')}>
            <span>✦</span> Novo horário
          </button>
          <button className={tab === 'appointments' ? 'active' : ''} onClick={() => setTab('appointments')}>
            <span>▦</span> Meus horários
          </button>
          <button className={tab === 'wallet' ? 'active' : ''} onClick={() => setTab('wallet')}>
            <span>◈</span> Minha carteira
          </button>
        </nav>
        <div className="sidebar-profile">
          <div className="avatar">{session.user.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <strong>{session.user.name}</strong>
            <small>Cliente Razorfy</small>
          </div>
          <button className="logout" onClick={signOut} title="Sair">↗</button>
        </div>
      </aside>

      <main>
        <header className="mobile-header"><Brand /></header>
        {tab === 'book' && <BookingPage session={session} onOpenAppointments={() => setTab('appointments')} />}
        {tab === 'appointments' && <AppointmentsPage session={session} />}
        {tab === 'wallet' && <WalletPage session={session} />}
        <nav className="mobile-nav">
          <button className={tab === 'book' ? 'active' : ''} onClick={() => setTab('book')}>✦<small>Agendar</small></button>
          <button className={tab === 'appointments' ? 'active' : ''} onClick={() => setTab('appointments')}>▦<small>Horários</small></button>
          <button className={tab === 'wallet' ? 'active' : ''} onClick={() => setTab('wallet')}>◈<small>Carteira</small></button>
        </nav>
      </main>
    </div>
  )
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-symbol" aria-hidden="true">
        <img src="/razorfy.png" alt="" />
      </span>
      <strong className="brand-word">Razorfy</strong>
    </div>
  )
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

  return (
    <div className="auth-page">
      <section className="auth-story">
        <Brand />
        <div>
          <p className="eyebrow">RAZORFY · BARBEARIA INTELIGENTE</p>
          <h1>Seu estilo.<br />Seu horário.<br /><em>Do seu jeito.</em></h1>
          <p>Escolha os serviços, encontre seu barbeiro e agende em poucos minutos. Simples, direto e sem espera.</p>
        </div>
        <div className="auth-proof">
          <div><strong>4.9</strong><span>★★★★★</span><small>experiência Razorfy</small></div>
          <blockquote>“Seu próximo visual começa antes mesmo de chegar à cadeira.”</blockquote>
        </div>
      </section>
      <section className="auth-form-panel">
        <form onSubmit={submit}>
          <div className="form-heading">
            <span>Bem-vindo à Razorfy</span>
            <h2>{mode === 'register' ? 'Crie sua conta' : 'Entre na sua conta'}</h2>
            <p>{mode === 'register' ? 'Seu próximo visual está a poucos cliques.' : 'Seu estilo estava esperando por você.'}</p>
          </div>
          {mode === 'register' && (
            <label>Nome completo<input name="name" minLength={3} placeholder="Como podemos chamar você?" required /></label>
          )}
          <label>E-mail<input name="email" type="email" placeholder="voce@email.com" required /></label>
          {mode === 'register' && (
            <label>WhatsApp<input name="phone" placeholder="+5511999999999" pattern="^\+?[1-9]\d{1,14}$" required /></label>
          )}
          <label>Senha<input name="password" type="password" minLength={8} placeholder="Mínimo de 8 caracteres" required /></label>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-button" disabled={loading}>
            {loading ? 'Só um instante...' : mode === 'register' ? 'Criar conta e agendar' : 'Entrar'}
          </button>
          <p className="mode-switch">
            {mode === 'register' ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}
            <button type="button" onClick={() => setMode(mode === 'register' ? 'login' : 'register')}>
              {mode === 'register' ? 'Entrar' : 'Criar conta'}
            </button>
          </p>
        </form>
      </section>
    </div>
  )
}

function BookingPage({ session, onOpenAppointments }: { session: Session; onOpenAppointments: () => void }) {
  const [services, setServices] = useState<ServiceItem[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [barberId, setBarberId] = useState('')
  const [date, setDate] = useState(tomorrow)
  const [times, setTimes] = useState<string[]>([])
  const [startTimestamp, setStartTimestamp] = useState('')
  const [cashback, setCashback] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE_PIX' | 'PRESENTIAL'>('ONLINE_PIX')
  const [result, setResult] = useState<Appointment | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const chosen = services.filter((service) => selectedServices.includes(service.id))
  const duration = chosen.reduce((sum, service) => sum + service.durationMinutes, 0)
  const total = chosen.reduce((sum, service) => sum + Number(service.price), 0)
  const amountToPay = Math.max(0, total - cashback)

  useEffect(() => {
    Promise.all([
      request<ServiceItem[]>('/services'),
      request<Barber[]>('/barbers'),
      request<Wallet>('/wallet', {}, session.accessToken),
    ]).then(([serviceData, barberData, walletData]) => {
      setServices(serviceData)
      setBarbers(barberData)
      setWallet(walletData)
      if (barberData[0]) setBarberId(barberData[0].id)
    }).catch((cause) => setError(cause.message))
  }, [session.accessToken])

  useEffect(() => {
    if (!barberId || !date || !duration) return
    request<{ availableStarts: string[] }>(
      `/barbers/${barberId}/availability?date=${date}&duration=${duration}`,
    ).then((data) => setTimes(data.availableStarts)).catch((cause) => setError(cause.message))
  }, [barberId, date, duration])

  function toggleService(id: string) {
    setStartTimestamp('')
    setTimes([])
    setSelectedServices((current) => current.includes(id)
      ? current.filter((serviceId) => serviceId !== id)
      : [...current, id])
  }

  async function book() {
    if (!startTimestamp) return setError('Escolha um horário disponível.')
    setError('')
    setLoading(true)
    try {
      const appointment = await request<Appointment>('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          barberId,
          serviceIds: selectedServices,
          startTimestamp,
          useCashback: cashback > 0,
          cashbackAmountToApply: cashback,
          paymentMethod,
        }),
      }, session.accessToken)
      setResult(appointment)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o agendamento.')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return <PaymentSuccess appointment={result} onDone={onOpenAppointments} />
  }

  return (
    <div className="page booking-page">
      <div className="page-title">
        <div>
          <p className="eyebrow">NOVO AGENDAMENTO</p>
          <h1>Como você quer sair hoje?</h1>
          <p>Monte sua experiência. O tempo e o valor são calculados na hora.</p>
        </div>
        <div className="wallet-pill"><span>◈</span><div><small>Saldo disponível</small><strong>{money.format(wallet?.availableBalance ?? 0)}</strong></div></div>
      </div>

      <div className="booking-grid">
        <div className="booking-steps">
          <section className="panel">
            <Step number="01" title="Escolha os serviços" />
            <div className="service-grid">
              {services.map((service) => {
                const selected = selectedServices.includes(service.id)
                return (
                  <button key={service.id} className={`service-card ${selected ? 'selected' : ''}`} onClick={() => toggleService(service.id)}>
                    <span className="select-dot">{selected ? '✓' : '+'}</span>
                    <i>{service.name.includes('Barba') ? '⌁' : service.name.includes('Sobrancelha') ? '⌒' : '✂'}</i>
                    <strong>{service.name}</strong>
                    <small>{service.durationMinutes} min</small>
                    <b>{money.format(service.price)}</b>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="panel">
            <Step number="02" title="Profissional e data" />
            <div className="field-row">
              <label>Profissional<select value={barberId} onChange={(event) => {
                setBarberId(event.target.value)
                setStartTimestamp('')
                setTimes([])
              }}>
                {barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.name}</option>)}
              </select></label>
              <label>Data<input type="date" min={dateInputValue(new Date())} value={date} onChange={(event) => {
                setDate(event.target.value)
                setStartTimestamp('')
                setTimes([])
              }} /></label>
            </div>
            <div className="time-grid">
              {!duration && <p className="empty-hint">Selecione os serviços para ver os horários.</p>}
              {!!duration && !times.length && <p className="empty-hint">Não há horários livres para esta combinação.</p>}
              {times.map((time) => (
                <button key={time} className={startTimestamp === time ? 'selected' : ''} onClick={() => setStartTimestamp(time)}>
                  {new Date(time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <Step number="03" title="Pagamento" />
            <div className="payment-options">
              <button className={paymentMethod === 'ONLINE_PIX' ? 'selected' : ''} onClick={() => setPaymentMethod('ONLINE_PIX')}>
                <span>PIX</span><div><strong>Pagar online</strong><small>Confirmação imediata</small></div>
              </button>
              <button className={paymentMethod === 'PRESENTIAL' ? 'selected' : ''} onClick={() => setPaymentMethod('PRESENTIAL')}>
                <span>⌂</span><div><strong>Pagar no balcão</strong><small>No dia do atendimento</small></div>
              </button>
            </div>
            <label className="cashback-control">
              <div><span>◈</span><div><strong>Usar cashback</strong><small>Até {money.format(Math.min(total, wallet?.availableBalance ?? 0))}</small></div></div>
              <input
                type="number"
                min="0"
                step="0.01"
                max={Math.min(total, wallet?.availableBalance ?? 0)}
                value={cashback}
                onChange={(event) => setCashback(Math.max(0, Math.min(Number(event.target.value), total, wallet?.availableBalance ?? 0)))}
              />
            </label>
          </section>
        </div>

        <aside className="summary-card">
          <p className="eyebrow">RESUMO</p>
          <h3>Seu momento</h3>
          <div className="summary-list">
            {chosen.length ? chosen.map((service) => (
              <div key={service.id}><span>{service.name}<small>{service.durationMinutes} min</small></span><strong>{money.format(service.price)}</strong></div>
            )) : <p>Escolha ao menos um serviço para começar.</p>}
          </div>
          <div className="summary-meta">
            <div><span>Duração total</span><strong>{duration} min</strong></div>
            {cashback > 0 && <div className="discount"><span>Cashback</span><strong>- {money.format(cashback)}</strong></div>}
          </div>
          <div className="summary-total"><span>Total</span><strong>{money.format(amountToPay)}</strong></div>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-button" disabled={!selectedServices.length || !startTimestamp || loading} onClick={book}>
            {loading ? 'Reservando...' : 'Confirmar agendamento'}
          </button>
          <small className="secure-note">◆ Horário protegido por 10 minutos no pagamento online</small>
        </aside>
      </div>
    </div>
  )
}

function Step({ number, title }: { number: string; title: string }) {
  return <div className="step-title"><span>{number}</span><h2>{title}</h2></div>
}

function PaymentSuccess({ appointment, onDone }: { appointment: Appointment; onDone: () => void }) {
  const [status, setStatus] = useState(appointment.status)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function confirmMockPayment() {
    setLoading(true)
    setError('')
    try {
      const result = await request<{ status: string }>('/payments/webhooks/mock', {
        method: 'POST',
        body: JSON.stringify({ appointmentId: appointment.appointmentId, paymentReference: `PIX-DEMO-${Date.now()}` }),
      })
      setStatus(result.status)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao confirmar o PIX.')
    } finally {
      setLoading(false)
    }
  }

  const confirmed = status === 'CONFIRMED'
  return (
    <div className="page result-page">
      <div className={`result-icon ${confirmed ? 'confirmed' : ''}`}>{confirmed ? '✓' : 'PIX'}</div>
      <p className="eyebrow">{confirmed ? 'TUDO CERTO' : 'PAGAMENTO PENDENTE'}</p>
      <h1>{confirmed ? 'Horário confirmado.' : 'Seu horário está reservado.'}</h1>
      <p>{confirmed ? 'Agora é só chegar e deixar o resto com a gente.' : 'Conclua o PIX nos próximos 10 minutos para confirmar.'}</p>
      <div className="result-card">
        <div><small>Profissional</small><strong>{appointment.barberName}</strong></div>
        <div><small>Quando</small><strong>{dateTime.format(new Date(appointment.startTimestamp))}</strong></div>
        <div><small>Valor</small><strong>{money.format(appointment.amountToPay)}</strong></div>
      </div>
      {!confirmed && appointment.paymentPayload && (
        <div className="pix-box">
          <div className="fake-qr">{appointment.paymentPayload.qrCodeBase64.slice(0, 36)}</div>
          <code>{appointment.paymentPayload.copyPasteCode}</code>
          <button className="primary-button" onClick={confirmMockPayment} disabled={loading}>
            {loading ? 'Processando...' : 'Simular pagamento aprovado'}
          </button>
        </div>
      )}
      {error && <div className="error-box">{error}</div>}
      {confirmed && <button className="primary-button compact" onClick={onDone}>Ver meus agendamentos</button>}
    </div>
  )
}

function AppointmentsPage({ session }: { session: Session }) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [error, setError] = useState('')

  const load = useCallback(() => {
    request<Appointment[]>('/appointments/mine', {}, session.accessToken)
      .then(setAppointments)
      .catch((cause) => setError(cause.message))
  }, [session.accessToken])

  useEffect(load, [load])

  async function cancel(id: string) {
    try {
      await request(`/appointments/${id}/cancel`, { method: 'POST' }, session.accessToken)
      load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cancelar.')
    }
  }

  return (
    <div className="page">
      <div className="page-title"><div><p className="eyebrow">SUA AGENDA</p><h1>Meus horários</h1><p>Acompanhe seus próximos cuidados e seu histórico.</p></div></div>
      {error && <div className="error-box">{error}</div>}
      <div className="appointment-list">
        {!appointments.length && <div className="panel empty-state"><span>▦</span><h2>Nenhum agendamento ainda</h2><p>Seu próximo visual vai aparecer aqui.</p></div>}
        {appointments.map((appointment) => (
          <article className="appointment-card" key={appointment.appointmentId}>
            <div className="date-block"><strong>{new Date(appointment.startTimestamp).getDate()}</strong><span>{new Date(appointment.startTimestamp).toLocaleDateString('pt-BR', { month: 'short' })}</span></div>
            <div className="appointment-info">
              <span className={`status status-${appointment.status.toLowerCase()}`}>{appointment.status.replaceAll('_', ' ')}</span>
              <h3>{appointment.services.map((service) => service.name).join(' + ')}</h3>
              <p>{appointment.barberName} · {new Date(appointment.startTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}–{new Date(appointment.endTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <strong className="appointment-price">{money.format(appointment.amountToPay)}</strong>
            {appointment.status === 'CONFIRMED' && <button className="ghost-button" onClick={() => cancel(appointment.appointmentId)}>Cancelar</button>}
          </article>
        ))}
      </div>
    </div>
  )
}

function WalletPage({ session }: { session: Session }) {
  const [wallet, setWallet] = useState<(Wallet & { transactions: { type: string; amount: number; description: string; createdAt: string }[] }) | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    request<typeof wallet>('/wallet', {}, session.accessToken).then(setWallet).catch((cause) => setError(cause.message))
  }, [session.accessToken])

  return (
    <div className="page">
      <div className="page-title"><div><p className="eyebrow">FIDELIDADE</p><h1>Minha carteira</h1><p>Seu cuidado volta para você em forma de crédito.</p></div></div>
      {error && <div className="error-box">{error}</div>}
      <div className="wallet-hero">
        <div><small>SALDO DISPONÍVEL</small><strong>{money.format(wallet?.availableBalance ?? 0)}</strong><p>Use no seu próximo agendamento.</p></div>
        <span>◈</span>
      </div>
      <section className="panel transaction-panel">
        <h2>Extrato</h2>
        {!wallet?.transactions.length && <p className="empty-hint">Seu extrato ainda está vazio.</p>}
        {wallet?.transactions.map((transaction, index) => (
          <div className="transaction" key={`${transaction.createdAt}-${index}`}>
            <span className={transaction.type === 'DEBIT' ? 'out' : 'in'}>{transaction.type === 'DEBIT' ? '−' : '+'}</span>
            <div><strong>{transaction.description}</strong><small>{dateTime.format(new Date(transaction.createdAt))}</small></div>
            <b>{transaction.type === 'DEBIT' ? '- ' : '+ '}{money.format(transaction.amount)}</b>
          </div>
        ))}
      </section>
    </div>
  )
}

export default App
