import { createClient } from '@supabase/supabase-js'
import type { Database } from './db/types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// In the browser there is no service-role key — alias so existing db/* imports compile unchanged.
// All queries run through RLS with the anon key.
export const supabaseAdmin = supabase

export const DEFAULT_TENANT_ID = 'a0000000-0000-0000-0000-000000000001'
