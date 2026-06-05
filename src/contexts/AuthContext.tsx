import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthUser {
  id: string
  email: string
  role: string
  firstName: string | null
}

interface AuthContextValue {
  session: Session | null
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Attempt to read the users table row with a 5-second timeout.
// If the query hangs or the row doesn't exist, fall back to
// user_metadata from the JWT so the UI never gets stuck.
async function fetchUserRow(supabaseUser: User): Promise<AuthUser> {
  const meta = supabaseUser.user_metadata ?? {}

  const fallback: AuthUser = {
    id:        supabaseUser.id,
    email:     supabaseUser.email ?? '',
    role:      (meta.role as string | undefined) ?? 'visitor_registered',
    firstName: (meta.first_name as string | undefined) ?? null,
  }

  try {
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 5000))

    const query = supabase
      .from('users')
      .select('role, first_name')
      .eq('id', supabaseUser.id)
      .maybeSingle()
      .then(({ data }) => data)

    const data = await Promise.race([query, timeout])

    if (data) {
      return {
        id:        supabaseUser.id,
        email:     supabaseUser.email ?? '',
        role:      data.role,
        firstName: data.first_name ?? null,
      }
    }

    // Timed out or no row — use metadata fallback
    return fallback
  } catch {
    return fallback
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser]       = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Helper: build a user immediately from JWT metadata — no network call.
    const userFromMeta = (su: User): AuthUser => {
      const meta = su.user_metadata ?? {}
      return {
        id:        su.id,
        email:     su.email ?? '',
        role:      (meta.role       as string | undefined) ?? 'visitor_registered',
        firstName: (meta.first_name as string | undefined) ?? null,
      }
    }

    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setSession(session)
      if (session?.user) {
        setUser(userFromMeta(session.user))
        fetchUserRow(session.user).then(u => { if (mounted) setUser(u) })
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      setSession(session)
      if (session?.user) {
        setUser(userFromMeta(session.user))
        // Defer the DB enrichment out of the callback so it runs after the
        // auth lock is released (Supabase warns against awaited calls inside
        // onAuthStateChange — they deadlock the internal lock).
        const su = session.user
        setTimeout(() => {
          fetchUserRow(su).then(u => { if (mounted) setUser(u) })
        }, 0)
      } else if (event === 'SIGNED_OUT') {
        // Only an explicit sign-out clears the user. Transient events
        // (TOKEN_REFRESHED, INITIAL_SESSION, focus re-checks) with a momentarily
        // null session must not wipe a valid logged-in session.
        setUser(null)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function isReceptionRole(role: string) {
  return role === 'reception_staff' || role === 'reception_admin'
}

export function isVisitorRole(role: string) {
  return role === 'visitor_registered' || role === 'visitor'
}
