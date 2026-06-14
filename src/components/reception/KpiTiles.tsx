import { useEffect, useRef } from 'react'
import { Icon, ICONS } from '@/lib/Icon'
import { fmtTime } from '@/lib/time'
import type { DashboardStats, Booking } from '@/data/types'

declare const echarts: any

interface Props {
  stats:    DashboardStats
  loading?: boolean
}

const TILES = [
  { statKey: 'todaysVisitors', label: "Today's Visitors", sub: 'booked for today',  icon: ICONS.calendar,  iconBg: 'rgba(251,191,36,0.10)', iconFg: '#FBBF24', valueFg: '#1C1917', line: '#FBBF24', fillStart: 'rgba(251,191,36,0.18)', fillEnd: 'rgba(251,191,36,0)', seed: 2 },
  { statKey: 'checkedIn',     label: 'Checked In',       sub: 'currently on site', icon: ICONS.userCheck, iconBg: 'rgba(34,197,94,0.10)',  iconFg: '#22C55E', valueFg: '#22C55E', line: '#22C55E', fillStart: 'rgba(34,197,94,0.18)',  fillEnd: 'rgba(34,197,94,0)',  seed: 5 },
  { statKey: 'pending',       label: 'Pending',           sub: 'yet to arrive',     icon: ICONS.clock,     iconBg: 'rgba(148,163,184,0.10)',iconFg: '#94A3B8', valueFg: '#1C1917', line: '#94A3B8', fillStart: 'rgba(148,163,184,0.15)', fillEnd: 'rgba(148,163,184,0)', seed: 1 },
  { statKey: 'icsHeld',       label: 'ICS Held',          sub: 'awaiting customs clearance', icon: ICONS.warning, iconBg: 'rgba(251,191,36,0.12)', iconFg: '#D97706', valueFg: '#D97706', line: '#F59E0B', fillStart: 'rgba(251,191,36,0.18)', fillEnd: 'rgba(251,191,36,0)', seed: 3 },
] as const

const STATUS_LABEL: Record<string, string> = { scheduled: 'Scheduled', checked_in: 'Checked In', completed: 'Completed', cancelled: 'Cancelled' }
const STATUS_STYLE: Record<string, string> = {
  checked_in: 'background:rgba(34,197,94,0.12);color:#16A34A;border:1px solid rgba(34,197,94,0.25);',
  completed:  'background:#F5F5F4;color:#78716C;border:1px solid rgba(0,0,0,0.08);',
  cancelled:  'background:transparentc3F3D;border:1px solid rgba(0,0,0,0.15);',
  scheduled:  'background:#F5F5F4;color:#57534E;border:1px solid rgba(0,0,0,0.1);',
}

function SparklineCard({ tile, value, chartId, loading }: { tile: typeof TILES[number]; value: number; chartId: string; loading?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const data: number[] = []  // no fake trend data — real historical data not yet available
    let chart: any

    const init = () => {
      if (typeof echarts === 'undefined') { setTimeout(init, 100); return }
      if (!ref.current) return
      chart = echarts.init(ref.current, null, { renderer: 'svg' })
      chart.setOption({
        animation: false,
        grid: { top: 2, right: 2, bottom: 2, left: 2 },
        xAxis: { type: 'category', show: false, boundaryGap: false },
        yAxis: { type: 'value', show: false, min: 'dataMin', max: 'dataMax' },
        series: [{
          type: 'line', data, smooth: 0.4, symbol: 'none',
          lineStyle: { color: tile.line, width: 1.5 },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: tile.fillStart }, { offset: 1, color: tile.fillEnd }] } },
        }],
      })
    }
    init()
    return () => chart?.dispose()
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 18, padding: 20, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02),0 4px 20px rgba(0,0,0,0.04)', transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1),box-shadow 0.2s ease', cursor: 'default' }}
      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.05),0 2px 6px rgba(0,0,0,0.03)' }}
      onMouseOut={e  => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02),0 4px 20px rgba(0,0,0,0.04)' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: tile.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${tile.iconFg}22` }}>
          <Icon name={tile.icon} size={20} style={{ color: tile.iconFg }} />
        </div>
      </div>
      {loading ? (
        <>
          <div style={{ width: 64, height: 38, borderRadius: 8, background: 'rgba(0,0,0,0.07)', marginBottom: 5, animation: 'dash-pulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: 110, height: 14, borderRadius: 5, background: 'rgba(0,0,0,0.06)', marginBottom: 6, animation: 'dash-pulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: 80, height: 12, borderRadius: 5, background: 'rgba(0,0,0,0.05)', marginBottom: 14, animation: 'dash-pulse 1.5s ease-in-out infinite' }} />
        </>
      ) : (
        <>
          <p style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: tile.valueFg, marginBottom: 5, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 2 }}>{tile.label}</p>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 14 }}>{tile.sub}</p>
        </>
      )}
      <div ref={ref} style={{ height: 44, margin: '0 -20px', width: 'calc(100% + 40px)' }} />
    </div>
  )
}

export function KpiTiles({ stats, loading }: Props) {
  return (
    <>
      <style>{`@keyframes dash-pulse{0%,100%{opacity:1}50%{opacity:0.45}}`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>
        {TILES.map(t => (
          <SparklineCard
            key={t.statKey}
            tile={t}
            value={stats[t.statKey] ?? 0}
            chartId={`kpi-${t.statKey}`}
            loading={loading}
          />
        ))}
      </div>
    </>
  )
}

export function RecentVisitors({ stats, loading }: Props) {
  const recent = [...(stats.recentVisitors ?? [])].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5)

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 18, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.02),0 4px 20px rgba(0,0,0,0.04)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h3 style={{ fontSize: 22, fontWeight: 700, color: '#1C1917', margin: 0, letterSpacing: '-0.02em' }}>Recent Visitors</h3>
            <p style={{ fontSize: 15, color: 'var(--text-muted)', margin: '5px 0 0' }}>Latest visitor activity and status updates</p>
          </div>
          <div style={{ width: 40, height: 40, background: 'rgba(0,0,0,0.03)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,0,0,0.05)' }}>
            <Icon name={ICONS.users} size={20} style={{ color: 'var(--text-secondary)' }} />
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.045)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9999, background: 'rgba(0,0,0,0.07)', flexShrink: 0, animation: 'dash-pulse 1.5s ease-in-out infinite' }} />
                  <div>
                    <div style={{ width: 120, height: 14, borderRadius: 5, background: 'rgba(0,0,0,0.07)', marginBottom: 6, animation: 'dash-pulse 1.5s ease-in-out infinite' }} />
                    <div style={{ width: 90, height: 12, borderRadius: 5, background: 'rgba(0,0,0,0.05)', animation: 'dash-pulse 1.5s ease-in-out infinite' }} />
                  </div>
                </div>
                <div style={{ width: 72, height: 26, borderRadius: 9999, background: 'rgba(0,0,0,0.06)', animation: 'dash-pulse 1.5s ease-in-out infinite' }} />
              </div>
            ))}
          </div>
        ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {recent.length > 0 ? recent.map(b => {
              const bv = b.status === 'checked_in' ? 'checked_in' : b.status === 'completed' ? 'completed' : b.status === 'cancelled' ? 'cancelled' : 'scheduled'
              const badgeStyle = (STATUS_STYLE[bv] ?? STATUS_STYLE.scheduled) + 'border-radius:9999px;padding:4px 10px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;'
              const initials = b.driverName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
              return (
                <tr key={b.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.045)' }}>
                  <td style={{ padding: '16px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9999, background: '#F5F5F4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0, border: '1px solid rgba(0,0,0,0.04)' }}>{initials}</div>
                      <div>
                        <p style={{ fontSize: 16, fontWeight: 600, color: '#1C1917', margin: 0 }}>{b.driverName}</p>
                        <p style={{ fontSize: 15, fontFamily: 'ui-monospace,monospace', color: 'var(--text-muted)', margin: '2px 0 0' }}>{b.referenceNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 0', textAlign: 'right' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ ...Object.fromEntries(badgeStyle.split(';').filter(Boolean).map(s => { const [k, ...v] = s.split(':'); return [k.trim().replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase()), v.join(':').trim()] })) } as any}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                      <p style={{ fontSize: 15, color: 'var(--text-muted)', fontWeight: 500 }}>
                        {fmtTime(b.updatedAt)}
                      </p>
                    </div>
                  </td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={2} style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 15 }}>
                  <div style={{ opacity: 0.3, marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                    <Icon name={ICONS.calendar} size={28} />
                  </div>
                  Day has just begun. No visitor activity yet today.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        )}
      </div>
  )
}
