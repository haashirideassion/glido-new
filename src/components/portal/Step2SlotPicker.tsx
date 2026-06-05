import { useState } from 'react'
import { useWizard } from '@/contexts/WizardContext'

type ServiceType = 'pickup' | 'dropoff'

// ── Small pill toggle — same visual as Working Hours ─────────────────────────
function ApplyAllToggle({
  on, onToggle, slotCount, field,
}: {
  on: boolean; onToggle: () => void; slotCount: number; field: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '5px 12px', borderRadius: 9999,
          background: on ? 'rgba(252,101,20,0.10)' : 'rgba(0,0,0,0.06)',
          border: `1.5px solid ${on ? 'rgba(252,101,20,0.30)' : 'rgba(0,0,0,0.12)'}`,
          cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        {/* Track */}
        <span style={{
          position: 'relative', width: 28, height: 16, borderRadius: 9999,
          background: on ? 'var(--brand-color, #FC6514)' : '#D1D5DB',
          display: 'inline-block', flexShrink: 0, transition: 'background 0.15s',
        }}>
          <span style={{
            position: 'absolute', top: 2,
            left: on ? 14 : 2,
            width: 12, height: 12, borderRadius: 9999,
            background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
            transition: 'left 0.15s',
          }} />
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: on ? 'var(--brand-color, #FC6514)' : '#6B7280', whiteSpace: 'nowrap' }}>
          Apply to all bookings
        </span>
      </button>
      <span style={{ fontSize: 11, color: '#A8A29E' }}>
        {on
          ? `${field} selected for all ${slotCount} bookings`
          : `Use the same ${field} for all ${slotCount} bookings`}
      </span>
    </div>
  )
}

export function Step2SlotPicker() {
  const { state, dispatch } = useWizard()
  const [applyAll, setApplyAll] = useState(false)

  const multi = state.slotCount > 1

  const setService = (slotIndex: number, v: ServiceType) =>
    dispatch({ type: 'SET_SLOT_CONFIG', slotIndex, field: 'serviceType', value: v })

  const setServiceAll = (v: ServiceType) => {
    for (const cfg of state.slotConfigs) {
      dispatch({ type: 'SET_SLOT_CONFIG', slotIndex: cfg.index, field: 'serviceType', value: v })
    }
  }

  // The single value shown when applyAll is on (mirrors slot 0)
  const unifiedService = state.slotConfigs[0]?.serviceType ?? null

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: '-0.03em', marginBottom: 6 }}>Service type</h2>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
            {multi
              ? 'Select the service type for each slot.'
              : 'Are you collecting cargo from, or delivering cargo to the CFS?'}
          </p>
        </div>
        {multi && (
          <ApplyAllToggle
            on={applyAll}
            onToggle={() => setApplyAll(v => !v)}
            slotCount={state.slotCount}
            field="service type"
          />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: applyAll ? 10 : (multi ? 24 : 10), marginBottom: 28 }}>
        {applyAll ? (
          // Single selector — applies to all slots
          <>
            <OptionCard
              selected={unifiedService === 'pickup'}
              onClick={() => setServiceAll('pickup')}
              icon={<PickupArrow selected={unifiedService === 'pickup'} />}
              title="Pick Up"
              desc="Collect cargo from the CFS · ICS checked automatically"
            />
            <OptionCard
              selected={unifiedService === 'dropoff'}
              onClick={() => setServiceAll('dropoff')}
              icon={<DropoffArrow selected={unifiedService === 'dropoff'} />}
              title="Drop Off"
              desc="Deliver cargo to the CFS · Container or HBL required"
            />
          </>
        ) : (
          // One selector per slot
          state.slotConfigs.map(cfg => (
            <div key={cfg.index}>
              {multi && (
                <p style={{ fontSize: 12, fontWeight: 700, color: '#78716C', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Slot {cfg.index}
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <OptionCard
                  selected={cfg.serviceType === 'pickup'}
                  onClick={() => setService(cfg.index, 'pickup')}
                  icon={<PickupArrow selected={cfg.serviceType === 'pickup'} />}
                  title="Pick Up"
                  desc="Collect cargo from the CFS · ICS checked automatically"
                />
                <OptionCard
                  selected={cfg.serviceType === 'dropoff'}
                  onClick={() => setService(cfg.index, 'dropoff')}
                  icon={<DropoffArrow selected={cfg.serviceType === 'dropoff'} />}
                  title="Drop Off"
                  desc="Deliver cargo to the CFS · Container or HBL required"
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function OptionCard({ selected, onClick, icon, title, desc }: {
  selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string
}) {
  return (
    <button
      type="button"
      className={`wizard-option-card${selected ? ' selected' : ''}`}
      onClick={onClick}
    >
      <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1.5px solid ${selected ? 'var(--brand-color)' : '#e5e7eb'}`, background: selected ? 'var(--brand-color)' : '#f9fafb', color: selected ? '#fff' : '#9ca3af', transition: 'all 0.15s ease' }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 3 }}>{title}</p>
        <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.4 }}>{desc}</p>
      </div>
      <div style={{ width: 20, height: 20, borderRadius: 9999, border: `1.5px solid ${selected ? 'var(--brand-color)' : '#e5e7eb'}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: selected ? 'var(--brand-color)' : 'transparent', transition: 'all 0.15s ease' }}>
        {selected && <div style={{ width: 7, height: 7, borderRadius: 9999, background: '#fff' }} />}
      </div>
    </button>
  )
}

function PickupArrow({ selected }: { selected: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" style={{ stroke: selected ? '#fff' : '#9ca3af' }}>
      <path d="M12 4v12M6 12l6 6 6-6"/><line x1="4" y1="20" x2="20" y2="20"/>
    </svg>
  )
}

function DropoffArrow({ selected }: { selected: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" style={{ stroke: selected ? '#fff' : '#9ca3af' }}>
      <path d="M12 20V8M6 12l6-6 6 6"/><line x1="4" y1="4" x2="20" y2="4"/>
    </svg>
  )
}
