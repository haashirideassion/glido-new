import { useKiosk } from '@/contexts/KioskContext'
import { Icon, ICONS } from '@/lib/Icon'

const OFFICE_REASONS = [
  'Meeting with Staff',
  'Document Submission',
  'Invoice / Payment Query',
  'Customs Documentation',
  'General Enquiry',
]

const YARD_REASONS = [
  'Container Inspection',
  'Cargo Survey',
  'Damage Assessment',
  'Photography / Documentation',
  'Customs Examination',
  'Insurance Assessment',
  'Quality Control Inspection',
]

export function WalkInScreen() {
  const { state, dispatch, submitWalkIn, goTo } = useKiosk()
  if (state.currentScreen !== 'walkin') return null

  type WalkInField = 'walkInPurpose' | 'walkInName' | 'walkInPhone' | 'walkInVehicle' | 'walkInBLRef' | 'walkInPersonVisited' | 'walkInReason'
  const set = (field: WalkInField, value: string) =>
    dispatch({ type: 'SET_WALK_IN_FIELD', field: field as any, value })

  const purpose    = state.walkInPurpose
  const isPickup   = purpose === 'walk_in_pickup'
  const isDropoff  = purpose === 'walk_in_dropoff'
  const isCargo    = isPickup || isDropoff
  const isOffice   = purpose === 'visit_office'
  const isYard     = purpose === 'visit_yard'
  const isVisit    = isOffice || isYard || purpose === 'visit_person'

  const reasonOptions = isOffice ? OFFICE_REASONS : isYard ? YARD_REASONS : []

  const LABEL: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#78716C', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }
  const FIELD: React.CSSProperties = { minHeight: 64, padding: '20px 14px', fontSize: 15 }

  const handleSubmit = () => {
    if (isYard) {
      // Yard visits require licence scan — route through consent → idscan before completing
      dispatch({ type: 'SET_ARRIVED_VISITOR', name: state.walkInName.trim() })
      goTo('consent')
    } else {
      submitWalkIn()
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 480, marginTop: 200 }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1C1917', letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 8 }}>Walk-In Registration</h2>
          <p style={{ fontSize: 14, color: '#78716C', lineHeight: 1.5 }}>Please provide your details so reception can assist you</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <label style={LABEL}>Your Name <span style={{ color: 'var(--brand-color)' }}>*</span></label>
            <input type="text" placeholder="Full name" className="wizard-field" style={FIELD} value={state.walkInName} onChange={e => set('walkInName', e.target.value)} />
          </div>
          <div>
            <label style={LABEL}>Phone Number <span style={{ fontWeight: 400, color: '#A8A29E', fontSize: 10 }}>(optional)</span></label>
            <input type="tel" placeholder="04XX XXX XXX" className="wizard-field" style={FIELD} value={state.walkInPhone} onChange={e => set('walkInPhone', e.target.value)} />
          </div>

          {/* Cargo-specific fields */}
          {isCargo && (
            <>
              <div>
                <label style={LABEL}>Vehicle Registration <span style={{ fontWeight: 400, color: '#A8A29E', fontSize: 10 }}>(optional)</span></label>
                <input type="text" placeholder="LEA-1234" className="wizard-field uppercase" style={{ ...FIELD, textTransform: 'uppercase' }} value={state.walkInVehicle} onChange={e => set('walkInVehicle', e.target.value.toUpperCase())} />
              </div>
              <div>
                <label style={LABEL}>B/L or Shipment Reference <span style={{ fontWeight: 400, color: '#A8A29E', fontSize: 10 }}>(optional)</span></label>
                <input type="text" placeholder="e.g. COSCO2026041201" className="wizard-field" style={FIELD} value={state.walkInBLRef} onChange={e => set('walkInBLRef', e.target.value)} />
              </div>
            </>
          )}

          {/* Person being visited — for visit_person legacy + office/yard */}
          {isVisit && (
            <div>
              <label style={LABEL}>Person You're Visiting <span style={{ fontWeight: 400, color: '#A8A29E', fontSize: 10 }}>(optional)</span></label>
              <input type="text" placeholder="Staff member's name" className="wizard-field" style={FIELD} value={state.walkInPersonVisited} onChange={e => set('walkInPersonVisited', e.target.value)} />
            </div>
          )}

          {/* Reason for Visit — dropdown for office/yard, free text for cargo/legacy */}
          <div>
            <label style={LABEL}>
              Reason for Visit
              {(isOffice || isYard) && <span style={{ color: 'var(--brand-color)', marginLeft: 3 }}>*</span>}
              {!isOffice && !isYard && <span style={{ fontWeight: 400, color: '#A8A29E', fontSize: 10, marginLeft: 6 }}>(optional)</span>}
            </label>
            {(isOffice || isYard) ? (
              <select
                className="wizard-field"
                style={{ ...FIELD, width: '100%', background: '#fff', appearance: 'auto' }}
                value={state.walkInReason}
                onChange={e => set('walkInReason', e.target.value)}
              >
                <option value="">Select reason...</option>
                {reasonOptions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            ) : (
              <input type="text" placeholder="e.g. Delivery, meeting, container pickup…" className="wizard-field" style={FIELD} value={state.walkInReason} onChange={e => set('walkInReason', e.target.value)} />
            )}
          </div>

          {/* Yard visit licence scan notice */}
          {isYard && (
            <div style={{ background: 'rgba(var(--brand-rgb),0.07)', border: '1px solid rgba(var(--brand-rgb),0.22)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <Icon name={ICONS.shield} size={16} style={{ color: 'var(--brand-color)', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: '#78716C', lineHeight: 1.5 }}>
                Yard access requires <strong style={{ color: '#1C1917' }}>ID verification</strong>. You will be asked to scan your driver's licence before entry.
              </p>
            </div>
          )}

          <button
            className="btn-primary"
            style={{ width: '100%', padding: '18px 24px', fontSize: 16, fontWeight: 700, borderRadius: 14, justifyContent: 'center', opacity: canProceed(state.walkInName, state.walkInReason, isOffice || isYard) ? 1 : 0.4, cursor: canProceed(state.walkInName, state.walkInReason, isOffice || isYard) ? 'pointer' : 'not-allowed' }}
            disabled={!canProceed(state.walkInName, state.walkInReason, isOffice || isYard)}
            onClick={handleSubmit}
          >
            <Icon name={ICONS.check} size={20} />
            {isYard ? 'Continue to ID Scan' : 'Register My Visit'}
          </button>
        </div>
      </div>
    </div>
  )
}

function canProceed(name: string, reason: string, requireReason: boolean): boolean {
  if (!name.trim()) return false
  if (requireReason && !reason.trim()) return false
  return true
}
