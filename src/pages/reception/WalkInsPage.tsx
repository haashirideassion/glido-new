import { useState, useEffect, useCallback } from 'react'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { usePageTitle } from '@/lib/usePageTitle'
import { Icon, ICONS } from '@/lib/Icon'
import { fmtTime } from '@/lib/time'
import { getActiveWalkIns } from '@/lib/db/walk-ins'
import { supabase, DEFAULT_TENANT_ID } from '@/lib/supabase'
import { todaySydney, TZ } from '@/lib/time'
import type { WalkIn, WalkInPurpose } from '@/data/types'

const PURPOSE_LABEL: Record<WalkInPurpose, string> = {
  walk_in_pickup:  'Pick Up',
  walk_in_dropoff: 'Drop Off',
  visit_person:    'Visiting Person',
}

// ── Unified visitor entry shape ───────────────────────────────────────────────
interface VisitorEntry {
  id:                 string
  type:               'walkin' | 'booking'
  name:               string
  phone:              string | null
  purpose:            string
  arrivedAt:          string
  licenceCaptured:    boolean
  personBeingVisited: string | null
  bookingRef?:        string
  serviceType?:       string
  loadType?:          string
}

function walkInToEntry(w: WalkIn): VisitorEntry {
  return {
    id:                 w.id,
    type:               'walkin',
    name:               w.visitorName,
    phone:              w.contactNumber ?? null,
    purpose:            PURPOSE_LABEL[w.purpose] ?? w.purpose,
    arrivedAt:          w.arrivedAt,
    licenceCaptured:    w.licenceCaptured,
    personBeingVisited: w.personBeingVisited ?? null,
  }
}

function toSydneyDate(utcIso: string | null | undefined): string {
  if (!utcIso) return ''
  return new Date(utcIso).toLocaleDateString('sv-SE', { timeZone: 'Australia/Sydney' })
}

function bookingToEntry(b: any): VisitorEntry {
  return {
    id:                 b.id,
    type:               'booking',
    name:               b.driver_name,
    phone:              b.driver_phone ?? null,
    purpose:            b.service_type === 'pickup' ? 'Pick Up' : 'Drop Off',
    arrivedAt:          toSydneyDate(b.checked_in_at) || toSydneyDate(b.created_at) || '',
    licenceCaptured:    true,
    personBeingVisited: null,
    bookingRef:         b.reference_number,
    serviceType:        b.service_type,
    loadType:           b.load_type,
  }
}

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86400000).toLocaleDateString('sv-SE', { timeZone: TZ })

type Preset = 'today' | '7d' | '30d' | 'all'

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d',    label: '7 Days' },
  { id: '30d',   label: '30 Days' },
  { id: 'all',   label: 'All Time' },
]

function presetDates(p: Preset): { from: string; to: string } {
  const today = todaySydney()
  if (p === 'today') return { from: today, to: today }
  if (p === '7d')   return { from: daysAgo(7),  to: today }
  if (p === '30d')  return { from: daysAgo(30), to: today }
  return { from: '', to: '' }
}

// ── Shared input field style ──────────────────────────────────────────────────
const FIELD: React.CSSProperties = {
  padding: '10px 14px', height: 44, fontSize: 14, color: '#1C1917',
  background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8,
  outline: 'none', boxSizing: 'border-box',
}

export default function WalkInsPage() {
  usePageTitle('Glido | Visitor Management')
  const [visitors, setVisitors] = useState<VisitorEntry[]>([])
  const [loading,  setLoading]  = useState(true)

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [preset,      setPreset]      = useState<Preset>('today')
  const [dateFrom,    setDateFrom]    = useState(() => todaySydney())
  const [dateTo,      setDateTo]      = useState(() => todaySydney())
  const [typeFilter,  setTypeFilter]  = useState('')   // '' | 'walkin' | 'booking'
  const [search,      setSearch]      = useState('')

  const applyPreset = (p: Preset) => {
    setPreset(p)
    const { from, to } = presetDates(p)
    setDateFrom(from)
    setDateTo(to)
  }

  // ── Data fetching (unchanged logic) ──────────────────────────────────────────
  const load = useCallback(async () => {
    console.log('[Visitors] loading...')
    try {
      const [walkIns, bookingsRes] = await Promise.all([
        getActiveWalkIns(DEFAULT_TENANT_ID),
        supabase
          .from('bookings')
          .select('*')
          .eq('tenant_id', DEFAULT_TENANT_ID)
          .eq('status', 'checked_in')
          .order('checked_in_at', { ascending: true }),
      ])

      console.log('[Visitors] walkIns result:', walkIns, null)
      console.log('[Visitors] bookings result:', bookingsRes.data, bookingsRes.error)

      const walkInEntries  = walkIns.map(walkInToEntry)
      const bookingEntries = ((bookingsRes.data ?? []) as any[]).map(bookingToEntry)
      const merged = [...walkInEntries, ...bookingEntries]
        .sort((a, b) => new Date(a.arrivedAt).getTime() - new Date(b.arrivedAt).getTime())

      console.log('[Visitors] merged visitors:', merged.length)
      setVisitors(merged)
    } catch (err) {
      console.log('[Visitors] ERROR:', err)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('visitors-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'walk_ins' },  () => { load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => { load() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  // ── Filtering ─────────────────────────────────────────────────────────────────
  const filtered = visitors.filter(v => {
    if (typeFilter === 'walkin'  && v.type !== 'walkin')  return false
    if (typeFilter === 'booking' && v.type !== 'booking') return false

    if (dateFrom || dateTo) {
      const d = v.arrivedAt.slice(0, 10)
      if (dateFrom && d < dateFrom) return false
      if (dateTo   && d > dateTo)   return false
    }

    if (search) {
      const s = search.toLowerCase()
      if (
        !v.name.toLowerCase().includes(s) &&
        !(v.phone ?? '').toLowerCase().includes(s) &&
        !(v.bookingRef ?? '').toLowerCase().includes(s)
      ) return false
    }

    return true
  })

  // ── KPI counts ────────────────────────────────────────────────────────────────
  const kpi = {
    checkedIn:  filtered.filter(v => v.type === 'booking').length,
    completed:  filtered.filter(v => v.type === 'booking' && (v as any).status === 'completed').length,
  }

  // ── CSV export ────────────────────────────────────────────────────────────────
  const exportCsv = () => {
    const header = ['Type', 'Name', 'Phone', 'Purpose', 'Arrived', 'Licence', 'Reference']
    const rows = filtered.map(v => [
      v.type === 'booking' ? 'Booking' : 'Walk-in',
      v.name,
      v.phone ?? '',
      v.purpose,
      fmtTime(v.arrivedAt),
      v.licenceCaptured ? 'Captured' : 'Not captured',
      v.bookingRef ?? '',
    ].map(val => `"${String(val).replace(/"/g, '""')}"`))
    const csv = [header, ...rows].map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `visitors-${todaySydney()}.csv`
    a.click()
  }

  // ── KPI tile style ────────────────────────────────────────────────────────────
  const KPI_DEF = [
    { key: 'checkedIn', label: 'Checked In', sub: 'Booking check-ins',  icon: ICONS.userCheck, iconBg: 'rgba(34,197,94,0.10)',  iconFg: '#22C55E', val: kpi.checkedIn },
    { key: 'completed', label: 'Completed',  sub: 'Processed bookings', icon: ICONS.bookings,  iconBg: 'rgba(107,114,128,0.10)', iconFg: '#6B7280', val: kpi.completed },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`@keyframes vp-pulse{0%,100%{opacity:1}50%{opacity:0.45}}`}</style>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
        {loading
          ? KPI_DEF.map(t => (
              <div key={t.key} style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 18, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F3F3F2', animation: 'vp-pulse 1.5s ease-in-out infinite' }} />
                </div>
                <div style={{ width: 60, height: 38, borderRadius: 6, background: '#F3F3F2', marginBottom: 8, animation: 'vp-pulse 1.5s ease-in-out infinite' }} />
                <div style={{ width: 100, height: 14, borderRadius: 4, background: '#F3F3F2', animation: 'vp-pulse 1.5s ease-in-out infinite' }} />
              </div>
            ))
          : KPI_DEF.map(t => (
              <div key={t.key}
                style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 18, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.07)', transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1),box-shadow 0.2s ease' }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.10),0 2px 6px rgba(0,0,0,0.06)' }}
                onMouseOut={e  => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.07)' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: t.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.iconFg}22` }}>
                    <Icon name={t.icon} size={20} style={{ color: t.iconFg }} />
                  </div>
                </div>
                <p style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: '#1C1917', marginBottom: 5, fontVariantNumeric: 'tabular-nums' }}>{t.val}</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#1C1917', marginBottom: 2 }}>{t.label}</p>
                <p style={{ fontSize: 14, color: '#4B5563', margin: 0 }}>{t.sub}</p>
              </div>
            ))
        }
      </div>

      {/* Filter bar — single inline row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <CustomSelect
          placeholder="All Types"
          value={typeFilter}
          onChange={v => setTypeFilter(v)}
          width={140}
          options={[
            { value: 'walkin',  label: 'Walk-in Only' },
            { value: 'booking', label: 'Booking Only' },
          ]}
        />
        <div style={{ display: 'flex', background: '#F7F6F5', borderRadius: 8, padding: 3, border: '1px solid rgba(0,0,0,0.05)', flexShrink: 0 }}>
          {PRESETS.map(p => {
            const active = preset === p.id
            return (
              <button key={p.id} type="button" onClick={() => applyPreset(p.id)}
                style={{ padding: '6px 12px', fontSize: 13, fontWeight: active ? 700 : 500, borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: active ? '#FFFFFF' : 'transparent', color: active ? '#FC6514' : '#4B5563', boxShadow: active ? '0 1px 3px rgba(0,0,0,0.10)' : 'none', whiteSpace: 'nowrap' }}>
                {p.label}
              </button>
            )
          })}
        </div>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreset('all') }} style={{ ...FIELD, width: 'auto' }} />
        <span style={{ color: '#A8A29E' }}>→</span>
        <input type="date" value={dateTo}   onChange={e => { setDateTo(e.target.value);   setPreset('all') }} style={{ ...FIELD, width: 'auto' }} />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, phone, ref…"
          style={{ ...FIELD, flex: 1, minWidth: 160 }}
        />
        <button onClick={exportCsv}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 16px', fontSize: 14, fontWeight: 600, color: '#374151', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap' }}
          onMouseOver={e => (e.currentTarget.style.background = '#F7F6F5')}
          onMouseOut={e  => (e.currentTarget.style.background = '#fff')}
        >
          <Icon name={ICONS.download} size={15} /> CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.07)' }}>
        {/* Table header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: 'rgba(0,0,0,0.01)' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
            {loading ? 'Loading…' : `${filtered.length} visitor${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F7F6F5', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                {['Type', 'Name', 'Phone', 'Purpose', 'Arrived', 'Licence'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: '48px 0', textAlign: 'center', color: '#A8A29E', fontSize: 14 }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '48px 0', textAlign: 'center', color: '#A8A29E', fontSize: 14 }}>No visitors match your filters.</td></tr>
              ) : filtered.map(v => (
                <tr
                  key={`${v.type}-${v.id}`}
                  style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', transition: 'background 0.12s' }}
                  onMouseOver={e => (e.currentTarget.style.background = 'rgba(252,101,20,0.03)')}
                  onMouseOut={e  => (e.currentTarget.style.background = '')}
                >
                  {/* Type */}
                  <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                    {v.type === 'booking' ? (
                      <div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 9999, background: 'rgba(34,197,94,0.10)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.22)' }}>
                          Booking
                        </span>
                        {v.bookingRef && (
                          <p style={{ fontSize: 11, fontFamily: 'ui-monospace,monospace', color: '#A8A29E', margin: '2px 0 0' }}>{v.bookingRef}</p>
                        )}
                      </div>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 9999, background: '#F5F5F4', color: '#57534E', border: '1px solid rgba(0,0,0,0.10)' }}>
                        Walk-in
                      </span>
                    )}
                  </td>

                  {/* Name */}
                  <td style={{ padding: '14px 16px' }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1917', margin: 0 }}>{v.name}</p>
                    {v.personBeingVisited && (
                      <p style={{ fontSize: 12, color: '#A8A29E', margin: '1px 0 0' }}>→ {v.personBeingVisited}</p>
                    )}
                  </td>

                  <td style={{ padding: '14px 16px', color: '#78716C', fontSize: 14 }}>{v.phone || '—'}</td>

                  {/* Purpose */}
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 9999, background: '#F5F5F4', color: '#57534E', border: '1px solid rgba(0,0,0,0.1)' }}>
                      {v.purpose}
                    </span>
                  </td>

                  <td style={{ padding: '14px 16px', fontSize: 14, color: '#78716C', whiteSpace: 'nowrap' }}>
                    {fmtTime(v.arrivedAt)}
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    {v.licenceCaptured ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#22C55E' }}>
                        <Icon name={ICONS.check} size={12} /> Captured
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#A8A29E' }}>Not captured</span>
                    )}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
