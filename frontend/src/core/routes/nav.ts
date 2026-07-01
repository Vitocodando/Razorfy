// Itens de navegação por papel + tipos de navegação (extraídos do App.tsx monolítico).
export type NavKey = 'home' | 'appointments' | 'wallet' | 'agenda' | 'schedule' | 'admin' | 'settings'
export type NavItem = { key: NavKey; label: string; icon: string }

export const CLIENT_NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Início', icon: 'home' },
  { key: 'appointments', label: 'Meus Horários', icon: 'event' },
  { key: 'wallet', label: 'Carteira', icon: 'account_balance_wallet' },
  { key: 'settings', label: 'Conta', icon: 'settings' },
]

export const BARBER_NAV_ITEMS: NavItem[] = [
  { key: 'agenda', label: 'Agenda', icon: 'calendar_today' },
  { key: 'schedule', label: 'Expediente', icon: 'tune' },
  { key: 'settings', label: 'Conta', icon: 'settings' },
]

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { key: 'admin', label: 'Comando', icon: 'dashboard' },
]
