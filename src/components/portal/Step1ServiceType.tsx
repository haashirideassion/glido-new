import { useState, useRef, useEffect } from 'react'
import { useWizard } from '@/contexts/WizardContext'
import { useAuth } from '@/contexts/AuthContext'

// Simple email format check
function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

export function Step1ServiceType() {
  const { state, dispatch } = useWizard()
  const { user } = useAuth()
  const loggedIn = !!user

  const set = (f: 'guestName' | 'guestEmail' | 'guestPhone', v: string) =>
    dispatch({ type: 'SET', field: f, value: v })

  const [editing, setEditing] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-populate wizard state from logged-in user on mount
  useEffect(() => {
    if (!loggedIn || !user) return
    const name = user.firstName?.trim()
      ? user.firstName.trim()
      : user.email
    dispatch({ type: 'SET', field: 'guestName',  value: name })
    dispatch({ type: 'SET', field: 'guestEmail', value: user.email })
  }, [loggedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  const commitEdit = (raw: string) => {
    const n = parseInt(raw, 10)
    if (!isNaN(n)) {
      dispatch({ type: 'SET', field: 'slotCount', value: Math.min(10, Math.max(1, n)) })
    }
    setEditing(false)
  }

  const emailError = emailTouched && !loggedIn && !isValidEmail(state.guestEmail)

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 6 }}>Get started</h2>
        <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
          {loggedIn
            ? `Welcome back, ${user!.firstName?.trim() || user!.email}. How many slots do you need today?`
            : 'Tell us who\'s visiting and how many slots you need today.'}
        </p>
      </div>

      {/* Slot counter — unchanged */}
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
                ref={inputRef}
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

      {/* Guest info — hidden when logged in, shown for guests */}
      {!loggedIn && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block' }}>
              Your Name <span style={{ color: '#FC6514' }}>*</span>
            </label>
            <input type="text" className="wizard-field" value={state.guestName} onChange={e => set('guestName', e.target.value)} placeholder="e.g. Sarah Nguyen" />
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 5 }}>Required — min. 2 characters</p>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block' }}>
              Email Address <span style={{ color: '#FC6514' }}>*</span>
            </label>
            <input
              type="email"
              className="wizard-field"
              value={state.guestEmail}
              onChange={e => set('guestEmail', e.target.value)}
              onBlur={() => setEmailTouched(true)}
              placeholder="you@example.com"
              style={emailError ? { borderColor: '#EF4444', boxShadow: '0 0 0 2px rgba(239,68,68,0.15)' } : {}}
            />
            {emailError
              ? <p style={{ fontSize: 11, color: '#EF4444', marginTop: 5 }}>Please enter a valid email address</p>
              : <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 5 }}>Required — for booking confirmation</p>
            }
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block' }}>
              Phone Number <span style={{ fontWeight: 400, marginLeft: 6, color: '#9ca3af', fontSize: 11 }}>(optional)</span>
            </label>
            <input type="tel" className="wizard-field" value={state.guestPhone} onChange={e => set('guestPhone', e.target.value)} placeholder="+61 4XX XXX XXX" />
          </div>
        </div>
      )}

      {/* Logged-in confirmation badge */}
      {loggedIn && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.22)', borderRadius: 10 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="8" cy="8" r="7.5" stroke="#22C55E"/>
            <path d="M4.5 8L7 10.5L11.5 5.5" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#15803D', margin: 0 }}>{user!.firstName?.trim() || user!.email}</p>
            <p style={{ fontSize: 11, color: '#16A34A', margin: 0 }}>{user!.email}</p>
          </div>
        </div>
      )}
    </div>
  )
}
