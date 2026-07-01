import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session, Barbershop } from '../../../core/types'
import { request } from '../../../core/api/client'
import { maskPhoneBR } from '../../../core/utils/phone'
import { Icon, ErrorBanner, FloatingField, PrimaryButton } from '../../../core/ui/primitives'

// ---------- Login com Google (OAuth 2 fases) ----------

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

// FEAT-076 FA01: tela de verificação 2FA no login (após credenciais válidas).
// Exportada: usada pelo AuthScreen e pelo DevLoginScreen (backoffice).
export function TwoFactorLoginScreen({ preAuthToken, onAuthenticated, onCancel }: {
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
export function PhoneOtpScreen({ tenantId, onAuthenticated, onCancel }: {
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

// FEAT-083: novo usuário Google valida WhatsApp (telefone → OTP → conclui cadastro).
export function GoogleWhatsappScreen({ preAuthToken, tenantId, onAuthenticated, onCancel }: {
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

// Tela principal de login/cadastro por senha (com 2FA, OTP telefone e Google).
export function AuthScreen({ onAuthenticated, initialError = '', tenant, onChangeTenant }: {
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
