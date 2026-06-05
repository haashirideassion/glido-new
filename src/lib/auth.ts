import { supabase } from '@/lib/supabase'

export interface SignUpVisitorOpts {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  company?: string
}

/**
 * Create a visitor account.
 *
 * Calls supabase.auth.signUp() and stores user metadata in auth.users for JWT.
 * The corresponding public.users row is created automatically by a database
 * trigger — no manual insert needed here.
 */
export async function signUpVisitor(opts: SignUpVisitorOpts): Promise<void> {
  // ── Phase 1: Supabase Auth signup ────────────────────────────────────────
  const { data, error: authError } = await supabase.auth.signUp({
    email: opts.email,
    password: opts.password,
    options: {
      // Keep metadata in the JWT so downstream reads have a fallback
      data: {
        first_name: opts.firstName,
        last_name:  opts.lastName,
        phone:      opts.phone  ?? null,
        company:    opts.company ?? null,
        role:       'visitor_registered',
      },
    },
  })

  if (authError) throw authError
  if (!data.user) throw new Error('Signup succeeded but returned no user object')
}

// ── Re-exports ────────────────────────────────────────────────────────────────
// Role helpers and useAuth hook remain in AuthContext as the single source.
export { isReceptionRole, isVisitorRole, useAuth } from '@/contexts/AuthContext'
