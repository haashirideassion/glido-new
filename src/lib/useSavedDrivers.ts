import { supabase, DEFAULT_TENANT_ID } from '@/lib/supabase'

export interface SavedDriver {
  id: string
  name: string
  phone: string
  vehicle_registration: string
}

export async function fetchSavedDrivers(): Promise<SavedDriver[]> {
  const { data } = await supabase
    .from('saved_drivers')
    .select('id, name, phone, vehicle_registration')
    .eq('tenant_id', DEFAULT_TENANT_ID)
    .order('name')
  return data ?? []
}

export async function upsertSavedDriver(d: Omit<SavedDriver, 'id'>) {
  await supabase.from('saved_drivers').upsert(
    { tenant_id: DEFAULT_TENANT_ID, ...d },
    { onConflict: 'tenant_id,name,vehicle_registration', ignoreDuplicates: true }
  )
}
