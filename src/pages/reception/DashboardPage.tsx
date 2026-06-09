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
      setBookings(bs)
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
      <DayChart bookings={bookings} loading={isLoading} capacityByHour={capacityByHour} defaultCapacity={defaultCapacity} />
      <RecentVisitors stats={stats} loading={isLoading} />
      <BookingTable bookings={bookings} currentDate={today} loading={isLoading} />
    </div>
  )
}
