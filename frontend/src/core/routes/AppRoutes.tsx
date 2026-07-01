import { useEffect, useState } from 'react'
import type { Session, Barbershop } from '../types'
import { request, parseConnectionCode, connectByCode } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { Icon } from '../ui/primitives'
import { AuthScreen, GoogleWhatsappScreen } from '../../modules/auth/screens/LoginScreen'
// Componentes de página ainda residem no App.tsx monolítico (migração para /modules é a próxima fase).
// A importação App → AppRoutes → App é um ciclo ESM seguro: só usamos estas funções em tempo de render.
import {
  AppShell,
  DevLoginScreen,
  PlatformConsole,
  TenantDiscovery,
  HomePage,
  AppointmentsPage,
  WalletPage,
  CalendarPage,
  BarberAgendaPage,
  BarberSchedulePage,
  SettingsPage,
  AdminCommandCenter,
  ADMIN_NAV_ITEMS,
  BARBER_NAV_ITEMS,
  CLIENT_NAV_ITEMS,
} from '../../App'
import type { NavKey, NavItem } from '../../App'

// Roteador raiz: resolve deep-links/OAuth, aplica o gate de sessão/tenant e monta a shell autenticada.
export function AppRoutes() {
  // Estado global de autenticação extraído para core/hooks/useAuth (sessão + tenant + persistência + logout no 401).
  const { session, tenant, selectTenant, clearTenant, signIn: authSignIn, signOut: authSignOut, updateSessionUser } = useAuth()

  // Estado de navegação/UI de responsabilidade do roteador (não pertence ao useAuth).
  const [screen, setScreen] = useState<'home' | 'calendar'>('home')
  const [nav, setNav] = useState<NavKey>(() => {
    const saved = localStorage.getItem('razorfy.session')
    if (!saved) return 'home'
    const parsed = JSON.parse(saved) as Session
    if (parsed?.user?.role === 'ADMIN') return 'admin'
    return parsed?.user?.role === 'BARBER' ? 'agenda' : 'home'
  })
  const [selectedServices, setSelectedServices] = useState<string[]>([])

  // Wrappers que combinam sign-in/out (useAuth) com o estado de navegação local.
  const signIn = (nextSession: Session) => {
    authSignIn(nextSession)
    setNav(nextSession.user.role === 'ADMIN' ? 'admin' : nextSession.user.role === 'BARBER' ? 'agenda' : 'home')
  }

  const signOut = () => {
    authSignOut()
    setScreen('home')
    setNav('home')
    setSelectedServices([])
  }

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
