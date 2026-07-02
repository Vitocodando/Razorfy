import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { request } from '../../../core/api/client'
import type { Session } from '../../../core/types'
import { Icon, ErrorBanner } from '../../../core/ui/primitives'
import { maskPhoneBR } from '../../../core/utils/phone'
import { TwoFactorLoginScreen } from '../../auth/screens/LoginScreen'

type PlatformAdminContact = { name: string; email: string; phone: string | null }
type PlatformTenant = {
  tenantId: string
  name: string
  connectionCode: string
  isActive: boolean
  createdAt: string
  adminContact: PlatformAdminContact | null
}
type PlatformList = { content: PlatformTenant[]; totalPages: number; totalElements: number }

// FEAT-084: gestão global de usuários (DEV).
type PlatformUser = { userId: string; name: string; phone: string | null; formattedPhone: string | null; email: string | null; role: string; isActive: boolean; tenantName?: string | null }
type PlatformUserList = { tenantName: string; content: PlatformUser[]; totalPages: number; totalElements: number }

// Login restrito do proprietário da plataforma (sem seleção de barbearia).
export function DevLoginScreen({ onAuthenticated }: { onAuthenticated: (s: Session) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending2fa, setPending2fa] = useState<string | null>(null)

  function accept(s: Session) {
    if (s.user.role !== 'DEV') { setError('Esta área é exclusiva da plataforma.'); setBusy(false); return }
    onAuthenticated(s)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const r = await request<Session | { status: 'REQUIRE_2FA'; preAuthToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) })
      if ('status' in r && r.status === 'REQUIRE_2FA') { setPending2fa(r.preAuthToken); setBusy(false); return }
      accept(r as Session)
    } catch (c) {
      setError(c instanceof Error ? c.message : 'Falha no login.')
      setBusy(false)
    }
  }

  if (pending2fa) {
    return <TwoFactorLoginScreen preAuthToken={pending2fa} onAuthenticated={accept} onCancel={() => { setPending2fa(null); setBusy(false) }} />
  }

  return (
    <div className="min-h-screen bg-[#0b0b0f] flex flex-col items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-[360px] flex flex-col gap-3">
        <div className="text-center mb-2">
          <Icon name="shield_person" className="text-[40px] text-primary" />
          <h1 className="text-[20px] font-bold text-white mt-2">Backoffice Razorfy</h1>
          <p className="text-[12px] text-white/50">Acesso restrito ao proprietário da plataforma.</p>
        </div>
        {error && <ErrorBanner message={error} />}
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoFocus placeholder="E-mail da plataforma" className="h-12 px-4 rounded-xl bg-white/5 border border-white/15 text-white text-[14px] placeholder:text-white/30 focus:outline-none focus:border-primary" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Senha" className="h-12 px-4 rounded-xl bg-white/5 border border-white/15 text-white text-[14px] placeholder:text-white/30 focus:outline-none focus:border-primary" />
        <button disabled={busy || !email || !password} className="h-12 rounded-xl bg-primary text-on-primary font-bold text-[14px] disabled:opacity-50 flex items-center justify-center gap-2">
          {busy ? <Icon name="progress_activity" className="animate-spin text-[20px]" /> : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

export function PlatformConsole({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const token = session.accessToken
  const [data, setData] = useState<PlatformList | null>(null)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [view, setView] = useState<'tenants' | 'users' | 'security'>('tenants') // FEAT-084 / 2FA DEV
  const [deleteTarget, setDeleteTarget] = useState<PlatformTenant | null>(null) // FEAT-085
  const size = 20

  const load = (p = page) => {
    setLoading(true)
    request<PlatformList>(`/platform/tenants?page=${p}&size=${size}`, {}, token)
      .then(setData)
      .catch((c) => setError(c instanceof Error ? c.message : 'Falha ao carregar barbearias.'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load(page); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page])

  async function toggleStatus(t: PlatformTenant) {
    const next = !t.isActive
    if (next === false && !confirm(`Bloquear "${t.name}"? Todos os usuários desta barbearia perdem acesso imediatamente.`)) return
    setError(''); setSuccess('')
    try {
      await request(`/platform/tenants/${t.tenantId}/status`, { method: 'PATCH', body: JSON.stringify({ isActive: next }) }, token)
      setSuccess(next ? `${t.name} reativada.` : `${t.name} bloqueada.`)
      load()
    } catch (c) {
      setError(c instanceof Error ? c.message : 'Não foi possível alterar o status.')
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-white">
      <header className="flex items-center justify-between px-5 h-16 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Icon name="shield_person" className="text-primary text-[24px]" />
          <span className="font-bold text-[15px]">Backoffice Razorfy</span>
          <span className="text-[11px] text-white/40 ml-2">{data?.totalElements ?? 0} barbearias</span>
        </div>
        <button onClick={onSignOut} className="text-[13px] text-white/60 hover:text-white inline-flex items-center gap-1.5">
          <Icon name="logout" className="text-[18px]" />Sair
        </button>
      </header>

      <main className="max-w-[960px] mx-auto p-5 flex flex-col gap-4">
        {error && <ErrorBanner message={error} />}
        {success && <div className="rounded-lg bg-primary/15 border border-primary/30 text-primary px-4 py-2 text-[13px]">{success}</div>}

        <div className="flex items-center gap-2">
          {([['tenants', 'Barbearias'], ['users', 'Usuários'], ['security', 'Segurança']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setView(k)} className={`h-9 px-4 rounded-lg text-[13px] font-semibold border transition-colors ${view === k ? 'bg-primary text-on-primary border-primary' : 'bg-white/5 text-white/60 border-white/10 hover:text-white'}`}>{label}</button>
          ))}
        </div>

        {view === 'users' && <PlatformUsersPanel token={token} tenants={data?.content ?? []} />}
        {view === 'security' && <PlatformSecurityPanel token={token} />}

        {view === 'tenants' && (<>
        <div className="flex items-center justify-between">
          <h1 className="text-[18px] font-bold">Barbearias (Tenants)</h1>
          <button onClick={() => setShowForm((v) => !v)} className="h-10 px-4 rounded-lg bg-primary text-on-primary font-bold text-[13px] inline-flex items-center gap-2">
            <Icon name={showForm ? 'close' : 'add'} className="text-[18px]" />
            {showForm ? 'Cancelar' : 'Nova barbearia'}
          </button>
        </div>

        {showForm && (
          <PlatformCreateForm
            token={token}
            onCreated={(msg) => { setShowForm(false); setSuccess(msg); setPage(0); load(0) }}
          />
        )}

        {loading ? (
          <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />)}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {data?.content.map((t) => (
              <div key={t.tenantId} className="flex items-center gap-3 p-4 rounded-lg bg-white/5 border border-white/10">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.isActive ? 'bg-emerald-400' : 'bg-red-500'}`} title={t.isActive ? 'Ativa' : 'Bloqueada'} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[14px] truncate">{t.name}</p>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/70">{t.connectionCode}</span>
                  </div>
                  <p className="text-[11px] text-white/40 truncate">
                    {t.adminContact ? `${t.adminContact.name} · ${t.adminContact.email}` : 'sem admin'}
                  </p>
                </div>
                <button
                  onClick={() => toggleStatus(t)}
                  className={`h-9 px-3 rounded-lg text-[12px] font-semibold inline-flex items-center gap-1.5 ${t.isActive ? 'border border-red-500/40 text-red-400 hover:bg-red-500/10' : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400'}`}
                >
                  <Icon name={t.isActive ? 'block' : 'check_circle'} className="text-[16px]" />
                  {t.isActive ? 'Bloquear' : 'Reativar'}
                </button>
                <button onClick={() => setDeleteTarget(t)} title="Excluir permanentemente" className="h-9 px-2.5 rounded-lg border border-red-600/50 text-red-500 hover:bg-red-600/15">
                  <Icon name="delete_forever" className="text-[18px]" />
                </button>
              </div>
            ))}
            {data && data.content.length === 0 && <p className="text-white/40 text-[13px] text-center py-8">Nenhuma barbearia cadastrada.</p>}
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="h-9 px-3 rounded-lg bg-white/5 text-[13px] disabled:opacity-30">Anterior</button>
            <span className="text-[12px] text-white/50">Página {page + 1} de {data.totalPages}</span>
            <button disabled={page + 1 >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="h-9 px-3 rounded-lg bg-white/5 text-[13px] disabled:opacity-30">Próxima</button>
          </div>
        )}
        </>)}

        {deleteTarget && (
          <DeleteTenantModal
            token={token}
            tenant={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onDeleted={() => { const n = deleteTarget.name; setDeleteTarget(null); setSuccess(`Barbearia "${n}" excluída permanentemente.`); load(0) }}
          />
        )}
      </main>
    </div>
  )
}

// FEAT-085: modal de exclusão permanente — exige código 2FA do DEV (header X-DEV-2FA).
function DeleteTenantModal({ token, tenant, onClose, onDeleted }: { token: string; tenant: PlatformTenant; onClose: () => void; onDeleted: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    if (code.length !== 6) return
    setBusy(true); setError('')
    try {
      await request(`/platform/tenants/${tenant.tenantId}`, { method: 'DELETE', headers: { 'X-DEV-2FA': code } }, token)
      onDeleted()
    } catch (c) { setError(c instanceof Error ? c.message : 'Falha ao excluir.'); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-[#1a0e0e] border-2 border-red-600/60 rounded-2xl p-5 w-full max-w-[400px] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 text-red-400">
          <Icon name="warning" filled className="text-[24px]" />
          <h3 className="text-[16px] font-bold">Exclusão permanente</h3>
        </div>
        <p className="text-[13px] text-white/80">Você vai apagar <b>{tenant.name}</b> e <b>TODOS</b> os seus dados (clientes, agendamentos, financeiro). <span className="text-red-400 font-semibold">Esta ação é irreversível.</span></p>
        <p className="text-[12px] text-white/50">Digite o código de 6 dígitos do seu app de autenticação para confirmar.</p>
        {error && <ErrorBanner message={error} />}
        <input autoFocus inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} className="h-14 px-4 rounded-xl bg-white/5 border border-red-600/40 text-[24px] tracking-[0.4em] font-bold text-center text-white focus:outline-none focus:border-red-500" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-11 rounded-lg border border-white/15 text-[13px] text-white/70">Cancelar</button>
          <button onClick={confirm} disabled={busy || code.length !== 6} className="flex-1 h-11 rounded-lg bg-red-600 text-white text-[13px] font-bold disabled:opacity-40">{busy ? 'Excluindo...' : 'Excluir para sempre'}</button>
        </div>
      </div>
    </div>
  )
}

function PlatformCreateForm({ token, onCreated }: { token: string; onCreated: (msg: string) => void }) {
  const [f, setF] = useState({ name: '', slug: '', connectionCode: '', adminName: '', email: '', phone: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const r = await request<{ message: string }>('/platform/tenants', {
        method: 'POST',
        body: JSON.stringify({
          tenant: { name: f.name.trim(), slug: f.slug.trim(), connectionCode: f.connectionCode.trim() },
          adminUser: { name: f.adminName.trim(), email: f.email.trim(), phone: f.phone.trim(), initialPassword: f.password },
        }),
      }, token)
      onCreated(r.message)
    } catch (c) {
      setError(c instanceof Error ? c.message : 'Não foi possível criar a barbearia.')
    } finally { setBusy(false) }
  }

  const input = 'h-11 px-3 rounded-lg bg-white/5 border border-white/15 text-white text-[13px] placeholder:text-white/30 focus:outline-none focus:border-primary'
  return (
    <form onSubmit={submit} className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3">
      {error && <ErrorBanner message={error} />}
      <p className="text-[12px] font-semibold text-white/60 uppercase tracking-wider">Estabelecimento</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input className={input} placeholder="Nome" value={f.name} onChange={(e) => set('name', e.target.value)} />
        <input className={input} placeholder="slug (ex: navalha-classica)" value={f.slug} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
        <input className={input} placeholder="CÓDIGO" maxLength={10} value={f.connectionCode} onChange={(e) => set('connectionCode', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
      </div>
      <p className="text-[12px] font-semibold text-white/60 uppercase tracking-wider mt-1">Dono (Admin)</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className={input} placeholder="Nome do dono" value={f.adminName} onChange={(e) => set('adminName', e.target.value)} />
        <input className={input} type="email" placeholder="E-mail" value={f.email} onChange={(e) => set('email', e.target.value)} />
        <input className={input} placeholder="Telefone (+55...)" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        <input className={input} type="password" placeholder="Senha inicial (mín. 8)" value={f.password} onChange={(e) => set('password', e.target.value)} />
      </div>
      <button disabled={busy} className="h-11 rounded-lg bg-primary text-on-primary font-bold text-[13px] disabled:opacity-50 inline-flex items-center justify-center gap-2 mt-1">
        {busy ? <Icon name="progress_activity" className="animate-spin text-[18px]" /> : <><Icon name="add_business" className="text-[18px]" />Criar barbearia + admin</>}
      </button>
    </form>
  )
}

// FEAT-084: gestão global de usuários (lista por tenant, busca global, editar, reset de senha).
function PlatformUsersPanel({ token, tenants }: { token: string; tenants: PlatformTenant[] }) {
  const [tenantId, setTenantId] = useState(tenants[0]?.tenantId ?? '')
  const [data, setData] = useState<PlatformUserList | null>(null)
  const [searchResults, setSearchResults] = useState<PlatformUser[] | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState<PlatformUser | null>(null)
  const [resetUser, setResetUser] = useState<PlatformUser | null>(null)
  const [tempPassword, setTempPassword] = useState('')

  useEffect(() => { if (!tenantId && tenants[0]) setTenantId(tenants[0].tenantId) }, [tenants, tenantId])

  const load = (tid = tenantId, p = page) => {
    if (!tid) return
    setLoading(true); setError('')
    request<PlatformUserList>(`/platform/tenants/${tid}/users?page=${p}&size=10`, {}, token)
      .then(setData)
      .catch((c) => setError(c instanceof Error ? c.message : 'Falha ao carregar usuários.'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { if (!searchResults) load(tenantId, page); /* eslint-disable-next-line */ }, [tenantId, page])

  async function runSearch(e: FormEvent) {
    e.preventDefault()
    if (query.trim().length < 2) { setSearchResults(null); return }
    setLoading(true); setError('')
    try { setSearchResults(await request<PlatformUser[]>(`/platform/users/search?q=${encodeURIComponent(query.trim())}`, {}, token)) }
    catch (c) { setError(c instanceof Error ? c.message : 'Falha na busca.') }
    finally { setLoading(false) }
  }

  async function doReset() {
    if (!resetUser) return
    setError('')
    try {
      const r = await request<{ temporaryPassword: string }>(`/platform/users/${resetUser.userId}/force-password-reset`, { method: 'POST' }, token)
      setTempPassword(r.temporaryPassword)
    } catch (c) { setError(c instanceof Error ? c.message : 'Falha ao resetar.'); setResetUser(null) }
  }

  const rows = searchResults ?? data?.content ?? []
  const roleBadge: Record<string, string> = { ADMIN: 'bg-amber-500/20 text-amber-300', BARBER: 'bg-blue-500/20 text-blue-300', CLIENT: 'bg-white/10 text-white/60' }

  return (
    <div className="flex flex-col gap-3">
      {error && <ErrorBanner message={error} />}
      {success && <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-2 text-[13px]">{success}</div>}

      <div className="flex flex-col sm:flex-row gap-2">
        <select value={tenantId} onChange={(e) => { setSearchResults(null); setQuery(''); setPage(0); setTenantId(e.target.value) }} className="h-10 px-3 rounded-lg bg-white/5 border border-white/15 text-white text-[13px] flex-1">
          {tenants.map((t) => <option key={t.tenantId} value={t.tenantId} className="bg-[#0b0b0f]">{t.name}</option>)}
        </select>
        <form onSubmit={runSearch} className="flex gap-2 flex-1">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Busca global (nome ou telefone)" className="h-10 px-3 rounded-lg bg-white/5 border border-white/15 text-white text-[13px] flex-1 placeholder:text-white/30" />
          <button className="h-10 px-3 rounded-lg bg-white/10 text-[13px]">Buscar</button>
          {searchResults && <button type="button" onClick={() => { setSearchResults(null); setQuery('') }} className="h-10 px-3 rounded-lg bg-white/5 text-[13px] text-white/60">Limpar</button>}
        </form>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-white/5 rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((u) => (
            <div key={u.userId} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
              <div className={`w-2 h-2 rounded-full shrink-0 ${u.isActive ? 'bg-emerald-400' : 'bg-red-500'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-[13px] truncate">{u.name}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${roleBadge[u.role] ?? 'bg-white/10'}`}>{u.role}</span>
                  {searchResults && u.tenantName && <span className="text-[10px] text-white/40">@ {u.tenantName}</span>}
                </div>
                <p className="text-[11px] text-white/40 truncate">{u.formattedPhone ?? '—'}{u.email ? ` · ${u.email}` : ''}</p>
              </div>
              <button onClick={() => setEditing(u)} className="h-8 px-2.5 rounded-lg text-[12px] border border-white/15 text-white/80 hover:bg-white/10">Editar</button>
              <button onClick={() => { setResetUser(u); setTempPassword('') }} className="h-8 px-2.5 rounded-lg text-[12px] border border-amber-500/40 text-amber-300 hover:bg-amber-500/10">Resetar senha</button>
            </div>
          ))}
          {rows.length === 0 && <p className="text-white/40 text-[13px] text-center py-8">Nenhum usuário.</p>}
        </div>
      )}

      {!searchResults && data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="h-8 px-3 rounded-lg bg-white/5 text-[12px] disabled:opacity-30">Anterior</button>
          <span className="text-[12px] text-white/50">Página {page + 1} de {data.totalPages}</span>
          <button disabled={page + 1 >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="h-8 px-3 rounded-lg bg-white/5 text-[12px] disabled:opacity-30">Próxima</button>
        </div>
      )}

      {editing && (
        <PlatformUserEditModal
          token={token}
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setSuccess('Usuário atualizado.'); if (searchResults) runSearchAgain(); else load() }}
        />
      )}

      {resetUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setResetUser(null)}>
          <div className="bg-[#16161c] border border-white/10 rounded-2xl p-5 w-full max-w-[380px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold mb-2">Resetar senha</h3>
            {tempPassword ? (
              <>
                <p className="text-[12px] text-white/60 mb-2">Senha temporária de <b>{resetUser.name}</b> (anote — exibida só uma vez):</p>
                <code className="block text-[18px] font-mono text-center bg-white/10 rounded-lg py-3 mb-3 tracking-wider">{tempPassword}</code>
                <button onClick={() => { setResetUser(null); setTempPassword('') }} className="w-full h-10 rounded-lg bg-primary text-on-primary text-[13px] font-bold">Fechar</button>
              </>
            ) : (
              <>
                <p className="text-[12px] text-white/60 mb-4">Gerar nova senha temporária para <b>{resetUser.name}</b>? A senha atual será invalidada.</p>
                <div className="flex gap-2">
                  <button onClick={() => setResetUser(null)} className="flex-1 h-10 rounded-lg border border-white/15 text-[13px] text-white/70">Cancelar</button>
                  <button onClick={doReset} className="flex-1 h-10 rounded-lg bg-amber-500 text-black text-[13px] font-bold">Resetar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )

  function runSearchAgain() {
    request<PlatformUser[]>(`/platform/users/search?q=${encodeURIComponent(query.trim())}`, {}, token).then(setSearchResults).catch(() => {})
  }
}

function PlatformUserEditModal({ token, user, onClose, onSaved }: { token: string; user: PlatformUser; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: user.name, phone: (user.phone ?? '').replace(/\D/g, '').replace(/^55/, ''), email: user.email ?? '', role: user.role, isActive: user.isActive })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setBusy(true); setError('')
    try {
      await request(`/platform/users/${user.userId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: f.name.trim(), phone: f.phone, email: f.email.trim() || undefined, role: f.role, isActive: f.isActive }),
      }, token)
      onSaved()
    } catch (c) { setError(c instanceof Error ? c.message : 'Falha ao salvar.'); setBusy(false) }
  }

  const input = 'h-11 px-3 rounded-lg bg-white/5 border border-white/15 text-white text-[13px] w-full placeholder:text-white/30 focus:outline-none focus:border-primary'
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-[#16161c] border border-white/10 rounded-2xl p-5 w-full max-w-[400px] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[15px] font-bold">Editar usuário</h3>
        {error && <ErrorBanner message={error} />}
        <label className="text-[11px] text-white/50">Nome<input className={input} value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} /></label>
        <label className="text-[11px] text-white/50">WhatsApp<input className={input} value={maskPhoneBR(f.phone)} onChange={(e) => setF((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 11) }))} /></label>
        <label className="text-[11px] text-white/50">E-mail<input className={input} type="email" value={f.email} onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} /></label>
        <label className="text-[11px] text-white/50">Cargo
          <select className={input} value={f.role} onChange={(e) => setF((p) => ({ ...p, role: e.target.value }))}>
            <option value="CLIENT" className="bg-[#0b0b0f]">CLIENT</option>
            <option value="BARBER" className="bg-[#0b0b0f]">BARBER</option>
            <option value="ADMIN" className="bg-[#0b0b0f]">ADMIN</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-[13px] text-white/80"><input type="checkbox" checked={f.isActive} onChange={(e) => setF((p) => ({ ...p, isActive: e.target.checked }))} /> Ativo</label>
        <div className="flex gap-2 mt-1">
          <button onClick={onClose} className="flex-1 h-10 rounded-lg border border-white/15 text-[13px] text-white/70">Cancelar</button>
          <button onClick={save} disabled={busy} className="flex-1 h-10 rounded-lg bg-primary text-on-primary text-[13px] font-bold disabled:opacity-50">Salvar</button>
        </div>
      </div>
    </div>
  )
}

// 2FA do DEV (fecha o gap de UX: o backoffice não tinha setup de 2FA).
// Reusa os endpoints /users/me/2fa/{setup,enable,disable} — estilizado dark para o backoffice.
function PlatformSecurityPanel({ token }: { token: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [setupData, setSetupData] = useState<{ otpAuthUri: string; manualSecretKey: string } | null>(null)
  const [code, setCode] = useState('')
  const [disablePwd, setDisablePwd] = useState('')
  const [showDisable, setShowDisable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    request<{ is2faEnabled: boolean }>('/users/me', {}, token)
      .then((me) => setEnabled(me.is2faEnabled))
      .catch((c) => setError(c instanceof Error ? c.message : 'Falha ao carregar status.'))
  }, [token])

  async function startSetup() {
    setBusy(true); setError(''); setSuccess('')
    try {
      setSetupData(await request<{ otpAuthUri: string; manualSecretKey: string }>('/users/me/2fa/setup', { method: 'POST' }, token))
    } catch (c) { setError(c instanceof Error ? c.message : 'Não foi possível iniciar o 2FA.') }
    finally { setBusy(false) }
  }

  async function confirmEnable(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(''); setSuccess('')
    try {
      await request('/users/me/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) }, token)
      setEnabled(true); setSetupData(null); setCode(''); setSuccess('2FA ativado.')
    } catch (c) { setError(c instanceof Error ? c.message : 'Código inválido.') }
    finally { setBusy(false) }
  }

  async function confirmDisable(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(''); setSuccess('')
    try {
      await request('/users/me/2fa', { method: 'DELETE', body: JSON.stringify({ currentPassword: disablePwd, code }) }, token)
      setEnabled(false); setShowDisable(false); setDisablePwd(''); setCode(''); setSuccess('2FA desativado.')
    } catch (c) { setError(c instanceof Error ? c.message : 'Não foi possível desativar.') }
    finally { setBusy(false) }
  }

  return (
    <div className="max-w-md flex flex-col gap-4">
      <div>
        <h1 className="text-[18px] font-bold">Segurança da conta (2FA)</h1>
        <p className="text-[12px] text-white/50">Autenticação em duas etapas (TOTP) — obrigatória para exclusão de barbearias.</p>
      </div>

      {error && <ErrorBanner message={error} />}
      {success && <div className="rounded-lg bg-primary/15 border border-primary/30 text-primary px-4 py-2 text-[13px]">{success}</div>}

      {enabled === null ? (
        <div className="h-24 bg-white/5 rounded-xl animate-pulse" />
      ) : enabled ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
          <div className="inline-flex items-center gap-2 text-green-400 text-[14px] font-semibold">
            <Icon name="verified_user" className="text-[20px]" /> 2FA ativo
          </div>
          {!showDisable ? (
            <button onClick={() => setShowDisable(true)} className="self-start text-[12px] text-white/50 hover:text-white underline">Desativar 2FA</button>
          ) : (
            <form onSubmit={confirmDisable} className="flex flex-col gap-2">
              <input type="password" value={disablePwd} onChange={(e) => setDisablePwd(e.target.value)} placeholder="Senha atual" required className="h-11 px-3 rounded-lg bg-white/5 border border-white/15 text-white text-[13px] placeholder:text-white/30" />
              <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Código do app (6 dígitos)" maxLength={6} required className="h-11 px-3 rounded-lg bg-white/5 border border-white/15 text-white text-[13px] placeholder:text-white/30" />
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowDisable(false); setError('') }} className="h-10 px-4 rounded-lg border border-white/15 text-white/60 text-[12px] font-semibold">Cancelar</button>
                <button disabled={busy || code.length !== 6 || !disablePwd} className="h-10 px-4 rounded-lg bg-error text-on-error text-[12px] font-semibold disabled:opacity-40">Desativar</button>
              </div>
            </form>
          )}
        </div>
      ) : !setupData ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
          <div className="inline-flex items-center gap-2 text-white/60 text-[14px] font-semibold">
            <Icon name="gpp_maybe" className="text-[20px] text-yellow-400" /> 2FA inativo
          </div>
          <button onClick={startSetup} disabled={busy} className="self-start h-10 px-4 rounded-lg bg-primary text-on-primary text-[13px] font-bold disabled:opacity-40 inline-flex items-center gap-2">
            {busy ? <Icon name="progress_activity" className="animate-spin text-[18px]" /> : <Icon name="qr_code_2" className="text-[18px]" />}
            Ativar 2FA
          </button>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center gap-3">
          <p className="text-[13px] text-white/70 self-start">1. Escaneie o QR no app autenticador (Google Authenticator, Authy...):</p>
          <div className="bg-white p-3 rounded-xl"><QRCodeCanvas value={setupData.otpAuthUri} size={172} level="M" /></div>
          <p className="text-[12px] text-white/50 self-start">Ou insira a chave manualmente:</p>
          <code className="text-[12px] font-mono bg-white/10 px-3 py-1.5 rounded-lg break-all w-full text-center text-white">{setupData.manualSecretKey}</code>
          <form onSubmit={confirmEnable} className="w-full flex flex-col gap-2 mt-1">
            <p className="text-[13px] text-white/70">2. Digite o código de 6 dígitos gerado pelo app:</p>
            <input autoFocus inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} className="h-12 px-4 rounded-lg bg-white/5 border border-white/15 text-white text-[20px] tracking-[0.4em] font-bold text-center placeholder:text-white/20" />
            <button disabled={busy || code.length !== 6} className="h-11 rounded-lg bg-primary text-on-primary text-[13px] font-bold disabled:opacity-40">Ativar 2FA</button>
          </form>
        </div>
      )}
    </div>
  )
}
