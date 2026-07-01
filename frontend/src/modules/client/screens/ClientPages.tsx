import { useEffect, useState } from 'react'
import { request } from '../../../core/api/client'
import type { Session, Appointment, Wallet } from '../../../core/types'
import { Icon, ErrorBanner, StatusBadge, TopBar } from '../../../core/ui/primitives'
import { money } from '../../../core/utils/format'

const TRANSACTION_META: Record<string, { label: string; icon: string; sign: string; color: string }> = {
  CREDIT: { label: 'Crédito', icon: 'add_circle', sign: '+', color: 'text-green-700' },
  DEBIT: { label: 'Débito', icon: 'remove_circle', sign: '-', color: 'text-red-700' },
  RESERVE: { label: 'Reservado', icon: 'lock', sign: '-', color: 'text-yellow-700' },
  RELEASE: { label: 'Liberado', icon: 'lock_open', sign: '+', color: 'text-yellow-700' },
  PENALTY_NO_SHOW: { label: 'Penalidade', icon: 'gpp_bad', sign: '-', color: 'text-red-800' },
}

// RN: cancelamento liberado só com 2h+ de antecedência.
function canCancelFrontend(startTimestamp: string): boolean {
  return new Date(startTimestamp).getTime() - Date.now() >= 2 * 60 * 60 * 1000
}

export function AppointmentsPage({ session }: { session: Session }) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    request<Appointment[]>('/appointments/mine', {}, session.accessToken)
      .then(setAppointments)
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false))
  }, [session.accessToken])

  async function handleCancel(id: string) {
    setCancellingId(id)
    try {
      const updated = await request<Appointment>(`/appointments/${id}/cancel`, { method: 'POST' }, session.accessToken)
      setAppointments((prev) => prev.map((a) => (a.appointmentId === id ? updated : a)))
      setConfirmId(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cancelar.')
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="flex flex-col min-h-screen pb-20 lg:pb-4">
      <div className="lg:hidden">
        <TopBar title="Meus Horários" />
      </div>
      <main className="flex-grow w-full max-w-[900px] mx-auto px-4 md:px-8 py-4 lg:py-8">
        <div className="mb-6 hidden lg:block">
          <h1 className="text-[28px] font-bold text-on-surface tracking-tight">Meus Horários</h1>
          <p className="text-[16px] text-on-surface-variant">Histórico e agendamentos futuros.</p>
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 h-28 animate-pulse" />
            ))}
          </div>
        ) : !appointments.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icon name="event_available" className="text-[64px] text-surface-variant mb-4" />
            <h3 className="text-[20px] font-bold text-on-surface mb-1">Nenhum agendamento encontrado</h3>
            <p className="text-[16px] text-on-surface-variant">Seu próximo visual vai aparecer aqui.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {appointments.map((appt) => {
              const canCancel = (appt.status === 'CONFIRMED' || appt.status === 'PENDING_PAYMENT') && canCancelFrontend(appt.startTimestamp)
              const isConfirming = confirmId === appt.appointmentId
              return (
                <div key={appt.appointmentId} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-[14px] font-semibold text-on-surface">{appt.barberName}</p>
                      <p className="text-[12px] text-on-surface-variant">
                        {new Date(appt.startTimestamp).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {' — '}
                        {new Date(appt.endTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <StatusBadge status={appt.status} />
                  </div>
                  <p className="text-[12px] text-on-surface-variant mb-2">{appt.services.map((s) => s.name).join(' + ')}</p>
                  <div className="flex items-center justify-between border-t border-on-surface/10 pt-2">
                    <span className="text-[13px] font-semibold text-on-surface">{money.format(appt.amountToPay)}</span>
                    {(appt.status === 'CONFIRMED' || appt.status === 'PENDING_PAYMENT') && (
                      isConfirming ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmId(null)}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-on-surface-variant border border-on-surface/20 hover:bg-surface-container"
                          >
                            Não
                          </button>
                          <button
                            onClick={() => handleCancel(appt.appointmentId)}
                            disabled={!!cancellingId}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-error text-on-error hover:opacity-80 disabled:opacity-40"
                          >
                            {cancellingId === appt.appointmentId ? 'Cancelando...' : 'Confirmar cancelamento'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => canCancel ? setConfirmId(appt.appointmentId) : undefined}
                          disabled={!canCancel}
                          title={!canCancel ? 'Cancelamento disponível apenas com 2h de antecedência' : undefined}
                          className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-primary border border-primary hover:bg-primary-fixed disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          Cancelar
                        </button>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

// ---------- Carteira Digital (CLIENT) ----------

export function WalletPage({ session }: { session: Session }) {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    request<Wallet>('/wallet', {}, session.accessToken)
      .then(setWallet)
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false))
  }, [session.accessToken])

  return (
    <div className="flex flex-col min-h-screen pb-20 lg:pb-4">
      <div className="lg:hidden">
        <TopBar title="Carteira" />
      </div>
      <main className="flex-grow w-full max-w-[900px] mx-auto px-4 md:px-8 py-4 lg:py-8">
        <div className="mb-6 hidden lg:block">
          <h1 className="text-[28px] font-bold text-on-surface tracking-tight">Carteira de Cashback</h1>
          <p className="text-[16px] text-on-surface-variant">Saldo e extrato de fidelidade.</p>
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

        {loading ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-surface-container-lowest rounded-xl animate-pulse" />)}
            </div>
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-surface-container-lowest rounded-xl animate-pulse" />)}
            </div>
          </div>
        ) : wallet ? (
          <>
            {/* Saldos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-primary text-on-primary rounded-xl p-4">
                <p className="text-[12px] font-medium opacity-80 mb-1">Disponível</p>
                <p className="text-[24px] font-bold">{money.format(wallet.availableBalance)}</p>
              </div>
              <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4">
                <p className="text-[12px] font-medium text-on-surface-variant mb-1">Saldo Total</p>
                <p className="text-[20px] font-bold text-on-surface">{money.format(wallet.balance)}</p>
              </div>
              <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4">
                <p className="text-[12px] font-medium text-on-surface-variant mb-1">Reservado</p>
                <p className="text-[20px] font-bold text-on-surface">{money.format(wallet.reservedBalance)}</p>
              </div>
            </div>

            {/* Extrato */}
            <h2 className="text-[16px] font-semibold text-on-surface mb-3">Extrato</h2>
            {wallet.transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center bg-surface-container-low rounded-xl">
                <Icon name="receipt_long" className="text-[48px] text-on-surface-variant mb-2" />
                <p className="text-[14px] text-on-surface-variant">Nenhuma transação registrada.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {wallet.transactions.map((tx) => {
                  const meta = TRANSACTION_META[tx.type] ?? { label: tx.type, icon: 'payments', sign: '', color: 'text-on-surface' }
                  return (
                    <div key={tx.id} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl px-4 py-3 flex items-center gap-3">
                      <Icon name={meta.icon} className={`text-[22px] shrink-0 ${meta.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-on-surface truncate">{tx.description}</p>
                        <p className="text-[11px] text-on-surface-variant">
                          {new Date(tx.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <span className={`text-[14px] font-bold shrink-0 ${meta.color}`}>
                        {meta.sign}{money.format(Math.abs(tx.amount))}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  )
}
