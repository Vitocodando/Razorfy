import type { InputHTMLAttributes, ReactNode } from 'react'

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
