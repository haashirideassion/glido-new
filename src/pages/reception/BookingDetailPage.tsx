import { useState, useEffect } from 'react'
import { usePageTitle } from '@/lib/usePageTitle'
import { useParams, Link } from 'react-router-dom'
import { Icon, ICONS } from '@/lib/Icon'
import { fmtDateTime } from '@/lib/time'
import { toast } from '@/lib/toast'
import { supabase } from '@/lib/supabase'
import {
  getBookingById, checkInBooking, completeBooking,
  cancelBooking, rescheduleBooking, refreshIcsStatus,
  getBookingsByGroupRef,
} from '@/lib/db/bookings'
import type { Booking } from '@/data/types'

const CARD: React.CSSProperties  = { background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.07)', marginBottom: 16 }
const SL: React.CSSProperties   = { fontSize: 14, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 12 }
const RL: React.CSSProperties   = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, color: '#4B5563' }
const RV: React.CSSProperties   = { fontSize: 16, fontWeight: 600, color: '#1C1917' }

const ICS_BADGE: Record<string, string> = {
  cleared:     'background:rgba(34,197,94,0.10);color:#16A34A;border:1px solid rgba(34,197,94,0.22);',
  held:        'background:rgba(239,68,68,0.10);color:#EF4444;border:1px solid rgba(239,68,68,0.22);',
  examination: 'background:rgba(251,191,36,0.10);color:#B45309;border:1px solid rgba(251,191,36,0.22);',
  pending:     'background:rgba(0,0,0,0.04);color:#78716C;border:1px solid rgba(0,0,0,0.10);',
}
const ICS_LABEL: Record<string, string> = { cleared: 'Cleared', held: 'Held', examination: 'On Hold', pending: 'Pending', unavailable: 'N/A' }

const STATUS_BADGE: Record<string, React.CSSProperties> = {
  scheduled:  { background: '#F5F5F4', color: '#57534E', border: '1px solid rgba(0,0,0,0.10)' },
  checked_in: { background: 'rgba(34,197,94,0.12)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.25)' },
  completed:  { background: '#F5F5F4', color: '#78716C', border: '1px solid rgba(0,0,0,0.08)' },
  cancelled:  { background: 'transparent', color: '#A8A29E', border: '1px solid rgba(0,0,0,0.15)' },
}
const STATUS_LABEL: Record<string, string> = { scheduled: 'Scheduled', checked_in: 'Checked In', completed: 'Completed', cancelled: 'Cancelled' }

const FIELD: React.CSSProperties = { width: '100%', padding: '10px 14px', fontSize: 14, color: '#1C1917', background: '#EBEBEA', border: '1px solid rgba(0,0,0,0.10)', borderRadius: 10, outline: 'none', boxSizing: 'border-box' }
const focus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.target.style.borderColor = 'rgba(252,101,20,0.50)' }
const blur  = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.target.style.borderColor = 'rgba(0,0,0,0.10)' }

export default function BookingDetailPage() {
  usePageTitle('Glido | Booking')
  const { id, groupRef } = useParams<{ id: string; groupRef: string }>()
  const [b, setB]         = useState<Booking | null>(null)
  const [groupSlots, setGroupSlots] = useState<Booking[]>([])  // all slots in a group
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState('')

  // Checkin record and documents
  const [checkinRecord, setCheckinRecord] = useState<any>(null)
  const [bookingDocs,   setBookingDocs]   = useState<any[]>([])

  // Modal state
  const [confirmModal,    setConfirmModal]    = useState(false)
  const [cancelModal,     setCancelModal]     = useState(false)
  const [rescheduleModal, setRescheduleModal] = useState(false)

  // Form fields
  const [completionNotes, setCompletionNotes] = useState('')
  const [newDate,  setNewDate]  = useState('')
  const [newStart, setNewStart] = useState('')

  useEffect(() => {
    if (!id && !groupRef) return
    setLoading(true)

    const loadBooking = groupRef
      // Group route: load all slots by group_reference
      ? getBookingsByGroupRef(groupRef).then(async slots => {
          const primary = slots[0] ?? null
          setB(primary)
          setGroupSlots(slots)
          if (primary) {
            setNewDate(primary.slotDate)
            setNewStart(primary.slotStartTime)
            const allBookingIds = slots.map(s => s.id)
            const [crRes, docsRes] = await Promise.all([
              supabase.from('checkin_records').select('*').eq('booking_id', primary.id).maybeSingle(),
              supabase.from('booking_documents').select('*').in('booking_id', allBookingIds),
            ])
            setCheckinRecord(crRes.data ?? null)
            setBookingDocs(docsRes.data ?? [])
          }
        })
      // Single booking route
      : getBookingById(id!).then(async booking => {
          setB(booking ?? null)
          if (booking) {
            setGroupSlots([booking])
            setNewDate(booking.slotDate)
            setNewStart(booking.slotStartTime)
            const [crRes, docsRes] = await Promise.all([
              supabase.from('checkin_records').select('*').eq('booking_id', booking.id).maybeSingle(),
              supabase.from('booking_documents').select('*').eq('booking_id', booking.id),
            ])
            setCheckinRecord(crRes.data ?? null)
            setBookingDocs(docsRes.data ?? [])
          }
        })

    loadBooking
      .catch(() => setB(null))
      .finally(() => setLoading(false))
  }, [id])

  const act = async (label: string, fn: () => Promise<Booking | undefined>, msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setActing(label)
    try {
      const updated = await fn()
      if (updated) setB(updated)
      toast(msg, type)
    } catch (err: any) {
      toast(err?.message ?? 'Action failed', 'error')
    } finally {
      setActing('')
    }
  }

  if (loading) return (
    <div style={{ padding: '48px 0', textAlign: 'center', color: '#A8A29E', fontSize: 14 }}>Loading…</div>
  )

  if (!b) return (
    <div style={{ padding: '48px 0', textAlign: 'center' }}>
      <p style={{ fontSize: 16, fontWeight: 600, color: '#1C1917', marginBottom: 8 }}>Booking not found</p>
      <Link to="/reception/bookings" style={{ color: '#FC6514', textDecoration: 'none', fontSize: 14 }}>← Back to Bookings</Link>
    </div>
  )

  const icsStyle   = ICS_BADGE[b.icsStatus ?? ''] ?? ICS_BADGE.pending
  const statusStyle = STATUS_BADGE[b.status] ?? STATUS_BADGE.scheduled

  // ── Identity check helpers ────────────────────────────────────────────────
  const nameScore = checkinRecord?.name_match_score ?? 0
  const idBadge = nameScore >= 85
    ? { label: 'Name Matched',  bg: 'rgba(34,197,94,0.10)',  color: '#16A34A', border: 'rgba(34,197,94,0.22)'  }
    : nameScore >= 60
    ? { label: 'Warning',       bg: 'rgba(251,191,36,0.10)', color: '#B45309', border: 'rgba(251,191,36,0.22)' }
    : { label: 'Mismatch',      bg: 'rgba(239,68,68,0.10)',  color: '#EF4444', border: 'rgba(239,68,68,0.22)'  }

  return (
    <div>
      {/* ── Breadcrumb + title ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link
            to="/reception/bookings"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 15, fontWeight: 600, color: '#4B5563', textDecoration: 'none', transition: 'color 0.14s ease' }}
            onMouseOver={e => (e.currentTarget.style.color = '#1C1917')}
            onMouseOut={e  => (e.currentTarget.style.color = '#4B5563')}
          >
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
              <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Bookings
          </Link>
          <span style={{ color: 'rgba(0,0,0,0.15)', fontSize: 14 }}>/</span>
          <span
            style={{ fontFamily: 'ui-monospace,monospace', fontSize: 16, fontWeight: 700, color: '#FC6514', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title="Click to copy"
            onClick={() => {
              const displayRef = groupSlots.length > 1 ? (b.groupReference ?? b.referenceNumber) : b.referenceNumber
              navigator.clipboard.writeText(displayRef).then(() => toast('Reference copied', 'info')).catch(() => {})
            }}
          >
            {groupSlots.length > 1 ? (b.groupReference ?? b.referenceNumber) : b.referenceNumber}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </span>
          <span style={{ ...statusStyle, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 9999, whiteSpace: 'nowrap' }}>
            {STATUS_LABEL[b.status] ?? b.status}
          </span>
          {groupSlots.length > 1 && (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#2563EB', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 9999, padding: '4px 10px', whiteSpace: 'nowrap' }}>
              {groupSlots.length} slots
            </span>
          )}
        </div>
        <p style={{ fontSize: 14, color: '#4B5563' }}>Created {fmtDateTime(b.createdAt)}</p>
      </div>

      {/* ── 2-col layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'flex-start' }}>

        {/* ── LEFT ── */}
        <div>

          {/* Driver / Visitor */}
          <div style={CARD}>
            <p style={SL}>Driver / Visitor</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <InfoRow label="Driver Name"  value={b.driverName}              icon={ICONS.user}  />
              {b.driverPhone       && <InfoRow label="Phone"           value={b.driverPhone}       icon={ICONS.phone} />}
              {b.vehicleRegistration && <InfoRow label="Vehicle Rego"  value={b.vehicleRegistration} icon={ICONS.cargo} mono />}
              {b.guestName && b.guestName !== b.driverName && <InfoRow label="Guest Name" value={b.guestName} icon={ICONS.users} />}
              {b.guestPhone        && <InfoRow label="Guest Phone"     value={b.guestPhone}        icon={ICONS.phone} />}
            </div>
          </div>

          {/* Slot & Shipment — one card per slot for multi-slot groups */}
          {groupSlots.length > 1 ? (
            groupSlots.map((slot, i) => {
              const slotStatusStyle = STATUS_BADGE[slot.status] ?? STATUS_BADGE.scheduled
              return (
                <div key={slot.id} style={{ ...CARD }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <p style={{ ...SL, marginBottom: 0 }}>Slot {i + 1} {slot.referenceNumber && <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12, fontWeight: 400, color: '#FC6514' }}>· {slot.referenceNumber}</span>}</p>
                    <span style={{ ...slotStatusStyle, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 9999 }}>
                      {STATUS_LABEL[slot.status] ?? slot.status}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <FieldBlock label="Date"        value={slot.slotDate} />
                    <FieldBlock label="Time"        value={`${slot.slotStartTime} – ${slot.slotEndTime}`} />
                    <FieldBlock label="Service"     value={slot.serviceType === 'pickup' ? 'Pick Up' : 'Drop Off'} />
                    <FieldBlock label="Load Type"   value={slot.loadType.toUpperCase()} />
                    {slot.containerNumber  && <FieldBlock label="Container No."  value={slot.containerNumber}  mono />}
                    {slot.houseBillNumber  && <FieldBlock label="HBL"            value={slot.houseBillNumber}  mono />}
                    {slot.containerSize    && <FieldBlock label="Container Size" value={slot.containerSize} />}
                    {slot.entryNumber      && <FieldBlock label="Entry Number"   value={slot.entryNumber}   mono />}
                    {slot.purpose          && <FieldBlock label="Purpose"        value={slot.purpose} />}
                    {slot.consolidator     && <FieldBlock label="Consolidator"   value={slot.consolidator} />}
                  </div>
                  {/* Per-slot actions */}
                  {slot.status === 'scheduled' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <button type="button" onClick={async () => { setActing(slot.id + '-checkin'); try { await checkInBooking(slot.id); setGroupSlots(prev => prev.map(s => s.id === slot.id ? { ...s, status: 'checked_in' as any } : s)); if (slot.id === b?.id) setB(prev => prev ? { ...prev, status: 'checked_in' as any } : prev); toast('Checked in', 'success') } catch { toast('Failed', 'error') } finally { setActing('') } }}
                        disabled={acting === slot.id + '-checkin'}
                        style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: 'rgba(34,197,94,0.10)', color: '#16A34A', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {acting === slot.id + '-checkin' ? '…' : 'Check In'}
                      </button>
                      <button type="button" onClick={async () => { setActing(slot.id + '-cancel'); try { await cancelBooking(slot.id); setGroupSlots(prev => prev.map(s => s.id === slot.id ? { ...s, status: 'cancelled' as any } : s)); if (slot.id === b?.id) setB(prev => prev ? { ...prev, status: 'cancelled' as any } : prev); toast('Cancelled', 'success') } catch { toast('Failed', 'error') } finally { setActing('') } }}
                        disabled={acting === slot.id + '-cancel'}
                        style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.20)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {acting === slot.id + '-cancel' ? '…' : 'Cancel Slot'}
                      </button>
                    </div>
                  )}
                  {slot.status === 'checked_in' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <button type="button" onClick={async () => { setActing(slot.id + '-complete'); try { await completeBooking(slot.id); setGroupSlots(prev => prev.map(s => s.id === slot.id ? { ...s, status: 'completed' as any } : s)); if (slot.id === b?.id) setB(prev => prev ? { ...prev, status: 'completed' as any } : prev); toast('Completed', 'success') } catch { toast('Failed', 'error') } finally { setActing('') } }}
                        disabled={acting === slot.id + '-complete'}
                        style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: 'rgba(107,114,128,0.10)', color: '#374151', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {acting === slot.id + '-complete' ? '…' : 'Complete'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div style={CARD}>
              <p style={SL}>Slot &amp; Shipment</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FieldBlock label="Date"         value={b.slotDate} />
                <FieldBlock label="Time"         value={`${b.slotStartTime} – ${b.slotEndTime}`} />
                <FieldBlock label="Service"      value={b.serviceType === 'pickup' ? 'Pick Up' : 'Drop Off'} />
                <FieldBlock label="Load Type"    value={b.loadType.toUpperCase()} />
                {b.containerNumber  && <FieldBlock label="Container No."   value={b.containerNumber}   mono />}
                {b.houseBillNumber  && <FieldBlock label="HBL"             value={b.houseBillNumber}   mono />}
                {b.containerSize    && <FieldBlock label="Container Size"  value={b.containerSize} />}
                {b.entryNumber      && <FieldBlock label="Entry Number"    value={b.entryNumber}    mono />}
                {b.purpose          && <FieldBlock label="Purpose"         value={b.purpose} />}
                {b.consolidator     && <FieldBlock label="Consolidator"    value={b.consolidator} />}
                {b.bookingReference && <FieldBlock label="Booking Ref"     value={b.bookingReference} mono />}
                {b.weightKg         && <FieldBlock label="Weight"          value={`${b.weightKg.toLocaleString()} kg`} />}
                {b.volumeCbm        && <FieldBlock label="Volume"          value={`${b.volumeCbm} CBM`} />}
                {b.packageCount     && <FieldBlock label="Packages"        value={`${b.packageCount}`} />}
                {(b.palletCount ?? 0) > 0 && <FieldBlock label="Pallets"  value={`${b.palletCount} × ${b.palletType}`} />}
              </div>
              {b.palletType === 'chep' && (
                <div style={{ marginTop: 14, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.20)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Icon name={ICONS.warning} size={15} style={{ color: '#FBBF24', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#B45309', marginBottom: 2 }}>CHEP Pallet Exchange</p>
                    <p style={{ fontSize: 12, color: '#92400E' }}>{b.palletCount} CHEP pallet{(b.palletCount ?? 0) > 1 ? 's' : ''} must be exchanged at collection.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Documents */}
          <div style={CARD}>
            <p style={SL}>Documents</p>
            {bookingDocs.length === 0 ? (
              <p style={{ fontSize: 14, color: '#A8A29E' }}>No documents uploaded</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bookingDocs.map((doc: any) => {
                  const { data: { publicUrl } } = supabase.storage.from('booking-documents').getPublicUrl(doc.storage_path)
                  return (
                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#F7F6F5', borderRadius: 10, padding: '10px 14px' }}>
                      {/* Left: type label + filename */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <Icon name={ICONS.document} size={16} style={{ color: '#78716C', flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1917', margin: 0, textTransform: 'capitalize' }}>
                            {doc.document_type ? doc.document_type.replace(/_/g, ' ') : 'Document'}
                          </p>
                          <p style={{ fontSize: 12, color: '#78716C', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.filename}</p>
                        </div>
                      </div>
                      {/* Right: file size + View */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        {doc.file_size_bytes ? (
                          <span style={{ fontSize: 11, color: '#A8A29E' }}>{(doc.file_size_bytes / 1024).toFixed(0)} KB</span>
                        ) : null}
                        <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 12, fontWeight: 600, color: '#FC6514', textDecoration: 'none' }}>
                          View
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ICS */}
          {b.icsStatus && (
            <div style={CARD}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ ...SL, marginBottom: 0 }}>ICS Status</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => act('ics', () => refreshIcsStatus(b.id), 'ICS status refreshed', 'info')} disabled={acting === 'ics'}
                    style={{ fontSize: 12, color: '#FC6514', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500, fontFamily: 'inherit' }}>
                    <Icon name={ICONS.refresh} size={12} />{acting === 'ics' ? 'Refreshing…' : 'Refresh ICS'}
                  </button>
                  <a href="https://ics.abf.gov.au" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#FC6514', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                    Open portal <Icon name={ICONS.arrowRight} size={12} />
                  </a>
                </div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 9999, ...cssToObj(icsStyle) } as any}>
                {ICS_LABEL[b.icsStatus] ?? b.icsStatus}
              </span>
              {b.icsLastCheckedAt && (
                <p style={{ fontSize: 11, color: '#A8A29E', marginTop: 8 }}>Last checked: {fmtDateTime(b.icsLastCheckedAt)}</p>
              )}
            </div>
          )}

          {/* Identity check — only when checked_in or completed */}
          {(b.status === 'checked_in' || b.status === 'completed') && (
            <div style={CARD}>
              <p style={SL}>Identity Check</p>
              {!checkinRecord ? (
                <p style={{ fontSize: 14, color: '#A8A29E' }}>No ID scan data available</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 9999, background: idBadge.bg, color: idBadge.color, border: `1px solid ${idBadge.border}` }}>
                      <Icon name={ICONS.check} size={12} />{idBadge.label}
                    </span>
                    {checkinRecord.name_match_score != null && (
                      <span style={{ fontSize: 12, color: '#A8A29E' }}>Score: {checkinRecord.name_match_score}%</span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {checkinRecord.licence_name    && <FieldBlock label="Name on Licence"   value={checkinRecord.licence_name} />}
                    {checkinRecord.licence_number  && <FieldBlock label="Licence Number"    value={checkinRecord.licence_number} mono />}
                    {checkinRecord.licence_dob     && <FieldBlock label="Date of Birth"     value={checkinRecord.licence_dob} />}
                    {checkinRecord.licence_expiry  && <FieldBlock label="Expiry"            value={checkinRecord.licence_expiry} />}
                    {checkinRecord.licence_address && <FieldBlock label="Address"           value={checkinRecord.licence_address} />}
                    {checkinRecord.licence_scan_method && <FieldBlock label="Scan Method"  value={checkinRecord.licence_scan_method} />}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT ── */}
        <div>

          {/* Charges */}
          {b.totalAmount && (
            <div style={CARD}>
              <p style={SL}>Charges</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                {(b.storageCharge ?? 0) > 0    && <CRow label={`Storage (${b.storageDays} days)`} val={`$${b.storageCharge!.toFixed(2)}`} />}
                {(b.shrinkWrapCharge ?? 0) > 0  && <CRow label="Shrink wrap" val={`$${b.shrinkWrapCharge!.toFixed(2)}`} />}
                {b.slotFee !== undefined          && <CRow label="Slot fee" val={`$${b.slotFee.toFixed(2)}`} />}
                {b.gstAmount !== undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#A8A29E', paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <span>GST (10%)</span><span>${b.gstAmount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#1C1917', paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.09)', fontSize: 14 }}>
                  <span>Total</span><span style={{ color: '#FC6514' }}>${b.totalAmount.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#A8A29E', marginTop: 2 }}>
                  <span>{(b.paymentMethod ?? '—').toUpperCase()}</span>
                  <span style={{ color: b.paymentStatus === 'paid' ? '#22C55E' : '#FBBF24', fontWeight: 600 }}>
                    {b.paymentStatus === 'paid' ? '✓ Paid' : b.paymentStatus === 'pending_eft' ? 'EFT Pending' : b.paymentStatus}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div style={CARD}>
            <p style={SL}>Timeline</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
              <TRow icon={ICONS.document}    iconColor="#A8A29E" label="Created"    value={fmtDateTime(b.createdAt)} />
              {b.paymentStatus === 'paid' && <TRow icon={ICONS.check} iconColor="#22C55E" label="Payment" value="Received" valueColor="#22C55E" />}
              {b.checkedInAt && <TRow icon={ICONS.userCheck}  iconColor="#FBBF24" label="Checked In" value={fmtDateTime(b.checkedInAt)} />}
              {b.completedAt && <TRow icon={ICONS.checkSquare} iconColor="#22C55E" label="Completed" value={fmtDateTime(b.completedAt)} />}
            </div>
          </div>

          {/* Actions */}
          {(b.status === 'scheduled' || b.status === 'checked_in') && (
            <div style={CARD}>
              <p style={SL}>Actions</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {b.status === 'scheduled' && (
                  <Btn color="green" loading={acting === 'checkin'} onClick={() => act('checkin', () => checkInBooking(b.id), `✓ ${b.driverName} checked in`, 'success')}>
                    <Icon name={ICONS.userCheck} size={16} /> Check In Visitor
                  </Btn>
                )}
                {b.status === 'checked_in' && (
                  <Btn color="brand" loading={acting === 'complete'} onClick={() => setConfirmModal(true)}>
                    <Icon name={ICONS.checkSquare} size={16} /> Mark Complete
                  </Btn>
                )}
                {b.status === 'scheduled' && (
                  <Btn color="ghost" onClick={() => setRescheduleModal(true)}>
                    <Icon name={ICONS.calendar} size={14} /> Reschedule
                  </Btn>
                )}
                {b.status === 'scheduled' && (
                  <Btn color="danger" onClick={() => setCancelModal(true)}>
                    <Icon name={ICONS.close} size={14} /> Cancel Booking
                  </Btn>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Reschedule modal ── */}
      {rescheduleModal && (
        <ModalWrap onClose={() => setRescheduleModal(false)}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1C1917', marginBottom: 6 }}>Reschedule Booking</h3>
          <p style={{ fontSize: 13, color: '#78716C', marginBottom: 20, lineHeight: 1.5 }}>
            Change the slot for <strong style={{ fontFamily: 'ui-monospace,monospace', color: '#1C1917' }}>{b.referenceNumber}</strong>.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>New Date</label>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={FIELD} onFocus={focus} onBlur={blur} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>New Start Time</label>
              <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} style={FIELD} onFocus={focus} onBlur={blur} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn color="ghost" onClick={() => setRescheduleModal(false)}>Cancel</Btn>
            <Btn color="brand" loading={acting === 'reschedule'} onClick={async () => {
              const endH = String(parseInt(newStart.split(':')[0]) + 1).padStart(2, '0')
              await act('reschedule', () => rescheduleBooking(b.id, newDate, newStart, `${endH}:${newStart.split(':')[1]}`), `Rescheduled to ${newDate} at ${newStart}`, 'success')
              setRescheduleModal(false)
            }}>
              <Icon name={ICONS.calendar} size={14} /> Confirm Reschedule
            </Btn>
          </div>
        </ModalWrap>
      )}

      {/* ── Cancel modal ── */}
      {cancelModal && (
        <ModalWrap onClose={() => setCancelModal(false)}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1C1917', marginBottom: 6 }}>Cancel this booking?</h3>
          <p style={{ fontSize: 13, color: '#78716C', marginBottom: 20, lineHeight: 1.5 }}>
            You are cancelling <strong style={{ fontFamily: 'ui-monospace,monospace', color: '#1C1917' }}>{b.referenceNumber}</strong> for <strong style={{ color: '#1C1917' }}>{b.driverName}</strong>. This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn color="ghost" onClick={() => setCancelModal(false)}>Keep Booking</Btn>
            <Btn color="danger" loading={acting === 'cancel'} onClick={async () => {
              setActing('cancel')
              try {
                await cancelBooking(b.id)
                setB(prev => prev ? { ...prev, status: 'cancelled' as Booking['status'] } : prev)
                toast(`Booking ${b.referenceNumber} cancelled`, 'info')
                setCancelModal(false)
              } catch (err: any) {
                toast(err?.message ?? 'Action failed', 'error')
              } finally {
                setActing('')
              }
            }}>
              <Icon name={ICONS.close} size={14} /> Confirm Cancel
            </Btn>
          </div>
        </ModalWrap>
      )}

      {/* ── Mark Complete modal ── */}
      {confirmModal && (
        <ModalWrap onClose={() => setConfirmModal(false)}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1C1917', marginBottom: 6 }}>Complete this job?</h3>
          <p style={{ fontSize: 13, color: '#78716C', marginBottom: 20, lineHeight: 1.5 }}>
            Marking <strong style={{ color: '#1C1917' }}>{b.driverName}</strong>'s visit as complete. This action is final.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {['Driver identity verified', 'Documents checked', 'Cargo released'].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#1C1917' }}>
                <span style={{ width: 20, height: 20, borderRadius: 9999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.22)' }}>
                  <Icon name={ICONS.check} size={11} style={{ color: '#22C55E' }} />
                </span>
                {item}
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Completion Notes (optional)</label>
            <textarea rows={2} value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} placeholder="Any notes for records…" style={{ ...FIELD, resize: 'none' }} onFocus={focus} onBlur={blur} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn color="ghost" onClick={() => setConfirmModal(false)}>Cancel</Btn>
            <Btn color="brand" loading={acting === 'complete'} onClick={async () => {
              await act('complete', () => completeBooking(b.id, completionNotes || undefined), `✓ ${b.driverName}'s visit completed`, 'success')
              setConfirmModal(false)
            }}>
              <Icon name={ICONS.check} size={16} /> Confirm Complete
            </Btn>
          </div>
        </ModalWrap>
      )}
    </div>
  )
}

/* ── Helpers ── */

function cssToObj(str: string): React.CSSProperties {
  return Object.fromEntries(str.split(';').filter(Boolean).map(s => {
    const [k, ...v] = s.split(':')
    return [k.trim().replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase()), v.join(':').trim()]
  }))
}

function InfoRow({ label, value, icon, mono }: { label: string; value: string; icon?: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={RL}>{icon && <Icon name={icon} size={14} style={{ color: '#A8A29E' }} />}{label}</span>
      <span style={{ ...RV, fontFamily: mono ? 'ui-monospace,monospace' : undefined }}>{value}</span>
    </div>
  )
}

function FieldBlock({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: '#78716C', marginBottom: 3, fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#1C1917', fontFamily: mono ? 'ui-monospace,monospace' : undefined, margin: 0 }}>{value}</p>
    </div>
  )
}

function CRow({ label, val }: { label: string; val: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#78716C' }}>
      <span>{label}</span><span>{val}</span>
    </div>
  )
}

function TRow({ icon, iconColor, label, value, valueColor }: { icon: string; iconColor: string; label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#78716C' }}>
        <Icon name={icon} size={13} style={{ color: iconColor }} />{label}
      </span>
      <span style={{ color: valueColor ?? '#1C1917', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function ModalWrap({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#FFFFFF', borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.28)', maxWidth: 420, width: '100%', padding: 24 }}>
        {children}
      </div>
    </div>
  )
}

function Btn({ color, onClick, loading, children }: { color: 'brand' | 'green' | 'ghost' | 'danger'; onClick: () => void; loading?: boolean; children: React.ReactNode }) {
  const s: Record<string, React.CSSProperties> = {
    brand:  { background: 'var(--brand-color)', color: '#fff', border: 'none', boxShadow: '0 2px 8px rgba(var(--brand-rgb),0.30)' },
    green:  { background: 'linear-gradient(135deg,#22C55E,#16A34A)', color: '#fff', border: 'none', boxShadow: '0 2px 8px rgba(34,197,94,0.30)' },
    ghost:  { background: '#fff', color: '#374151', border: '1.5px solid #e5e7eb' },
    danger: { background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.25)' },
  }
  return (
    <button onClick={onClick} disabled={loading} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'all 0.15s', fontFamily: 'inherit', ...s[color] }}>
      {children}
    </button>
  )
}
