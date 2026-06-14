import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '@/lib/usePageTitle'
import { Icon, ICONS } from '@/lib/Icon'
import { fmtDate, fmtDateTime as _fmtDateTime, todaySydney, TZ } from '@/lib/time'
import { supabase } from '@/lib/supabase'
import { DEFAULT_TENANT_ID } from '@/lib/supabase'

interface VisitorRecord {
  id: string
  check_in_time: string
  licence_name?: string
  licence_address?: string
  licence_number?: string
  licence_dob?: string
  licence_scan_method?: string
  visit_person_name?: string
  walk_in_reason?: string
  bookings?: {
    driver_name?: string
    service_type?: string
    completed_at?: string
  }
}

interface ColumnConfig {
  date:          boolean
  fullName:      boolean
  address:       boolean
  idType:        boolean
  idNumber:      boolean
  dob:           boolean
  idSignedBy:    boolean
  reason:        boolean
  personVisited: boolean
  checkInTime:   boolean
  checkOutTime:  boolean
  notes:         boolean
}

const FIELD: React.CSSProperties = {
  fontSize: 15, border: '1px solid rgba(0,0,0,0.10)', borderRadius: 6,
  padding: '8px 12px', height: 48, outline: 'none', boxSizing: 'border-box', background: '#fff', color: '#1C1917',
}

const fmtDateTime = (iso?: string) => iso ? _fmtDateTime(iso) : '—'
const today = () => todaySydney()
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toLocaleDateString('sv-SE', { timeZone: TZ })

const DEFAULT_VISIBLE: ColumnConfig = {
  date: true, fullName: true, address: true, idType: true,
  idNumber: true, dob: true, idSignedBy: true, reason: true,
  personVisited: true, checkInTime: false, checkOutTime: false, notes: false,
}

export default function VisitorLogPage() {
  usePageTitle('Glido | ABF Visitor Log')
  const [records, setRecords] = useState<VisitorRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRecord, setSelectedRecord] = useState<typeof records[0] | null>(null)
  const [visibleCols, setVisibleCols] = useState<ColumnConfig>(DEFAULT_VISIBLE)
  const [from, setFrom]       = useState(daysAgo(7))
  const [to, setTo]           = useState(today())
  const [status, setStatus]   = useState('')
  const [search, setSearch]   = useState('')

  // Load report_config.visibleColumns on mount
  useEffect(() => {
    supabase
      .from('tenants')
      .select('report_config')
      .eq('id', DEFAULT_TENANT_ID)
      .single()
      .then(({ data }) => {
        const rc = (data?.report_config as any)
        if (rc?.visibleColumns && typeof rc.visibleColumns === 'object') {
          setVisibleCols({ ...DEFAULT_VISIBLE, ...rc.visibleColumns })
        }
      })
      .catch(() => { /* use defaults */ })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('checkin_records')
        .select('*, bookings(*)')
        .eq('tenant_id', DEFAULT_TENANT_ID)
        .order('check_in_time', { ascending: false })

      if (from) q = q.gte('check_in_time', from)
      if (to)   q = q.lte('check_in_time', to + 'T23:59:59')

      const { data } = await q
      let rows = (data ?? []) as Record[]

      if (status) rows = rows.filter(r => (r.bookings as any)?.status === status)
      if (search) {
        const s = search.toLowerCase()
        rows = rows.filter(r =>
          (r.licence_name ?? '').toLowerCase().includes(s) ||
          (r.licence_number ?? '').toLowerCase().includes(s) ||
          (r.visit_person_name ?? '').toLowerCase().includes(s) ||
          ((r.bookings as any)?.driver_name ?? '').toLowerCase().includes(s)
        )
      }
      setRecords(rows)
    } catch { /* noop */ } finally { setLoading(false) }
  }, [from, to, status, search])

  useEffect(() => { load() }, [load])

  const stats = {
    total:     records.length,
    onSite:    records.filter(r => (r.bookings as any)?.status === 'checked_in').length,
    completed: records.filter(r => (r.bookings as any)?.status === 'completed').length,
  }

  const exportCsv = () => {
    const header = ['Date', 'Full Name', 'Address', 'ID Type', 'ID Number', 'DOB', 'Reason', 'Person Visited', 'Entry Time', 'Exit Time']
    const rows = records.map(r => {
      const b = r.bookings as any
      return [
        fmtDate(r.check_in_time),
        r.licence_name || b?.driver_name || '',
        r.licence_address || '',
        r.licence_scan_method || 'Manual',
        r.licence_number || '',
        fmtDate(r.licence_dob),
        r.walk_in_reason || b?.service_type?.toUpperCase() || '',
        r.visit_person_name || '',
        fmtDateTime(r.check_in_time),
        b?.completed_at ? fmtDateTime(b.completed_at) : '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`)
    })
    const csv = [header, ...rows].map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `ABF_Visitor_Log_${today()}.csv`
    a.click()
  }

  const QUICK = [{ label: 'Today', from: today(), to: today() }, { label: '7 Days', from: daysAgo(7), to: today() }, { label: '15 Days', from: daysAgo(15), to: today() }]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ABF compliance header */}
      <div style={{ background: '#1C1917', borderRadius: 12, padding: '16px 24px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(var(--brand-rgb),0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={ICONS.reports} size={20} style={{ color: 'var(--brand-color)' }} />
        </div>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF', margin: 0, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            S.77Q Customs Depot Licensed Area — Section 77Q, Customs Act 1901
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', margin: '2px 0 0', fontWeight: 500 }}>
            Mandatory Visitor Record Log · ABF Regulatory Compliance Requirement
          </p>
        </div>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'Total Visitors',    value: stats.total,     icon: ICONS.walkIn,   color: '#1C1917' },
          { label: 'Currently On-Site', value: stats.onSite,    icon: ICONS.check,    color: 'var(--brand-color)' },
          { label: 'Completed Visits',  value: stats.completed, icon: ICONS.bookings, color: '#22C55E' },
        ].map(k => (
          <div key={k.label} style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 16, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02),0 4px 20px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 38, fontWeight: 800, color: '#1C1917', margin: 0, letterSpacing: '-0.03em', lineHeight: 1 }}>{k.value}</p>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)', margin: '2px 0 0' }}>{k.label}</p>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color }}>
              <Icon name={k.icon} size={22} />
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 16, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Quick filters */}
          <div style={{ display: 'flex', background: '#F7F6F5', borderRadius: 8, padding: 3, border: '1px solid rgba(0,0,0,0.05)' }}>
            {QUICK.map(q => {
              const active = from === q.from && to === q.to
              return (
                <button key={q.label} onClick={() => { setFrom(q.from); setTo(q.to) }}
                  style={{ padding: '8px 14px', fontSize: 15, fontWeight: 600, textDecoration: 'none', borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: active ? '#FFFFFF' : 'transparent', color: active ? 'var(--brand-color)' : '#4B5563', boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}>
                  {q.label}
                </button>
              )
            })}
          </div>

          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={FIELD} />
          <span style={{ fontSize: 14, color: 'var(--text-tertiary)', fontWeight: 700 }}>→</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={FIELD} />

          <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...FIELD, background: '#fff' }}>
            <option value="">All Statuses</option>
            <option value="checked_in">Checked In</option>
            <option value="completed">Completed</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="text" placeholder="Search visitor, ID…" value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...FIELD, width: 220 }}
          />
          <button onClick={exportCsv} style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '0 16px', height: 48, fontSize: 15, fontWeight: 600, color: '#1C1917', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseOver={e => (e.currentTarget.style.background = '#F7F6F5')}
            onMouseOut={e  => (e.currentTarget.style.background = '#FFFFFF')}
          >
            <Icon name={ICONS.download} size={15} /> CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02),0 4px 20px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'rgba(0,0,0,0.01)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1917', margin: 0 }}>
            ABF Visitor Log <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 6 }}>Showing {records.length} records</span>
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {loading && <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Loading…</span>}
          </div>
        </div>
        <div style={{ overflowX: 'auto', position: 'relative' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15, whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ background: '#F7F6F5', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                {visibleCols.date          && <th style={{ textAlign: 'left', padding: '14px 20px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 15 }}>Date</th>}
                {visibleCols.fullName      && <th style={{ textAlign: 'left', padding: '14px 20px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 15, position: 'sticky', left: 0, zIndex: 2, background: '#F7F6F5' }}>Full Name</th>}
                {visibleCols.address       && <th style={{ textAlign: 'left', padding: '14px 20px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 15 }}>Address</th>}
                {visibleCols.idType        && <th style={{ textAlign: 'left', padding: '14px 20px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 15 }}>ID Type</th>}
                {visibleCols.idNumber      && <th style={{ textAlign: 'left', padding: '14px 20px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 15, position: 'sticky', left: 160, zIndex: 2, background: '#F7F6F5' }}>ID Number</th>}
                {visibleCols.dob           && <th style={{ textAlign: 'left', padding: '14px 20px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 15 }}>DOB</th>}
                {visibleCols.idSignedBy    && <th style={{ textAlign: 'left', padding: '14px 20px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 15 }}>ID Signed By</th>}
                {visibleCols.reason        && <th style={{ textAlign: 'left', padding: '14px 20px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 15 }}>Reason</th>}
                {visibleCols.personVisited && <th style={{ textAlign: 'left', padding: '14px 20px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 15 }}>Person Visited</th>}
                {visibleCols.checkInTime   && <th style={{ textAlign: 'left', padding: '14px 20px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 15 }}>Entry Time</th>}
                {visibleCols.checkOutTime  && <th style={{ textAlign: 'left', padding: '14px 20px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 15 }}>Exit Time</th>}
                {visibleCols.notes         && <th style={{ textAlign: 'left', padding: '14px 20px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 15 }}>Notes</th>}
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const b = r.bookings as any
                const name   = r.licence_name || b?.driver_name || '—'
                const reason = r.walk_in_reason || b?.service_type?.toUpperCase() || '—'
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', transition: 'background 0.1s', cursor: 'pointer' }}
                    onMouseOver={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.015)')}
                    onMouseOut={e  => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => setSelectedRecord(r)}
                  >
                    {visibleCols.date          && <td style={{ padding: '14px 20px', color: '#1C1917', fontWeight: 500 }}>{fmtDate(r.check_in_time)}</td>}
                    {visibleCols.fullName      && <td style={{ padding: '14px 20px', fontWeight: 700, color: '#1C1917', position: 'sticky', left: 0, zIndex: 1, background: '#fff' }}>{name}</td>}
                    {visibleCols.address       && <td style={{ padding: '14px 20px', color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.licence_address || '—'}</td>}
                    {visibleCols.idType        && <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>{r.licence_scan_method || 'Manual'}</td>}
                    {visibleCols.idNumber      && <td style={{ padding: '14px 20px', fontFamily: 'ui-monospace,monospace', color: 'var(--brand-color)', fontWeight: 700, position: 'sticky', left: 160, zIndex: 1, background: '#fff' }}>{r.licence_number || '—'}</td>}
                    {visibleCols.dob           && <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>{fmtDate(r.licence_dob)}</td>}
                    {visibleCols.idSignedBy    && <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>—</td>}
                    {visibleCols.reason        && <td style={{ padding: '14px 20px' }}><span style={{ background: 'rgba(0,0,0,0.04)', padding: '4px 10px', borderRadius: 6, fontWeight: 600, color: '#374151' }}>{reason}</span></td>}
                    {visibleCols.personVisited && <td style={{ padding: '14px 20px', color: '#1C1917', fontWeight: 600 }}>{r.visit_person_name || '—'}</td>}
                    {visibleCols.checkInTime   && <td style={{ padding: '14px 20px', color: '#16A34A', fontWeight: 700 }}>{fmtDateTime(r.check_in_time)}</td>}
                    {visibleCols.checkOutTime  && <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>{b?.completed_at ? fmtDateTime(b.completed_at) : '—'}</td>}
                    {visibleCols.notes         && <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>—</td>}
                  </tr>
                )
              })}
              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={Object.values(visibleCols).filter(Boolean).length || 9} style={{ padding: '64px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                      <Icon name={ICONS.reports} size={40} style={{ color: 'rgba(0,0,0,0.1)' }} />
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>No visitor records found</p>
                    <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>Try adjusting your filters or date range.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visitor Record slide-over */}
      <style>{`@keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>
      {selectedRecord && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setSelectedRecord(null)}>
          <div style={{ width: 480, maxWidth: '100vw', background: '#fff', height: '100%', overflowY: 'auto', padding: 32, boxShadow: '-8px 0 32px rgba(0,0,0,0.12)', animation: 'slideIn 0.2s ease' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>Visitor Record</h2>
            {[
              ['Date',          fmtDate(selectedRecord.check_in_time)],
              ['Full Name',     selectedRecord.licence_name || (selectedRecord.bookings as any)?.driver_name || '—'],
              ['Address',       selectedRecord.licence_address || '—'],
              ['ID Type',       selectedRecord.licence_scan_method || 'Manual'],
              ['ID Number',     selectedRecord.licence_number || '—'],
              ['Date of Birth', fmtDate(selectedRecord.licence_dob)],
              ['Reason',        selectedRecord.walk_in_reason || (selectedRecord.bookings as any)?.service_type?.toUpperCase() || '—'],
              ['Person Visited',selectedRecord.visit_person_name || '—'],
              ['Check-in Time', fmtDateTime(selectedRecord.check_in_time)],
              ['Check-out Time',(selectedRecord.bookings as any)?.completed_at ? fmtDateTime((selectedRecord.bookings as any).completed_at) : '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <span style={{ fontSize: 15, color: '#94A3B8', fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 15, color: '#1C1917', fontWeight: 600, textAlign: 'right', maxWidth: 260 }}>{value}</span>
              </div>
            ))}
            <button onClick={() => setSelectedRecord(null)} style={{ marginTop: 24, width: '100%', padding: '12px 0', borderRadius: 10, background: '#F3F4F6', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
