import { useState } from 'react'
import { useWizard } from '@/contexts/WizardContext'
import { Icon, ICONS } from '@/lib/Icon'

const LOAD_OPTIONS = [
  {
    value: 'fcl' as const,
    icon: ICONS.container,
    label: 'FCL',
    sub: 'Full Container Load',
    bullets: ['Container number required', 'No HBL needed'],
  },
  {
    value: 'lcl' as const,
    icon: ICONS.cargo,
    label: 'LCL',
    sub: 'Less than Container Load',
    bullets: ['HBL + container number', 'ICS auto-checked'],
  },
]

export function Step3HoldConfirm() {
  const { state, dispatch } = useWizard()
  const [applyAll, setApplyAll] = useState(false)

  const multi = state.slotCount > 1

  // Start on the first slot that hasn't been filled yet
  const firstIncomplete = state.slotConfigs.findIndex(c => !c.loadType)
  const [activeSlot, setActiveSlot] = useState(firstIncomplete === -1 ? 0 : firstIncomplete)

  const setLoad = (slotIndex: number, v: 'fcl' | 'lcl') =>
    dispatch({ type: 'SET_SLOT_CONFIG', slotIndex, field: 'loadType', value: v })

  const setLoadAll = (v: 'fcl' | 'lcl') => {
    for (const cfg of state.slotConfigs) {
      dispatch({ type: 'SET_SLOT_CONFIG', slotIndex: cfg.index, field: 'loadType', value: v })
    }
  }

  const handleSelect = (slotIndex: number, v: 'fcl' | 'lcl') => {
    if (applyAll) {
      setLoadAll(v)
    } else {
      setLoad(slotIndex, v)
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
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: '-0.03em', marginBottom: 6 }}>Cargo type</h2>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
            {multi
              ? 'Select FCL or LCL for each slot.'
              : 'Select whether your shipment is FCL or LCL — this determines which details we ask for next.'}
          </p>
        </div>
        {multi && (
          <ApplyAllToggle
            on={applyAll}
            onToggle={() => setApplyAll(v => !v)}
            slotCount={state.slotCount}
            field="load type"
          />
        )}
      </div>

      {/* Tab bar — only when multi and not applyAll */}
      {multi && !applyAll && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {state.slotConfigs.map((cfg, i) => {
            const done = !!cfg.loadType
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

      {/* Cards — single slot view */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {LOAD_OPTIONS.map(opt => {
          const currentVal = applyAll ? state.slotConfigs[0]?.loadType : activeCfg?.loadType
          const sel = currentVal === opt.value
          return (
            <LoadCard
              key={opt.value}
              selected={sel}
              onClick={() => handleSelect(activeCfg?.index ?? 1, opt.value)}
              icon={<Icon name={opt.icon} size={22} />}
              label={opt.label}
              sub={opt.sub}
              bullets={opt.bullets}
            />
          )
        })}
      </div>
    </div>
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

function LoadCard({ selected, onClick, icon, label, sub, bullets }: {
  selected: boolean; onClick: () => void; icon: React.ReactNode
  label: string; sub: string; bullets: string[]
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
      <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 2, lineHeight: 1.2 }}>{label}</p>
      <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12, lineHeight: 1.3 }}>{sub}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {bullets.map(b => (
          <span key={b} style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 6,
            background: selected ? 'rgba(252,101,20,0.10)' : '#F3F4F6',
            color: selected ? 'var(--brand-color, #FC6514)' : '#6B7280', fontWeight: 500,
          }}>
            {b}
          </span>
        ))}
      </div>
    </button>
  )
}
