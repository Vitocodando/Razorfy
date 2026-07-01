import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { request } from '../../../core/api/client'
import type { Session, User } from '../../../core/types'
import { Icon, ErrorBanner, SuccessBanner, TopBar } from '../../../core/ui/primitives'

type MeResponse = {
  userId: string
  name: string
  email: string
  phone: string | null
  notificationPushEnabled: boolean
  notificationWhatsappEnabled: boolean
  role: string
  hasPassword: boolean
  is2faEnabled: boolean
}

export function SettingsPage({ session, onSignOut, onDisconnect, onProfileChange }: {
  session: Session
  onSignOut: () => void
  onDisconnect: () => void
  onProfileChange: (patch: Partial<User>) => void
}) {
  const token = session.accessToken
  const [me, setMe] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [profile, setProfile] = useState({ name: '', phone: '', push: true, whatsapp: true })
  const [pwd, setPwd] = useState({ current: '', next: '' })
  const [delPwd, setDelPwd] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    request<MeResponse>('/users/me', {}, token)
      .then((data) => {
        setMe(data)
        setProfile({ name: data.name, phone: data.phone ?? '', push: data.notificationPushEnabled, whatsapp: data.notificationWhatsappEnabled })
      })
      .catch((c) => setError(c.message))
      .finally(() => setLoading(false))
  }, [token])

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(''); setSuccess('')
    try {
      const r = await request<MeResponse>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone || undefined,
          notificationPushEnabled: profile.push,
          notificationWhatsappEnabled: profile.whatsapp,
        }),
      }, token)
      setMe(r)
      onProfileChange({ name: r.name, phone: r.phone })
      setSuccess('Perfil atualizado.')
    } catch (c) {
      setError(c instanceof Error ? c.message : 'Não foi possível salvar.')
    } finally { setBusy(false) }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(''); setSuccess('')
    try {
      await request('/users/me/password', { method: 'PUT', body: JSON.stringify({ currentPassword: pwd.current, newPassword: pwd.next }) }, token)
      setPwd({ current: '', next: '' })
      setSuccess('Senha alterada.')
    } catch (c) {
      setError(c instanceof Error ? c.message : 'Não foi possível trocar a senha.')
    } finally { setBusy(false) }
  }

  async function deleteAccount() {
    setBusy(true); setError('')
    try {
      await request('/users/me', { method: 'DELETE', body: JSON.stringify({ currentPassword: delPwd }) }, token)
      onSignOut()
    } catch (c) {
      setError(c instanceof Error ? c.message : 'Não foi possível excluir a conta.')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen pb-20 lg:pb-4">
      <div className="lg:hidden"><TopBar title="Conta" /></div>
      <main className="flex-grow w-full max-w-[640px] mx-auto px-4 md:px-8 py-4 lg:py-8 flex flex-col gap-5">
        <div className="hidden lg:block">
          <h1 className="text-[28px] font-bold text-on-surface tracking-tight">Configurações</h1>
        </div>
        {error && <ErrorBanner message={error} />}
        {success && <SuccessBanner message={success} />}

        {loading || !me ? (
          <div className="h-40 bg-surface-container-lowest rounded-xl animate-pulse" />
        ) : (
          <>
            {/* Perfil + notificações */}
            <form onSubmit={saveProfile} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 flex flex-col gap-3">
              <h2 className="text-[15px] font-bold text-on-surface">Perfil</h2>
              <label className="text-[12px] text-on-surface-variant">Nome
                <input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} minLength={3} required className="h-11 px-3 mt-1 w-full bg-surface-container border border-on-surface/10 rounded-lg text-[13px] text-on-surface" />
              </label>
              <label className="text-[12px] text-on-surface-variant">E-mail (não editável)
                <input value={me.email} disabled className="h-11 px-3 mt-1 w-full bg-surface-container-high border border-on-surface/10 rounded-lg text-[13px] text-on-surface-variant" />
              </label>
              <label className="text-[12px] text-on-surface-variant">Telefone
                <input value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="+55..." className="h-11 px-3 mt-1 w-full bg-surface-container border border-on-surface/10 rounded-lg text-[13px] text-on-surface" />
              </label>
              <label className="flex items-center justify-between gap-3 py-1">
                <span className="text-[13px] text-on-surface">Notificações Push</span>
                <input type="checkbox" checked={profile.push} onChange={(e) => setProfile((p) => ({ ...p, push: e.target.checked }))} className="w-4 h-4 accent-primary" />
              </label>
              <label className="flex items-center justify-between gap-3 py-1">
                <span className="text-[13px] text-on-surface">Notificações WhatsApp</span>
                <input type="checkbox" checked={profile.whatsapp} onChange={(e) => setProfile((p) => ({ ...p, whatsapp: e.target.checked }))} className="w-4 h-4 accent-primary" />
              </label>
              <button disabled={busy} className="h-11 rounded-lg bg-primary text-on-primary text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40">Salvar perfil</button>
            </form>

            {/* Senha */}
            {me.hasPassword && (
              <form onSubmit={savePassword} className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 flex flex-col gap-3">
                <h2 className="text-[15px] font-bold text-on-surface">Trocar senha</h2>
                <input type="password" value={pwd.current} onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))} placeholder="Senha atual" required className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                <input type="password" value={pwd.next} onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} placeholder="Nova senha (mín. 6)" minLength={6} required className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                <button disabled={busy} className="h-11 rounded-lg bg-secondary text-on-secondary text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40">Alterar senha</button>
              </form>
            )}

            {/* Segurança — 2FA TOTP (FEAT-076) */}
            {me.hasPassword && (
              <TwoFactorSettings
                token={token}
                enabled={me.is2faEnabled}
                onChange={(v) => setMe((m) => (m ? { ...m, is2faEnabled: v } : m))}
              />
            )}

            {/* Desconectar barbearia (FEAT-074 RN04) — apenas cliente */}
            {me.role === 'CLIENT' && (
              <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 flex flex-col gap-3">
                <h2 className="text-[15px] font-bold text-on-surface">Barbearia conectada</h2>
                <p className="text-[12px] text-on-surface-variant">Desconectar encerra sua sessão e volta para a tela de conexão por código.</p>
                <button onClick={onDisconnect} className="h-11 rounded-lg border border-on-surface/20 text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant hover:bg-surface-container-high inline-flex items-center justify-center gap-2">
                  <Icon name="link_off" className="text-[18px]" />
                  Desconectar barbearia
                </button>
              </div>
            )}

            {/* Excluir conta (apenas cliente) */}
            {me.role === 'CLIENT' && (
              <div className="bg-surface-container-lowest border border-error/30 rounded-xl p-4 flex flex-col gap-3">
                <h2 className="text-[15px] font-bold text-error">Excluir minha conta</h2>
                <p className="text-[12px] text-on-surface-variant">Sua conta será anonimizada (LGPD) e o saldo de cashback será perdido permanentemente. Cancele agendamentos futuros antes.</p>
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)} className="h-11 rounded-lg border border-error text-error text-[12px] font-semibold uppercase tracking-wider hover:bg-error-container">Excluir conta</button>
                ) : (
                  <>
                    <input type="password" value={delPwd} onChange={(e) => setDelPwd(e.target.value)} placeholder="Confirme com sua senha" className="h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]" />
                    <div className="flex gap-2">
                      <button onClick={() => { setConfirmDelete(false); setDelPwd('') }} className="flex-1 h-11 rounded-lg border border-on-surface/20 text-[12px] font-semibold text-on-surface-variant">Cancelar</button>
                      <button onClick={deleteAccount} disabled={busy || !delPwd} className="flex-1 h-11 rounded-lg bg-error text-on-error text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40">Confirmar exclusão</button>
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

// FEAT-076: card de Segurança (2FA) em Configurações. Ativação exige provar o 1º código (RN02).
function TwoFactorSettings({ token, enabled, onChange }: {
  token: string
  enabled: boolean
  onChange: (v: boolean) => void
}) {
  const [setupData, setSetupData] = useState<{ otpAuthUri: string; manualSecretKey: string } | null>(null)
  const [code, setCode] = useState('')
  const [disablePwd, setDisablePwd] = useState('')
  const [showDisable, setShowDisable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, 6)

  async function startSetup() {
    setBusy(true); setError('')
    try {
      setSetupData(await request<{ otpAuthUri: string; manualSecretKey: string }>('/users/me/2fa/setup', { method: 'POST' }, token))
    } catch (c) { setError(c instanceof Error ? c.message : 'Falha ao iniciar 2FA.') } finally { setBusy(false) }
  }
  async function confirmEnable(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await request('/users/me/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) }, token)
      setSetupData(null); setCode(''); onChange(true)
    } catch (c) { setError(c instanceof Error ? c.message : 'Código inválido.') } finally { setBusy(false) }
  }
  async function disable(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await request('/users/me/2fa', { method: 'DELETE', body: JSON.stringify({ currentPassword: disablePwd, code }) }, token)
      setShowDisable(false); setDisablePwd(''); setCode(''); onChange(false)
    } catch (c) { setError(c instanceof Error ? c.message : 'Não foi possível desativar.') } finally { setBusy(false) }
  }

  const input = 'h-11 px-3 bg-surface-container border border-on-surface/10 rounded-lg text-[13px]'
  return (
    <div className="bg-surface-container-lowest border border-on-surface/10 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-on-surface">Verificação em duas etapas</h2>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${enabled ? 'bg-emerald-500/15 text-emerald-600' : 'bg-on-surface/10 text-on-surface-variant'}`}>
          {enabled ? 'Ativa' : 'Inativa'}
        </span>
      </div>
      <p className="text-[12px] text-on-surface-variant">Proteja sua conta exigindo um código do app autenticador (Google Authenticator, Authy) ao entrar.</p>
      {error && <ErrorBanner message={error} />}

      {!enabled && !setupData && (
        <button onClick={startSetup} disabled={busy} className="h-11 rounded-lg bg-secondary text-on-secondary text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40 inline-flex items-center justify-center gap-2">
          <Icon name="add_moderator" className="text-[18px]" />Habilitar 2FA
        </button>
      )}

      {!enabled && setupData && (
        <form onSubmit={confirmEnable} className="flex flex-col items-center gap-3">
          <p className="text-[12px] text-on-surface-variant self-start">1. Escaneie o QR Code no seu app autenticador:</p>
          <div className="bg-white p-3 rounded-xl"><QRCodeCanvas value={setupData.otpAuthUri} size={172} level="M" /></div>
          <p className="text-[11px] text-on-surface-variant self-start">Ou insira manualmente a chave:</p>
          <code className="text-[12px] font-mono bg-surface-container px-3 py-1.5 rounded-lg break-all w-full text-center">{setupData.manualSecretKey}</code>
          <p className="text-[12px] text-on-surface-variant self-start">2. Digite o código gerado para confirmar:</p>
          <input autoFocus inputMode="numeric" value={code} onChange={(e) => setCode(onlyDigits(e.target.value))} placeholder="000000" maxLength={6} className={`${input} w-full text-center text-[20px] tracking-[0.4em] font-bold`} />
          <div className="flex gap-2 w-full">
            <button type="button" onClick={() => { setSetupData(null); setCode('') }} className="flex-1 h-11 rounded-lg border border-on-surface/20 text-[12px] font-semibold text-on-surface-variant">Cancelar</button>
            <button disabled={busy || code.length !== 6} className="flex-1 h-11 rounded-lg bg-primary text-on-primary text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40">Ativar</button>
          </div>
        </form>
      )}

      {enabled && !showDisable && (
        <button onClick={() => { setShowDisable(true); setError('') }} className="h-11 rounded-lg border border-error text-error text-[12px] font-semibold uppercase tracking-wider hover:bg-error-container">Desativar 2FA</button>
      )}
      {enabled && showDisable && (
        <form onSubmit={disable} className="flex flex-col gap-2">
          <p className="text-[12px] text-on-surface-variant">Confirme com sua senha e um código atual do app:</p>
          <input type="password" value={disablePwd} onChange={(e) => setDisablePwd(e.target.value)} placeholder="Senha atual" required className={input} />
          <input inputMode="numeric" value={code} onChange={(e) => setCode(onlyDigits(e.target.value))} placeholder="Código (6 dígitos)" maxLength={6} required className={input} />
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowDisable(false); setDisablePwd(''); setCode('') }} className="flex-1 h-11 rounded-lg border border-on-surface/20 text-[12px] font-semibold text-on-surface-variant">Cancelar</button>
            <button disabled={busy || !disablePwd || code.length !== 6} className="flex-1 h-11 rounded-lg bg-error text-on-error text-[12px] font-semibold uppercase tracking-wider disabled:opacity-40">Confirmar</button>
          </div>
        </form>
      )}
    </div>
  )
}
