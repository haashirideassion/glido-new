import { useState } from 'react'
import { useWizard } from '@/contexts/WizardContext'
import { Icon, ICONS } from '@/lib/Icon'

const LOAD_OPTIONS = [
  { value: 'fcl' as const, icon: ICONS.container, label: 'FCL', sub: 'Full Container Load',       desc: 'Container number required · No HBL needed' },
  { value: 'lcl' as const, icon: ICONS.cargo,     label: 'LCL', sub: 'Less than Container Load', desc: 'Shared container · HBL + container number · ICS auto-checked' },
]

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

export function Step3HoldConfirm() {
  const { state, dispatch } = useWizard()
  const [applyAll, setApplyAll] = useState(false)

  const multi = state.slotCount > 1

  const setLoad = (slotIndex: number, v: 'fcl' | 'lcl') =>
    dispatch({ type: 'SET_SLOT_CONFIG', slotIndex, field: 'loadType', value: v })

  const setLoadAll = (v: 'fcl' | 'lcl') => {
    for (const cfg of state.slotConfigs) {
      dispatch({ type: 'SET_SLOT_CONFIG', slotIndex: cfg.index, field: 'loadType', value: v })
    }
  }

  // The single value shown when applyAll is on (mirrors slot 0)
  const unifiedLoad = state.slotConfigs[0]?.loadType ?? null

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: applyAll ? 10 : (multi ? 24 : 10), marginBottom: 24 }}>
        {applyAll ? (
          // Single selector — applies to all slots
          LOAD_OPTIONS.map(opt => {
            const sel = unifiedLoad === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                className={`wizard-option-card${sel ? ' selected' : ''}`}
                onClick={() => setLoadAll(opt.value)}
              >
                <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1.5px solid ${sel ? 'var(--brand-color)' : '#e5e7eb'}`, background: sel ? 'var(--brand-color)' : '#f9fafb', color: sel ? '#fff' : '#9ca3af', transition: 'all 0.15s ease' }}>
                  <Icon name={opt.icon} size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 3 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{opt.label}</p>
                    <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 400 }}>{opt.sub}</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.4 }}>{opt.desc}</p>
                </div>
                <div style={{ width: 20, height: 20, borderRadius: 9999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${sel ? 'var(--brand-color)' : '#e5e7eb'}`, background: sel ? 'var(--brand-color)' : 'transparent', transition: 'all 0.15s ease' }}>
                  {sel && <span style={{ width: 7, height: 7, borderRadius: 9999, background: '#fff', display: 'block' }} />}
                </div>
              </button>
            )
          })
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
                {LOAD_OPTIONS.map(opt => {
                  const sel = cfg.loadType === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={`wizard-option-card${sel ? ' selected' : ''}`}
                      onClick={() => setLoad(cfg.index, opt.value)}
                    >
                      <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1.5px solid ${sel ? 'var(--brand-color)' : '#e5e7eb'}`, background: sel ? 'var(--brand-color)' : '#f9fafb', color: sel ? '#fff' : '#9ca3af', transition: 'all 0.15s ease' }}>
                        <Icon name={opt.icon} size={20} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 3 }}>
                          <p style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{opt.label}</p>
                          <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 400 }}>{opt.sub}</span>
                        </div>
                        <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.4 }}>{opt.desc}</p>
                      </div>
                      <div style={{ width: 20, height: 20, borderRadius: 9999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${sel ? 'var(--brand-color)' : '#e5e7eb'}`, background: sel ? 'var(--brand-color)' : 'transparent', transition: 'all 0.15s ease' }}>
                        {sel && <span style={{ width: 7, height: 7, borderRadius: 9999, background: '#fff', display: 'block' }} />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
