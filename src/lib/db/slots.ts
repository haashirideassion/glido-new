import { supabaseAdmin as supabase } from '../supabase'
import type { TimeSlot, SlotBusyness } from '../../data/types'
import type { Database } from './types'

type SlotRow = Database['public']['Tables']['time_slots']['Row']

function trimTime(t: string): string {
  return t.slice(0, 5)
}

function rowToSlot(row: SlotRow): TimeSlot {
  const { capacity, confirmed } = row
  let busyness: SlotBusyness = 'available'
  if (confirmed >= capacity) busyness = 'full'
  else if (confirmed / capacity >= 0.6) busyness = 'busy'
  return {
    id:        row.id,
    date:      row.date,
    startTime: trimTime(row.start_time),
    endTime:   trimTime(row.end_time),
    capacity,
    confirmed,
    held:      row.held,
    busyness,
  }
}

function generateDefaultSlots(date: string, capacity = 10): TimeSlot[] {
  return Array.from({ length: 12 }, (_, i) => {
    const h = i + 6
    const start = `${String(h).padStart(2, '0')}:00`
    const end   = `${String(h + 1).padStart(2, '0')}:00`
    return {
      id:        `gen-${date}-${h}`,
      date,
      startTime: start,
      endTime:   end,
      capacity,
      confirmed: 0,
      held:      0,
      busyness:  'available' as SlotBusyness,
    }
  })
}

export async function getSlotsByDate(date: string): Promise<TimeSlot[]> {
  const { data, error } = await supabase
    .from('time_slots')
    .select('*')
    .eq('date', date)
    .order('start_time', { ascending: true })
  if (error) throw error
  if (data.length === 0) return generateDefaultSlots(date)
  return data.map(rowToSlot)
}

export async function findSlot(id: string): Promise<TimeSlot | undefined> {
  const { data, error } = await supabase
    .from('time_slots')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? rowToSlot(data) : undefined
}

export async function getSlotsForDateRange(
  from: string,
  to: string,
): Promise<TimeSlot[]> {
  const { data, error } = await supabase
    .from('time_slots')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })
  if (error) throw error
  return data.map(rowToSlot)
}

export async function incrementSlotConfirmed(slotId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('increment_slot_confirmed', { slot_id: slotId })
  if (error) {
    // Fallback: fetch then update
    const { data: slot, error: fetchErr } = await supabase
      .from('time_slots')
      .select('confirmed')
      .eq('id', slotId)
      .single()
    if (fetchErr) throw fetchErr
    const { error: updateErr } = await supabase
      .from('time_slots')
      .update({ confirmed: slot.confirmed + 1 })
      .eq('id', slotId)
    if (updateErr) throw updateErr
  }
}
