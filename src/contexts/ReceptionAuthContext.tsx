import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

interface ReceptionAuthValue {
  role:         string | null
  userId:       string | null
  isAdmin:      boolean   // reception_admin or super_admin
  isStaff:      boolean   // reception_staff only (not admin)
  isSuperAdmin: boolean   // super_admin only
  loading:      boolean
}

const ReceptionAuthContext = createContext<ReceptionAuthValue>({
  role: null, userId: null,
  isAdmin: false, isStaff: false, isSuperAdmin: false,
  loading: true,
})

export function ReceptionAuthProvider({ children }: { children: ReactNode }) {
  const [role,    setRole]    = useState<string | null>(null)
  const [userId,  setUserId]  = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (!session) { setLoading(false); return }
        setUserId(session.user.id)
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle()
        setRole((data as any)?.role ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const isAdmin      = role === 'reception_admin' || role === 'super_admin'
  const isStaff      = role === 'reception_staff'
  const isSuperAdmin = role === 'super_admin'

  return (
    <ReceptionAuthContext.Provider value={{ role, userId, isAdmin, isStaff, isSuperAdmin, loading }}>
      {children}
    </ReceptionAuthContext.Provider>
  )
}

export function useReceptionAuth() {
  return useContext(ReceptionAuthContext)
}
