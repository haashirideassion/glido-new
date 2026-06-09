import { useState } from 'react'
import { useWizard } from '@/contexts/WizardContext'

type ServiceType = 'pickup' | 'dropoff'

export function Step2SlotPicker() {
  const { state, dispatch } = useWizard()
  const [applyAll, setApplyAll] = useState(false)

  const multi = state.slotCount > 1

  // Start on the first slot that hasn't been filled yet
  const firstIncomplete = state.slotConfigs.findIndex(c => !c.serviceType)
  const [activeSlot, setActiveSlot] = useState(firstIncomplete === -1 ? 0 : firstIncomplete)

  const setService = (slotIndex: number, v: ServiceType) => {
    dispatch({ type: 'SET_SLOT_CONFIG', slotIndex, field: 'serviceType', value: v })
  }

  const setServiceAll = (v: ServiceType) => {
    for (const cfg of state.slotConfigs) {
      dispatch({ type: 'SET_SLOT_CONFIG', slotIndex: cfg.index, field: 'serviceType', value: v })
    }
  }

  const handleSelect = (slotIndex: number, v: ServiceType) => {
    if (applyAll) {
      setServiceAll(v)
    } else {
      setService(slotIndex, v)
      // Auto-advance to next incomplete slot
      if (multi && activeSlot < state.slotConfigs.length - 1) {
        setActiveSlot(activeSlot + 1)
      }
    }
  }

  const activeCfg = state.slotConfigs[activeSlot]

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

      {/* Tab bar — only when multi and not applyAll */}
      {multi && !applyAll && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {state.slotConfigs.map((cfg, i) => {
            const done = !!cfg.serviceType
            const active = activeSlot === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActiveSlot(i)}
                style={{
                  padding: '8px 20px', borderRadius: 999, border: 'none',
                  background: active ? 'var(--brand-color, #FC6514)' : '#F3F4F6',
                  color: active ? '#fff' : '#6B7280',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontFamily: 'inherit', transition: 'all 0.15s',
                }}
              >
                {done && (
                  <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                    <path d="M1 5L4.5 8.5L11 1" stroke={active ? '#fff' : '#22C55E'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                Slot {i + 1}
              </button>
            )
          })}
        </div>
      )}

      {/* Cards — single slot view when multi, or all-at-once when applyAll */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        <OptionCard
          selected={(applyAll ? state.slotConfigs[0]?.serviceType : activeCfg?.serviceType) === 'pickup'}
          onClick={() => handleSelect(activeCfg?.index ?? 1, 'pickup')}
          icon={<PickupArrow selected={(applyAll ? state.slotConfigs[0]?.serviceType : activeCfg?.serviceType) === 'pickup'} />}
          title="Pick Up"
          desc="Collect cargo from the CFS"
          sub="ICS auto-checked"
        />
        <OptionCard
          selected={(applyAll ? state.slotConfigs[0]?.serviceType : activeCfg?.serviceType) === 'dropoff'}
          onClick={() => handleSelect(activeCfg?.index ?? 1, 'dropoff')}
          icon={<DropoffArrow selected={(applyAll ? state.slotConfigs[0]?.serviceType : activeCfg?.serviceType) === 'dropoff'} />}
          title="Drop Off"
          desc="Deliver cargo to the CFS"
          sub="Container or HBL required"
        />
      </div>
    </div>
  )
}

function OptionCard({ selected, onClick, icon, title, desc, sub }: {
  selected: boolean; onClick: () => void; icon: React.ReactNode
  title: string; desc: string; sub: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        padding: '20px 18px 18px', borderRadius: 14,
        border: selected ? '2px solid var(--brand-color, #FC6514)' : '1.5px solid rgba(0,0,0,0.08)',
        background: selected ? 'rgba(252,101,20,0.04)' : '#fff',
        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease',
        width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none',
      }}
    >
      {selected && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          width: 20, height: 20, borderRadius: 9999,
          background: 'var(--brand-color, #FC6514)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
            <path d="M1 4.5L4 7.5L10 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 14, flexShrink: 0,
        background: selected ? 'var(--brand-color, #FC6514)' : '#F3F4F6',
        color: selected ? '#fff' : '#6B7280', transition: 'all 0.15s ease',
      }}>
        {icon}
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4, lineHeight: 1.2 }}>{title}</p>
      <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.4, marginBottom: 10 }}>{desc}</p>
      <span style={{
        fontSize: 11, padding: '3px 8px', borderRadius: 6,
        background: selected ? 'rgba(252,101,20,0.10)' : '#F3F4F6',
        color: selected ? 'var(--brand-color, #FC6514)' : '#6B7280', fontWeight: 500,
      }}>
        {sub}
      </span>
    </button>
  )
}

function ApplyAllToggle({ on, onToggle, slotCount, field }: {
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
          cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
        }}
      >
        <span style={{
          position: 'relative', width: 28, height: 16, borderRadius: 9999,
          background: on ? 'var(--brand-color, #FC6514)' : '#D1D5DB',
          display: 'inline-block', flexShrink: 0, transition: 'background 0.15s',
        }}>
          <span style={{
            position: 'absolute', top: 2, left: on ? 14 : 2,
            width: 12, height: 12, borderRadius: 9999,
            background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.18)', transition: 'left 0.15s',
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

function PickupArrow({ selected }: { selected: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" style={{ stroke: selected ? '#fff' : '#6B7280' }}>
      <path d="M12 4v12M6 12l6 6 6-6"/><line x1="4" y1="20" x2="20" y2="20"/>
    </svg>
  )
}

function DropoffArrow({ selected }: { selected: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" style={{ stroke: selected ? '#fff' : '#6B7280' }}>
      <path d="M12 20V8M6 12l6-6 6 6"/><line x1="4" y1="4" x2="20" y2="4"/>
    </svg>
  )
}
