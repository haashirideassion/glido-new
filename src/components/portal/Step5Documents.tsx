import { useState } from 'react'
import { useWizard } from '@/contexts/WizardContext'
import rollImg from '@/assets/roll.png'
import type { SlotConfig } from '@/contexts/WizardContext'
import { Icon, ICONS } from '@/lib/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { lookupShipment, lookupShipmentByContainer } from '@/lib/db/cfs-shipments'
import { DEFAULT_TENANT_ID } from '@/lib/supabase'

const FL: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: '#78716C', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 6 }
const ROW: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }

const ICS_MAP: Record<string, { bg: string; color: string; border: string; label: string }> = {
  cleared:     { bg: 'rgba(34,197,94,0.12)',  color: '#22C55E', border: 'rgba(34,197,94,0.22)',  label: 'Cleared'  },
  held:        { bg: 'rgba(239,68,68,0.12)',  color: '#EF4444', border: 'rgba(239,68,68,0.22)',  label: 'Held'     },
  examination: { bg: 'rgba(251,191,36,0.10)', color: '#FBBF24', border: 'rgba(251,191,36,0.22)', label: 'On Hold'  },
  pending:     { bg: 'rgba(0,0,0,0.04)',      color: '#78716C', border: 'rgba(0,0,0,0.10)',      label: 'Pending'  },
}

const CONTAINER_SIZES = [
  '', '20ft Standard', '40ft Standard', '40ft High Cube', '45ft High Cube',
]

const PURPOSES = [
  '', 'Delivery to Consignee', 'Customs Examination', 'Transfer to Another Depot', 'Return to Shipper',
]

// ─── Per-slot "done" check ────────────────────────────────────────────────────
function isSlotDetailDone(cfg: any): boolean {
  const svc = cfg.serviceType; const lt = cfg.loadType
  const cn = (cfg.containerNumber ?? '').trim()
  const hbl = (cfg.hbl ?? '').trim()
  const cs = (cfg.containerSize ?? '').trim()
  const en = (cfg.entryNumber ?? '').trim()
  const pu = (cfg.purpose ?? '').trim()
  const co = (cfg.consolidator ?? '').trim()
  const br = (cfg.bookingReference ?? '').trim()
  if (svc === 'pickup'  && lt === 'lcl')  return !!(cn && hbl)
  if (svc === 'pickup'  && lt === 'fcl')  return !!(cn && cs)
  if (svc === 'dropoff' && lt === 'lcl')  return !!(br && co && en && pu)
  if (svc === 'dropoff' && lt === 'fcl')  return !!(cn && cs && en && pu)
  return false
}

export function Step5Documents() {
  const { state, dispatch } = useWizard()
  const [touched, setTouch] = useState<Record<string, boolean>>({})

  const set = (f: keyof typeof state, v: string) => dispatch({ type: 'SET', field: f as any, value: v })
  const touch = (f: string) => setTouch(p => ({ ...p, [f]: true }))

  const multi = state.slotCount > 1

  // Tab state for multi-slot
  const firstIncomplete5 = state.slotConfigs.findIndex(c => !isSlotDetailDone(c))
  const [activeSlot5, setActiveSlot5] = useState(firstIncomplete5 === -1 ? 0 : firstIncomplete5)

  const isPickupLcl  = state.serviceType === 'pickup'  && state.loadType === 'lcl'
  const isPickupFcl  = state.serviceType === 'pickup'  && state.loadType === 'fcl'
  const isDropoffLcl = state.serviceType === 'dropoff' && state.loadType === 'lcl'
  const isDropoffFcl = state.serviceType === 'dropoff' && state.loadType === 'fcl'

  // ── Shipment lookup ────────────────────────────────────────────────────────
  const fetchLcl = async () => {
    if (!state.hbl.trim()) return
    dispatch({ type: 'SET_SHIPMENT', data: null, loading: true, error: null, fetched: false })
    try {
      const data = await lookupShipment(DEFAULT_TENANT_ID, state.hbl.trim())
      dispatch({ type: 'SET_SHIPMENT', data: data ?? null, loading: false, error: data ? null : 'HBL not found.', fetched: true })
      if (data?.containerNumber) dispatch({ type: 'SET', field: 'containerNumber', value: data.containerNumber })
    } catch {
      dispatch({ type: 'SET_SHIPMENT', data: null, loading: false, error: 'Lookup failed.', fetched: false })
    }
  }

  const fetchFcl = async () => {
    if (!state.containerNumber.trim()) return
    dispatch({ type: 'SET_SHIPMENT', data: null, loading: true, error: null, fetched: false })
    try {
      const data = await lookupShipmentByContainer(DEFAULT_TENANT_ID, state.containerNumber.trim())
      const result = data ?? { id: '', hbl: '', containerNumber: state.containerNumber.trim(), icsStatus: 'unavailable', readyForCollection: false }
      dispatch({ type: 'SET_SHIPMENT', data: result, loading: false, error: data ? null : 'Container not found in CFS records — ICS status unavailable.', fetched: true })
    } catch {
      dispatch({ type: 'SET_SHIPMENT', data: null, loading: false, error: 'Lookup failed. Enter details manually.', fetched: false })
    }
  }

  const sd        = state.shipmentData
  const icsBadge  = ICS_MAP[sd?.icsStatus ?? ''] ?? ICS_MAP.pending
  const showChep  = sd?.palletType === 'chep'
  const showHeld  = sd?.icsStatus === 'held'

  // Multi-slot: tab switcher + shared driver fields
  if (multi) {
    const setSlot = (slotIndex: number) => (f: string, v: string) =>
      dispatch({ type: 'SET_SLOT_DETAIL', slotIndex, field: f, value: v })

    const activeCfg5 = state.slotConfigs[activeSlot5]

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src={rollImg} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          </div>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1C1917', letterSpacing: '-0.03em', lineHeight: 1.2, margin: 0 }}>Load Information</h2>
            <p style={{ fontSize: 14, color: '#78716C', lineHeight: 1.5, margin: '4px 0 0' }}>Enter shipment details for each booking slot.</p>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '2px solid #F3F4F6', marginBottom: 24, gap: 0 }}>
          {state.slotConfigs.map((cfg, i) => {
            const done   = isSlotDetailDone(cfg)
            const active = activeSlot5 === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActiveSlot5(i)}
                style={{
                  padding: '10px 24px', fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--brand-color, #FC6514)' : '#6B7280',
                  background: 'none', border: 'none',
                  borderBottom: active ? '2px solid var(--brand-color, #FC6514)' : '2px solid transparent',
                  marginBottom: -2, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  transition: 'all 0.15s', fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}
              >
                {done && (
                  <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                    <path d="M1 5L4.5 8.5L11 1" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                Slot {i + 1}
              </button>
            )
          })}
        </div>

        {/* Active slot panel */}
        <style>{`@keyframes slideInFromRight{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}`}</style>
        {activeCfg5 && (
          <div key={activeSlot5} style={{ animation: 'slideInFromRight 0.22s ease forwards' }}>
          <div style={{ padding: 20, background: '#F9F9F8', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 16, marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#78716C', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 16 }}>
              Slot {activeCfg5.index} — {activeCfg5.serviceType === 'pickup' ? 'Pick Up' : 'Drop Off'} · {(activeCfg5.loadType ?? '').toUpperCase()}
              {activeCfg5.selectedSlotLabel && <span style={{ fontWeight: 400, marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>{activeCfg5.selectedDate} {activeCfg5.selectedSlotLabel}</span>}
            </p>
            <SlotDetailFields
              cfg={activeCfg5}
              set={setSlot(activeCfg5.index)}
              touched={touched}
              touch={touch}
              touchPrefix={`s${activeSlot5}_`}
              slotIndex={activeCfg5.index}
            />
          </div>
          </div>
        )}

        {/* Shared driver fields */}
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#78716C', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>Driver / Visitor Details</p>
          <DriverFields state={state} set={set} touch={touch} touched={touched} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <img src={rollImg} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
        </div>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1C1917', letterSpacing: '-0.03em', lineHeight: 1.2, margin: 0 }}>Load Information</h2>
          <p style={{ fontSize: 14, color: '#78716C', lineHeight: 1.5, margin: '4px 0 0' }}>
            {isPickupLcl  && 'Enter your container and house bill details. ICS clearance status is checked automatically.'}
            {isPickupFcl  && 'Enter your container number and size. ICS clearance status is checked automatically.'}
            {isDropoffLcl && 'Enter your booking and customs details for this LCL drop-off.'}
            {isDropoffFcl && 'Enter your container details and customs information for this FCL drop-off.'}
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          1. PICKUP + LCL
          Fields: Container Number (req), HBL Number (req)
      ══════════════════════════════════════════════════════ */}
      {isPickupLcl && (
        <div>
          <div style={{ ...ROW, marginBottom: 24 }}>
            <FField label="Container Number" required error={touched.containerNumber && !state.containerNumber.trim()}>
              <input
                type="text" className="wizard-field"
                value={state.containerNumber}
                onChange={e => set('containerNumber', e.target.value.toUpperCase())}
                onBlur={() => touch('containerNumber')}
                placeholder="e.g. MSCU1234567"
                style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
              />
            </FField>
            <FField label="House Bill of Lading #" required error={touched.hbl && !state.hbl.trim()}>
              <input
                type="text" className="wizard-field"
                value={state.hbl}
                onChange={e => set('hbl', e.target.value.toUpperCase())}
                onBlur={() => touch('hbl')}
                placeholder="e.g. SYHMSCU001847"
                style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
              />
            </FField>
          </div>
          <div style={{ marginBottom: 32 }}>
            <button type="button" className="btn-dark" onClick={fetchLcl} disabled={state.hbl.trim().length < 4 || state.shipmentLoading}>
              {state.shipmentLoading ? <Spinner /> : <Icon name={ICONS.search} size={16} />}
              {state.shipmentLoading ? 'Looking up...' : 'Look Up Shipment'}
            </button>
          </div>
          {state.shipmentFetched && sd && (
            <ShipmentCard sd={sd} icsBadge={icsBadge} showHeld={showHeld} showChep={showChep} />
          )}
          <DriverFields state={state} set={set} touch={touch} touched={touched} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          2. DROPOFF + LCL
          Fields: Booking Reference # (req), Consolidator (req),
                  Entry Number (req), Purpose (req dropdown)
      ══════════════════════════════════════════════════════ */}
      {isDropoffLcl && (
        <div>
          <div style={{ ...ROW, marginBottom: 24 }}>
            <FField label="Booking Reference #" required error={touched.bookingReference && !state.bookingReference.trim()}>
              <input
                type="text" className="wizard-field"
                value={state.bookingReference}
                onChange={e => set('bookingReference', e.target.value)}
                onBlur={() => touch('bookingReference')}
                placeholder="e.g. BK-2026-00142"
              />
            </FField>
            <FField label="Consolidator / Freight Forwarder" required error={touched.consolidator && !state.consolidator.trim()}>
              <input
                type="text" className="wizard-field"
                value={state.consolidator}
                onChange={e => set('consolidator', e.target.value)}
                onBlur={() => touch('consolidator')}
                placeholder="e.g. Kuehne + Nagel"
              />
            </FField>
          </div>
          <div style={{ ...ROW, marginBottom: 24 }}>
            <FField label="Customs Entry #" required error={touched.entryNumber && !state.entryNumber.trim()}>
              <input
                type="text" className="wizard-field"
                value={state.entryNumber}
                onChange={e => set('entryNumber', e.target.value.toUpperCase())}
                onBlur={() => touch('entryNumber')}
                placeholder="e.g. CE2026100142"
                style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
              />
            </FField>
            <FField label="Purpose" required error={touched.purpose && !state.purpose.trim()}>
              <CustomSelect
                placeholder="Select purpose…"
                value={state.purpose}
                onChange={v => set('purpose', v)}
                onBlur={() => touch('purpose')}
                options={PURPOSES.filter(Boolean).map(p => ({ value: p, label: p }))}
              />
            </FField>
          </div>
          <DriverFields state={state} set={set} touch={touch} touched={touched} />
          <p style={{ fontSize: 12, color: '#78716C', display: 'flex', alignItems: 'center', gap: 6, margin: '16px 0 0' }}>
            <Icon name={ICONS.info} size={13} style={{ flexShrink: 0 }} />
            Drop-off does not incur storage charges. No ICS check required.
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          3. PICKUP + FCL
          Fields: Container Number (req), Container Size (req dropdown)
      ══════════════════════════════════════════════════════ */}
      {isPickupFcl && (
        <div>
          <div style={{ ...ROW, marginBottom: 24 }}>
            <FField label="Container Number" required error={touched.containerNumber && !state.containerNumber.trim()}>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text" className="wizard-field"
                  value={state.containerNumber}
                  onChange={e => set('containerNumber', e.target.value.toUpperCase())}
                  onBlur={() => touch('containerNumber')}
                  placeholder="e.g. MSCU1234567"
                  style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}
                />
                <button type="button" className="btn-dark" onClick={fetchFcl} disabled={state.containerNumber.trim().length < 4 || state.shipmentLoading} style={{ flexShrink: 0 }}>
                  {state.shipmentLoading ? <Spinner /> : null}
                  Look Up
                </button>
              </div>
            </FField>
            <FField label="Container Size" required error={touched.containerSize && !state.containerSize.trim()}>
              <CustomSelect
                placeholder="Select size…"
                value={state.containerSize}
                onChange={v => set('containerSize', v)}
                onBlur={() => touch('containerSize')}
                options={CONTAINER_SIZES.filter(Boolean).map(s => ({ value: s, label: s }))}
              />
            </FField>
          </div>
          {state.shipmentFetched && sd && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#78716C' }}>ICS Status:</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 9999, border: '1px solid transparent', background: icsBadge.bg, color: icsBadge.color, borderColor: icsBadge.border }}>
                  {icsBadge.label}
                </span>
              </div>
              {state.shipmentError && (
                <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#B45309', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name={ICONS.info} size={14} style={{ color: '#B45309', flexShrink: 0 }} />
                  {state.shipmentError}
                </div>
              )}
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <p style={{ ...FL, marginBottom: 16 }}>Container details</p>
                <div style={ROW}>
                  {[['Gross Weight', sd.weightKg ? `${sd.weightKg} kg` : '—'], ['Volume', sd.volumeCbm ? `${sd.volumeCbm} CBM` : '—']].map(([l, v]) => (
                    <div key={l} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
                      <p style={{ fontSize: 10, color: '#78716C', margin: '0 0 4px' }}>{l}</p>
                      <p style={{ fontWeight: 600, color: '#1C1917', fontSize: 13, margin: 0 }}>{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DriverFields state={state} set={set} touch={touch} touched={touched} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          4. DROPOFF + FCL
          Fields: Container Number (req), Container Size (req dropdown),
                  Entry Number (req), Purpose (req dropdown)
      ══════════════════════════════════════════════════════ */}
      {isDropoffFcl && (
        <div>
          <div style={{ ...ROW, marginBottom: 24 }}>
            <FField label="Container Number" required error={touched.containerNumber && !state.containerNumber.trim()}>
              <input
                type="text" className="wizard-field"
                value={state.containerNumber}
                onChange={e => set('containerNumber', e.target.value.toUpperCase())}
                onBlur={() => touch('containerNumber')}
                placeholder="e.g. MSCU1234567"
                style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
              />
            </FField>
            <FField label="Container Size" required error={touched.containerSize && !state.containerSize.trim()}>
              <CustomSelect
                placeholder="Select size…"
                value={state.containerSize}
                onChange={v => set('containerSize', v)}
                onBlur={() => touch('containerSize')}
                options={CONTAINER_SIZES.filter(Boolean).map(s => ({ value: s, label: s }))}
              />
            </FField>
          </div>
          <div style={{ ...ROW, marginBottom: 24 }}>
            <FField label="Customs Entry #" required error={touched.entryNumber && !state.entryNumber.trim()}>
              <input
                type="text" className="wizard-field"
                value={state.entryNumber}
                onChange={e => set('entryNumber', e.target.value.toUpperCase())}
                onBlur={() => touch('entryNumber')}
                placeholder="e.g. CE2026100142"
                style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
              />
            </FField>
            <FField label="Purpose" required error={touched.purpose && !state.purpose.trim()}>
              <CustomSelect
                placeholder="Select purpose…"
                value={state.purpose}
                onChange={v => set('purpose', v)}
                onBlur={() => touch('purpose')}
                options={PURPOSES.filter(Boolean).map(p => ({ value: p, label: p }))}
              />
            </FField>
          </div>
          <DriverFields state={state} set={set} touch={touch} touched={touched} />
          <p style={{ fontSize: 12, color: '#78716C', display: 'flex', alignItems: 'center', gap: 6, margin: '16px 0 0' }}>
            <Icon name={ICONS.info} size={13} style={{ flexShrink: 0 }} />
            Drop-off does not incur storage charges. No ICS check required.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Field wrapper with inline validation ─────────────────────────────────────

function FField({ label, required, error, children }: { label: string; required?: boolean; error?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ ...FL, color: error ? '#EF4444' : '#78716C' }}>
        {label}{required && <span style={{ color: '#EF4444', marginLeft: 4 }}>*</span>}
      </label>
      {children}
      {error && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>This field is required</p>}
    </div>
  )
}

// ─── Driver fields ────────────────────────────────────────────────────────────

function DriverFields({ state, set, touch, touched }: { state: any; set: (f: any, v: string) => void; touch: (f: string) => void; touched: Record<string, boolean> }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 8 }}>
      <FField label="Driver Name" required error={touched.driverName && !state.driverName.trim()}>
        <input
          type="text" className="wizard-field"
          value={state.driverName}
          onChange={e => set('driverName', e.target.value)}
          onBlur={() => touch('driverName')}
          placeholder="Person physically visiting"
        />
      </FField>
      <FField label="Driver Phone">
        <input
          type="tel" className="wizard-field"
          value={state.driverPhone}
          onChange={e => set('driverPhone', e.target.value)}
          placeholder="+61 4XX XXX XXX"
        />
      </FField>
      <FField label="Vehicle Registration" required error={touched.vehicleRegistration && !(state.vehicleRegistration ?? '').trim()}>
        <input
          type="text" className="wizard-field"
          value={state.vehicleRegistration ?? ''}
          onChange={e => set('vehicleRegistration', e.target.value.toUpperCase())}
          onBlur={() => touch('vehicleRegistration')}
          placeholder="e.g. ABC123"
          style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
        />
      </FField>
    </div>
  )
}

// ─── Shipment card (LCL pickup) ───────────────────────────────────────────────

function ShipmentCard({ sd, icsBadge, showHeld, showChep }: any) {
  const charges = sd ? (() => {
    const storageDays = sd.storageStartDate ? Math.max(1, Math.ceil((Date.now() - new Date(sd.storageStartDate).getTime()) / 86400000)) : 0
    const storageCharge = sd.volumeCbm ? sd.volumeCbm * 8.5 * storageDays : 0
    const shrinkWrap = sd.palletCount ? sd.palletCount * 12 : 0
    const subtotal = storageCharge + shrinkWrap + 5
    const gst = subtotal * 0.1
    return { storageCharge, shrinkWrap, subtotal, gst, total: subtotal + gst }
  })() : null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#78716C' }}>ICS Status:</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 9999, border: `1px solid ${icsBadge.border}`, background: icsBadge.bg, color: icsBadge.color }}>{icsBadge.label}</span>
      </div>
      {showHeld && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24 }}>
          <Icon name={ICONS.warning} size={18} style={{ color: '#EF4444', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontWeight: 600, color: '#EF4444', fontSize: 13, margin: '0 0 4px' }}>ICS Hold Detected</p>
            <p style={{ fontSize: 12, color: 'rgba(239,68,68,0.70)', lineHeight: 1.5, margin: 0 }}>This shipment is held by Australian Border Force. Contact your freight forwarder.</p>
          </div>
        </div>
      )}
      {showChep && (
        <div style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24 }}>
          <Icon name={ICONS.warning} size={18} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontWeight: 600, color: '#B45309', fontSize: 13, margin: '0 0 4px' }}>CHEP Pallet Exchange Required</p>
            <p style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5, margin: 0 }}>Bring the same number of empty CHEP pallets to exchange at collection.</p>
          </div>
        </div>
      )}
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#78716C', letterSpacing: '0.09em', textTransform: 'uppercase', margin: '0 0 16px' }}>Auto-populated from CFS records</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[['Weight', sd.weightKg ? sd.weightKg + ' kg' : '—'], ['Volume', sd.volumeCbm ? sd.volumeCbm + ' CBM' : '—'], ['Packages', sd.packageCount || '—'], ['Pallets', sd.palletCount ? `${sd.palletCount} × ${sd.palletType}` : '—'], ['Storage from', sd.storageStartDate || '—'], ['Days in store', '—']].map(([l, v]) => (
            <div key={l} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' }}>
              <p style={{ fontSize: 10, color: '#78716C', margin: '0 0 4px' }}>{l}</p>
              <p style={{ fontWeight: 600, color: '#1C1917', fontSize: 13, margin: 0 }}>{String(v)}</p>
            </div>
          ))}
        </div>
      </div>
      {charges && charges.total > 5.5 && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 32 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1917', margin: '0 0 16px' }}>Estimated Charges</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
            {charges.storageCharge > 0 && <ChargeRow label="Storage" val={`$${charges.storageCharge.toFixed(2)}`} />}
            {charges.shrinkWrap   > 0 && <ChargeRow label="Shrink wrap" val={`$${charges.shrinkWrap.toFixed(2)}`} />}
            <ChargeRow label="Slot fee" val="$5.00" />
            <div style={{ height: 1, background: 'rgba(0,0,0,0.07)', margin: '2px 0' }} />
            <ChargeRow label="Subtotal" val={`$${charges.subtotal.toFixed(2)}`} bold />
            <ChargeRow label="GST (10%)" val={`$${charges.gst.toFixed(2)}`} small />
            <div style={{ height: 1, background: 'rgba(0,0,0,0.07)', margin: '2px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#1C1917', fontSize: 15 }}>
              <span>Total</span><span style={{ color: '#FC6514' }}>${charges.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ChargeRow({ label, val, bold, small }: { label: string; val: string; bold?: boolean; small?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', color: bold ? '#1C1917' : '#78716C', fontWeight: bold ? 600 : 400, fontSize: small ? 12 : 13 }}>
      <span>{label}</span><span>{val}</span>
    </div>
  )
}

function Spinner() {
  return <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', borderRadius: 9999, animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
}

// ─── Per-slot detail fields for multi-slot mode ───────────────────────────────

function SlotDetailFields({ cfg, set, touched, touch, touchPrefix, slotIndex }: {
  cfg: SlotConfig
  set: (f: string, v: string) => void
  touched: Record<string, boolean>
  touch: (f: string) => void
  touchPrefix: string
  slotIndex: number
}) {
  const { dispatch } = useWizard()
  const [slotShipmentData,    setSlotShipmentData]    = useState<any>(null)
  const [slotShipmentFetched, setSlotShipmentFetched] = useState(false)
  const [slotShipmentLoading, setSlotShipmentLoading] = useState(false)
  const [slotShipmentError,   setSlotShipmentError]   = useState<string | null>(null)

  const fetchSlotLcl = async () => {
    const hblVal = (cfg.hbl ?? '').trim()
    if (!hblVal) return
    setSlotShipmentLoading(true); setSlotShipmentData(null); setSlotShipmentFetched(false); setSlotShipmentError(null)
    try {
      const data = await lookupShipment(DEFAULT_TENANT_ID, hblVal)
      setSlotShipmentData(data ?? null)
      setSlotShipmentError(data ? null : 'HBL not found.')
      setSlotShipmentFetched(true)
      if (data?.containerNumber) {
        set('containerNumber', data.containerNumber)
        dispatch({ type: 'SET_SLOT_DETAIL', slotIndex, field: 'containerNumber', value: data.containerNumber })
      }
    } catch { setSlotShipmentError('Lookup failed.') }
    finally { setSlotShipmentLoading(false) }
  }

  const fetchSlotFcl = async () => {
    const cnVal = (cfg.containerNumber ?? '').trim()
    if (!cnVal) return
    setSlotShipmentLoading(true); setSlotShipmentData(null); setSlotShipmentFetched(false); setSlotShipmentError(null)
    try {
      const data = await lookupShipmentByContainer(DEFAULT_TENANT_ID, cnVal)
      const result = data ?? { id: '', hbl: '', containerNumber: cnVal, icsStatus: 'unavailable', readyForCollection: false }
      setSlotShipmentData(result)
      setSlotShipmentError(data ? null : 'Container not found in CFS records — ICS status unavailable.')
      setSlotShipmentFetched(true)
    } catch { setSlotShipmentError('Lookup failed. Enter details manually.') }
    finally { setSlotShipmentLoading(false) }
  }

  const sd       = slotShipmentData
  const icsBadge = ICS_MAP[sd?.icsStatus ?? ''] ?? ICS_MAP.pending
  const showHeld = sd?.icsStatus === 'held'

  const svc = cfg.serviceType; const lt = cfg.loadType
  const isPickupLcl  = svc === 'pickup'  && lt === 'lcl'
  const isPickupFcl  = svc === 'pickup'  && lt === 'fcl'
  const isDropoffLcl = svc === 'dropoff' && lt === 'lcl'
  const isDropoffFcl = svc === 'dropoff' && lt === 'fcl'
  const p = touchPrefix  // key prefix to avoid cross-slot touch collision

  // Safe accessors — guard against undefined when restored from sessionStorage
  const cn  = cfg.containerNumber  ?? ''
  const hbl = cfg.hbl              ?? ''
  const cs  = cfg.containerSize    ?? ''
  const en  = cfg.entryNumber      ?? ''
  const pu  = cfg.purpose          ?? ''
  const co  = cfg.consolidator     ?? ''
  const br  = cfg.bookingReference ?? ''

  if (isPickupLcl) return (
    <div>
      <div style={{ ...ROW, marginBottom: 16 }}>
        <FField label="Container Number" required error={touched[p+'cn'] && !cn.trim()}>
          <input type="text" className="wizard-field" value={cn}
            onChange={e => set('containerNumber', e.target.value.toUpperCase())}
            onBlur={() => touch(p+'cn')} placeholder="e.g. MSCU1234567"
            style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }} />
        </FField>
        <FField label="House Bill of Lading #" required error={touched[p+'hbl'] && !hbl.trim()}>
          <input type="text" className="wizard-field" value={hbl}
            onChange={e => set('hbl', e.target.value.toUpperCase())}
            onBlur={() => touch(p+'hbl')} placeholder="e.g. SYHMSCU001847"
            style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }} />
        </FField>
      </div>
      <div style={{ marginBottom: slotShipmentFetched && sd ? 16 : 0 }}>
        <button type="button" className="btn-dark" onClick={fetchSlotLcl}
          disabled={hbl.trim().length < 4 || slotShipmentLoading}>
          {slotShipmentLoading ? <Spinner /> : <Icon name={ICONS.search} size={16} />}
          {slotShipmentLoading ? 'Looking up...' : 'Look Up Shipment'}
        </button>
      </div>
      {slotShipmentFetched && sd && <SlotIcsCard sd={sd} icsBadge={icsBadge} showHeld={showHeld} error={slotShipmentError} />}
    </div>
  )

  if (isPickupFcl) return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
        <FField label="Container Number" required error={touched[p+'cn'] && !cn.trim()}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input type="text" className="wizard-field" value={cn}
              onChange={e => set('containerNumber', e.target.value.toUpperCase())}
              onBlur={() => touch(p+'cn')} placeholder="e.g. MSCU1234567"
              style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }} />
            <button type="button" className="btn-dark" onClick={fetchSlotFcl}
              disabled={cn.trim().length < 4 || slotShipmentLoading} style={{ flexShrink: 0 }}>
              {slotShipmentLoading ? <Spinner /> : null}
              Look Up
            </button>
          </div>
        </FField>
        <FField label="Container Size" required error={touched[p+'cs'] && !cs.trim()}>
          <CustomSelect placeholder="Select size…" value={cs}
            onChange={v => set('containerSize', v)} onBlur={() => touch(p+'cs')}
            options={CONTAINER_SIZES.filter(Boolean).map(s => ({ value: s, label: s }))} />
        </FField>
      </div>
      {slotShipmentFetched && sd && <SlotIcsCard sd={sd} icsBadge={icsBadge} showHeld={showHeld} error={slotShipmentError} />}
    </div>
  )

  if (isDropoffLcl) return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <FField label="Booking Reference #" required error={touched[p+'br'] && !br.trim()}>
        <input type="text" className="wizard-field" value={br}
          onChange={e => set('bookingReference', e.target.value)}
          onBlur={() => touch(p+'br')} placeholder="e.g. BK-2026-00142" />
      </FField>
      <FField label="Consolidator / Freight Forwarder" required error={touched[p+'co'] && !co.trim()}>
        <input type="text" className="wizard-field" value={co}
          onChange={e => set('consolidator', e.target.value)}
          onBlur={() => touch(p+'co')} placeholder="e.g. Kuehne + Nagel" />
      </FField>
      <FField label="Customs Entry #" required error={touched[p+'en'] && !en.trim()}>
        <input type="text" className="wizard-field" value={en}
          onChange={e => set('entryNumber', e.target.value.toUpperCase())}
          onBlur={() => touch(p+'en')} placeholder="e.g. CE2026100142"
          style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }} />
      </FField>
      <FField label="Purpose" required error={touched[p+'pu'] && !pu.trim()}>
        <CustomSelect placeholder="Select purpose…" value={pu}
          onChange={v => set('purpose', v)} onBlur={() => touch(p+'pu')}
          options={PURPOSES.filter(Boolean).map(p2 => ({ value: p2, label: p2 }))} />
      </FField>
    </div>
  )

  if (isDropoffFcl) return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <FField label="Container Number" required error={touched[p+'cn'] && !cn.trim()}>
        <input type="text" className="wizard-field" value={cn}
          onChange={e => set('containerNumber', e.target.value.toUpperCase())}
          onBlur={() => touch(p+'cn')} placeholder="e.g. MSCU1234567"
          style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }} />
      </FField>
      <FField label="Container Size" required error={touched[p+'cs'] && !cs.trim()}>
        <CustomSelect placeholder="Select size…" value={cs}
          onChange={v => set('containerSize', v)} onBlur={() => touch(p+'cs')}
          options={CONTAINER_SIZES.filter(Boolean).map(s => ({ value: s, label: s }))} />
      </FField>
      <FField label="Customs Entry #" required error={touched[p+'en'] && !en.trim()}>
        <input type="text" className="wizard-field" value={en}
          onChange={e => set('entryNumber', e.target.value.toUpperCase())}
          onBlur={() => touch(p+'en')} placeholder="e.g. CE2026100142"
          style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }} />
      </FField>
      <FField label="Purpose" required error={touched[p+'pu'] && !pu.trim()}>
        <CustomSelect placeholder="Select purpose…" value={pu}
          onChange={v => set('purpose', v)} onBlur={() => touch(p+'pu')}
          options={PURPOSES.filter(Boolean).map(p2 => ({ value: p2, label: p2 }))} />
      </FField>
    </div>
  )

  return null
}

// ─── Per-slot ICS status card ─────────────────────────────────────────────────
function SlotIcsCard({ sd, icsBadge, showHeld, error }: {
  sd: any
  icsBadge: { bg: string; color: string; border: string; label: string }
  showHeld: boolean
  error: string | null
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#78716C' }}>ICS Status:</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 9999, border: `1px solid ${icsBadge.border}`, background: icsBadge.bg, color: icsBadge.color }}>
          {icsBadge.label}
        </span>
      </div>
      {showHeld && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <Icon name={ICONS.warning} size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontWeight: 600, color: '#EF4444', fontSize: 13, margin: '0 0 3px' }}>ICS Hold Detected</p>
            <p style={{ fontSize: 12, color: 'rgba(239,68,68,0.70)', margin: 0 }}>This shipment is held by Australian Border Force. Contact your freight forwarder.</p>
          </div>
        </div>
      )}
      {error && (
        <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#B45309', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name={ICONS.info} size={14} style={{ color: '#B45309', flexShrink: 0 }} />
          {error}
        </div>
      )}
      {(sd.weightKg || sd.volumeCbm) && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
          <p style={{ ...FL, marginBottom: 12 }}>Container details</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['Gross Weight', sd.weightKg ? `${sd.weightKg} kg` : '—'], ['Volume', sd.volumeCbm ? `${sd.volumeCbm} CBM` : '—']].map(([l, v]) => (
              <div key={l} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
                <p style={{ fontSize: 10, color: '#78716C', margin: '0 0 3px' }}>{l}</p>
                <p style={{ fontWeight: 600, color: '#1C1917', fontSize: 13, margin: 0 }}>{String(v)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
