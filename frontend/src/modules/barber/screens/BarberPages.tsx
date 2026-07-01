import { useEffect, useMemo, useState } from 'react'
import { request } from '../../../core/api/client'
import type { Session, Appointment } from '../../../core/types'
import { Icon, ErrorBanner, SuccessBanner, PrimaryButton, StatusBadge, Avatar, TopBar } from '../../../core/ui/primitives'
import { money, today } from '../../../core/utils/format'

// ---------- Tipos do domínio barbeiro ----------

type ExpressBlock = {
  blockId: string
  startTimestamp: string
  endTimestamp: string
  reason: string | null
}
type Review = { id: string; rating: number; comment: string | null; clientName?: string; createdAt: string }
type ReviewSummary = { average: number; count: number; reviews: Review[] }
type BarberGoal = {
  id: string
  periodStart: string
  periodEnd: string
  targetAppointments: number
  completed: number
  progressPct: number
}
type ClientNote = {
  id: string
  noteText: string
  authorId: string
  authorName: string
  createdAt: string
  updatedAt: string
}
type BarberSlotData = {
  dayOfWeek: number
  startTime: string
  endTime: string
  lunchStart: string | null
  lunchEnd: string | null
}

const WEEKDAYS = [
  { day: 1, label: 'Segunda-feira' },
  { day: 2, label: 'Terça-feira' },
  { day: 3, label: 'Quarta-feira' },
  { day: 4, label: 'Quinta-feira' },
  { day: 5, label: 'Sexta-feira' },
  { day: 6, label: 'Sábado' },
  { day: 7, label: 'Domingo' },
]

type AgendaFilter = 'hoje' | 'semana' | 'mes' | 'custom'
type AgendaStatus = 'all' | 'pending' | 'concluded' | 'cancelled'

const AGENDA_PERIOD_CHIPS: { key: Exclude<AgendaFilter, 'custom'>; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mês' },
]

const AGENDA_STATUS_CHIPS: { key: AgendaStatus; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'concluded', label: 'Concluídos' },
  { key: 'cancelled', label: 'Cancelados' },
]

// Agrupa os status do domínio nas categorias visíveis ao barbeiro.
const AGENDA_STATUS_GROUPS: Record<Exclude<AgendaStatus, 'all'>, string[]> = {
  pending: ['CONFIRMED', 'PENDING_PAYMENT'],
  concluded: ['CONCLUDED'],
  cancelled: ['CANCELLED', 'EXPIRED_PAYMENT', 'CANCELLED_OVERBOOKING'],
}

function agendaRange(filter: AgendaFilter, customDate: string): { start: Date; end: Date } {
  const now = new Date()
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
  const dayEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

  if (filter === 'custom' && customDate) {
    const [y, m, d] = customDate.split('-').map(Number)
    const base = new Date(y, m - 1, d)
    return { start: dayStart(base), end: dayEnd(base) }
  }

  if (filter === 'semana') {
    const dow = now.getDay() === 0 ? 6 : now.getDay() - 1 // Monday=0
    const start = dayStart(now); start.setDate(start.getDate() - dow)
    const end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  if (filter === 'mes') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    return { start, end }
  }

  // hoje
  return { start: dayStart(now), end: dayEnd(now) }
}

export function BarberAgendaPage({ session }: { session: Session }) {
  const barberId = session.user.id
  const token = session.accessToken
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filter, setFilter] = useState<AgendaFilter>('hoje')
  const [customDate, setCustomDate] = useState('')
  const [statusFilter, setStatusFilter] = useState<AgendaStatus>('all')
  const [concludingId, setConcludingId] = useState<string | null>(null)
  const [callingId, setCallingId] = useState<string | null>(null)

  const [blocks, setBlocks] = useState<ExpressBlock[]>([])
  const [goals, setGoals] = useState<BarberGoal[]>([])
  const [reviews, setReviews] = useState<ReviewSummary | null>(null)
  const [blockMenuOpen, setBlockMenuOpen] = useState(false)
  const [creatingBlock, setCreatingBlock] = useState(false)
  const [notesFor, setNotesFor] = useState<{ clientId: string; clientName: string } | null>(null)

  function loadBlocks() {
    request<ExpressBlock[]>(`/barbers/${barberId}/express-blocks?date=${today()}`, {}, token)
      .then(setBlocks)
      .catch(() => {})
  }

  useEffect(() => {
    request<Appointment[]>('/appointments/mine', {}, token)
      .then(setAppointments)
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false))
    loadBlocks()
    request<BarberGoal[]>(`/barbers/${barberId}/goals`, {}, token).then(setGoals).catch(() => {})
    request<ReviewSummary>(`/reviews?barberId=${barberId}`, {}, token).then(setReviews).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, barberId])

  const filtered = useMemo(() => {
    const { start, end } = agendaRange(filter, customDate)
    const allowed = statusFilter === 'all' ? null : AGENDA_STATUS_GROUPS[statusFilter]
    return appointments
      .filter((a) => {
        const t = new Date(a.startTimestamp).getTime()
        if (t < start.getTime() || t > end.getTime()) return false
        if (allowed && !allowed.includes(a.status)) return false
        return true
      })
      .sort((a, b) => new Date(a.startTimestamp).getTime() - new Date(b.startTimestamp).getTime())
  }, [appointments, filter, customDate, statusFilter])

  async function handleConclude(id: string) {
    setConcludingId(id)
    try {
      const updated = await request<Appointment>(`/appointments/${id}/conclude`, { method: 'POST' }, token)
      setAppointments((prev) => prev.map((a) => (a.appointmentId === id ? updated : a)))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir o atendimento.')
    } finally {
      setConcludingId(null)
    }
  }

  async function handleCreateBlock(durationMinutes: 15 | 30 | 60) {
    setError(''); setSuccess(''); setCreatingBlock(true)
    try {
      await request<ExpressBlock>(`/barbers/${barberId}/express-blocks`, {
        method: 'POST', body: JSON.stringify({ durationMinutes }),
      }, token)
      setSuccess(`Agenda bloqueada por ${durationMinutes} minutos.`)
      setBlockMenuOpen(false)
      loadBlocks()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível bloquear a agenda.')
      setBlockMenuOpen(false)
    } finally {
      setCreatingBlock(false)
    }
  }

  async function handleDeleteBlock(blockId: string) {
    try {
      await request(`/barbers/${barberId}/express-blocks/${blockId}`, { method: 'DELETE' }, token)
      setBlocks((prev) => prev.filter((b) => b.blockId !== blockId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível remover o bloqueio.')
    }
  }

  async function handleCall(id: string) {
    setError(''); setSuccess(''); setCallingId(id)
    try {
      await request(`/appointments/${id}/call-client`, { method: 'POST' }, token)
      setSuccess('Cliente chamado! Notificação enviada.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível chamar o cliente.')
    } finally {
      setCallingId(null)
    }
  }

  const activeGoal = goals[0]
  const customLabel = customDate
    ? new Date(customDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    : 'Data'

  return (
    <div className="flex flex-col min-h-screen pb-20 lg:pb-4">
      <div className="lg:hidden">
        <TopBar title="Minha Agenda" right={<Avatar name={session.user.name} size={36} />} />
      </div>
      <main className="flex-grow w-full max-w-[900px] mx-auto px-4 md:px-8 py-4 lg:py-8">
        <div className="mb-4 hidden lg:block">
          <h1 className="text-[28px] font-bold text-on-surface tracking-tight">Minha Agenda</h1>
        </div>

        {/* Resumo: avaliações, meta e bloqueio express */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {/* Avaliações */}
          <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-3">
            <p className="text-[11px] font-medium text-on-surface-variant mb-0.5">Avaliações</p>
            <div className="flex items-center gap-1.5">
              <Icon name="star" filled className="text-[20px] text-yellow-500" />
              <span className="text-[18px] font-bold text-on-surface">{reviews ? reviews.average.toFixed(1) : '—'}</span>
              <span className="text-[12px] text-on-surface-variant">({reviews?.count ?? 0})</span>
            </div>
          </div>
          {/* Meta */}
          <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-3">
            <p className="text-[11px] font-medium text-on-surface-variant mb-1">Meta do período</p>
            {activeGoal ? (
              <>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[14px] font-bold text-on-surface">{activeGoal.completed}/{activeGoal.targetAppointments}</span>
                  <span className="text-[11px] text-on-surface-variant">{activeGoal.progressPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${activeGoal.progressPct}%` }} />
                </div>
              </>
            ) : (
              <span className="text-[12px] text-on-surface-variant">Nenhuma meta definida</span>
            )}
          </div>
          {/* Bloqueio express */}
          <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-3 relative">
            <p className="text-[11px] font-medium text-on-surface-variant mb-1">Pausa rápida</p>
            <button
              onClick={() => setBlockMenuOpen((v) => !v)}
              disabled={creatingBlock}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-secondary-fixed text-on-secondary-container hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              <Icon name="block" className="text-[16px]" />
              {creatingBlock ? 'Bloqueando...' : 'Bloquear agenda'}
            </button>
            {blockMenuOpen && (
              <div className="absolute z-20 left-3 right-3 mt-1 bg-surface-container-lowest border border-on-surface/15 rounded-lg shadow-lg p-1 flex gap-1">
                {[15, 30, 60].map((d) => (
                  <button
                    key={d}
                    onClick={() => handleCreateBlock(d as 15 | 30 | 60)}
                    className="flex-1 px-2 py-1.5 rounded-md text-[12px] font-semibold text-on-surface hover:bg-primary-fixed transition-colors"
                  >
                    {d}min
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bloqueios ativos hoje */}
        {blocks.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {blocks.map((b) => (
              <span key={b.blockId} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-surface-container-high text-on-surface-variant">
                <Icon name="block" className="text-[15px]" />
                {new Date(b.startTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {'–'}
                {new Date(b.endTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                <button onClick={() => handleDeleteBlock(b.blockId)} aria-label="Remover bloqueio" className="hover:text-primary">
                  <Icon name="close" className="text-[15px]" />
                </button>
              </span>
            ))}
          </div>
        )}

        {success && <div className="mb-4"><SuccessBanner message={success} /></div>}

        {/* Filtros de período + data personalizada */}
        <div className="flex items-center gap-2 mb-3 overflow-x-auto">
          {AGENDA_PERIOD_CHIPS.map(({ key, label }) => {
            const isActive = filter === key
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                {label}
              </button>
            )
          })}
          {/* Botão calendário (datas personalizadas) — input nativo sobreposto */}
          <label
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              filter === 'custom'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
            title="Escolher data específica"
          >
            <Icon name="calendar_month" className="text-[18px]" />
            {filter === 'custom' && <span>{customLabel}</span>}
            <input
              type="date"
              value={customDate}
              onChange={(e) => { setCustomDate(e.target.value); setFilter('custom') }}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label="Data específica"
            />
          </label>
        </div>

        {/* Subfiltros de status */}
        <div className="flex flex-wrap gap-2 mb-5">
          {AGENDA_STATUS_CHIPS.map(({ key, label }) => {
            const isActive = statusFilter === key
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-colors ${
                  isActive
                    ? 'border-secondary text-secondary bg-secondary-fixed/40'
                    : 'border-on-surface/15 text-on-surface-variant hover:border-on-surface/30 hover:text-on-surface'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-container-lowest rounded-2xl p-4 h-28 animate-pulse shadow-sm" />
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icon name="event_busy" className="text-[64px] text-surface-variant mb-4" />
            <h3 className="text-[20px] font-bold text-on-surface mb-1">Nenhum atendimento neste filtro</h3>
            <p className="text-[16px] text-on-surface-variant">Tente outro período ou status.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((appt) => {
              const start = new Date(appt.startTimestamp)
              const end = new Date(appt.endTimestamp)
              return (
                <div
                  key={appt.appointmentId}
                  className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow border border-on-surface/5"
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={appt.clientName ?? '?'} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[16px] font-bold text-on-surface truncate">{appt.clientName ?? '—'}</p>
                        <StatusBadge status={appt.status} />
                      </div>
                      <p className="flex items-center gap-1 text-[13px] font-medium text-on-surface-variant mt-0.5">
                        <Icon name="schedule" className="text-[16px]" />
                        <span>
                          {start.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                          {' · '}
                          {start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {' — '}
                          {end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-on-surface/10 flex flex-col gap-1.5">
                    {appt.services.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-[13px]">
                        <span className="text-on-surface-variant truncate pr-2">{s.name}</span>
                        <span className="text-on-surface font-semibold whitespace-nowrap">{money.format(s.price)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[12px] text-on-surface-variant">Total</span>
                      <span className="text-[15px] font-bold text-on-surface">{money.format(appt.amountToPay)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {appt.clientId && (
                        <button
                          onClick={() => setNotesFor({ clientId: appt.clientId!, clientName: appt.clientName ?? 'Cliente' })}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg text-[12px] font-semibold text-on-surface-variant border border-on-surface/15 hover:bg-surface-container transition-colors"
                        >
                          <Icon name="sticky_note_2" className="text-[15px]" />
                          Notas
                        </button>
                      )}
                      {appt.status === 'CONFIRMED' && (
                        <button
                          onClick={() => handleCall(appt.appointmentId)}
                          disabled={callingId === appt.appointmentId}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg text-[12px] font-semibold text-secondary border border-secondary hover:bg-secondary-fixed/40 disabled:opacity-40 transition-colors"
                        >
                          <Icon name="campaign" className="text-[15px]" />
                          {callingId === appt.appointmentId ? 'Chamando...' : 'Chamar'}
                        </button>
                      )}
                      {appt.status === 'CONFIRMED' && (
                        <button
                          onClick={() => handleConclude(appt.appointmentId)}
                          disabled={concludingId === appt.appointmentId}
                          className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-primary text-on-primary hover:bg-primary-container disabled:opacity-40 transition-colors shadow-sm active:scale-95"
                        >
                          {concludingId === appt.appointmentId ? 'Concluindo...' : 'Concluir'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      {notesFor && (
        <ClientNotesModal session={session} client={notesFor} onClose={() => setNotesFor(null)} />
      )}
    </div>
  )
}

function ClientNotesModal({
  session,
  client,
  onClose,
}: {
  session: Session
  client: { clientId: string; clientName: string }
  onClose: () => void
}) {
  const [notes, setNotes] = useState<ClientNote[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    request<ClientNote[]>(`/clients/${client.clientId}/notes`, {}, session.accessToken)
      .then(setNotes)
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false))
  }, [client.clientId, session.accessToken])

  async function addNote() {
    if (!text.trim()) return
    setSaving(true); setError('')
    try {
      const note = await request<ClientNote>(`/clients/${client.clientId}/notes`, {
        method: 'POST', body: JSON.stringify({ noteText: text.trim() }),
      }, session.accessToken)
      // POST retorna sem authorName; recarrega a lista para padronizar.
      setNotes((prev) => [{ ...note, authorName: session.user.name }, ...prev])
      setText('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a nota.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-surface-container-lowest w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-on-surface/10">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={client.clientName} size={36} />
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-on-surface truncate">{client.clientName}</p>
              <p className="text-[11px] text-on-surface-variant">Prancheta de notas</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-1 text-on-surface-variant hover:text-on-surface">
            <Icon name="close" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-2 overflow-y-auto flex-1">
          {error && <ErrorBanner message={error} />}
          <div className="flex gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Preferências, alergias, observações..."
              rows={2}
              className="flex-1 px-3 py-2 bg-surface-container border border-on-surface/10 rounded-lg text-[13px] text-on-surface resize-none focus:outline-none focus:border-secondary"
            />
            <button
              onClick={addNote}
              disabled={saving || !text.trim()}
              className="px-3 rounded-lg text-[12px] font-semibold bg-primary text-on-primary disabled:opacity-40 transition-opacity"
            >
              {saving ? '...' : 'Salvar'}
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col gap-2 mt-2">
              {[1, 2].map((i) => <div key={i} className="h-14 bg-surface-container rounded-lg animate-pulse" />)}
            </div>
          ) : notes.length === 0 ? (
            <p className="text-[13px] text-on-surface-variant text-center py-6">Nenhuma nota ainda.</p>
          ) : (
            <div className="flex flex-col gap-2 mt-1">
              {notes.map((n) => (
                <div key={n.id} className="bg-surface-container rounded-lg p-3">
                  <p className="text-[13px] text-on-surface whitespace-pre-wrap break-words">{n.noteText}</p>
                  <p className="text-[11px] text-on-surface-variant mt-1">
                    {n.authorName} · {new Date(n.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- Configuração de Expediente (BARBER) ----------

type SlotState = {
  active: boolean
  startTime: string
  endTime: string
  lunchStart: string
  lunchEnd: string
}

export function BarberSchedulePage({ session }: { session: Session }) {
  const defaultSlots: Record<number, SlotState> = Object.fromEntries(
    WEEKDAYS.map(({ day }) => [day, { active: false, startTime: '09:00', endTime: '18:00', lunchStart: '12:00', lunchEnd: '13:00' }])
  )
  const [slots, setSlots] = useState<Record<number, SlotState>>(defaultSlots)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    request<BarberSlotData[]>(`/barbers/${session.user.id}/slots`, {}, session.accessToken)
      .then((data) => {
        setSlots((prev) => {
          const next = { ...prev }
          for (const s of data) {
            next[s.dayOfWeek] = {
              active: true,
              startTime: s.startTime,
              endTime: s.endTime,
              lunchStart: s.lunchStart ?? '12:00',
              lunchEnd: s.lunchEnd ?? '13:00',
            }
          }
          return next
        })
      })
      .catch((cause) => setError(cause.message))
      .finally(() => setLoading(false))
  }, [session.user.id, session.accessToken])

  function updateSlot(day: number, field: keyof SlotState, value: string | boolean) {
    setSlots((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
  }

  async function save() {
    setError('')
    setSuccess('')
    setSaving(true)
    const body: BarberSlotData[] = WEEKDAYS
      .filter(({ day }) => slots[day].active)
      .map(({ day }) => ({
        dayOfWeek: day,
        startTime: slots[day].startTime,
        endTime: slots[day].endTime,
        lunchStart: slots[day].lunchStart || null,
        lunchEnd: slots[day].lunchEnd || null,
      }))
    try {
      await request(`/barbers/${session.user.id}/slots`, { method: 'PUT', body: JSON.stringify(body) }, session.accessToken)
      setSuccess('Expediente salvo com sucesso!')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen pb-20 lg:pb-4">
      <div className="lg:hidden">
        <TopBar title="Meu Expediente" />
      </div>
      <main className="flex-grow w-full max-w-[900px] mx-auto px-4 md:px-8 py-4 lg:py-8">
        <div className="mb-6 hidden lg:block">
          <h1 className="text-[28px] font-bold text-on-surface tracking-tight">Meu Expediente</h1>
          <p className="text-[16px] text-on-surface-variant">Configure os dias e horários de atendimento.</p>
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
        {success && <div className="mb-4"><SuccessBanner message={success} /></div>}

        {loading ? (
          <div className="flex flex-col gap-3">
            {WEEKDAYS.map(({ day }) => (
              <div key={day} className="h-20 bg-surface-container-lowest rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {WEEKDAYS.map(({ day, label }) => {
              const slot = slots[day]
              return (
                <div
                  key={day}
                  className={`bg-surface-container-lowest border rounded-xl p-4 transition-colors ${
                    slot.active ? 'border-secondary/40' : 'border-on-surface/10 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={slot.active}
                        onChange={(e) => updateSlot(day, 'active', e.target.checked)}
                        className="w-4 h-4 accent-secondary"
                      />
                      <span className="text-[14px] font-semibold text-on-surface">{label}</span>
                    </label>
                  </div>
                  {slot.active && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-on-surface-variant font-medium">Entrada</span>
                        <input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) => updateSlot(day, 'startTime', e.target.value)}
                          className="h-10 px-2 bg-surface-container border border-on-surface/10 rounded-lg text-[13px] focus:outline-none focus:border-secondary"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-on-surface-variant font-medium">Saída</span>
                        <input
                          type="time"
                          value={slot.endTime}
                          onChange={(e) => updateSlot(day, 'endTime', e.target.value)}
                          className="h-10 px-2 bg-surface-container border border-on-surface/10 rounded-lg text-[13px] focus:outline-none focus:border-secondary"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-on-surface-variant font-medium">Almoço início</span>
                        <input
                          type="time"
                          value={slot.lunchStart}
                          onChange={(e) => updateSlot(day, 'lunchStart', e.target.value)}
                          className="h-10 px-2 bg-surface-container border border-on-surface/10 rounded-lg text-[13px] focus:outline-none focus:border-secondary"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-on-surface-variant font-medium">Almoço fim</span>
                        <input
                          type="time"
                          value={slot.lunchEnd}
                          onChange={(e) => updateSlot(day, 'lunchEnd', e.target.value)}
                          className="h-10 px-2 bg-surface-container border border-on-surface/10 rounded-lg text-[13px] focus:outline-none focus:border-secondary"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-6 max-w-xs">
          <PrimaryButton onClick={save} disabled={saving || loading}>
            {saving ? 'Salvando...' : 'Salvar expediente'}
          </PrimaryButton>
        </div>
      </main>
    </div>
  )
}
