import { useState, useEffect } from 'react'
import { useWizard, useHoldTimer, calcCharges } from '@/contexts/WizardContext'
import { Icon, ICONS } from '@/lib/Icon'
import { createBooking } from '@/lib/db/bookings'
import { supabase, DEFAULT_TENANT_ID } from '@/lib/supabase'
import { useTenantInfo } from '@/lib/useTenantInfo'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/lib/toast'

// EFT details are fetched live from tenant — see useTenantInfo() call inside the component

function comboSuffix(serviceType: string, loadType: string): string {
  const s = serviceType?.toLowerCase()
  const l = loadType?.toLowerCase()
  if (s === 'pickup'  && l === 'lcl') return 'PL'
  if (s === 'pickup'  && l === 'fcl') return 'PF'
  if (s === 'dropoff' && l === 'lcl') return 'DL'
  if (s === 'dropoff' && l === 'fcl') return 'DF'
  return 'XX'
}

export function Step7Confirmation() {
  const { state, dispatch } = useWizard()
  const { user } = useAuth()

  useEffect(() => {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
  }, [])
  const tenant = useTenantInfo()
  const { holdActive, holdLabel, expiring } = useHoldTimer()
  const charges = calcCharges(state)
  console.log('[Charges Debug]', {
    tenantPricing: state.tenantPricing,
    slotCount: state.slotCount,
    charges: calcCharges(state),
  })
  const sd = state.shipmentData
  const showChep = sd?.palletType === 'chep'
  const totalWithGst = charges.total.toFixed(2)

  const set = (f: 'paymentMethod' | 'cardNumber' | 'cardExpiry' | 'cardCvv', v: string) =>
    dispatch({ type: 'SET', field: f, value: v })

  const canSubmit = state.termsAccepted && !!state.paymentMethod &&
    (state.paymentMethod === 'eft' ? state.eftConfirmed : true) && !state.submitting

  const submit = async () => {
    if (!canSubmit) return
    const multi = state.slotCount > 1

    // Single-slot: require the top-level selectedSlotId
    if (!multi) {
      const slot = state.slots.find(s => s.id === state.selectedSlotId)
      if (!slot) return
    }

    dispatch({ type: 'SET', field: 'submitting', value: true })
    dispatch({ type: 'SET', field: 'submitError', value: null })
    try {
      const bookingGroupId = crypto.randomUUID()
      const slotFeeUnit    = charges.slotFee / state.slotCount

      // Generate a collision-resistant reference using a random base-36 component
      const generateRef = () => {
        const year = new Date().getFullYear()
        const rand = Math.random().toString(36).slice(2, 7).toUpperCase()
        return `GLD-${year}-${rand}`
      }

      // One master group reference shared across all slots
      let groupRef = generateRef()

      // Each slot config gets its own unique slot ref: groupRef for single, groupRef-SN for multi
      // Suffix is per-slot-index (not per time-group) so every row has a distinct reference_number
      const slotRefMap = new Map<number, string>()
      for (const cfg of state.slotConfigs) {
        const slotRef = multi ? `${groupRef}-S${cfg.index}-${comboSuffix(cfg.serviceType, cfg.loadType)}` : groupRef
        slotRefMap.set(cfg.index, slotRef)
      }

      const refs: Array<{ ref: string; slotLabel: string; date: string }> = []
      for (const cfg of state.slotConfigs) {
        // Per-slot: use per-slot fields if multi-slot, else top-level fields
        const slotDate        = multi ? cfg.selectedDate      : state.selectedDate
        const slotLabel       = multi ? cfg.selectedSlotLabel : state.selectedSlotLabel
        const slotStartTime   = slotLabel?.split('–')[0]?.trim() ?? ''
        const slotEndTime     = slotLabel?.split('–')[1]?.trim() ?? ''
        const slotIdForUpsert = multi ? cfg.selectedSlotId    : state.selectedSlotId

        const hbl              = multi ? cfg.hbl              : state.hbl
        const containerNumber  = multi ? cfg.containerNumber  : state.containerNumber
        const containerSize    = multi ? cfg.containerSize    : state.containerSize
        const entryNumber      = multi ? cfg.entryNumber      : state.entryNumber
        const purpose          = multi ? cfg.purpose          : state.purpose
        const consolidator     = multi ? cfg.consolidator     : state.consolidator
        const bookingReference = multi ? cfg.bookingReference : state.bookingReference
        const uploadedDocs     = (multi ? cfg.documentFiles   : state.documentFiles).filter(d => d.storagePath)

        let slotRef   = slotRefMap.get(cfg.index) ?? groupRef
        const bookingParams = {
          reference_number:  slotRef,
          group_reference:   groupRef,
          serviceType: cfg.serviceType!, loadType: cfg.loadType!,
          slotDate, slotStartTime, slotEndTime,
          driverName: state.driverName || state.guestName,
          driverPhone: state.driverPhone || state.guestPhone || undefined,
          guestName: state.guestName || undefined,
          guestPhone: state.guestPhone || undefined,
          houseBillNumber: hbl || undefined,
          containerNumber: containerNumber || undefined,
          weightKg: sd?.weightKg, volumeCbm: sd?.volumeCbm,
          packageCount: sd?.packageCount, palletCount: sd?.palletCount,
          storageStartDate: sd?.storageStartDate,
          storageDays: charges.storageDays || undefined,
          storageCharge: charges.storageCharge || undefined,
          shrinkWrapCharge: charges.shrinkWrapCharge || undefined,
          slotFee: slotFeeUnit,
          subtotal: charges.subtotal / state.slotCount,
          gstAmount: charges.gst / state.slotCount,
          totalAmount: charges.total / state.slotCount,
          paymentMethod: state.paymentMethod as 'card' | 'eft',
          paymentStatus: state.paymentMethod === 'eft' ? 'pending_eft' : 'pending',
          icsStatus: (sd?.icsStatus as any) || undefined,
          tenantId: DEFAULT_TENANT_ID,
          userId: user?.id ?? undefined,
          container_size:       containerSize       || undefined,
          entry_number:         entryNumber         || undefined,
          purpose:              purpose             || undefined,
          consolidator:         consolidator        || undefined,
          booking_reference:    bookingReference    || undefined,
          vehicle_registration: state.vehicleRegistration || undefined,
          booking_group_id:     bookingGroupId,
          slot_index:           cfg.index,
        }

        // Attempt createBooking with retry on duplicate key (23505)
        let booking
        try {
          booking = await createBooking(bookingParams as any)
        } catch (err: any) {
          if (err?.code === '23505') {
            // Duplicate reference_number — regenerate slotRef only; keep groupRef unchanged
            const year    = new Date().getFullYear()
            const newRand = Math.random().toString(36).slice(2, 7).toUpperCase()
            slotRef = multi ? `${groupRef}-S${cfg.index}-${comboSuffix(cfg.serviceType, cfg.loadType)}-${newRand}` : `GLD-${year}-${newRand}`
            booking = await createBooking({ ...bookingParams, reference_number: slotRef } as any)
          } else {
            throw err
          }
        }

        console.log('[Submit Debug] booking result:', booking)
        console.log('[Submit Debug] booking.referenceNumber:', booking?.referenceNumber)
        refs.push({ ref: booking.referenceNumber, slotLabel, date: slotDate })
        console.log('[Submit Debug] refs so far:', refs)

        // Upsert time_slots row and increment confirmed count — best-effort
        ;(async () => {
          try {
            const { data: upsertedSlot } = await supabase
              .from('time_slots')
              .upsert({
                id:         slotIdForUpsert ?? `gen-${slotDate}-${slotStartTime.replace(':', '')}`,
                date:       slotDate,
                start_time: slotStartTime,
                end_time:   slotEndTime,
                capacity:   10,
                confirmed:  1,
                held:       0,
                tenant_id:  DEFAULT_TENANT_ID,
              }, { onConflict: 'id', ignoreDuplicates: false })
              .select('id')
              .single()
            if (upsertedSlot?.id) {
              await (supabase as any).rpc('increment_slot_confirmed', { slot_id: upsertedSlot.id })
            }
          } catch { /* noop */ }
        })()

        // Insert booking_documents — best-effort
        if (uploadedDocs.length > 0) {
          ;(async (bid: string) => {
            try {
              await supabase.from('booking_documents').insert(
                uploadedDocs.map(d => ({
                  booking_id:      bid,
                  tenant_id:       DEFAULT_TENANT_ID,
                  document_type:   d.docType ?? 'general',
                  filename:        d.name,
                  file_size_bytes: d.size ?? null,
                  storage_path:    d.storagePath!,
                }))
              )
            } catch { /* noop */ }
          })(booking.id)
        }
      }

      // Deduplicate by ref string, preserving object shape
      const _seenRefs = new Set<string>()
      const uniqueRefs = refs.filter(r => { if (_seenRefs.has(r.ref)) return false; _seenRefs.add(r.ref); return true })
      console.log('[Submit Debug] final refs:', uniqueRefs)
      dispatch({ type: 'SET', field: 'confirmationRef',  value: uniqueRefs[0]?.ref ?? null })
      dispatch({ type: 'SET', field: 'confirmationRefs', value: uniqueRefs })
      dispatch({ type: 'SET', field: 'submitting', value: false })
      dispatch({ type: 'SET', field: 'step', value: 8 })
    } catch (err: any) {
      console.log('[Submit Debug] createBooking error:', err)
      dispatch({ type: 'SET', field: 'submitError', value: err?.message ?? 'Booking failed. Please try again.' })
      dispatch({ type: 'SET', field: 'submitting', value: false })
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1C1917', letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 6 }}>
          {state.paymentMethod === 'eft' ? 'Review & Confirm' : 'Review & Pay'}
        </h2>
        <p style={{ fontSize: 14, color: '#78716C', lineHeight: 1.5 }}>
          {state.paymentMethod === 'eft'
            ? 'Confirm your booking details. You will receive bank transfer instructions by email.'
            : 'Confirm your booking details and complete payment to secure your slot.'}
        </p>
      </div>


      {/* Booking summary */}
      <div style={{ background: '#fff', border: '1.5px solid #8B8B8B', borderRadius: 14, padding: 20, marginBottom: 20, fontSize: 13 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Booking Summary</p>
        {/* Shared fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: state.slotCount > 1 ? 16 : 0 }}>
          {[
            ['Guest Name', state.guestName || '—'],
            ['Driver', state.driverName || '—'],
            ...(state.slotCount === 1 ? [
              ['Service', state.serviceType === 'pickup' ? 'Pick Up' : state.serviceType === 'dropoff' ? 'Drop Off' : '—'],
              ['Load Type', (state.loadType || '—').toUpperCase()],
              ['Slot', state.selectedSlotLabel || '—'],
              ...(state.hbl ? [['HBL', state.hbl]] : []),
              ...(state.containerNumber ? [['Container', state.containerNumber]] : []),
            ] : []),
          ].map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#78716C' }}>{label}</span>
              <span style={{ fontWeight: 600, color: '#1C1917', fontFamily: label === 'HBL' || label === 'Container' ? 'ui-monospace,monospace' : undefined, fontSize: label === 'HBL' || label === 'Container' ? 12 : 13 }}>{val}</span>
            </div>
          ))}
        </div>
        {/* Per-slot breakdown for multi-slot */}
        {state.slotCount > 1 && state.slotConfigs.map((cfg, i) => {
          // Per-slot charge calculation
          const tp = state.tenantPricing
          const perSlotFee = cfg.serviceType === 'pickup'
            ? (tp?.slot_fee_pickup  ?? 5.00)
            : (tp?.slot_fee_dropoff ?? 5.00)
          const perSlotStorage    = charges.storageCharge    / state.slotCount
          const perSlotShrinkWrap = charges.shrinkWrapCharge / state.slotCount
          const perSlotSubtotal   = perSlotFee + perSlotStorage + perSlotShrinkWrap

          return (
            <div key={cfg.index} style={{ borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: 12, marginTop: i === 0 ? 4 : 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#78716C', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>Slot {cfg.index}</p>
              {[
                ['Service',   cfg.serviceType === 'pickup' ? 'Pick Up' : cfg.serviceType === 'dropoff' ? 'Drop Off' : '—'],
                ['Load',      (cfg.loadType || '—').toUpperCase()],
                ['Date',      cfg.selectedDate || '—'],
                ['Time',      cfg.selectedSlotLabel || '—'],
                ...(cfg.containerNumber ? [['Container', cfg.containerNumber]] : []),
                ...(cfg.hbl            ? [['HBL',       cfg.hbl]]             : []),
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ color: '#A8A29E', fontSize: 12 }}>{label}</span>
                  <span style={{ fontWeight: 600, color: '#1C1917', fontSize: 12, fontFamily: label === 'HBL' || label === 'Container' ? 'ui-monospace,monospace' : undefined }}>{val}</span>
                </div>
              ))}
              {/* Per-slot charges */}
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: 8, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#A8A29E' }}>
                  <span>Slot fee</span>
                  <span style={{ fontWeight: 500, color: '#78716C' }}>${perSlotFee.toFixed(2)}</span>
                </div>
                {perSlotStorage > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#A8A29E' }}>
                    <span>Storage</span>
                    <span style={{ fontWeight: 500, color: '#78716C' }}>${perSlotStorage.toFixed(2)}</span>
                  </div>
                )}
                {perSlotShrinkWrap > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#A8A29E' }}>
                    <span>Shrink wrap</span>
                    <span style={{ fontWeight: 500, color: '#78716C' }}>${perSlotShrinkWrap.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#1C1917', marginTop: 2 }}>
                  <span>Slot subtotal</span>
                  <span>${perSlotSubtotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ICS status */}
      {sd && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, marginBottom: 20 }}>
          <span style={{ color: '#78716C', fontWeight: 500 }}>ICS Status:</span>
          {(() => {
            const m: Record<string, [string, string, string]> = {
              cleared: ['rgba(34,197,94,0.12)', '#22C55E', 'rgba(34,197,94,0.22)'],
              held: ['rgba(239,68,68,0.12)', '#EF4444', 'rgba(239,68,68,0.22)'],
              examination: ['rgba(251,191,36,0.10)', '#FBBF24', 'rgba(251,191,36,0.22)'],
            }
            const [bg, color, border] = m[sd.icsStatus ?? ''] ?? ['rgba(0,0,0,0.04)', '#78716C', 'rgba(0,0,0,0.10)']
            const label = { cleared: 'Cleared', held: 'Held', examination: 'On Hold', pending: 'Pending' }[sd.icsStatus ?? ''] ?? 'Unknown'
            return <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 9999, background: bg, color, border: `1px solid ${border}` }}>{label}</span>
          })()}
        </div>
      )}

      {/* CHEP */}
      {showChep && (
        <div style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Icon name={ICONS.warning} size={16} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: '#92400E', fontWeight: 500, lineHeight: 1.5 }}>Reminder: CHEP pallet exchange required at collection. Bring your CHEP pallets.</p>
        </div>
      )}

      {/* Charges — single-slot: full breakdown; multi-slot: grand total summary only */}
      <div style={{ background: '#fff', border: '1.5px solid #8B8B8B', borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1917', marginBottom: 14 }}>
          {state.slotCount > 1 ? 'Total Summary' : 'Charges'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
          {state.slotCount === 1 && (
            <>
              {charges.storageCharge > 0 && <CR label="Storage charge" val={`$${charges.storageCharge.toFixed(2)}`} />}
              {charges.shrinkWrapCharge > 0 && <CR label="Shrink wrap" val={`$${charges.shrinkWrapCharge.toFixed(2)}`} />}
              <CR label="Slot fee" val={`$${charges.slotFee.toFixed(2)}`} />
              <div style={{ height: 1, background: 'rgba(0,0,0,0.07)', margin: '2px 0' }} />
            </>
          )}
          <CR label={state.slotCount > 1 ? 'Subtotal (all slots)' : 'Subtotal'} val={`$${charges.subtotal.toFixed(2)}`} bold />
          <CR label="GST (10%)" val={`$${charges.gst.toFixed(2)}`} small />
          <div style={{ height: 1, background: 'rgba(0,0,0,0.07)', margin: '2px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#1C1917', fontSize: 15 }}>
            <span>Total Due</span>
            <span style={{ color: 'var(--brand-color)' }}>${totalWithGst} AUD</span>
          </div>
        </div>
      </div>

      {/* Payment method */}
      <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1917', marginBottom: 12 }}>Payment Method</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        {[
          { val: 'card',   icon: ICONS.shield,   title: 'Credit / Debit Card',   sub: 'Visa, Mastercard, Amex'            },
          { val: 'eft',    icon: ICONS.document,  title: 'Bank Transfer (EFT)',   sub: 'Transfer before slot date'         },
          { val: 'compay', icon: ICONS.bookings,  title: 'ComPay',                sub: 'Port community payment system'     },
        ].map(opt => {
          const sel = state.paymentMethod === opt.val
          return (
            <button key={opt.val} type="button" onClick={() => dispatch({ type: 'SET', field: 'paymentMethod', value: opt.val })}
              style={{ textAlign: 'left', cursor: 'pointer', borderRadius: 14, padding: 16, transition: 'all 0.15s ease', background: sel ? 'rgba(var(--brand-rgb),0.03)' : '#fff', border: `1.5px solid ${sel ? 'var(--brand-color)' : '#8B8B8B'}` }}>
              <Icon name={opt.icon} size={20} style={{ color: 'var(--brand-color)', marginBottom: 8, display: 'block' }} />
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1C1917' }}>{opt.title}</div>
              <div style={{ fontSize: 12, color: '#78716C', marginTop: 2 }}>{opt.sub}</div>
            </button>
          )
        })}
      </div>

      {/* Card panel */}
      {state.paymentMethod === 'card' && (
        <CardPaymentPanel />
      )}

      {/* EFT panel */}
      {state.paymentMethod === 'eft' && (
        <div style={{ background: 'rgba(var(--brand-rgb),0.06)', border: '1px solid rgba(var(--brand-rgb),0.20)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <p style={{ fontWeight: 600, color: 'var(--brand-color)', fontSize: 13, marginBottom: 14 }}>Bank Transfer Details</p>
          {[
            ['Bank',         tenant?.eftBankName      || '—'],
            ['Account Name', tenant?.eftAccountName   || '—'],
            ['BSB',          tenant?.eftBsb           || '—'],
            ['Account No.',  tenant?.eftAccountNumber || '—'],
          ].map(([k, v], i, arr) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(var(--brand-rgb),0.15)' : 'none' }}>
              <span style={{ color: 'rgba(var(--brand-rgb),0.60)', fontSize: 12 }}>{k}</span>
              <span style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 600, color: 'var(--brand-color)', fontSize: 12 }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <input type="checkbox" id="eft-confirm" checked={state.eftConfirmed} onChange={e => dispatch({ type: 'SET', field: 'eftConfirmed', value: e.target.checked })} style={{ marginTop: 3, accentColor: 'var(--brand-color)' }} />
            <label htmlFor="eft-confirm" style={{ fontSize: 12, color: 'rgba(var(--brand-rgb),0.70)', cursor: 'pointer', lineHeight: 1.5 }}>
              I confirm I will transfer <strong style={{ color: 'var(--brand-color)' }}>${totalWithGst} AUD</strong> to the above account using my booking reference as the payment reference.
            </label>
          </div>
        </div>
      )}

      {/* ComPay panel */}
      {state.paymentMethod === 'compay' && (() => {
        const clientNum = tenant?.compayClientNumber
        const ref = state.confirmationRef || state.confirmationRefs?.[0]?.ref || ''
        const amt = totalWithGst
        const compayUrl = clientNum
          ? `https://compay.1-stop.biz/AdhocCCWebPages/Payment.aspx?CN=${encodeURIComponent(clientNum)}&PayType=STORAGE&REF1=${encodeURIComponent(ref)}&AMT=${encodeURIComponent(amt)}`
          : null
        return (
          <div style={{ background: 'rgba(var(--brand-rgb),0.06)', border: '1px solid rgba(var(--brand-rgb),0.20)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <p style={{ fontWeight: 600, color: 'var(--brand-color)', fontSize: 13, marginBottom: 8 }}>ComPay — Port Community Payments</p>
            <p style={{ fontSize: 12, color: '#78716C', marginBottom: 14, lineHeight: 1.5 }}>
              Pay your freight and storage charges through the ComPay port community payment system.
            </p>
            {compayUrl ? (
              <a
                href={compayUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--brand-color)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}
              >
                <Icon name={ICONS.bookings} size={16} />
                Pay via ComPay →
              </a>
            ) : (
              <button
                type="button"
                onClick={() => toast('ComPay online payments — coming soon. Please pay at reception.', 'info')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--brand-color)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <Icon name={ICONS.bookings} size={16} />
                Pay via ComPay →
              </button>
            )}
            {ref && (
              <p style={{ fontSize: 12, color: '#78716C', marginTop: 10, lineHeight: 1.5 }}>
                Reference your booking number: <strong style={{ fontFamily: 'ui-monospace,monospace', color: '#1C1917' }}>{ref}</strong> when paying.
              </p>
            )}
            <p style={{ fontSize: 11, color: '#A8A29E', marginTop: 12, lineHeight: 1.5 }}>
              ComPay is used by freight forwarders and transport companies at Australian ports. Settlement next business day.
            </p>
          </div>
        )
      })()}

      {/* Terms */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
        <input type="checkbox" id="terms" checked={state.termsAccepted} onChange={e => dispatch({ type: 'SET', field: 'termsAccepted', value: e.target.checked })} style={{ marginTop: 3, accentColor: 'var(--brand-color)' }} />
        <label htmlFor="terms" style={{ fontSize: 13, color: '#78716C', cursor: 'pointer', lineHeight: 1.5 }}>
          I agree to the <a href="#" style={{ color: 'var(--brand-color)', textDecoration: 'underline', textUnderlineOffset: 2 }}>booking terms</a>{' '}
          and <a href="#" style={{ color: 'var(--brand-color)', textDecoration: 'underline', textUnderlineOffset: 2 }}>cancellation policy</a>.
        </label>
      </div>

      {/* Error */}
      {state.submitError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#DC2626', fontWeight: 500 }}>
          {state.submitError}
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        className="btn-primary"
        onClick={submit}
        disabled={!canSubmit}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 600, padding: '14px 24px', border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.50, borderRadius: 12, pointerEvents: canSubmit ? 'auto' : 'none' }}
      >
        {state.submitting
          ? <><Spinner /> Submitting…</>
          : <><Icon name={ICONS.check} size={18} /> {state.paymentMethod === 'eft' ? 'Confirm Booking' : `Confirm & Pay $${totalWithGst} AUD`}</>}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function CR({ label, val, bold, small }: { label: string; val: string; bold?: boolean; small?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', color: bold ? '#1C1917' : '#78716C', fontWeight: bold ? 600 : 400, fontSize: small ? 12 : 13 }}>
      <span>{label}</span><span>{val}</span>
    </div>
  )
}

function Spinner() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }}>
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round"/>
  </svg>
}

// ─── Card type detection ──────────────────────────────────────────────────────
function detectCard(digits: string): 'visa' | 'mastercard' | 'amex' | null {
  if (!digits) return null
  if (digits.startsWith('4')) return 'visa'
  const n = parseInt(digits.substring(0, 2))
  if (n >= 51 && n <= 55) return 'mastercard'
  if (digits.startsWith('34') || digits.startsWith('37')) return 'amex'
  return null
}

const CARD_LOGOS: Record<string, React.ReactNode> = {
  visa:       <span style={{ fontSize: 11, fontWeight: 800, color: '#1a1f71', letterSpacing: '-0.02em', fontStyle: 'italic' }}>VISA</span>,
  mastercard: <span style={{ fontSize: 10, fontWeight: 700, color: '#eb001b' }}>MC</span>,
  amex:       <span style={{ fontSize: 10, fontWeight: 700, color: '#007bc1' }}>AMEX</span>,
}

// ─── Validated card panel ─────────────────────────────────────────────────────
function CardPaymentPanel() {
  const { state, dispatch } = useWizard()
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [errors, setErrors]   = useState<Record<string, string>>({})

  const set = (f: string, v: string) => dispatch({ type: 'SET', field: f as any, value: v })
  const touch = (f: string) => setTouched(p => ({ ...p, [f]: true }))

  const digits   = state.cardNumber.replace(/\s/g, '')
  const cardType = detectCard(digits)
  const isAmex   = cardType === 'amex'

  // ── Formatters ──────────────────────────────────────────────────────────────

  const handleCardNumber = (raw: string) => {
    const d = raw.replace(/\D/g, '')
    let formatted: string
    if (isAmex || d.startsWith('34') || d.startsWith('37')) {
      // Amex: 4-6-5
      const p1 = d.slice(0, 4)
      const p2 = d.slice(4, 10)
      const p3 = d.slice(10, 15)
      formatted = [p1, p2, p3].filter(Boolean).join(' ')
    } else {
      // Standard: 4-4-4-4
      formatted = d.slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
    }
    set('cardNumber', formatted)
  }

  const handleExpiry = (raw: string) => {
    const d    = raw.replace(/\D/g, '').slice(0, 4)
    let result = d
    if (d.length > 2) result = d.slice(0, 2) + '/' + d.slice(2)
    set('cardExpiry', result)
  }

  const handleCvv = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, isAmex ? 4 : 3)
    set('cardCvv', d)
  }

  const handleName = (raw: string) => {
    const cleaned = raw.replace(/[^a-zA-Z \-']/g, '').slice(0, 60)
    set('cardName', cleaned)
  }

  // ── Validators ──────────────────────────────────────────────────────────────

  const validateCard = () => {
    const d = state.cardNumber.replace(/\s/g, '')
    const ct = detectCard(d)
    const expected = ct === 'amex' ? 15 : 16
    const err = d.length !== expected ? 'Please enter a valid ' + expected + '-digit card number' : ''
    setErrors(p => ({ ...p, cardNumber: err }))
  }

  const validateExpiry = () => {
    const parts = state.cardExpiry.split('/')
    if (parts.length !== 2 || parts[0].length !== 2 || parts[1].length !== 2) {
      setErrors(p => ({ ...p, cardExpiry: 'Invalid expiry date' })); return
    }
    const mm = parseInt(parts[0]), yy = parseInt(parts[1])
    if (mm < 1 || mm > 12) { setErrors(p => ({ ...p, cardExpiry: 'Invalid expiry date' })); return }
    const now = new Date()
    const expMs = new Date(2000 + yy, mm, 1).getTime()
    if (expMs < now.getTime()) { setErrors(p => ({ ...p, cardExpiry: 'Card has expired' })); return }
    setErrors(p => ({ ...p, cardExpiry: '' }))
  }

  const validateCvv = () => {
    const expected = isAmex ? 4 : 3
    const err = state.cardCvv.length !== expected ? 'Invalid CVV' : ''
    setErrors(p => ({ ...p, cardCvv: err }))
  }

  const validateName = () => {
    const err = state.cardName.trim().length < 2 ? 'Please enter the cardholder name as it appears on the card' : ''
    setErrors(p => ({ ...p, cardName: err }))
  }

  // ── Shared label style (matching existing wizard style) ──────────────────────
  const LBL: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#78716C', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }
  const ERR: React.CSSProperties = { fontSize: 11, color: '#EF4444', marginTop: 4 }
  const fieldStyle = (hasErr: boolean): React.CSSProperties => ({
    borderColor: hasErr ? '#EF4444' : undefined,
    boxShadow:   hasErr ? '0 0 0 2px rgba(239,68,68,0.15)' : undefined,
  })

  return (
    <div style={{ background: '#fff', border: '1.5px solid #8B8B8B', borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Icon name={ICONS.shield} size={15} style={{ color: '#22C55E' }} />
        <p style={{ fontSize: 12, color: '#78716C', fontWeight: 500 }}>Secure card payment powered by Stripe</p>
      </div>

      {/* Cardholder name */}
      <div style={{ marginBottom: 14 }}>
        <label style={LBL}>Cardholder Name</label>
        <input
          type="text"
          placeholder="As it appears on the card"
          maxLength={60}
          className="wizard-field"
          value={state.cardName}
          onChange={e => handleName(e.target.value)}
          onBlur={() => { touch('cardName'); validateName() }}
          style={touched.cardName && errors.cardName ? fieldStyle(true) : {}}
        />
        {touched.cardName && errors.cardName && <p style={ERR}>{errors.cardName}</p>}
      </div>

      {/* Card number */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={{ ...LBL, marginBottom: 0 }}>Card Number</label>
          {cardType && CARD_LOGOS[cardType] && (
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 6px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 4, background: '#fff' }}>
              {CARD_LOGOS[cardType]}
            </span>
          )}
        </div>
        <input
          type="text"
          inputMode="numeric"
          placeholder={isAmex ? '3782 822463 10005' : '•••• •••• •••• ••••'}
          maxLength={isAmex ? 17 : 19}
          className="wizard-field"
          value={state.cardNumber}
          onChange={e => handleCardNumber(e.target.value)}
          onBlur={() => { touch('cardNumber'); validateCard() }}
          style={{ letterSpacing: '0.08em', fontFamily: 'ui-monospace,monospace', ...(touched.cardNumber && errors.cardNumber ? fieldStyle(true) : {}) }}
        />
        {touched.cardNumber && errors.cardNumber && <p style={ERR}>{errors.cardNumber}</p>}
      </div>

      {/* Expiry + CVV */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={LBL}>Expiry</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="MM/YY"
            maxLength={5}
            className="wizard-field"
            value={state.cardExpiry}
            onChange={e => handleExpiry(e.target.value)}
            onBlur={() => { touch('cardExpiry'); validateExpiry() }}
            style={touched.cardExpiry && errors.cardExpiry ? fieldStyle(true) : {}}
          />
          {touched.cardExpiry && errors.cardExpiry && <p style={ERR}>{errors.cardExpiry}</p>}
        </div>
        <div>
          <label style={LBL}>CVV</label>
          <input
            type="password"
            inputMode="numeric"
            placeholder={isAmex ? '••••' : '•••'}
            maxLength={isAmex ? 4 : 3}
            className="wizard-field"
            value={state.cardCvv}
            onChange={e => handleCvv(e.target.value)}
            onBlur={() => { touch('cardCvv'); validateCvv() }}
            style={touched.cardCvv && errors.cardCvv ? fieldStyle(true) : {}}
          />
          {touched.cardCvv && errors.cardCvv && <p style={ERR}>{errors.cardCvv}</p>}
        </div>
      </div>
    </div>
  )
}
