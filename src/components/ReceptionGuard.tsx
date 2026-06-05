import { useEffect, useState } from 'react'
import { Outlet, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ReceptionAuthProvider } from '@/contexts/ReceptionAuthContext'

const ALLOWED_ROLES = ['reception_staff', 'reception_admin', 'super_admin']

export default function ReceptionGuard() {
  const navigate   = useNavigate()
  const [loading,    setLoading]    = useState(true)
  const [authorised, setAuthorised] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          navigate('/login', { replace: true })
          return
        }

        const { data: userRow } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single()

        if (!userRow || !ALLOWED_ROLES.includes(userRow.role as string)) {
          await supabase.auth.signOut()
          navigate('/login', { replace: true })
          return
        }

        setAuthorised(true)
      } catch {
        navigate('/login', { replace: true })
      } finally {
        setLoading(false)
      }
    }

    // Hard 5-second timeout — never hang on Loading… forever
    const timeout = setTimeout(() => {
      navigate('/login', { replace: true })
    }, 5000)

    checkAuth().finally(() => clearTimeout(timeout))

    // React to sign-out after initial auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/login', { replace: true })
      }
    })

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontSize: 14, color: '#78716C' }}>
        Loading…
      </div>
    )
  }

  if (!authorised) {
    return <Navigate to="/login" replace />
  }

  return (
    <ReceptionAuthProvider>
      <Outlet />
    </ReceptionAuthProvider>
  )
}
