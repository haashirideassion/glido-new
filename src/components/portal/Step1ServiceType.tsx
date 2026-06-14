import { useState, useRef, useEffect } from 'react'
import { useWizard } from '@/contexts/WizardContext'
import { useAuth } from '@/contexts/AuthContext'
import { Icon, ICONS } from '@/lib/Icon'
import { supabase } from '@/lib/supabase'
import slotImg from '@/assets/slot.png'
import { validators, sanitize } from '@/lib/validation'

export function Step1ServiceType() {
  const { state, dispatch } = useWizard()
  const { user } = useAuth()
  const loggedIn = !!user

  const set = (f: 'guestName' | 'guestEmail' | 'guestPhone' | 'companyName', v: string) =>
    dispatch({ type: 'SET', field: f, value: v })

  const [editing, setEditing] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const [guestNameErr, setGuestNameErr] = useState('')
  const [guestPhoneErr, setGuestPhoneErr] = useState('')
  const [modPhoneErr, setModPhoneErr] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Logged-in user display name
  const displayName = user?.firstName?.trim() || user?.email || 'there'

  // Modify-panel state
  const [expanded, setExpanded] = useState(false)
  const [modName,    setModName]    = useState(user?.firstName?.trim() ?? '')
  const [modEmail,   setModEmail]   = useState(user?.email ?? '')
  const [modPhone,   setModPhone]   = useState('')
  const [modCompany, setModCompany] = useState(state.companyName ?? '')
  const [saving,     setSaving]     = useState(false)

  const handleDone = async () => {
    setSaving(true)
    await supabase.auth.updateUser({
      data: { first_name: modName.trim(), phone: modPhone.trim() },
    })
    setSaving(false)
    setExpanded(false)
    // Update wizard state too
    dispatch({ type: 'SET', field: 'guestName',   value: modName.trim() || modEmail })
    dispatch({ type: 'SET', field: 'guestEmail',  value: modEmail })
    dispatch({ type: 'SET', field: 'companyName', value: modCompany.trim() })
  }

  // Auto-populate wizard state from logged-in user on mount
  useEffect(() => {
    if (!loggedIn || !user) return
    const name = user.firstName?.trim() ? user.firstName.trim() : user.email
    dispatch({ type: 'SET', field: 'guestName',  value: name })
    dispatch({ type: 'SET', field: 'guestEmail', value: user.email })
    setModName(user.firstName?.trim() ?? '')
    setModEmail(user.email ?? '')
  }, [loggedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  const commitEdit = (raw: string) => {
    const n = parseInt(raw, 10)
    if (!isNaN(n)) {
      dispatch({ type: 'SET', field: 'slotCount', value: Math.min(10, Math.max(1, n)) })
    }
    setEditing(false)
  }

  const emailError = emailTouched && !loggedIn && !!validators.email(state.guestEmail)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <img src={slotImg} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
        </div>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1C1917', letterSpacing: '-0.03em', lineHeight: 1.2, margin: 0 }}>Get started</h2>
          <p style={{ fontSize: 15, color: '#4F4F4F', lineHeight: 1.5, margin: '4px 0 0' }}>
            {loggedIn
              ? `Welcome back, ${displayName}. How many slots do you need today?`
              : "Tell us who's visiting and how many slots you need today."}
          </p>
        </div>
      </div>

      {/* Slot counter */}
      <div style={{ border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 16, padding: '28px 24px', marginBottom: 28, background: '#fff' }}>
        {/* Big counter display */}
        <div style={{ textAlign: 'center', paddingBottom: 24 }}>
          <p style={{ fontSize: 15, color: '#9CA3AF', marginBottom: 16, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>How many slots?</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET', field: 'slotCount', value: Math.max(1, state.slotCount - 1) })}
              disabled={state.slotCount <= 1}
              style={{ width: 48, height: 48, borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.10)', background: '#fff', fontSize: 24, cursor: state.slotCount <= 1 ? 'not-allowed' : 'pointer', opacity: state.slotCount <= 1 ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', transition: 'opacity 0.15s' }}
            >−</button>

            {editing ? (
              <input
                ref={inputRef}
                type="number" min={1} max={10} defaultValue={state.slotCount}
                autoFocus
                onFocus={e => e.target.select()}
                onBlur={e => commitEdit(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit((e.target as HTMLInputElement).value)
                  if (e.key === 'Escape') setEditing(false)
                }}
                style={{
                  fontSize: 64, fontWeight: 800, color: 'var(--brand-color)', lineHeight: 1,
                  width: 96, textAlign: 'center', border: '2px solid rgba(var(--brand-rgb),0.40)',
                  borderRadius: 10, outline: 'none', background: 'rgba(var(--brand-rgb),0.04)',
                  fontFamily: 'inherit', padding: '0 8px', boxSizing: 'border-box',
                }}
              />
            ) : (
              <span
                title="Click to type a number"
                onClick={() => setEditing(true)}
                style={{ fontSize: 64, fontWeight: 800, color: '#1C1917', lineHeight: 1, cursor: 'text', display: 'block', minWidth: 64, textAlign: 'center', fontFamily: 'inherit' }}
              >
                {state.slotCount}
              </span>
            )}

            <button
              type="button"
              onClick={() => dispatch({ type: 'SET', field: 'slotCount', value: Math.min(10, state.slotCount + 1) })}
              disabled={state.slotCount >= 10}
              style={{ width: 48, height: 48, borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.10)', background: '#fff', fontSize: 24, cursor: state.slotCount >= 10 ? 'not-allowed' : 'pointer', opacity: state.slotCount >= 10 ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', transition: 'opacity 0.15s' }}
            >+</button>
          </div>
          <p style={{ fontSize: 15, color: '#9CA3AF', marginTop: 8 }}>slot{state.slotCount !== 1 ? 's' : ''}</p>
        </div>

        {/* Quick-select pills */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          {[1, 2, 3, 5, 10].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => dispatch({ type: 'SET', field: 'slotCount', value: n })}
              style={{
                padding: '8px 20px', fontSize: 15, fontWeight: 600, borderRadius: 9999,
                border: state.slotCount === n ? '1.5px solid var(--brand-color, #FC6514)' : '1.5px solid rgba(0,0,0,0.10)',
                background: state.slotCount === n ? 'rgba(var(--brand-rgb),0.08)' : '#fff',
                color: state.slotCount === n ? 'var(--brand-color, #FC6514)' : '#6B7280',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >{n}</button>
          ))}
        </div>


      </div>

      {/* Guest info — hidden when logged in, shown for guests */}
      {!loggedIn && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block' }}>
              Your Name <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input type="text" className="wizard-field" value={state.guestName}
              onChange={e => { set('guestName', sanitize.nameChars(e.target.value)); setGuestNameErr('') }}
              onBlur={e => setGuestNameErr(validators.name(e.target.value))}
              placeholder="e.g. Sarah Nguyen" />
            {guestNameErr
              ? <p style={{ fontSize: 13, color: '#EF4444', marginTop: 5 }}>{guestNameErr}</p>
              : <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 5 }}>Required — min. 2 characters</p>
            }
          </div>

          <div>
            <label style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block' }}>
              Email Address <span style={{ color: '#EF4444' }}>*</span>
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
              ? <p style={{ fontSize: 13, color: '#EF4444', marginTop: 5 }}>Please enter a valid email address</p>
              : <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 5 }}>Required — for booking confirmation</p>
            }
          </div>

          <div>
            <label style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block' }}>
              Phone Number <span style={{ fontWeight: 400, marginLeft: 6, color: '#9ca3af', fontSize: 13 }}>(optional)</span>
            </label>
            <input type="tel" inputMode="numeric" maxLength={10} className="wizard-field"
              value={state.guestPhone}
              onChange={e => { set('guestPhone', sanitize.digitsOnly(e.target.value)); setGuestPhoneErr('') }}
              onBlur={e => setGuestPhoneErr(validators.phoneAU(e.target.value))}
              placeholder="04XX XXX XXX" />
            {guestPhoneErr && <p style={{ fontSize: 13, color: '#EF4444', marginTop: 5 }}>{guestPhoneErr}</p>}
          </div>

          <div>
            <label style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'block' }}>
              Company Name <span style={{ fontWeight: 400, marginLeft: 6, color: '#9ca3af', fontSize: 13 }}>(optional)</span>
            </label>
            <input type="text" className="wizard-field" value={state.companyName} onChange={e => set('companyName', e.target.value)} placeholder="Your company or organisation (optional)" />
          </div>
        </div>
      )}

      {/* Logged-in confirmation badge */}
      {loggedIn && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(22,163,74,0.08)', border: '1.5px solid rgba(22,163,74,0.2)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="7.5" stroke="#22C55E"/>
                <path d="M4.5 8L7 10.5L11.5 5.5" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#15803D', margin: 0 }}>{displayName}</p>
                <p style={{ fontSize: 14, color: '#16A34A', margin: 0 }}>{user!.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              style={{ fontSize: 15, fontWeight: 600, color: '#15803D', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', padding: 0 }}
            >
              {expanded ? (saving ? 'Saving…' : 'Done') : 'Modify →'}
            </button>
          </div>

          {expanded && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 15, fontWeight: 600, color: '#1C1917', display: 'block', marginBottom: 6 }}>
                  Your Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={modName}
                  onChange={e => setModName(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.12)', fontSize: 15, color: '#1C1917', background: '#fff', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
                />
                <p style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4, marginBottom: 0 }}>Required — min. 2 characters</p>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 15, fontWeight: 600, color: '#1C1917', display: 'block', marginBottom: 6 }}>
                  Email Address <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="email"
                  value={modEmail}
                  onChange={e => setModEmail(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.12)', fontSize: 15, color: '#1C1917', background: '#fff', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
                />
                <p style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4, marginBottom: 0 }}>Booking confirmations sent here</p>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 15, fontWeight: 600, color: '#1C1917', display: 'block', marginBottom: 6 }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={modPhone}
                  onChange={e => { setModPhone(sanitize.digitsOnly(e.target.value)); setModPhoneErr('') }}
                  onBlur={e => setModPhoneErr(validators.phoneAU(e.target.value))}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.12)', fontSize: 15, color: '#1C1917', background: '#fff', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
                />
                {modPhoneErr && <p style={{ fontSize: 14, color: '#EF4444', marginTop: 4 }}>{modPhoneErr}</p>}
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 15, fontWeight: 600, color: '#1C1917', display: 'block', marginBottom: 6 }}>
                  Company Name <span style={{ fontWeight: 400, fontSize: 14, color: '#9CA3AF' }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={modCompany}
                  onChange={e => setModCompany(e.target.value)}
                  placeholder="Your company or organisation (optional)"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.12)', fontSize: 15, color: '#1C1917', background: '#fff', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
              <button
                type="button"
                onClick={handleDone}
                disabled={saving}
                style={{ padding: '11px 24px', borderRadius: 12, border: 'none', background: saving ? '#D1D5DB' : 'var(--brand-color, #FC6514)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', marginTop: 8, fontFamily: 'inherit', transition: 'background 0.15s' }}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
