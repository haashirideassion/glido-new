import { useState } from 'react'
import { useWizard } from '@/contexts/WizardContext'

export function ReceptionStep1ServiceType() {
  const { state, dispatch } = useWizard()
  const [editing, setEditing] = useState(false)

  const set = (f: 'guestName' | 'guestPhone', v: string) =>
    dispatch({ type: 'SET', field: f, value: v })

  const commitEdit = (raw: string) => {
    const n = parseInt(raw, 10)
    if (!isNaN(n)) {
      dispatch({ type: 'SET', field: 'slotCount', value: Math.min(10, Math.max(1, n)) })
    }
    setEditing(false)
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 6 }}>New Booking</h2>
        <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
          Creating booking on behalf of a visitor or driver.
        </p>
      </div>

      {/* Slot counter */}
      <div style={{ border: '1.5px solid #e5e7eb', borderRadius: 14, padding: '20px 24px', marginBottom: 28, background: '#fff' }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 14, display: 'block', letterSpacing: '-0.01em' }}>Number of slots</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 16 }}>
          <button
            type="button"
            className="wizard-stepper-btn"
            onClick={() => dispatch({ type: 'SET', field: 'slotCount', value: Math.max(1, state.slotCount - 1) })}
            disabled={state.slotCount <= 1}
          >−</button>

          <div style={{ minWidth: 80, textAlign: 'center', padding: '0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
            {editing ? (
              <input
                type="number"
                min={1}
                max={10}
                defaultValue={state.slotCount}
                className="slot-num"
                autoFocus
                onFocus={e => e.target.select()}
                onBlur={e => commitEdit(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit((e.target as HTMLInputElement).value)
                  if (e.key === 'Escape') setEditing(false)
                }}
                style={{
                  fontSize: 36, fontWeight: 800, color: '#FC6514',
                  fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em',
                  lineHeight: 1, width: 64, height: 44, textAlign: 'center',
                  border: '2px solid rgba(252,101,20,0.50)',
                  borderRadius: 8, outline: 'none', background: 'rgba(252,101,20,0.05)',
                  boxShadow: '0 0 0 3px rgba(252,101,20,0.12)',
                  padding: '2px 4px', fontFamily: 'inherit', display: 'block',
                }}
              />
            ) : (
              <span
                className="slot-num"
                title="Click to type a number"
                onClick={() => setEditing(true)}
                style={{ fontSize: 36, fontWeight: 800, color: '#111827', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em', lineHeight: 1, display: 'block', cursor: 'text', height: 44 }}
              >
                {state.slotCount}
              </span>
            )}
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af' }}>slots</span>
          </div>

          <button
            type="button"
            className="wizard-stepper-btn"
            onClick={() => dispatch({ type: 'SET', field: 'slotCount', value: Math.min(10, state.slotCount + 1) })}
            disabled={state.slotCount >= 10}
          >+</button>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {[1, 2, 3, 5, 10].map(n => (
            <button
              key={n}
              type="button"
              className={`wizard-chip slot-num${state.slotCount === n ? ' active' : ''}`}
              onClick={() => dispatch({ type: 'SET', field: 'slotCount', value: n })}
            >{n}</button>
          ))}
          <span className="slot-num" style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>max 10</span>
        </div>
      </div>

      {/* Booking For — always visible, staff enters visitor/driver details */}
      <div style={{ border: '1.5px solid #e5e7eb', borderRadius: 14, padding: '20px 24px', background: '#fff' }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 16, display: 'block', letterSpacing: '-0.01em' }}>
          Visitor Name
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block' }}>
              Visitor / Driver Name <span style={{ color: '#FC6514' }}>*</span>
            </label>
            <input
              type="text"
              className="wizard-field"
              value={state.guestName}
              onChange={e => set('guestName', e.target.value)}
              placeholder="e.g. John Smith"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block' }}>
              Phone Number <span style={{ fontWeight: 400, marginLeft: 6, color: '#9ca3af', fontSize: 11 }}>(optional)</span>
            </label>
            <input
              type="tel"
              className="wizard-field"
              value={state.guestPhone}
              onChange={e => set('guestPhone', e.target.value)}
              placeholder="+61 4XX XXX XXX"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
