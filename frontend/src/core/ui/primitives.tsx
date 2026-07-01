import { useState } from 'react'
import type { InputHTMLAttributes, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { CATEGORY_META } from '../domain/catalog'
import type { Category } from '../domain/catalog'

// Componentes base de UI compartilhados (extraídos do App.tsx monolítico).
// Sem dependência de estado global — puros e reutilizáveis por todos os módulos.

export function Icon({ name, filled = false, className = '' }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${filled ? 'filled' : ''} ${className}`}>
      {name}
    </span>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="bg-error-container text-on-error-container p-2 rounded-lg border border-error/20 flex items-start gap-2">
      <Icon name="error" filled className="shrink-0 text-[20px]" />
      <p className="text-[12px] font-medium pt-[2px]">{message}</p>
    </div>
  )
}

export function FloatingField(props: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
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

export function PrimaryButton({ children, disabled, onClick, type = 'button', className = '' }: {
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

export function TopBar({ title, onBack, onLogout, right }: { title?: string; onBack?: () => void; onLogout?: () => void; right?: ReactNode }) {
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

// FEAT-082: renderiza SVG de ícone de serviço. O conteúdo já foi sanitizado no backend
// (anti-XSS), por isso o dangerouslySetInnerHTML é seguro e justificado aqui.
export function SafeSvg({ svg, className }: { svg: string; className?: string }) {
  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
}

export function SuccessBanner({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="bg-green-50 text-green-800 p-2 rounded-lg border border-green-200 flex items-start gap-2">
      <Icon name="check_circle" filled className="shrink-0 text-[20px]" />
      <p className="text-[12px] font-medium pt-[2px]">{message}</p>
    </div>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className="rounded-full bg-secondary-fixed text-on-secondary-container flex items-center justify-center font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  )
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

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: 'bg-surface-container text-on-surface-variant' }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.color}`}>
      {meta.label}
    </span>
  )
}

// Ícones vetoriais custom por categoria: diamante (Especiais/premium) e bigode (Barba).
// Demais categorias usam Material Symbols. width/height 1em + currentColor herdam a classe.
export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
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

// Hero com efeito parallax: a imagem e o rótulo se deslocam em camadas conforme o mouse.
export function BarberParallax({ name, image, subtitle }: { name: string; image?: string; subtitle: string }) {
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
