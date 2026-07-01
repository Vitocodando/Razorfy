import { useEffect, useState } from 'react'
import { request } from '../../../core/api/client'
import { Icon, ErrorBanner, TopBar, SafeSvg, CategoryIcon } from '../../../core/ui/primitives'
import { money } from '../../../core/utils/format'
import { CATEGORIES, categoryOf, CATEGORY_META } from '../../../core/domain/catalog'
import type { ServiceItem, ServiceIconItem } from '../../../core/types'

// ---------- Home / Catálogo (etapa 1 do agendamento) ----------

export function HomePage({
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
