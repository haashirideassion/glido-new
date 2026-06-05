import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, ICONS } from '@/lib/Icon'
import { fmtTime } from '@/lib/time'
import { cancelBooking } from '@/lib/db/bookings'
import { toast } from '@/lib/toast'
import type { Booking } from '@/data/types'

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled', checked_in: 'Checked In', completed: 'Completed', cancelled: 'Cancelled',
}

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  scheduled:  { background: 'rgba(37,99,235,0.07)',   color: '#2563EB', border: '1px solid rgba(37,99,235,0.20)'  },
  checked_in: { background: 'rgba(var(--brand-rgb),0.08)',  color: 'var(--brand-color)', border: '1px solid rgba(var(--brand-rgb),0.25)' },
  completed:  { background: 'rgba(0,0,0,0.05)',       color: '#78716C', border: '1px solid rgba(0,0,0,0.10)'      },
  cancelled:  { background: 'rgba(239,68,68,0.07)',   color: '#DC2626', border: '1px solid rgba(239,68,68,0.20)'  },
}

interface Props {
  bookings: Booking[]
  query?: string
  onCancelled?: () => void
}

export function MyBookingsList({ bookings, query, onCancelled }: Props) {
  const [cancelTarget,    setCancelTarget]    = useState<Booking | null>(null)
  const [cancellingId,    setCancellingId]    = useState<string | null>(null)

  const confirmCancel = async () => {
    if (!cancelTarget) return
    setCancellingId(cancelTarget.id)
    try {
      await cancelBooking(cancelTarget.id)
      toast('Booking cancelled', 'success')
      setCancelTarget(null)
      onCancelled?.()
    } catch {
      toast('Failed to cancel booking. Please try again.', 'error')
    } finally {
      setCancellingId(null)
    }
  }
  if (bookings.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0 48px' }}>
        <div style={{ width: 48, height: 48, borderRadius: 10, background: '#EBEBEA', border: '1px solid rgba(0,0,0,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Icon name={ICONS.bookings} size={22} style={{ color: '#A8A29E' }} />
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1917', marginBottom: 6, letterSpacing: '-0.01em' }}>
          {query ? `No results for "${query}"` : 'No bookings yet'}
        </p>
        <p style={{ fontSize: 13, color: '#78716C', marginBottom: 24 }}>
          {query ? 'Check the reference number and try again.' : 'Your booking history will appear here.'}
        </p>
        <Link to="/book" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--brand-color)', borderRadius: 9999, textDecoration: 'none', boxShadow: '0 2px 8px rgba(var(--brand-rgb),0.35)' }}>
          <Icon name={ICONS.calendar} size={14} /> Book a Visit
        </Link>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {bookings.map(b => {
        const statusStyle = STATUS_STYLE[b.status] ?? STATUS_STYLE.scheduled
        return (
          <div
            key={b.id}
            style={{ display: 'block', background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 12, padding: '18px 20px', transition: 'border-color 0.15s ease,box-shadow 0.15s ease,transform 0.15s cubic-bezier(0.16,1,0.3,1)', boxShadow: '0 1px 3px rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.06)', cursor: 'pointer' }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'rgba(var(--brand-rgb),0.30)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(var(--brand-rgb),0.08),0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseOut={e  => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.07)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            {/* Top row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div>
                <p style={{ fontFamily: 'ui-monospace,monospace', fontSize: 13.5, fontWeight: 700, color: 'var(--brand-color)', letterSpacing: '0.03em', marginBottom: 3 }}>
                  {b.referenceNumber}
                </p>
                <p style={{ fontSize: 12, color: '#A8A29E', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Icon name={ICONS.calendar} size={12} style={{ color: '#C7C3BF' }} />
                  {b.slotDate} · {b.slotStartTime} – {b.slotEndTime}
                </p>
              </div>
              <span style={{ ...statusStyle, display: 'inline-block', padding: '4px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {STATUS_LABEL[b.status] ?? b.status}
              </span>
            </div>

            {/* Info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px 16px', paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <InfoCell label="Service" value={`${b.serviceType === 'pickup' ? 'Pick Up' : 'Drop Off'} · ${(b.loadType ?? '').toUpperCase()}`} />
              {b.houseBillNumber  && <InfoCell label="HBL"       value={b.houseBillNumber}  mono />}
              {b.containerNumber  && <InfoCell label="Container" value={b.containerNumber}   mono />}
              <InfoCell label="Driver" icon={ICONS.user} value={b.driverName} />
              {b.weightKg         && <InfoCell label="Weight"    value={`${b.weightKg.toLocaleString()} kg`} />}
            </div>

            {/* Timeline */}
            {(b.checkedInAt || b.completedAt) && (
              <div style={{ display: 'flex', gap: 16, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                {b.checkedInAt && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#78716C' }}>
                    <Icon name={ICONS.clock} size={11} style={{ color: '#A8A29E' }} />
                    Checked in {fmtTime(b.checkedInAt)}
                  </span>
                )}
                {b.completedAt && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#16A34A', fontWeight: 500 }}>
                    <Icon name={ICONS.check} size={11} />
                    Completed {fmtTime(b.completedAt)}
                  </span>
                )}
              </div>
            )}

            {/* Cancel button — scheduled bookings only */}
            {b.status === 'scheduled' && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setCancelTarget(b) }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#DC2626', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 8, cursor: 'pointer', transition: 'all 0.13s' }}
                  onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.38)' }}
                  onMouseOut={e  => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.22)' }}
                >
                  Cancel Booking
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Confirmation modal */}
      {cancelTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setCancelTarget(null)}
        >
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 28px 24px', maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.20)', animation: 'none' }}
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
                disabled={!!cancellingId}
                style={{ padding: '9px 18px', fontSize: 13, fontWeight: 600, color: '#fff', background: cancellingId ? '#FCA5A5' : '#DC2626', border: 'none', borderRadius: 9, cursor: cancellingId ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background 0.13s' }}
              >
                {cancellingId ? 'Cancelling…' : 'Cancel Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoCell({ label, value, mono, icon }: { label: string; value: string; mono?: boolean; icon?: string }) {
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#A8A29E', marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1917', fontFamily: mono ? 'ui-monospace,monospace' : undefined, display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon && <Icon name={icon} size={12} style={{ color: '#C7C3BF', flexShrink: 0 }} />}
        {value}
      </p>
    </div>
  )
}
