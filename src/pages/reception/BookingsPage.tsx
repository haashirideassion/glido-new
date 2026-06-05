import { useState, useEffect, useCallback, useRef } from 'react'
import { usePageTitle } from '@/lib/usePageTitle'
import { Link, useNavigate } from 'react-router-dom'
import { getBookings, getBookingsByDateRange, cancelBooking } from '@/lib/db/bookings'
import { supabase } from '@/lib/supabase'
import { Icon, ICONS } from '@/lib/Icon'
import { toast } from '@/lib/toast'
import { todaySydney, TZ } from '@/lib/time'
import type { Booking } from '@/data/types'

// ─── Date helpers ────────────────────────────────────────────────────────────
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86400000).toLocaleDateString('sv-SE', { timeZone: TZ })

// ─── Custom filter dropdown — matches original 1:1 ───────────────────────────
interface SelectOpt { value: string; label: string }

function FilterSelect({ placeholder, options, value, onChange }: {
  placeholder: string
  options: SelectOpt[]
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const allOpts = [{ value: '', label: placeholder }, ...options]
  const label = allOpts.find(o => o.value === value)?.label ?? placeholder
  const active = value !== ''

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontSize: 14, padding: '6px 13px', borderRadius: 6,
          cursor: 'pointer', whiteSpace: 'nowrap', outline: 'none',
          transition: 'all 0.12s ease', boxSizing: 'border-box',
          background: active ? 'rgba(252,101,20,0.07)' : '#FFFFFF',
          border: `1px solid ${active ? 'rgba(252,101,20,0.30)' : 'rgba(0,0,0,0.12)'}`,
          color: active ? '#FC6514' : '#1C1917',
          fontFamily: 'inherit',
        }}
      >
        <span>{label}</span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ flexShrink: 0, opacity: 0.55, transition: 'transform 0.15s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 5px)', left: 0, zIndex: 300,
          minWidth: 160, background: '#FFFFFF',
          border: '1px solid rgba(0,0,0,0.09)', borderRadius: 12,
          boxShadow: '0 8px 28px rgba(0,0,0,0.11),0 2px 6px rgba(0,0,0,0.06)',
          padding: 5,
        }}>
          {allOpts.map(opt => {
            const selected = opt.value === value
            return (
              <button
                key={opt.value || '__all__'}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '8px 10px', borderRadius: 8,
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  fontSize: 15, fontFamily: 'inherit',
                  background: selected ? 'rgba(252,101,20,0.08)' : 'transparent',
                  color: selected ? '#FC6514' : '#1C1917',
                  transition: 'background 0.12s ease',
                }}
                onMouseOver={e => { if (!selected) e.currentTarget.style.background = 'rgba(0,0,0,0.04)' }}
                onMouseOut={e  => { if (!selected) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {selected && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6L4.5 8.5 10 3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <span>{opt.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── KPI helpers ──────────────────────────────────────────────────────────────
function calcKpi(bs: Booking[]) {
  const scheduled = bs.filter(b => b.status === 'scheduled').length
  return {
    total:        bs.length,
    scheduled,
    preProcessed: scheduled,
    visitors:     new Set(bs.map(b => b.driverName)).size,
    checkedIn:    bs.filter(b => b.status === 'checked_in').length,
    completed:    bs.filter(b => b.status === 'completed').length,
  }
}

function pctBadge(curr: number, prev: number): { text: string; up: boolean } | null {
  if (curr === 0 && prev === 0) return null
  if (prev === 0) return { text: 'New', up: true }
  const p = Math.round(((curr - prev) / prev) * 100)
  return { text: p >= 0 ? `+${p}%` : `${p}%`, up: p >= 0 }
}

// ─── Booking KPI tiles ────────────────────────────────────────────────────────
const KPI_TILES = [
  { key: 'total',        label: 'Total Bookings', sub: 'Matching filters',           icon: ICONS.bookings, iconBg: 'rgba(28,25,23,0.06)',   iconFg: '#1C1917' },
  { key: 'scheduled',    label: 'Scheduled',      sub: 'Awaiting check-in',          icon: ICONS.calendar, iconBg: 'rgba(59,130,246,0.10)', iconFg: '#3B82F6' },
  { key: 'preProcessed', label: 'Pre-processed',  sub: 'Scheduled, not checked in',  icon: ICONS.calendar, iconBg: 'rgba(251,191,36,0.10)', iconFg: '#FBBF24' },
] as const

type KpiKey = typeof KPI_TILES[number]['key']

function KpiSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
      {KPI_TILES.map(t => (
        <div key={t.key} style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 18, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F3F3F2', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ width: 56, height: 26, borderRadius: 8, background: '#F3F3F2', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
          <div style={{ width: 60, height: 38, borderRadius: 6, background: '#F3F3F2', marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: 100, height: 14, borderRadius: 4, background: '#F3F3F2', marginBottom: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: 80, height: 12, borderRadius: 4, background: '#F3F3F2', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      ))}
    </div>
  )
}

function BookingKpiTiles({ bookings, prevBookings, hasPrev }: {
  bookings: Booking[]
  prevBookings: Booking[]
  hasPrev: boolean
}) {
  const curr = calcKpi(bookings)
  const prev = calcKpi(prevBookings)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
      {KPI_TILES.map(t => {
        const badge = hasPrev ? pctBadge(curr[t.key as KpiKey], prev[t.key as KpiKey]) : null
        return (
          <div key={t.key}
            style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 18, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.07)', transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1),box-shadow 0.2s ease' }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.10),0 2px 6px rgba(0,0,0,0.06)' }}
            onMouseOut={e  => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.07)' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: t.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${t.iconFg}22` }}>
                <Icon name={t.icon} size={20} style={{ color: t.iconFg }} />
              </div>
              {badge ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: badge.up ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', color: badge.up ? '#16A34A' : '#DC2626', border: `1px solid ${badge.up ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
                  {badge.text !== 'New' && <Icon name={badge.up ? ICONS.arrowUp : ICONS.arrowDown} size={11} />}
                  {badge.text}
                </div>
              ) : (
                <div style={{ width: 28, height: 4 }} />
              )}
            </div>
            <p style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: '#1C1917', marginBottom: 5, fontVariantNumeric: 'tabular-nums' }}>{curr[t.key as KpiKey]}</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1C1917', marginBottom: 2 }}>{t.label}</p>
            <p style={{ fontSize: 14, color: '#4B5563', margin: 0 }}>{t.sub}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─── Table skeleton ───────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          {[90, 120, 100, 90, 70, 60, 70, 20].map((w, j) => (
            <td key={j} style={{ padding: '17px 16px' }}>
              <div style={{ width: w, height: 14, borderRadius: 4, background: '#F3F3F2', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

const STATUS_LABEL: Record<string, string> = { scheduled: 'Scheduled', checked_in: 'Checked In', completed: 'Completed', cancelled: 'Cancelled' }
const STATUS_STYLE: Record<string, React.CSSProperties> = {
  scheduled:  { background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' },
  checked_in: { background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' },
  completed:  { background: '#F9FAFB', color: '#6B7280', border: '1px solid #E5E7EB' },
  cancelled:  { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' },
}
const ICS_LABEL: Record<string, string> = { cleared: 'Clear', held: 'Held', examination: 'On Hold', pending: 'Pending', unavailable: 'N/A' }
const ICS_STYLE: Record<string, string> = {
  cleared:     'background:rgba(34,197,94,0.10);color:#16A34A;border:1px solid rgba(34,197,94,0.22);',
  held:        'background:rgba(239,68,68,0.10);color:#EF4444;border:1px solid rgba(239,68,68,0.22);',
  examination: 'background:rgba(251,191,36,0.10);color:#B45309;border:1px solid rgba(251,191,36,0.22);',
  pending:     'background:rgba(0,0,0,0.04);color:#78716C;border:1px solid rgba(0,0,0,0.10);',
}

const FIELD = { width: '100%', padding: '10px 14px', height: 44, fontSize: 14, color: '#1C1917', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.15s ease, box-shadow 0.15s ease' }

// ─── Preset config ────────────────────────────────────────────────────────────
type Preset = 'today' | '7d' | '30d' | 'all'
const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d',   label: '7 Days' },
  { id: '30d',  label: '30 Days' },
  { id: 'all',  label: 'All Time' },
]

function presetDates(p: Preset): { from: string; to: string } {
  const today = todaySydney()
  if (p === 'today') return { from: today, to: today }
  if (p === '7d')   return { from: daysAgo(7),  to: today }
  if (p === '30d')  return { from: daysAgo(30), to: today }
  return { from: '', to: '' }
}

export default function BookingsPage() {
  usePageTitle('Glido | Bookings')

  const [bookings,     setBookings]     = useState<Booking[]>([])
  const [prevBookings, setPrevBookings] = useState<Booking[]>([])
  const [loading,      setLoading]      = useState(true)
  const [kpiLoading,   setKpiLoading]   = useState(true)
  const [preset,       setPreset]       = useState<Preset>('30d')
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [serviceFilter,setServiceFilter]= useState('')
  const [dateFrom,     setDateFrom]     = useState(() => daysAgo(30))
  const [dateTo,       setDateTo]       = useState(() => todaySydney())
  const [liveColor,    setLiveColor]    = useState('#22C55E')
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null)
  const [cancelling,   setCancelling]   = useState(false)
  const navigate = useNavigate()

  const confirmCancel = async () => {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      await cancelBooking(cancelTarget.id)
      toast('Booking cancelled', 'success')
      setCancelTarget(null)
      load()
    } catch {
      toast('Failed to cancel. Please try again.', 'error')
    } finally {
      setCancelling(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setKpiLoading(true)
    setLiveColor('#FBBF24')
    try {
      // ── Current period ──────────────────────────────────────────────────────
      const curr = dateFrom && dateTo
        ? await getBookingsByDateRange(dateFrom, dateTo)
        : await getBookings()
      setBookings(curr)

      // ── Previous period (same span, immediately before) ─────────────────────
      if (dateFrom && dateTo) {
        const f = new Date(dateFrom + 'T00:00:00')
        const t = new Date(dateTo   + 'T00:00:00')
        const span = Math.round((t.getTime() - f.getTime()) / 86400000) // inclusive days - 1
        const prevToDate   = new Date(f.getTime() - 86400000)
        const prevFromDate = new Date(f.getTime() - (span + 1) * 86400000)
        const pf = prevFromDate.toLocaleDateString('sv-SE', { timeZone: TZ })
        const pt = prevToDate.toLocaleDateString('sv-SE', { timeZone: TZ })
        const prev = await getBookingsByDateRange(pf, pt)
        setPrevBookings(prev)
      } else {
        setPrevBookings([])
      }

      setLiveColor('#22C55E')
    } catch {
      setLiveColor('#EF4444')
    } finally {
      setLoading(false)
      setKpiLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const channel = supabase
      .channel('bookings-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => { load() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const filtered = bookings.filter(b => {
    if (statusFilter && b.status !== statusFilter) return false
    if (serviceFilter && b.serviceType !== serviceFilter) return false
    if (search) {
      const s = search.toLowerCase()
      const grp = (b.groupReference ?? '').toLowerCase()
      if (!b.referenceNumber.toLowerCase().includes(s) && !grp.includes(s) && !b.driverName.toLowerCase().includes(s) && !(b.houseBillNumber ?? '').toLowerCase().includes(s)) return false
    }
    return true
  })

  // Group by group_reference (fall back to id for old single bookings)
  const STATUS_RANK: Record<string, number> = { checked_in: 0, scheduled: 1, completed: 2, cancelled: 3 }
  const groupMap = new Map<string, Booking[]>()
  for (const b of filtered) {
    const key = b.groupReference ?? b.id
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(b)
  }
  // One display row per group — primary = first slot; worst status surfaces to top
  const groupedRows = [...groupMap.values()].map(slots => {
    const primary = slots[0]
    const worstStatus = slots.reduce((worst, s) =>
      (STATUS_RANK[s.status] ?? 9) < (STATUS_RANK[worst] ?? 9) ? s.status : worst,
      primary.status
    )
    return { primary, slots, worstStatus, slotCount: slots.length }
  })

  const exportCsv = () => {
    const header = ['Reference', 'Date', 'Time', 'Driver', 'Service', 'HBL', 'ICS', 'Status']
    const rows = filtered.map(b => [b.referenceNumber, b.slotDate, b.slotStartTime, b.driverName, `${b.serviceType} ${b.loadType}`, b.houseBillNumber ?? '', b.icsStatus ?? '', b.status].map(v => `"${String(v).replace(/"/g, '""')}"`))
    const csv = [header, ...rows].map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = 'glido-bookings.csv'
    a.click()
  }

  const applyPreset = (p: Preset) => {
    setPreset(p)
    const { from, to } = presetDates(p)
    setDateFrom(from)
    setDateTo(to)
  }

  const clearAll = () => {
    setStatusFilter('')
    setServiceFilter('')
    setSearch('')
    applyPreset('30d')
  }

  const hasFilters = !!(statusFilter || serviceFilter || search || preset !== '30d')

  return (
    <>
    {/* Pulse animation keyframes */}
    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

    <div>
      {/* KPI tiles */}
      {kpiLoading ? (
        <KpiSkeleton />
      ) : (
        <BookingKpiTiles
          bookings={filtered}
          prevBookings={prevBookings}
          hasPrev={!!(dateFrom && dateTo)}
        />
      )}

      {/* Filter bar — single inline row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <FilterSelect
          placeholder="All Statuses"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'scheduled',  label: 'Scheduled'  },
            { value: 'checked_in', label: 'Checked In' },
            { value: 'completed',  label: 'Completed'  },
            { value: 'cancelled',  label: 'Cancelled'  },
          ]}
        />
        <FilterSelect
          placeholder="All Services"
          value={serviceFilter}
          onChange={setServiceFilter}
          options={[
            { value: 'pickup',  label: 'Pick Up'  },
            { value: 'dropoff', label: 'Drop Off' },
          ]}
        />
        <div style={{ display: 'flex', background: '#F7F6F5', borderRadius: 8, padding: 3, border: '1px solid rgba(0,0,0,0.05)', flexShrink: 0 }}>
          {PRESETS.map(p => {
            const active = preset === p.id
            return (
              <button key={p.id} type="button" onClick={() => applyPreset(p.id)}
                style={{ padding: '6px 13px', fontSize: 14, fontWeight: active ? 700 : 500, borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: active ? '#FFFFFF' : 'transparent', color: active ? '#FC6514' : '#4B5563', boxShadow: active ? '0 1px 3px rgba(0,0,0,0.10)' : 'none', whiteSpace: 'nowrap' }}>
                {p.label}
              </button>
            )
          })}
        </div>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreset('all') }} style={{ ...FIELD, width: 'auto' }} />
        <span style={{ color: '#A8A29E' }}>→</span>
        <input type="date" value={dateTo}   onChange={e => { setDateTo(e.target.value);   setPreset('all') }} style={{ ...FIELD, width: 'auto' }} />
        {hasFilters && (
          <button onClick={clearAll}
            style={{ fontSize: 13, color: '#A8A29E', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', transition: 'color 0.15s' }}
            onMouseOver={e => (e.currentTarget.style.color = '#FC6514')}
            onMouseOut={e  => (e.currentTarget.style.color = '#A8A29E')}
          >Clear filters</button>
        )}
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search ref, driver, HBL…"
          style={{ ...FIELD, flex: 1, minWidth: 160 }}
          onFocus={e => { e.target.style.borderColor = 'rgba(252,101,20,0.50)'; e.target.style.boxShadow = '0 0 0 3px rgba(252,101,20,0.12)' }}
          onBlur={e  => { e.target.style.borderColor = 'rgba(0,0,0,0.12)'; e.target.style.boxShadow = 'none' }}
        />
        <button onClick={exportCsv} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 16px', fontSize: 14, fontWeight: 600, color: '#374151', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, cursor: 'pointer', transition: 'all 0.12s' }}
          onMouseOver={e => { e.currentTarget.style.background = '#F7F6F5' }}
          onMouseOut={e  => { e.currentTarget.style.background = '#fff' }}
        >
          <Icon name={ICONS.download} size={15} /> CSV
        </button>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#A8A29E', whiteSpace: 'nowrap' }}>
          <span style={{ width: 7, height: 7, borderRadius: 9999, background: liveColor, display: 'inline-block', transition: 'background 0.4s' }} />
          Live
        </span>
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: 'rgba(0,0,0,0.01)' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
            {loading ? 'Loading…' : `${groupedRows.length} booking${groupedRows.length !== 1 ? 's' : ''}${filtered.length !== groupedRows.length ? ` (${filtered.length} slots)` : ''}`}
          </span>
          <Link to="/reception/bookings/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg,#FF7A2A,#E85A0A)', color: '#fff', borderRadius: 9999, textDecoration: 'none', boxShadow: '0 2px 8px rgba(252,101,20,0.30)' }}>
            <Icon name={ICONS.add} size={14} /> New Booking
          </Link>
        </div>

        {loading ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F7F6F5', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                  {['Reference', 'Driver', 'Slot', 'Service', 'HBL', 'ICS', 'Status', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <TableSkeleton />
            </table>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: '#A8A29E' }}>
            <Icon name={ICONS.bookings} size={36} style={{ margin: '0 auto 10px', opacity: 0.25, display: 'block' }} />
            <p style={{ fontSize: 14 }}>No bookings match your filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F7F6F5', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                  {['Reference', 'Driver', 'Slot', 'Service', 'HBL', 'ICS', 'Status', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupedRows.map(({ primary: b, worstStatus, slotCount }) => {
                  const displayRef = b.groupReference ?? b.referenceNumber
                  const rowBg = b.icsStatus === 'held' ? 'rgba(239,68,68,0.05)' : worstStatus === 'checked_in' ? 'rgba(34,197,94,0.04)' : worstStatus === 'completed' ? 'rgba(0,0,0,0.01)' : ''
                  const icsStyle = ICS_STYLE[b.icsStatus ?? ''] ?? ''
                  const statusSty = STATUS_STYLE[worstStatus] ?? STATUS_STYLE.scheduled
                  const navTarget = b.groupReference
                    ? `/reception/bookings/group/${b.groupReference}`
                    : `/reception/bookings/${b.id}`
                  return (
                    <tr key={displayRef} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer', transition: 'background 0.12s', background: rowBg }}
                      onMouseOver={e => (e.currentTarget.style.background = 'rgba(252,101,20,0.03)')}
                      onMouseOut={e  => (e.currentTarget.style.background = rowBg)}
                      onClick={() => navigate(navTarget)}
                    >
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span
                            style={{ fontFamily: 'ui-monospace,monospace', fontSize: 14, fontWeight: 700, color: '#FC6514', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                            title="Click to copy"
                            onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(displayRef).then(() => toast('Reference copied', 'info')).catch(() => {}) }}
                          >
                            {displayRef}
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.45, flexShrink: 0 }}>
                              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          </span>
                          {slotCount > 1 && (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 9999, background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', whiteSpace: 'nowrap' }}>
                              {slotCount} slots
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1917', margin: 0 }}>{b.driverName}</p>
                        <p style={{ fontSize: 12, color: '#A8A29E', margin: '1px 0 0' }}>{b.driverPhone ?? '—'}</p>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1917', whiteSpace: 'nowrap', margin: 0 }}>{b.slotStartTime} – {b.slotEndTime}</p>
                        <p style={{ fontSize: 12, color: '#A8A29E', margin: '1px 0 0' }}>{b.slotDate}{slotCount > 1 ? ` +${slotCount - 1} more` : ''}</p>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 500, color: '#4B5563', whiteSpace: 'nowrap' }}>
                        {b.serviceType === 'pickup' ? 'Pick Up' : 'Drop Off'} · {(b.loadType ?? '').toUpperCase()}
                      </td>
                      <td style={{ padding: '14px 16px', fontFamily: 'ui-monospace,monospace', fontSize: 13, color: '#78716C' }}>{b.houseBillNumber ?? b.containerNumber ?? '—'}</td>
                      <td style={{ padding: '14px 16px' }}>
                        {b.icsStatus ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 9999, ...Object.fromEntries(icsStyle.split(';').filter(Boolean).map(s => { const [k, ...v] = s.split(':'); return [k.trim().replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase()), v.join(':').trim()] })) } as any}>
                            {ICS_LABEL[b.icsStatus]}
                          </span>
                        ) : <span style={{ color: '#A8A29E', fontSize: 14 }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ ...statusSty, borderRadius: 20, padding: '4px 10px', fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>
                          {STATUS_LABEL[worstStatus] ?? worstStatus}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'rgba(0,0,0,0.25)', fontSize: 16 }}>→</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>

    {/* Cancel confirmation modal */}
    {cancelTarget && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(0,0,0,0.45)' }}
        onClick={() => setCancelTarget(null)}
      >
        <div style={{ background: '#fff', borderRadius: 16, padding: '28px 28px 24px', maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.20)' }}
          onClick={e => e.stopPropagation()}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1C1917', marginBottom: 10, letterSpacing: '-0.02em' }}>Cancel Booking</h2>
          <p style={{ fontSize: 14, color: '#78716C', lineHeight: 1.6, marginBottom: 24 }}>
            Are you sure you want to cancel booking <strong style={{ fontFamily: 'ui-monospace,monospace', color: '#1C1917' }}>{cancelTarget.referenceNumber}</strong>? This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setCancelTarget(null)}
              style={{ padding: '9px 18px', fontSize: 13, fontWeight: 600, color: '#374151', background: '#F7F6F5', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Keep Booking
            </button>
            <button
              type="button"
              onClick={confirmCancel}
              disabled={cancelling}
              style={{ padding: '9px 18px', fontSize: 13, fontWeight: 600, color: '#fff', background: cancelling ? '#FCA5A5' : '#DC2626', border: 'none', borderRadius: 9, cursor: cancelling ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background 0.13s' }}
            >
              {cancelling ? 'Cancelling…' : 'Cancel Booking'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
