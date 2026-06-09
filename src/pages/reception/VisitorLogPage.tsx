import { useState, useEffect, useCallback } from 'react'
import { usePageTitle } from '@/lib/usePageTitle'
import { Icon, ICONS } from '@/lib/Icon'
import { fmtDate, fmtDateTime as _fmtDateTime, todaySydney, TZ } from '@/lib/time'
import { supabase } from '@/lib/supabase'
import { DEFAULT_TENANT_ID } from '@/lib/supabase'

interface Record {
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

const FIELD: React.CSSProperties = {
  fontSize: 15, border: '1px solid rgba(0,0,0,0.10)', borderRadius: 6,
  padding: '8px 12px', height: 48, outline: 'none', boxSizing: 'border-box', background: '#fff', color: '#1C1917',
}

const fmtDateTime = (iso?: string) => iso ? _fmtDateTime(iso) : '—'
const today = () => todaySydney()
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toLocaleDateString('sv-SE', { timeZone: TZ })

export default function VisitorLogPage() {
  usePageTitle('Glido | ABF Visitor Log')
  const [records, setRecords] = useState<Record[]>([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom]       = useState(daysAgo(7))
  const [to, setTo]           = useState(today())
  const [status, setStatus]   = useState('')
  const [search, setSearch]   = useState('')

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
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(252,101,20,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={ICONS.reports} size={20} style={{ color: '#FC6514' }} />
        </div>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF', margin: 0, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            S.77Q Customs Depot Licensed Area — Section 77Q, Customs Act 1901
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: '2px 0 0', fontWeight: 500 }}>
            Mandatory Visitor Record Log · ABF Regulatory Compliance Requirement
          </p>
        </div>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'Total Visitors',    value: stats.total,     icon: ICONS.walkIn,   color: '#1C1917' },
          { label: 'Currently On-Site', value: stats.onSite,    icon: ICONS.check,    color: '#FC6514' },
          { label: 'Completed Visits',  value: stats.completed, icon: ICONS.bookings, color: '#22C55E' },
        ].map(k => (
          <div key={k.label} style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 16, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 38, fontWeight: 800, color: '#1C1917', margin: 0, letterSpacing: '-0.03em', lineHeight: 1 }}>{k.value}</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#4B5563', margin: '2px 0 0' }}>{k.label}</p>
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
                  style={{ padding: '8px 14px', fontSize: 14, fontWeight: 600, textDecoration: 'none', borderRadius: 6, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: active ? '#FFFFFF' : 'transparent', color: active ? '#FC6514' : '#4B5563', boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}>
                  {q.label}
                </button>
              )
            })}
          </div>

          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={FIELD} />
          <span style={{ fontSize: 12, color: '#A8A29E', fontWeight: 700 }}>→</span>
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
          <button onClick={exportCsv} style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '0 16px', height: 48, fontSize: 14, fontWeight: 600, color: '#1C1917', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseOver={e => (e.currentTarget.style.background = '#F7F6F5')}
            onMouseOut={e  => (e.currentTarget.style.background = '#FFFFFF')}
          >
            <Icon name={ICONS.download} size={15} /> CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.07)' }}>
        <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'rgba(0,0,0,0.01)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1C1917', margin: 0 }}>
            ABF Visitor Log <span style={{ fontWeight: 400, color: '#A8A29E', marginLeft: 6 }}>Showing {records.length} records</span>
          </p>
          {loading && <span style={{ fontSize: 12, color: '#A8A29E' }}>Loading…</span>}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ background: '#F7F6F5', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                {['Date', 'Full Name', 'Address', 'ID Type', 'ID Number', 'DOB', 'ID Signed By', 'Reason', 'Person Visited', 'Escort', 'Entry Time', 'Exit Time'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '14px 20px', color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 13 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const b = r.bookings as any
                const name   = r.licence_name || b?.driver_name || '—'
                const reason = r.walk_in_reason || b?.service_type?.toUpperCase() || '—'
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', transition: 'background 0.1s' }}
                    onMouseOver={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.015)')}
                    onMouseOut={e  => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '14px 20px', color: '#1C1917', fontWeight: 500 }}>{fmtDate(r.check_in_time)}</td>
                    <td style={{ padding: '14px 20px', fontWeight: 700, color: '#1C1917' }}>{name}</td>
                    <td style={{ padding: '14px 20px', color: '#4B5563', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.licence_address || '—'}</td>
                    <td style={{ padding: '14px 20px', color: '#4B5563' }}>{r.licence_scan_method || 'Manual'}</td>
                    <td style={{ padding: '14px 20px', fontFamily: 'ui-monospace,monospace', color: '#FC6514', fontWeight: 700 }}>{r.licence_number || '—'}</td>
                    <td style={{ padding: '14px 20px', color: '#4B5563' }}>{fmtDate(r.licence_dob)}</td>
                    <td style={{ padding: '14px 20px', color: '#4B5563' }}>—</td>
                    <td style={{ padding: '14px 20px' }}><span style={{ background: 'rgba(0,0,0,0.04)', padding: '4px 10px', borderRadius: 6, fontWeight: 600, color: '#374151' }}>{reason}</span></td>
                    <td style={{ padding: '14px 20px', color: '#1C1917', fontWeight: 600 }}>{r.visit_person_name || '—'}</td>
                    <td style={{ padding: '14px 20px', color: '#4B5563' }}>—</td>
                    <td style={{ padding: '14px 20px', color: '#16A34A', fontWeight: 700 }}>{fmtDateTime(r.check_in_time)}</td>
                    <td style={{ padding: '14px 20px', color: '#4B5563' }}>{b?.completed_at ? fmtDateTime(b.completed_at) : '—'}</td>
                  </tr>
                )
              })}
              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={12} style={{ padding: '64px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                      <Icon name={ICONS.reports} size={40} style={{ color: 'rgba(0,0,0,0.1)' }} />
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#78716C', margin: 0 }}>No visitor records found</p>
                    <p style={{ fontSize: 12, color: '#A8A29E', margin: '4px 0 0' }}>Try adjusting your filters or date range.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
