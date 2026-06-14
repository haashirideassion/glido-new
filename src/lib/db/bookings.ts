import { supabaseAdmin as supabase, DEFAULT_TENANT_ID } from '../supabase'
import { todaySydney } from '../time'
import type {
  Booking, BookingStatus, ServiceType, LoadType,
  PalletType, IcsStatus, DashboardStats,
} from '../../data/types'
import type { Database } from './types'

type BookingRow = Database['public']['Tables']['bookings']['Row']

// Postgres returns time as HH:MM:SS — normalise to HH:MM
function trimTime(t: string): string {
  return t.slice(0, 5)
}

function rowToBooking(row: BookingRow): Booking {
  return {
    id:                 row.id,
    referenceNumber:    row.reference_number,
    sessionId:          row.session_id ?? undefined,
    status:             row.status as BookingStatus,
    serviceType:        row.service_type as ServiceType,
    loadType:           row.load_type as LoadType,
    slotDate:           row.slot_date,
    slotStartTime:      trimTime(row.slot_start_time),
    slotEndTime:        trimTime(row.slot_end_time),
    guestName:          row.guest_name ?? undefined,
    guestEmail:         (row as any).guest_email ?? undefined,
    guestPhone:         row.guest_phone ?? undefined,
    companyName:        (row as any).company_name ?? undefined,
    driverName:         row.driver_name,
    driverPhone:        row.driver_phone ?? undefined,
    houseBillNumber:    row.house_bill_number ?? undefined,
    containerNumber:    row.container_number ?? undefined,
    weightKg:           row.weight_kg ?? undefined,
    volumeCbm:          row.volume_cbm ?? undefined,
    packageCount:       row.package_count ?? undefined,
    palletCount:        row.pallet_count ?? undefined,
    palletType:         (row.pallet_type ?? undefined) as PalletType | undefined,
    storageStartDate:   row.storage_start_date ?? undefined,
    storageDays:        row.storage_days ?? undefined,
    storageCharge:      row.storage_charge ?? undefined,
    shrinkWrapCharge:   row.shrink_wrap_charge ?? undefined,
    slotFee:            row.slot_fee ?? undefined,
    subtotal:           row.subtotal ?? undefined,
    gstAmount:          row.gst_amount ?? undefined,
    totalAmount:        row.total_amount ?? undefined,
    paymentMethod:      (row.payment_method ?? undefined) as 'card' | 'eft' | undefined,
    paymentStatus:      (row.payment_status ?? undefined) as Booking['paymentStatus'],
    icsStatus:          (row.ics_status ?? undefined) as IcsStatus | undefined,
    icsLastCheckedAt:   row.ics_last_checked_at ?? undefined,
    checkedInAt:        row.checked_in_at ?? undefined,
    completedAt:        row.completed_at ?? undefined,
    completionNotes:    row.completion_notes ?? undefined,
    // Extended fields (cast via any — columns added after type generation)
    containerSize:      (row as any).container_size      ?? undefined,
    entryNumber:        (row as any).entry_number        ?? undefined,
    purpose:            (row as any).purpose             ?? undefined,
    consolidator:       (row as any).consolidator        ?? undefined,
    bookingReference:   (row as any).booking_reference   ?? undefined,
    vehicleRegistration:(row as any).vehicle_registration ?? undefined,
    bookingGroupId:     (row as any).booking_group_id    ?? undefined,
    slotIndex:          (row as any).slot_index          ?? undefined,
    groupReference:     (row as any).group_reference     ?? undefined,
    bookingSource:      (row as any).booking_source      ?? undefined,
    tenantId:           row.tenant_id,
    createdAt:          row.created_at,
    updatedAt:          row.updated_at,
  }
}

export async function getBookings(): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(rowToBooking)
}

export async function getBookingsByDateRange(from: string, to: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .gte('slot_date', from)
    .lte('slot_date', to)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(rowToBooking)
}

export async function getBookingById(id: string): Promise<Booking | undefined> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? rowToBooking(data) : undefined
}

export async function getBookingByRef(ref: string): Promise<Booking | undefined> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('reference_number', ref)
    
    .maybeSingle()
  if (error) throw error
  return data ? rowToBooking(data) : undefined
}

export async function getBookingByRego(rego: string): Promise<Booking | undefined> {
  const { data, error } = await (supabase as any)
    .from('bookings')
    .select('*')
    .eq('vehicle_registration', rego.toUpperCase())
    .eq('status', 'scheduled')
    .order('slot_date', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? rowToBooking(data) : undefined
}

export async function findBooking(idOrRef: string): Promise<Booking | undefined> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .or(`id.eq.${idOrRef},reference_number.eq.${idOrRef}`)
    .maybeSingle()
  if (error) throw error
  return data ? rowToBooking(data) : undefined
}

export async function getTodayBookings(): Promise<Booking[]> {
  const today = todaySydney()
  return getBookingsByDate(today)
}

export async function getBookingsByDate(date: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('slot_date', date)
    .order('slot_start_time', { ascending: true })
  if (error) throw error
  return data.map(rowToBooking)
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = todaySydney()

  // All stats for the KPI tiles — scoped to this tenant + today only
  const { data: bookings, error: bError } = await supabase
    .from('bookings')
    .select('status, ics_status')
    .eq('tenant_id', DEFAULT_TENANT_ID)
    .eq('slot_date', today)
    .neq('status', 'cancelled')

  if (bError) throw bError

  // Recent activity feed — scoped to tenant + today, non-cancelled, ordered by creation time
  const { data: recent, error: rError } = await supabase
    .from('bookings')
    .select('*')
    .eq('tenant_id', DEFAULT_TENANT_ID)
    .eq('slot_date', today)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(5)

  if (rError) throw rError

  return {
    todaysVisitors: (bookings ?? []).filter(b => ['scheduled', 'checked_in', 'completed'].includes(b.status!)).length,
    checkedIn:      (bookings ?? []).filter(b => b.status === 'checked_in').length,
    pending:        (bookings ?? []).filter(b => b.status === 'scheduled').length,
    icsHeld:        (bookings ?? []).filter(b => b.ics_status === 'held').length,
    recentVisitors: (recent ?? []).map(rowToBooking),
  }
}

export async function checkInBooking(id: string): Promise<Booking | undefined> {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw error
  return data ? rowToBooking(data) : undefined
}

export async function completeBooking(id: string, notes?: string): Promise<Booking | undefined> {
  const { data, error } = await supabase
    .from('bookings')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      ...(notes ? { completion_notes: notes } : {}),
    })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw error
  return data ? rowToBooking(data) : undefined
}

export async function getBookingsByUserId(userId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('user_id', userId)
    .order('slot_date', { ascending: false })
    .order('slot_start_time', { ascending: false })
    
  if (error) throw error
  return data.map(rowToBooking)
}

export async function rescheduleBooking(
  id: string,
  newDate: string,
  newStart: string,
  newEnd: string,
): Promise<Booking | undefined> {
  const { data, error } = await supabase
    .from('bookings')
    .update({ slot_date: newDate, slot_start_time: newStart, slot_end_time: newEnd })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw error
  return data ? rowToBooking(data) : undefined
}

export async function refreshIcsStatus(id: string): Promise<Booking | undefined> {
  const { data, error } = await supabase
    .from('bookings')
    .update({ ics_last_checked_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw error
  return data ? rowToBooking(data) : undefined
}

export async function cancelBooking(id: string): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'scheduled')  // guard: only cancel scheduled bookings
  if (error) throw error
}

export interface CreateBookingInput {
  serviceType:       ServiceType
  loadType:          LoadType
  slotDate:          string
  slotStartTime:     string
  slotEndTime:       string
  driverName:        string
  driverPhone?:      string
  guestName?:        string
  guestEmail?:       string
  guestPhone?:       string
  companyName?:      string
  userId?:           string
  houseBillNumber?:  string
  containerNumber?:  string
  weightKg?:         number
  volumeCbm?:        number
  packageCount?:     number
  palletCount?:      number
  palletType?:       PalletType
  storageStartDate?: string
  storageDays?:      number
  storageCharge?:    number
  shrinkWrapCharge?: number
  slotFee?:          number
  subtotal?:         number
  gstAmount?:        number
  totalAmount?:      number
  paymentMethod?:    'card' | 'eft'
  paymentStatus?:    Booking['paymentStatus']
  icsStatus?:        IcsStatus
  tenantId:          string
  container_size?:       string
  entry_number?:         string
  purpose?:              string
  consolidator?:         string
  booking_reference?:    string
  vehicle_registration?: string
  booking_group_id?:     string   // shared UUID across all slots in a multi-slot booking
  slot_index?:           number   // 1-based position within the booking group
  group_reference?:      string   // human-readable master ref (GLD-YYYY-XXXXX) shared across group
  reference_number?:     string   // override generated ref (used when caller pre-generates slot refs)
}

export async function getBookingsByGroupRef(groupRef: string): Promise<Booking[]> {
  const { data, error } = await (supabase as any)
    .from('bookings')
    .select('*')
    .eq('group_reference', groupRef)
    .order('slot_index', { ascending: true })
  if (error) throw error
  return (data ?? []).map(rowToBooking)
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const year = new Date().getFullYear()
  const seq  = String(Math.floor(Math.random() * 90000) + 10000)
  const ref  = input.reference_number ?? `GLD-${year}-${seq}`

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      reference_number:   ref,
      status:             'scheduled',
      service_type:       input.serviceType,
      load_type:          input.loadType,
      slot_date:          input.slotDate,
      slot_start_time:    input.slotStartTime,
      slot_end_time:      input.slotEndTime,
      driver_name:        input.driverName,
      driver_phone:       input.driverPhone ?? null,
      guest_name:         input.guestName  ?? null,
      // Only include guest_email when present — omitting it entirely avoids schema cache errors if the column doesn't exist yet
      ...(input.guestEmail ? { guest_email: input.guestEmail } : {}),
      guest_phone:        input.guestPhone ?? null,
      company_name:       input.companyName ?? null,
      house_bill_number:  input.houseBillNumber ?? null,
      container_number:   input.containerNumber ?? null,
      weight_kg:          input.weightKg ?? null,
      volume_cbm:         input.volumeCbm ?? null,
      package_count:      input.packageCount ?? null,
      pallet_count:       input.palletCount ?? null,
      pallet_type:        input.palletType ?? null,
      storage_start_date: input.storageStartDate ?? null,
      storage_days:       input.storageDays ?? null,
      storage_charge:     input.storageCharge ?? null,
      shrink_wrap_charge: input.shrinkWrapCharge ?? null,
      slot_fee:           input.slotFee ?? null,
      subtotal:           input.subtotal ?? null,
      gst_amount:         input.gstAmount ?? null,
      total_amount:       input.totalAmount ?? null,
      payment_method:     input.paymentMethod ?? null,
      payment_status:     input.paymentStatus ?? 'pending',
      ics_status:         input.icsStatus ?? null,
      tenant_id:          input.tenantId,
      user_id:            input.userId ?? null,
      container_size:     input.container_size ?? null,
      entry_number:       input.entry_number ?? null,
      purpose:            input.purpose ?? null,
      consolidator:          input.consolidator ?? null,
      booking_reference:     input.booking_reference ?? null,
      vehicle_registration:  input.vehicle_registration ?? null,
      booking_group_id:      input.booking_group_id ?? null,
      slot_index:            input.slot_index ?? null,
      group_reference:       input.group_reference ?? null,
    } as any)
    .select()
    
    .single()
  if (error) {
    console.error('[createBooking] Supabase insert error:', error.message, error.details, error.hint)
    throw error
  }
  return rowToBooking(data)
}
