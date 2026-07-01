import type { ReactNode } from 'react'
import { Icon } from './primitives'
import type { NavKey, NavItem } from '../routes/nav'

// Layout base autenticado: sidebar (desktop) + bottom-nav (mobile) + área de conteúdo.
export function AppShell({
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
