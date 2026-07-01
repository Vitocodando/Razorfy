import { useEffect, useMemo, useState } from 'react'
import { request } from '../../../core/api/client'
import type { Session, ServiceItem, Barber, Wallet, Appointment } from '../../../core/types'
import { Icon, ErrorBanner, PrimaryButton, TopBar, BarberParallax } from '../../../core/ui/primitives'
import { money, tomorrow, dateInputValue } from '../../../core/utils/format'
import { suggestCashback } from '../../../core/domain/catalog'
import { barberImageFor } from '../../../core/domain/barbers'

// ---------- Calendário / Agendamento (etapa 2) ----------

export function CalendarPage({
  session,
  tenantId,
  selectedServiceIds,
  onBack,
  onBooked,
}: {
  session: Session
  tenantId?: string
  selectedServiceIds: string[]
  onBack: () => void
  onBooked: () => void
}) {
  const tenantPath = tenantId ? `/tenants/${tenantId}` : ''
  const [services, setServices] = useState<ServiceItem[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [barberId, setBarberId] = useState<string>('')
  const [date, setDate] = useState(tomorrow)
  const [slots, setSlots] = useState<Map<string, string[]>>(new Map())
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [startTimestamp, setStartTimestamp] = useState('')
  const [useCashback, setUseCashback] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [result, setResult] = useState<Appointment | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const chosen = services.filter((service) => selectedServiceIds.includes(service.id))
  const duration = chosen.reduce((sum, service) => sum + service.durationMinutes, 0)
  const total = chosen.reduce((sum, service) => sum + Number(service.price), 0)

  useEffect(() => {
    Promise.all([
      request<ServiceItem[]>(`${tenantPath}/services`),
      request<Barber[]>(`${tenantPath}/barbers`),
      request<Wallet>('/wallet', {}, session.accessToken).catch(() => null),
    ]).then(([serviceData, barberData, walletData]) => {
      setServices(serviceData)
      setBarbers(barberData)
      if (walletData) setWallet(walletData)
    }).catch((cause) => setError(cause.message))
  }, [session.accessToken])

  useEffect(() => {
    if (!date || !duration || !barbers.length) return
    queueMicrotask(() => {
      setStartTimestamp('')
      setSlots(new Map())
      setSlotsLoading(true)
    })
    const candidates = barberId ? barbers.filter((b) => b.id === barberId) : barbers
    Promise.all(
      candidates.map((barber) =>
        request<{ availableStarts: string[] }>(`${tenantPath}/barbers/${barber.id}/availability?date=${date}&duration=${duration}`)
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
  const normalizedCouponCode = couponCode.trim().toUpperCase()

  async function book() {
    if (!startTimestamp) return setError('Escolha um horário disponível.')
    const availableBarbers = slots.get(startTimestamp) ?? []
    const chosenBarberId = barberId || availableBarbers[0]
    if (!chosenBarberId) return setError('Horário indisponível. Escolha outro.')
    if (useCashback && !canUseCashback) {
      return setError('Saldo de cashback insuficiente para pagar qualquer serviço por completo.')
    }
    if (useCashback && normalizedCouponCode) {
      return setError('Cupom e cashback não podem ser usados no mesmo agendamento.')
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
          couponCode: normalizedCouponCode || null,
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
          {(result.couponDiscount ?? 0) > 0 && (
            <div><small className="text-[12px] text-on-surface-variant block">Cupom {result.couponCode}</small><strong className="text-[16px] text-green-700">-{money.format(result.couponDiscount ?? 0)}</strong></div>
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

            <div className="bg-surface-container-lowest rounded-xl p-3 border border-on-surface/10">
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-on-surface-variant">Cupom</span>
                <input
                  value={couponCode}
                  onChange={(e) => {
                    const next = e.target.value.toUpperCase()
                    setCouponCode(next)
                    if (next.trim()) setUseCashback(false)
                  }}
                  maxLength={20}
                  placeholder="CLIENTE20"
                  className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px] text-on-surface uppercase focus:outline-none focus:border-secondary"
                />
              </label>
            </div>

            {/* Cashback — sugestão paga serviços completos (mais baratos primeiro) */}
            {wallet && wallet.availableBalance > 0 && (
              <div className="bg-surface-container-low rounded-xl p-3 border border-on-surface/10">
                <label className={`flex items-start gap-3 ${canUseCashback && !normalizedCouponCode ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                  <input
                    type="checkbox"
                    checked={useCashback}
                    disabled={!canUseCashback || Boolean(normalizedCouponCode)}
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
