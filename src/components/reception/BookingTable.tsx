import { Link } from 'react-router-dom'
import { todaySydney } from '@/lib/time'
import type { Booking } from '@/data/types'

const ICS_LABEL: Record<string, string> = { cleared: 'Clear', held: 'Held', examination: 'On Hold', pending: 'Pending', unavailable: 'N/A' }
const ICS_CLASS: Record<string, string> = {
  cleared:     'bg-green-100 text-green-800 border-green-200',
  held:        'bg-red-100 text-red-800 border-red-200',
  examination: 'bg-amber-100 text-amber-800 border-amber-200',
  pending:     'bg-slate-100 text-slate-500 border-slate-200',
  unavailable: 'bg-slate-100 text-slate-400 border-slate-200',
}
const STATUS_STYLE: Record<string, React.CSSProperties> = {
  scheduled:  { background: '#F5F5F4', color: '#57534E', border: '1px solid rgba(0,0,0,0.1)' },
  checked_in: { background: 'rgba(34,197,94,0.12)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.25)' },
  completed:  { background: '#F5F5F4', color: '#78716C', border: '1px solid rgba(0,0,0,0.08)' },
  cancelled:  { background: 'transparent', color: '#A8A29E', border: '1px solid rgba(0,0,0,0.15)' },
}
const STATUS_LABEL: Record<string, string> = { scheduled: 'Scheduled', checked_in: 'Checked In', completed: 'Completed', cancelled: 'Cancelled' }

interface Props {
  bookings: Booking[]
  currentDate?: string
  loading?: boolean
}

export function BookingTable({ bookings, currentDate, loading }: Props) {
  const today = todaySydney()
  const displayDate = currentDate ?? today

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.07)' }}>
      {/* Table header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1C1917', margin: 0, letterSpacing: '-0.01em' }}>
            {displayDate === today ? "Today's Bookings" : `Bookings · ${displayDate}`}
          </h2>
          <p style={{ fontSize: 12, color: '#A8A29E', margin: '2px 0 0' }}>{bookings.length} records</p>
        </div>
        <Link
          to="/reception/bookings"
          style={{ fontSize: 12, fontWeight: 600, color: '#FC6514', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          View all →
        </Link>
      </div>

      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: '#A8A29E', fontSize: 13 }}>Loading…</div>
      ) : bookings.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: '#A8A29E', fontSize: 13 }}>No bookings for today.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F7F6F5', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                {['Reference', 'Driver', 'Slot', 'Service', 'HBL', 'ICS', 'Status', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => {
                const ics = b.icsStatus ?? ''
                const rowBg = ics === 'held' ? 'rgba(239,68,68,0.05)' : b.status === 'checked_in' ? 'rgba(34,197,94,0.04)' : b.status === 'completed' ? 'rgba(0,0,0,0.01)' : 'transparent'
                const icsStyle = ICS_CLASS[ics]
                const statusStyle = STATUS_STYLE[b.status] ?? STATUS_STYLE.scheduled
                return (
                  <tr
                    key={b.id}
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer', transition: 'background 0.12s ease', background: rowBg }}
                    onMouseOver={e => (e.currentTarget.style.background = 'rgba(252,101,20,0.03)')}
                    onMouseOut={e  => (e.currentTarget.style.background = rowBg)}
                    onClick={() => { /* TODO: slide-over */ }}
                  >
                    <td style={{ padding: '14px 16px', fontFamily: 'ui-monospace,monospace', fontSize: 12, fontWeight: 700, color: '#FC6514', whiteSpace: 'nowrap' }}>
                      {b.referenceNumber}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1917', margin: 0 }}>{b.driverName}</p>
                      <p style={{ fontSize: 11, color: '#A8A29E', margin: '1px 0 0' }}>{b.driverPhone ?? '—'}</p>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1917', whiteSpace: 'nowrap', margin: 0 }}>
                        {b.slotStartTime}{b.slotEndTime ? ` – ${b.slotEndTime}` : ''}
                      </p>
                      <p style={{ fontSize: 11, color: '#A8A29E', margin: '1px 0 0' }}>{b.slotDate}</p>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 12, fontWeight: 500, color: '#78716C', whiteSpace: 'nowrap' }}>
                      {b.serviceType === 'pickup' ? 'Pick Up' : 'Drop Off'} · {(b.loadType ?? '').toUpperCase()}
                    </td>
                    <td style={{ padding: '14px 16px', fontFamily: 'ui-monospace,monospace', fontSize: 12, color: '#78716C' }}>
                      {b.houseBillNumber ?? b.containerNumber ?? '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {ics ? (
                        <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${icsStyle}`}>
                          {ICS_LABEL[ics] ?? ics}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: '#A8A29E' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ ...statusStyle, borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'rgba(0,0,0,0.30)' }}>→</td>
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
