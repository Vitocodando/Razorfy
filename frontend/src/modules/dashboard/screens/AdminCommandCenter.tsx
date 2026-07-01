import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { request } from '../../../core/api/client'
import type { Session, Barber, ServiceIconItem, Appointment, CouponItem, VacationBlock } from '../../../core/types'
import { Icon, ErrorBanner, SafeSvg, SuccessBanner, Avatar, StatusBadge, TopBar } from '../../../core/ui/primitives'
import { money, today, tomorrow, timeLabel, dateOnlyLabel } from '../../../core/utils/format'

// ---------- Tipos do painel administrativo ----------

type AdminAlert = {
  id: string
  alertType: string
  status: 'PENDING' | 'RESOLVED'
  createdAt: string
  appointment: {
    appointmentId?: string
    id?: string
    client: { id: string; name: string; phone: string | null }
    barber: { id: string; name: string }
    services: { serviceName: string; name?: string }[]
    review?: { rating: number; comment: string | null }
  }
}
type AdminHeatmap = {
  barberId: string
  barberName: string
  workingMinutes: number
  busyMinutes: number
  idleMinutes: number
  occupancyPct: number
}
type DailyAdminReport = {
  reportDate: string
  grossRevenue: number
  netRevenue: number
  concludedAppointments: number
  noShowAppointments: number
  averageTicket: number
  estimatedLtv: number
  idleMinutes: number
  occupancyPct: number
  heatmap: AdminHeatmap[]
}
type AdminGrid = {
  date: string
  barbers: (Barber & { onVacation: boolean })[]
  appointments: Appointment[]
}
type AdminDashboard = {
  report: DailyAdminReport
  alerts: AdminAlert[]
  grid: AdminGrid
}
type AdminTab = 'overview' | 'coupons' | 'vacations' | 'barbers' | 'services' | 'rules' | 'connection' | 'analytics'
type AnalyticsRange = 'LAST_7_DAYS' | 'LAST_14_DAYS' | 'CURRENT_MONTH'
type AnalyticsData = {
  range: AnalyticsRange
  generalTimeline: { date: string; formattedDate: string; revenue: number }[]
  barberBreakdown: { barberId: string; barberName: string; revenue: number }[]
  dayOfWeekBreakdown: { dayIndex: number; dayName: string; revenue: number }[]
}
type GlobalSettingsData = { noShowToleranceMinutes: number; defaultCashbackPct: number }
type AdminBarberRow = {
  barberId: string
  name: string
  email: string
  phone: string | null
  isActive: boolean
  totalAppointmentsConcluded: number
}
type AdminServiceRow = {
  serviceId: string
  name: string
  price: number
  durationMinutes: number
  isActive: boolean
  iconId?: string | null
  totalAppointments: number
}

// ---------- Centro de Comando (ADMIN) ----------

export function AdminCommandCenter({ session }: { session: Session }) {
  const token = session.accessToken
  const [date, setDate] = useState(today())
  const [tab, setTab] = useState<AdminTab>('overview')
  // FEAT-080: dashboard/grid via React Query — revalidação passiva (window focus + polling).
  // queryKey inclui a data → troca de data refaz só esta query (invalidação granular, RN03).
  const { data: dashboard = null, isLoading: dashboardLoading } = useQuery({
    queryKey: ['admin-dashboard', date],
    queryFn: () => request<AdminDashboard>(`/admin/dashboard?date=${date}`, {}, token),
  })
  const queryClient = useQueryClient()
  // RN03: invalida só a query do dashboard (grid/alertas) após ações que a afetam.
  const refreshDashboard = () => queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })

  // FEAT-081: analytics financeiro (BFF) com filtro temporal; React Query (window-focus/polling).
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('LAST_7_DAYS')
  const { data: analytics = null, isLoading: analyticsLoading } = useQuery({
    queryKey: ['admin-analytics', analyticsRange],
    queryFn: () => request<AnalyticsData>(`/admin/analytics?range=${analyticsRange}`, {}, token),
  })
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [coupons, setCoupons] = useState<CouponItem[]>([])
  const [vacations, setVacations] = useState<VacationBlock[]>([])
  const [adminBarbers, setAdminBarbers] = useState<AdminBarberRow[]>([])
  const [adminServices, setAdminServices] = useState<AdminServiceRow[]>([])
  const [rulesForm, setRulesForm] = useState<GlobalSettingsData>({ noShowToleranceMinutes: 15, defaultCashbackPct: 10 })
  const [shop, setShop] = useState<{ id: string; name: string; slug: string; connectionCode: string; logoUrl: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [couponForm, setCouponForm] = useState({
    code: '',
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_VALUE',
    discountValue: '10',
    maxUsesGlobal: '',
    expiresAt: dateTimeLocalInDays(30),
  })
  const [vacationForm, setVacationForm] = useState({ barberId: '', startDate: tomorrow(), endDate: tomorrow() })
  const [barberForm, setBarberForm] = useState({ name: '', email: '', phone: '', initialPassword: '' })
  const [serviceForm, setServiceForm] = useState({ name: '', durationMinutes: '30', price: '35', iconId: '' })
  const [icons, setIcons] = useState<ServiceIconItem[]>([])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [barberList, couponList, vacationList, adminBarberList, adminServiceList, settingsData, iconList] = await Promise.all([
        request<Barber[]>('/barbers'),
        request<CouponItem[]>('/admin/coupons', {}, token),
        request<VacationBlock[]>('/admin/vacation-blocks', {}, token),
        request<AdminBarberRow[]>('/admin/barbers', {}, token),
        request<AdminServiceRow[]>('/admin/services', {}, token),
        request<GlobalSettingsData>('/admin/global-settings', {}, token),
        request<ServiceIconItem[]>('/admin/icons', {}, token),
      ])
      setBarbers(barberList)
      setCoupons(couponList)
      setVacations(vacationList)
      setAdminBarbers(adminBarberList)
      setAdminServices(adminServiceList)
      setRulesForm({ noShowToleranceMinutes: settingsData.noShowToleranceMinutes, defaultCashbackPct: Number(settingsData.defaultCashbackPct) })
      setIcons(iconList)
      setVacationForm((prev) => ({ ...prev, barberId: prev.barberId || barberList[0]?.id || '' }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o painel administrativo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadAll()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // FEAT-074: carrega código de conexão sob demanda ao abrir a aba Conexão.
  useEffect(() => {
    if (tab !== 'connection' || shop) return
    request<{ id: string; name: string; slug: string; connectionCode: string; logoUrl: string | null }>('/admin/barbershop', {}, token)
      .then(setShop)
      .catch((c) => setError(c instanceof Error ? c.message : 'Não foi possível carregar a conexão.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  async function reloadDate(nextDate: string) {
    setDate(nextDate)
  }

  async function createCouponSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true); setError(''); setSuccess('')
    try {
      await request<CouponItem>('/admin/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: couponForm.code.trim().toUpperCase(),
          discountType: couponForm.discountType,
          discountValue: Number(couponForm.discountValue),
          maxUsesGlobal: couponForm.maxUsesGlobal ? Number(couponForm.maxUsesGlobal) : null,
          expiresAt: new Date(couponForm.expiresAt).toISOString(),
        }),
      }, token)
      setSuccess('Cupom criado.')
      setCouponForm((prev) => ({ ...prev, code: '' }))
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o cupom.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteCoupon(id: string) {
    setSaving(true); setError(''); setSuccess('')
    try {
      await request(`/admin/coupons/${id}`, { method: 'DELETE' }, token)
      setSuccess('Cupom removido.')
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível remover o cupom.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleBarberStatus(barberId: string, isActive: boolean) {
    setSaving(true); setError(''); setSuccess('')
    try {
      const r = await request<{ name: string; newStatus: boolean; orphanedAppointments: { appointmentId: string }[] }>(
        `/admin/barbers/${barberId}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }, token,
      )
      const orphans = r.orphanedAppointments?.length ?? 0
      setSuccess(
        `${r.name} ${r.newStatus ? 'ativado' : 'inativado'}.` +
        (orphans > 0 ? ` Atenção: ${orphans} agendamento(s) futuro(s) confirmado(s) a realocar.` : ''),
      )
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível alterar o barbeiro.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleServiceStatus(serviceId: string, isActive: boolean) {
    setSaving(true); setError(''); setSuccess('')
    try {
      const r = await request<{ message: string }>(
        `/admin/services/${serviceId}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }, token,
      )
      setSuccess(r.message)
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível alterar o serviço.')
    } finally {
      setSaving(false)
    }
  }

  async function saveRules(event: FormEvent) {
    event.preventDefault()
    setSaving(true); setError(''); setSuccess('')
    try {
      const r = await request<GlobalSettingsData>('/admin/global-settings', {
        method: 'PUT',
        body: JSON.stringify({
          noShowToleranceMinutes: Number(rulesForm.noShowToleranceMinutes),
          defaultCashbackPct: Number(rulesForm.defaultCashbackPct),
        }),
      }, token)
      setRulesForm({ noShowToleranceMinutes: r.noShowToleranceMinutes, defaultCashbackPct: Number(r.defaultCashbackPct) })
      setSuccess('Regras da barbearia atualizadas.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar as regras.')
    } finally {
      setSaving(false)
    }
  }

  async function createBarberSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true); setError(''); setSuccess('')
    try {
      const r = await request<{ name: string }>('/admin/barbers', {
        method: 'POST',
        body: JSON.stringify({
          name: barberForm.name.trim(),
          email: barberForm.email.trim(),
          phone: barberForm.phone.trim(),
          initialPassword: barberForm.initialPassword,
        }),
      }, token)
      setSuccess(`Barbeiro ${r.name} criado.`)
      setBarberForm({ name: '', email: '', phone: '', initialPassword: '' })
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o barbeiro.')
    } finally {
      setSaving(false)
    }
  }

  async function createServiceSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true); setError(''); setSuccess('')
    try {
      const r = await request<{ name: string }>('/admin/services', {
        method: 'POST',
        body: JSON.stringify({
          name: serviceForm.name.trim(),
          durationMinutes: Number(serviceForm.durationMinutes),
          price: Number(serviceForm.price),
          ...(serviceForm.iconId ? { iconId: serviceForm.iconId } : {}),
        }),
      }, token)
      setSuccess(`Serviço ${r.name} criado.`)
      setServiceForm({ name: '', durationMinutes: '30', price: '35', iconId: '' })
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o serviço.')
    } finally {
      setSaving(false)
    }
  }

  // FEAT-082: upload de SVG customizado (lê o arquivo como texto e envia).
  async function uploadIcon(file: File) {
    if (file.type !== 'image/svg+xml' && !file.name.toLowerCase().endsWith('.svg')) {
      setError('Envie um arquivo .svg.'); return
    }
    setSaving(true); setError(''); setSuccess('')
    try {
      const svgContent = await file.text()
      const r = await request<{ id: string; message: string }>('/admin/icons', {
        method: 'POST',
        body: JSON.stringify({ name: file.name.replace(/\.svg$/i, '').slice(0, 50) || 'Ícone', svgContent }),
      }, token)
      const list = await request<ServiceIconItem[]>('/admin/icons', {}, token)
      setIcons(list)
      setServiceForm((p) => ({ ...p, iconId: r.id }))
      setSuccess(r.message)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o ícone.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteBarberRow(barberId: string) {
    setSaving(true); setError(''); setSuccess('')
    try {
      await request(`/admin/barbers/${barberId}`, { method: 'DELETE' }, token)
      setSuccess('Barbeiro excluído.')
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível excluir o barbeiro.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteServiceRow(serviceId: string) {
    setSaving(true); setError(''); setSuccess('')
    try {
      await request(`/admin/services/${serviceId}`, { method: 'DELETE' }, token)
      setSuccess('Serviço excluído.')
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível excluir o serviço.')
    } finally {
      setSaving(false)
    }
  }

  async function createVacation(event: FormEvent) {
    event.preventDefault()
    setSaving(true); setError(''); setSuccess('')
    try {
      await request<VacationBlock>('/admin/vacation-blocks', {
        method: 'POST',
        body: JSON.stringify(vacationForm),
      }, token)
      setSuccess('Férias cadastradas.')
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar férias.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteVacation(id: string) {
    setSaving(true); setError(''); setSuccess('')
    try {
      await request(`/admin/vacation-blocks/${id}`, { method: 'DELETE' }, token)
      setSuccess('Férias removidas.')
      await loadAll()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível remover férias.')
    } finally {
      setSaving(false)
    }
  }

  async function applyNoShow(appointmentId: string) {
    setSaving(true); setError(''); setSuccess('')
    try {
      await request(`/admin/appointments/${appointmentId}/no-show`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cliente ultrapassou a tolerância limite de 15 minutos e não avisou.' }),
      }, token)
      setSuccess('No-show aplicado e carteira zerada quando havia saldo.')
      void refreshDashboard()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível aplicar No-Show.')
    } finally {
      setSaving(false)
    }
  }

  async function resolveAlert(id: string) {
    setSaving(true); setError(''); setSuccess('')
    try {
      await request(`/admin/alerts/${id}/resolve`, { method: 'PATCH' }, token)
      setSuccess('Alerta resolvido.')
      void refreshDashboard()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível resolver o alerta.')
    } finally {
      setSaving(false)
    }
  }

  async function runWinBack() {
    setSaving(true); setError(''); setSuccess('')
    try {
      const result = await request<{ published: number; skipped: number; failures: number }>('/admin/campaigns/win-back/run', {
        method: 'POST',
        body: JSON.stringify({ date }),
      }, token)
      setSuccess(`Win-back enfileirado: ${result.published} enviado(s), ${result.skipped} ignorado(s), ${result.failures} falha(s).`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível executar o Win-back.')
    } finally {
      setSaving(false)
    }
  }

  const report = dashboard?.report
  const grid = dashboard?.grid
  const alerts = dashboard?.alerts ?? []

  return (
    <div className="flex flex-col min-h-screen pb-20 lg:pb-4">
      <div className="lg:hidden">
        <TopBar title="Comando" right={<Avatar name={session.user.name} size={36} />} />
      </div>
      <main className="flex-grow w-full max-w-[1200px] mx-auto px-4 md:px-8 py-4 lg:py-8">
        <div className="hidden lg:flex items-end justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[28px] font-bold text-on-surface tracking-tight">Centro de Comando</h1>
            <p className="text-[14px] text-on-surface-variant">Visão executiva e ações operacionais do dia.</p>
          </div>
          <label className="flex items-center gap-2 text-[12px] font-semibold text-on-surface-variant">
            <Icon name="calendar_month" className="text-[18px]" />
            <input type="date" value={date} onChange={(e) => reloadDate(e.target.value)} className="h-10 px-3 bg-surface-container-lowest border border-on-surface/10 rounded-lg text-[13px] text-on-surface" />
          </label>
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
        {success && <div className="mb-4"><SuccessBanner message={success} /></div>}

        {(loading || dashboardLoading) && !dashboard ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-surface-container-lowest rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <AdminMetric icon="payments" label="Receita líquida" value={money.format(report?.netRevenue ?? 0)} />
              <AdminMetric icon="receipt_long" label="Ticket médio" value={money.format(report?.averageTicket ?? 0)} />
              <AdminMetric icon="person_search" label="LTV estimado" value={money.format(report?.estimatedLtv ?? 0)} />
              <AdminMetric icon="event_busy" label="Ociosidade" value={`${report?.idleMinutes ?? 0} min`} tone={(report?.idleMinutes ?? 0) > 0 ? 'warn' : 'normal'} />
            </div>

            {alerts.length > 0 && (
              <div className="mb-4 bg-error-container border border-error/25 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="warning" filled className="text-error" />
                  <h2 className="text-[15px] font-bold text-on-error-container">Radar de detratores</h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {alerts.map((alert) => {
                    const phone = alert.appointment.client.phone
                    const whatsapp = phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : null
                    return (
                      <div key={alert.id} className="bg-surface-container-lowest border border-error/20 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-on-surface truncate">{alert.appointment.client.name}</p>
                            <p className="text-[12px] text-on-surface-variant truncate">{alert.appointment.barber.name} · {alert.appointment.review?.rating ?? '?'} estrelas</p>
                          </div>
                          <button onClick={() => resolveAlert(alert.id)} disabled={saving} className="p-1 text-on-surface-variant hover:text-primary" aria-label="Resolver alerta">
                            <Icon name="done" className="text-[18px]" />
                          </button>
                        </div>
                        <p className="text-[12px] text-on-surface mt-2">{alert.appointment.review?.comment || 'Sem comentário.'}</p>
                        {whatsapp && (
                          <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-[12px] font-semibold text-secondary">
                            <Icon name="chat" className="text-[15px]" />
                            WhatsApp
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-4 overflow-x-auto">
              {[
                { key: 'overview' as const, label: 'Grid', icon: 'view_timeline' },
                { key: 'coupons' as const, label: 'Cupons', icon: 'sell' },
                { key: 'vacations' as const, label: 'Férias', icon: 'beach_access' },
                { key: 'barbers' as const, label: 'Barbeiros', icon: 'group' },
                { key: 'services' as const, label: 'Serviços', icon: 'content_cut' },
                { key: 'analytics' as const, label: 'Análises', icon: 'monitoring' },
                { key: 'rules' as const, label: 'Regras', icon: 'tune' },
                { key: 'connection' as const, label: 'Conexão', icon: 'qr_code_2' },
              ].map((item) => (
                <button key={item.key} onClick={() => setTab(item.key)} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold whitespace-nowrap border transition-colors ${tab === item.key ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest text-on-surface-variant border-on-surface/10 hover:text-on-surface'}`}>
                  <Icon name={item.icon} className="text-[16px]" />
                  {item.label}
                </button>
              ))}
            </div>

            {tab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
                <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-on-surface/10 flex items-center justify-between">
                    <h2 className="text-[15px] font-bold text-on-surface">Grid global</h2>
                    <button onClick={runWinBack} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-secondary-fixed text-on-secondary-container disabled:opacity-40">
                      <Icon name="campaign" className="text-[15px]" />
                      Win-back
                    </button>
                  </div>
                  <div className="divide-y divide-on-surface/10">
                    {(grid?.appointments ?? []).length === 0 ? (
                      <p className="p-4 text-[13px] text-on-surface-variant">Nenhum agendamento neste dia.</p>
                    ) : (
                      grid!.appointments.map((appt) => (
                        <div key={appt.appointmentId} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                          <div className="w-20 shrink-0">
                            <p className="text-[18px] font-bold text-on-surface">{timeLabel(appt.startTimestamp)}</p>
                            <p className="text-[11px] text-on-surface-variant">{timeLabel(appt.endTimestamp)}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[14px] font-bold text-on-surface truncate">{appt.clientName ?? 'Cliente'}</p>
                              <StatusBadge status={appt.status} />
                            </div>
                            <p className="text-[12px] text-on-surface-variant truncate">{appt.barberName} · {appt.services.map((s) => s.name).join(', ')}</p>
                          </div>
                          <div className="flex items-center gap-2 justify-between md:justify-end">
                            <span className="text-[13px] font-bold text-on-surface">{money.format(appt.amountToPay)}</span>
                            {appt.status === 'CONFIRMED' && (
                              <button onClick={() => applyNoShow(appt.appointmentId)} disabled={saving} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[12px] font-semibold text-error border border-error/35 hover:bg-error-container disabled:opacity-40">
                                <Icon name="person_cancel" className="text-[15px]" />
                                No-show
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4">
                  <h2 className="text-[15px] font-bold text-on-surface mb-3">Mapa de ociosidade</h2>
                  <div className="flex flex-col gap-3">
                    {(report?.heatmap ?? []).map((row) => (
                      <div key={row.barberId}>
                        <div className="flex justify-between text-[12px] mb-1">
                          <span className="font-semibold text-on-surface">{row.barberName}</span>
                          <span className="text-on-surface-variant">{row.occupancyPct}%</span>
                        </div>
                        <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                          <div className="h-full bg-secondary rounded-full" style={{ width: `${Math.min(row.occupancyPct, 100)}%` }} />
                        </div>
                        <p className="text-[11px] text-on-surface-variant mt-1">{row.idleMinutes} min livres</p>
                      </div>
                    ))}
                    {(grid?.barbers ?? []).filter((b) => b.onVacation).map((barber) => (
                      <p key={barber.id} className="inline-flex items-center gap-1 text-[12px] text-on-surface-variant">
                        <Icon name="beach_access" className="text-[15px]" />
                        {barber.name} em férias
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'coupons' && (
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
                <form onSubmit={createCouponSubmit} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 flex flex-col gap-3">
                  <h2 className="text-[15px] font-bold text-on-surface">Novo cupom</h2>
                  <input value={couponForm.code} onChange={(e) => setCouponForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="CLIENTE20" className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <select value={couponForm.discountType} onChange={(e) => setCouponForm((p) => ({ ...p, discountType: e.target.value as 'PERCENTAGE' | 'FIXED_VALUE' }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]">
                    <option value="PERCENTAGE">Percentual</option>
                    <option value="FIXED_VALUE">Valor fixo</option>
                  </select>
                  <input type="number" min="0.01" step="0.01" value={couponForm.discountValue} onChange={(e) => setCouponForm((p) => ({ ...p, discountValue: e.target.value }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <input type="number" min="1" value={couponForm.maxUsesGlobal} onChange={(e) => setCouponForm((p) => ({ ...p, maxUsesGlobal: e.target.value }))} placeholder="Limite global opcional" className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <input type="datetime-local" value={couponForm.expiresAt} onChange={(e) => setCouponForm((p) => ({ ...p, expiresAt: e.target.value }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <button disabled={saving || !couponForm.code} className="h-11 rounded-lg bg-primary text-on-primary text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40">Criar</button>
                </form>
                <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl overflow-hidden">
                  {coupons.map((coupon) => (
                    <div key={coupon.id} className="p-4 border-b last:border-b-0 border-on-surface/10 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-bold text-on-surface">{coupon.code}</p>
                        <p className="text-[12px] text-on-surface-variant">{coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}%` : money.format(coupon.discountValue)} · {coupon.currentUses}/{coupon.maxUsesGlobal ?? '∞'} usos · vence {new Date(coupon.expiresAt).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <button onClick={() => deleteCoupon(coupon.id)} disabled={saving} className="p-2 text-on-surface-variant hover:text-error" aria-label="Remover cupom"><Icon name="delete" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'vacations' && (
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
                <form onSubmit={createVacation} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 flex flex-col gap-3">
                  <h2 className="text-[15px] font-bold text-on-surface">Bloquear férias</h2>
                  <select value={vacationForm.barberId} onChange={(e) => setVacationForm((p) => ({ ...p, barberId: e.target.value }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]">
                    {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <input type="date" value={vacationForm.startDate} onChange={(e) => setVacationForm((p) => ({ ...p, startDate: e.target.value }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <input type="date" value={vacationForm.endDate} onChange={(e) => setVacationForm((p) => ({ ...p, endDate: e.target.value }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <button disabled={saving || !vacationForm.barberId} className="h-11 rounded-lg bg-primary text-on-primary text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40">Cadastrar</button>
                </form>
                <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl overflow-hidden">
                  {vacations.length === 0 ? (
                    <p className="p-4 text-[13px] text-on-surface-variant">Nenhum bloqueio de férias.</p>
                  ) : vacations.map((block) => (
                    <div key={block.id} className="p-4 border-b last:border-b-0 border-on-surface/10 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-bold text-on-surface">{block.barber?.name ?? 'Barbeiro'}</p>
                        <p className="text-[12px] text-on-surface-variant">{dateOnlyLabel(block.startDate)} até {dateOnlyLabel(block.endDate)}</p>
                      </div>
                      <button onClick={() => deleteVacation(block.id)} disabled={saving} className="p-2 text-on-surface-variant hover:text-error" aria-label="Remover férias"><Icon name="delete" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'barbers' && (
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
                <form onSubmit={createBarberSubmit} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 flex flex-col gap-3 h-fit">
                  <h2 className="text-[15px] font-bold text-on-surface">Novo barbeiro</h2>
                  <input required placeholder="Nome" value={barberForm.name} onChange={(e) => setBarberForm((p) => ({ ...p, name: e.target.value }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <input required type="email" placeholder="E-mail" value={barberForm.email} onChange={(e) => setBarberForm((p) => ({ ...p, email: e.target.value }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <input required placeholder="Telefone (+55...)" value={barberForm.phone} onChange={(e) => setBarberForm((p) => ({ ...p, phone: e.target.value }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <input required type="password" placeholder="Senha inicial" value={barberForm.initialPassword} onChange={(e) => setBarberForm((p) => ({ ...p, initialPassword: e.target.value }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <button disabled={saving} className="h-11 rounded-lg bg-primary text-on-primary text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40">Cadastrar</button>
                </form>
                <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl overflow-hidden">
                  {adminBarbers.length === 0 ? (
                    <p className="p-4 text-[13px] text-on-surface-variant">Nenhum barbeiro cadastrado.</p>
                  ) : adminBarbers.map((b) => (
                    <div key={b.barberId} className="p-4 border-b last:border-b-0 border-on-surface/10 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold text-on-surface flex items-center gap-2">
                          {b.name}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${b.isActive ? 'bg-green-100 text-green-800' : 'bg-surface-container-high text-on-surface-variant'}`}>
                            {b.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </p>
                        <p className="text-[12px] text-on-surface-variant truncate">{b.email} · {b.totalAppointmentsConcluded} concluídos</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleBarberStatus(b.barberId, !b.isActive)}
                          disabled={saving}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors disabled:opacity-40 ${b.isActive ? 'text-error border-error/40 hover:bg-error-container' : 'text-green-700 border-green-300 hover:bg-green-50'}`}
                        >
                          {b.isActive ? 'Inativar' : 'Ativar'}
                        </button>
                        {b.totalAppointmentsConcluded === 0 && (
                          <button onClick={() => deleteBarberRow(b.barberId)} disabled={saving} className="p-2 text-on-surface-variant hover:text-error" aria-label="Excluir barbeiro" title="Excluir (sem histórico)"><Icon name="delete" /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'services' && (
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
                <form onSubmit={createServiceSubmit} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 flex flex-col gap-3 h-fit">
                  <h2 className="text-[15px] font-bold text-on-surface">Novo serviço</h2>
                  <input required placeholder="Nome" value={serviceForm.name} onChange={(e) => setServiceForm((p) => ({ ...p, name: e.target.value }))} className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                  <label className="text-[12px] text-on-surface-variant">Duração (min)
                    <input required type="number" min="1" value={serviceForm.durationMinutes} onChange={(e) => setServiceForm((p) => ({ ...p, durationMinutes: e.target.value }))} className="h-11 px-3 mt-1 w-full bg-surface-container border border-on-surface/10 rounded-lg text-[13px] text-on-surface" />
                  </label>
                  <label className="text-[12px] text-on-surface-variant">Preço (R$)
                    <input required type="number" min="0" step="0.01" value={serviceForm.price} onChange={(e) => setServiceForm((p) => ({ ...p, price: e.target.value }))} className="h-11 px-3 mt-1 w-full bg-surface-container border border-on-surface/10 rounded-lg text-[13px] text-on-surface" />
                  </label>

                  {/* FEAT-082: galeria de ícones + upload de SVG */}
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-on-surface-variant">Ícone</span>
                    <label className="text-[11px] font-semibold text-secondary cursor-pointer hover:text-primary">
                      Enviar SVG
                      <input type="file" accept=".svg,image/svg+xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadIcon(f); e.target.value = '' }} />
                    </label>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {icons.map((ic) => (
                      <button
                        key={ic.id}
                        type="button"
                        title={ic.name}
                        onClick={() => setServiceForm((p) => ({ ...p, iconId: p.iconId === ic.id ? '' : ic.id }))}
                        className={`aspect-square rounded-lg border flex items-center justify-center p-1.5 transition-colors ${serviceForm.iconId === ic.id ? 'border-primary bg-primary/10 text-primary' : 'border-on-surface/15 text-on-surface-variant hover:border-on-surface/40'}`}
                      >
                        <SafeSvg svg={ic.svgContent} className="[&>svg]:w-full [&>svg]:h-full block w-full h-full" />
                      </button>
                    ))}
                  </div>
                  {icons.length > 0 && <p className="text-[10px] text-on-surface-variant">Dica: SVGs com <code>fill=&quot;currentColor&quot;</code> herdam a cor do tema (claro/escuro).</p>}

                  <button disabled={saving} className="h-11 rounded-lg bg-primary text-on-primary text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40">Cadastrar</button>
                </form>
                <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl overflow-hidden">
                  {adminServices.length === 0 ? (
                    <p className="p-4 text-[13px] text-on-surface-variant">Nenhum serviço cadastrado.</p>
                  ) : adminServices.map((s) => (
                    <div key={s.serviceId} className="p-4 border-b last:border-b-0 border-on-surface/10 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-3">
                        {(() => { const ic = icons.find((i) => i.id === s.iconId); return ic ? <SafeSvg svg={ic.svgContent} className="[&>svg]:w-6 [&>svg]:h-6 text-primary shrink-0" /> : null })()}
                        <div className="min-w-0">
                        <p className="text-[14px] font-bold text-on-surface flex items-center gap-2">
                          {s.name}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-surface-container-high text-on-surface-variant'}`}>
                            {s.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </p>
                        <p className="text-[12px] text-on-surface-variant truncate">{money.format(s.price)} · {s.durationMinutes} min · {s.totalAppointments} agendamentos</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleServiceStatus(s.serviceId, !s.isActive)}
                          disabled={saving}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors disabled:opacity-40 ${s.isActive ? 'text-error border-error/40 hover:bg-error-container' : 'text-green-700 border-green-300 hover:bg-green-50'}`}
                        >
                          {s.isActive ? 'Inativar' : 'Ativar'}
                        </button>
                        {s.totalAppointments === 0 && (
                          <button onClick={() => deleteServiceRow(s.serviceId)} disabled={saving} className="p-2 text-on-surface-variant hover:text-error" aria-label="Excluir serviço" title="Excluir (sem histórico)"><Icon name="delete" /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'analytics' && (
              <AnalyticsPanel
                range={analyticsRange}
                onRange={setAnalyticsRange}
                data={analytics}
                loading={analyticsLoading}
              />
            )}

            {tab === 'rules' && (
              <form onSubmit={saveRules} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 flex flex-col gap-4 max-w-md">
                <h2 className="text-[15px] font-bold text-on-surface">Regras da barbearia</h2>
                <p className="text-[12px] text-on-surface-variant">Parâmetros globais do sistema. Alterações têm efeito imediato (cache invalidado).</p>
                <label className="text-[12px] text-on-surface-variant">Tolerância de No-Show (minutos, 5–60)
                  <input type="number" min={5} max={60} required value={rulesForm.noShowToleranceMinutes} onChange={(e) => setRulesForm((p) => ({ ...p, noShowToleranceMinutes: Number(e.target.value) }))} className="h-11 px-3 mt-1 w-full bg-surface-container border border-on-surface/10 rounded-lg text-[13px] text-on-surface" />
                </label>
                <label className="text-[12px] text-on-surface-variant">Taxa padrão de cashback (%, 0–100)
                  <input type="number" min={0} max={100} step="0.01" required value={rulesForm.defaultCashbackPct} onChange={(e) => setRulesForm((p) => ({ ...p, defaultCashbackPct: Number(e.target.value) }))} className="h-11 px-3 mt-1 w-full bg-surface-container border border-on-surface/10 rounded-lg text-[13px] text-on-surface" />
                </label>
                <button disabled={saving} className="h-11 rounded-lg bg-primary text-on-primary text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40">Salvar regras</button>
              </form>
            )}

            {tab === 'connection' && (
              <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-6 flex flex-col items-center gap-4 max-w-md">
                <h2 className="text-[15px] font-bold text-on-surface self-start">Código de conexão</h2>
                <p className="text-[12px] text-on-surface-variant self-start">Compartilhe este código ou QR Code para que clientes conectem o app à sua barbearia.</p>
                {!shop ? (
                  <div className="h-48 w-full bg-surface-container rounded-xl animate-pulse" />
                ) : (
                  <>
                    <div className="bg-white p-4 rounded-xl">
                      <QRCodeCanvas id="razorfy-qr" value={connectUrl(shop.connectionCode)} size={200} level="M" includeMargin={false} />
                    </div>
                    <p className="text-[28px] font-bold tracking-[0.3em] text-on-surface">{shop.connectionCode}</p>
                    <div className="flex gap-2 w-full">
                      <button
                        onClick={() => { navigator.clipboard?.writeText(shop.connectionCode); setSuccess('Código copiado.') }}
                        className="flex-1 h-11 rounded-lg border border-on-surface/20 text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant hover:bg-surface-container-high inline-flex items-center justify-center gap-2"
                      >
                        <Icon name="content_copy" className="text-[18px]" />Copiar
                      </button>
                      <button
                        onClick={() => downloadQr('razorfy-qr', `qrcode-${shop.connectionCode}.png`)}
                        className="flex-1 h-11 rounded-lg bg-primary text-on-primary text-[12px] font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-2"
                      >
                        <Icon name="download" className="text-[18px]" />Baixar QR
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

// URL universal de conexão (deep-link web/QR). Cliente escaneia → app.barberflow.com/c/CODE.
function connectUrl(code: string): string {
  const base = (import.meta.env.VITE_CONNECT_BASE_URL as string | undefined) ?? window.location.origin
  return `${base.replace(/\/$/, '')}/c/${code}`
}

// Exporta canvas do QR como PNG.
function downloadQr(canvasId: string, filename: string) {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null
  if (!canvas) return
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = filename
  a.click()
}

// FEAT-081: painel de gráficos financeiros (recharts) com filtro temporal.
function AnalyticsPanel({ range, onRange, data, loading }: {
  range: AnalyticsRange
  onRange: (r: AnalyticsRange) => void
  data: AnalyticsData | null
  loading: boolean
}) {
  const ranges: { key: AnalyticsRange; label: string }[] = [
    { key: 'LAST_7_DAYS', label: '7 dias' },
    { key: 'LAST_14_DAYS', label: '14 dias' },
    { key: 'CURRENT_MONTH', label: 'Mês atual' },
  ]
  const brl = (v: number) => money.format(v)
  // RF03: dias da semana ordenados do maior para o menor faturamento (barras horizontais).
  const dowSorted = data ? [...data.dayOfWeekBreakdown].sort((a, b) => b.revenue - a.revenue) : []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {ranges.map((r) => (
          <button
            key={r.key}
            onClick={() => onRange(r.key)}
            className={`h-9 px-3 rounded-lg text-[12px] font-semibold border transition-colors ${range === r.key ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest text-on-surface-variant border-on-surface/10 hover:text-on-surface'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="h-72 bg-surface-container-lowest rounded-xl animate-pulse" />
      ) : !data ? (
        <p className="text-[14px] text-on-surface-variant py-8 text-center">Sem dados para o período.</p>
      ) : (
        <>
          {/* RF01: faturamento geral cronológico (linha) */}
          <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4">
            <h2 className="text-[15px] font-bold text-on-surface mb-3">Faturamento geral</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.generalTimeline} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="formattedDate" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => brl(Number(value))} />
                <Line type="monotone" dataKey="revenue" name="Faturamento" stroke="#b8412f" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* RF02: faturamento por barbeiro (barras verticais) */}
            <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4">
              <h2 className="text-[15px] font-bold text-on-surface mb-3">Por barbeiro</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.barberBreakdown} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="barberName" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => brl(Number(value))} />
                  <Bar dataKey="revenue" name="Faturamento" fill="#2f6fb8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* RF03: faturamento por dia da semana (barras horizontais, maior→menor) */}
            <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4">
              <h2 className="text-[15px] font-bold text-on-surface mb-3">Por dia da semana</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart layout="vertical" data={dowSorted} margin={{ top: 8, right: 12, bottom: 4, left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="dayName" tick={{ fontSize: 11 }} width={88} />
                  <Tooltip formatter={(value) => brl(Number(value))} />
                  <Bar dataKey="revenue" name="Faturamento" fill="#3f9d6a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function AdminMetric({ icon, label, value, tone = 'normal' }: { icon: string; label: string; value: string; tone?: 'normal' | 'warn' }) {
  return (
    <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4">
      <div className="flex items-center gap-2 text-on-surface-variant mb-2">
        <Icon name={icon} className={`text-[18px] ${tone === 'warn' ? 'text-error' : 'text-secondary'}`} />
        <span className="text-[11px] font-semibold">{label}</span>
      </div>
      <p className="text-[22px] font-bold text-on-surface tracking-tight">{value}</p>
    </div>
  )
}

function dateTimeLocalInDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}
