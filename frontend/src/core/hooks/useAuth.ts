import { useEffect, useState } from 'react'
import type { Session, Barbershop, User } from '../types'

const SESSION_KEY = 'razorfy.session'
const TENANT_KEY = 'razorfy.tenant'

// Estado global de autenticação (sessão + barbearia conectada), antes preso no App.tsx.
// Persiste em localStorage e escuta `razorfy:unauthorized` (401) para logout automático.
export function useAuth() {
  const [session, setSession] = useState<Session | null>(() => {
    const saved = localStorage.getItem(SESSION_KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved) as Session
    return parsed?.user ? parsed : null
  })
  const [tenant, setTenant] = useState<Barbershop | null>(() => {
    const saved = localStorage.getItem(TENANT_KEY)
    return saved ? (JSON.parse(saved) as Barbershop) : null
  })

  const selectTenant = (t: Barbershop) => { localStorage.setItem(TENANT_KEY, JSON.stringify(t)); setTenant(t) }
  const clearTenant = () => { localStorage.removeItem(TENANT_KEY); setTenant(null) }

  const signIn = (next: Session) => { localStorage.setItem(SESSION_KEY, JSON.stringify(next)); setSession(next) }
  const signOut = () => { localStorage.removeItem(SESSION_KEY); setSession(null) }

  const updateSessionUser = (patch: Partial<User>) => {
    setSession((prev) => {
      if (!prev) return prev
      const next = { ...prev, user: { ...prev.user, ...patch } }
      localStorage.setItem(SESSION_KEY, JSON.stringify(next))
      return next
    })
  }

  // Sessão expirada (401 em chamada autenticada): volta ao login automaticamente.
  useEffect(() => {
    const onUnauthorized = () => signOut()
    window.addEventListener('razorfy:unauthorized', onUnauthorized)
    return () => window.removeEventListener('razorfy:unauthorized', onUnauthorized)
  }, [])

  return { session, tenant, selectTenant, clearTenant, signIn, signOut, updateSessionUser }
}
