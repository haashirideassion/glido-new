import { supabaseAdmin as supabase } from '../supabase'
import { todaySydney } from '../time'
import type { WalkIn, WalkInPurpose } from '../../data/types'
import type { Database } from './types'

type WalkInRow = Database['public']['Tables']['walk_ins']['Row']

function rowToWalkIn(row: WalkInRow): WalkIn {
  return {
    id:                  row.id,
    tenantId:            row.tenant_id,
    purpose:             row.purpose as WalkInPurpose,
    visitorName:         row.visitor_name,
    contactNumber:       row.contact_number ?? undefined,
    personBeingVisited:  row.person_being_visited ?? undefined,
    reason:              row.reason ?? undefined,
    arrivedAt:           row.arrived_at,
    licenceCaptured:     row.licence_captured,
    dismissed:           row.dismissed,
    dismissedAt:         row.dismissed_at ?? undefined,
  }
}

export async function getActiveWalkIns(tenantId: string): Promise<WalkIn[]> {
  const { data, error } = await supabase
    .from('walk_ins')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('dismissed', false)
    .order('arrived_at', { ascending: true })
  if (error) throw error
  return data.map(rowToWalkIn)
}

export async function getAllWalkIns(tenantId: string): Promise<WalkIn[]> {
  const { data, error } = await supabase
    .from('walk_ins')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('arrived_at', { ascending: false })
  if (error) throw error
  return data.map(rowToWalkIn)
}

export interface CreateWalkInInput {
  tenantId:            string
  purpose:             WalkInPurpose
  visitorName:         string
  contactNumber?:      string
  personBeingVisited?: string
  reason?:             string
  licenceCaptured?:    boolean
}

export async function createWalkIn(input: CreateWalkInInput): Promise<WalkIn> {
  const { data, error } = await supabase
    .from('walk_ins')
    .insert({
      tenant_id:            input.tenantId,
      purpose:              input.purpose,
      visitor_name:         input.visitorName,
      contact_number:       input.contactNumber ?? null,
      person_being_visited: input.personBeingVisited ?? null,
      reason:               input.reason ?? null,
      licence_captured:     input.licenceCaptured ?? false,
    })
    .select()
    .single()
  if (error) throw error
  return rowToWalkIn(data)
}

export async function dismissWalkIn(id: string): Promise<void> {
  const { error } = await supabase
    .from('walk_ins')
    .update({ dismissed: true, dismissed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function getTodayWalkInCount(tenantId: string): Promise<number> {
  const today = todaySydney()
  const { count, error } = await supabase
    .from('checkin_records')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_walk_in', true)
    .gte('check_in_time', `${today}T00:00:00Z`)
    .lte('check_in_time', `${today}T23:59:59Z`)
  if (error) throw error
  return count ?? 0
}

export async function getVisitorLogRecords(params: {
  tenantId: string
  from?: string
  to?: string
  status?: string
  search?: string
}) {
  let query = supabase
    .from('checkin_records')
    .select('*, bookings(*)')
    .eq('tenant_id', params.tenantId)

  if (params.from) query = query.gte('check_in_time', params.from)
  if (params.to)   query = query.lte('check_in_time', params.to)

  const { data, error } = await query.order('check_in_time', { ascending: false })
  if (error) throw error

  let records = data

  if (params.status) {
    records = records.filter((r) => (r.bookings as any)?.status === params.status)
  }

  if (params.search) {
    const s = params.search.toLowerCase()
    records = records.filter(
      (r) =>
        (r.licence_name ?? '').toLowerCase().includes(s) ||
        (r.licence_number ?? '').toLowerCase().includes(s) ||
        (r.visit_person_name ?? '').toLowerCase().includes(s),
    )
  }

  return records as any[]
}
