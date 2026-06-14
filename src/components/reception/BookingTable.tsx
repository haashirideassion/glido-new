import { Link, useNavigate } from 'react-router-dom'
import { todaySydney } from '@/lib/time'
import { toast } from '@/lib/toast'
import type { Booking } from '@/data/types'

const ICS_LABEL: Record<string, string> = { cleared: 'Cleared', held: 'Held', examination: 'Examination', pending: 'Pending', unavailable: 'N/A' }
const ICS_BAR_COLOR: Record<string, string> = {
  cleared:     '#16A34A',
  held:        '#DC2626',
  examination: 'var(--brand-color)',
  pending:     '#94A3B8',
  unavailable: '#E5E7EB',
}

const ICS_LEGEND = [
  { key: 'cleared',     label: 'Cleared'     },
  { key: 'held',        label: 'Held'        },
  { key: 'examination', label: 'Examination' },
  { key: 'pending',     label: 'Pending'     },
  { key: 'unavailable', label: 'N/A'         },
]
const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string; icon: string }> = {
  scheduled:  { label: 'Scheduled',  bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE', icon: 'M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
  checked_in: { label: 'Checked In', bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', icon: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
  completed:  { label: 'Completed',  bg: '#F9FAFB', color: '#374151', border: '#E5E7EB', icon: 'M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 0 1 3.375 3.375M9 15l2.25 2.25L15 12' },
  cancelled:  { label: 'Cancelled',  bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', icon: 'M9.75 9.75l4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
}

interface Props {
  bookings: Booking[]
  currentDate?: string
  loading?: boolean
}

export function BookingTable({ bookings, currentDate, loading }: Props) {
  const today = todaySydney()
  const displayDate = currentDate ?? today
  const navigate = useNavigate()

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02),0 4px 20px rgba(0,0,0,0.04)', marginBottom: 20 }}>
      {/* Table header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1C1917', margin: 0, letterSpacing: '-0.01em' }}>
            {displayDate === today ? "Today's Bookings" : `Bookings · ${displayDate}`}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>{bookings.length} records</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* ICS legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {ICS_LEGEND.map(l => (
              <span key={l.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#94A3B8', whiteSpace: 'nowrap' }}>
                <span style={{ width: 8, height: 8, borderRadius: 9999, background: ICS_BAR_COLOR[l.key], flexShrink: 0, display: 'inline-block' }} />
                {l.label}
              </span>
            ))}
          </div>
          <Link
            to="/reception/bookings?filter=today"
            style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand-color)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            View all →
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 15 }}>Loading…</div>
      ) : bookings.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 15 }}>No bookings for today.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F7F6F5', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                {['', 'Reference', 'Driver', 'Slot', 'Service', 'HBL', 'Status', ''].map((h, i) => (
                  <th key={i} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap', ...(i === 0 ? { width: 8, padding: 0 } : {}) }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => {
                const ics = b.icsStatus ?? ''
                const rowBg =
                  ics === 'held'                ? 'rgba(239,68,68,0.08)'  :
                  b.status === 'checked_in'     ? 'rgba(34,197,94,0.07)'  :
                  b.status === 'completed'      ? 'rgba(0,0,0,0.025)'     :
                  b.status === 'cancelled'      ? 'rgba(0,0,0,0.015)'     :
                                                  ''
                const displayRef = b.groupReference ?? b.referenceNumber
                const navTarget  = b.groupReference
                  ? `/reception/bookings/group/${b.groupReference}`
                  : `/reception/bookings/${b.id}`
                return (
                  <tr
                    key={b.id}
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', cursor: 'pointer', transition: 'background 0.12s ease', background: rowBg }}
                    onMouseOver={e => (e.currentTarget.style.background = ics === 'held' ? 'rgba(239,68,68,0.13)' : 'rgba(var(--brand-rgb),0.05)')}
                    onMouseOut={e  => (e.currentTarget.style.background = rowBg)}
                    onClick={() => navigate(navTarget)}
                  >
                    <td style={{ width: 10, padding: 0, paddingLeft: 4 }}>
                      <div style={{ width: 6, minHeight: 40, height: '100%', borderRadius: 2, background: ICS_BAR_COLOR[ics] ?? ICS_BAR_COLOR.unavailable }} />
                    </td>
                    <td style={{ padding: '18px 16px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{ fontFamily: 'ui-monospace,monospace', fontSize: 15, fontWeight: 700, color: 'var(--brand-color)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        title="Click to copy"
                        onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(displayRef).then(() => toast('Reference copied', 'info')).catch(() => {}) }}
                      >
                        {displayRef}
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.45, flexShrink: 0 }}>
                          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      </span>
                    </td>
                    <td style={{ padding: '18px 16px' }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1917', margin: 0 }}>{b.driverName}</p>
                      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '1px 0 0' }}>{b.driverPhone ?? '—'}</p>
                    </td>
                    <td style={{ padding: '18px 16px' }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1917', whiteSpace: 'nowrap', margin: 0 }}>
                        {b.slotStartTime}{b.slotEndTime ? ` – ${b.slotEndTime}` : ''}
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '1px 0 0' }}>{b.slotDate}</p>
                    </td>
                    <td style={{ padding: '18px 16px', fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {b.serviceType === 'pickup' ? 'Pick Up' : 'Drop Off'} · {(b.loadType ?? '').toUpperCase()}
                    </td>
                    <td style={{ padding: '18px 16px', fontFamily: 'ui-monospace,monospace', fontSize: 14, color: 'var(--text-secondary)' }}>
                      {b.houseBillNumber ?? b.containerNumber ?? '—'}
                    </td>
                    <td style={{ padding: '18px 16px' }}>
                      {(() => {
                        const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.scheduled
                        return (
                          <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: 20, padding: '5px 10px 5px 8px', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                              <path d={cfg.icon} />
                            </svg>
                            {cfg.label}
                          </span>
                        )
                      })()}
                    </td>
                    <td style={{ padding: '18px 16px', color: 'rgba(0,0,0,0.30)' }}>→</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
