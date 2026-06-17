import { useState, useEffect, useCallback } from 'react'
import { usePageTitle } from '@/lib/usePageTitle'
import { KpiTiles, RecentVisitors } from '@/components/reception/KpiTiles'
import { DayChart } from '@/components/reception/DayChart'
import { BookingTable } from '@/components/reception/BookingTable'
import { getDashboardStats, getBookingsByDate } from '@/lib/db/bookings'
import { getTenant } from '@/lib/db/tenants'
import { supabase, DEFAULT_TENANT_ID } from '@/lib/supabase'
import { todaySydney } from '@/lib/time'
import type { DashboardStats, Booking } from '@/data/types'

const EMPTY_STATS: DashboardStats = {
  todaysVisitors: 0,
  checkedIn:      0,
  pending:        0,
  held:           0,
  recentVisitors: [],
}

export default function DashboardPage() {
  usePageTitle('Glido | Dashboard')
  const today = todaySydney()

  const [stats,           setStats]           = useState<DashboardStats>(EMPTY_STATS)
  const [bookings,        setBookings]        = useState<Booking[]>([])
  const [isLoading,       setIsLoading]       = useState(true)
  const [capacityByHour,  setCapacityByHour]  = useState<Record<string, number>>({})
  const [defaultCapacity, setDefaultCapacity] = useState<number>(5)

  const refresh = useCallback(async () => {
    try {
      const [s, bs, tenant] = await Promise.all([
        getDashboardStats(),
        getBookingsByDate(today),
        getTenant(DEFAULT_TENANT_ID),
      ])
      setStats(s)
      // Exclude bookings where every slot in the group is already checked in
      // (group check not possible here without the full day's rows by group, so
      //  filter individual checked-in rows — single-slot bookings disappear immediately,
      //  multi-slot groups still show via their remaining scheduled rows)
      setBookings(bs.filter(b => b.status !== 'checked_in'))
      if (tenant) {
        setCapacityByHour((tenant as any).slot_capacity_by_hour ?? {})
        setDefaultCapacity(tenant.max_bookings_per_slot ?? 5)
      }
    } catch (err) {
      console.error('[dashboard] refresh error', err)
    } finally {
      setIsLoading(false)
    }
  }, [today])

  // Initial load + Realtime subscription — replaces polling
  useEffect(() => {
    refresh()
    const channel = supabase
      .channel('dashboard-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => { refresh() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [refresh])

  return (
    <div>
      <KpiTiles stats={stats} loading={isLoading} />

      {stats.held > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.20)', borderRadius: 'var(--r-lg)', padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L14 13H2L8 2Z" stroke="#EF4444" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 6.5V9" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.75" fill="#EF4444"/></svg>
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#DC2626', margin: 0 }}>Attention Required</p>
            <p style={{ fontSize: 14, color: '#DC2626', margin: '2px 0 0', opacity: 0.8 }}>
              {stats.held} booking{stats.held > 1 ? 's' : ''} currently held — ICS clearance pending
            </p>
          </div>
        </div>
      )}

      <BookingTable bookings={bookings} currentDate={today} loading={isLoading} />
      <RecentVisitors stats={stats} loading={isLoading} />
      <DayChart bookings={bookings} loading={isLoading} capacityByHour={capacityByHour} defaultCapacity={defaultCapacity} />
    </div>
  )
}
