import { useState } from 'react'
import { useKiosk } from '@/contexts/KioskContext'
import { Icon, ICONS } from '@/lib/Icon'
import { getBookingByRego } from '@/lib/db/bookings'

type Tab = 'ref' | 'rego'

export function LookupScreen() {
  const { state, dispatch, goTo, performLookup } = useKiosk()

  const [tab,         setTab]         = useState<Tab>('ref')
  const [regoInput,   setRegoInput]   = useState('')
  const [regoLoading, setRegoLoading] = useState(false)
  const [regoError,   setRegoError]   = useState(false)

  if (state.currentScreen !== 'lookup') return null

  const borderColor     = state.lookupError ? '#EF4444' : '#C2C2C2'
  const bg              = state.lookupError ? '#FEF2F2' : '#F7F6F5'
  const regoBorderColor = regoError ? '#EF4444' : '#C2C2C2'
  const regoBg          = regoError ? '#FEF2F2' : '#F7F6F5'

  const handleRegoLookup = async () => {
    const rego = regoInput.trim().toUpperCase()
    if (!rego) return
    setRegoLoading(true)
    setRegoError(false)
    dispatch({ type: 'SET_LOOKUP', result: null, error: false, loading: true })
    try {
      const booking = await getBookingByRego(rego)
      if (!booking) {
        dispatch({ type: 'SET_LOOKUP', result: null, error: true, loading: false })
        setRegoError(true)
        return
      }
      dispatch({
        type: 'SET_LOOKUP',
        loading: false, error: false,
        result: {
          found:      true,
          bookingId:  booking.id,
          ref:        booking.referenceNumber,
          name:       booking.driverName,
          driverName: booking.driverName,
          slot:       `${booking.slotDate} ${booking.slotStartTime} – ${booking.slotEndTime}`,
          service:    booking.serviceType === 'pickup' ? 'Pick Up' : 'Drop Off',
          loadType:   booking.loadType.toUpperCase(),
          status:     booking.status,
        },
      })
      dispatch({ type: 'GO_TO', screen: 'confirm' })
    } catch {
      dispatch({ type: 'SET_LOOKUP', result: null, error: true, loading: false })
      setRegoError(true)
    } finally {
      setRegoLoading(false)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 448, textAlign: 'center' }}>

        {/* Header */}
        <div style={{ width: 64, height: 64, background: 'rgba(var(--brand-rgb),0.09)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Icon name={ICONS.search} size={36} style={{ color: 'var(--brand-color)' }} />
        </div>
        <h2 style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: 8, color: '#1C1917' }}>Find Your Booking</h2>
        <p style={{ color: '#78716C', marginBottom: 28 }}>Select how you'd like to look up your booking</p>

        {/* Tab switcher — same pattern as ScanScreen */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 28, background: 'rgba(0,0,0,0.04)', borderRadius: 14, padding: 4 }}>
          {(['ref', 'rego'] as Tab[]).map(t => {
            const active = tab === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  flex: 1, height: 50, borderRadius: 11,
                  fontWeight: 700, fontSize: 15, cursor: 'pointer',
                  border: 'none',
                  background: active ? 'var(--brand-color)' : 'transparent',
                  color: active ? '#fff' : '#78716C',
                  boxShadow: active ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.15s',
                  fontFamily: 'inherit',
                }}
              >
                {t === 'ref' ? 'Booking Reference' : 'Vehicle Registration'}
              </button>
            )
          })}
        </div>

        {/* ── Booking Reference tab ── */}
        {tab === 'ref' && (
          <>
            <input
              type="text"
              placeholder="GLD-2026-XXXXX"
              className="kiosk-input"
              style={{ width: '100%', borderRadius: 16, marginBottom: 12, border: `2px solid ${borderColor}`, background: bg, color: '#1C1917', padding: '14px 24px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
              value={state.referenceInput}
              onChange={e => dispatch({ type: 'SET_REF_INPUT', value: e.target.value.toUpperCase() })}
              onKeyDown={e => e.key === 'Enter' && performLookup()}
              onFocus={e => { e.target.style.borderColor = 'var(--brand-color)'; e.target.style.boxShadow = '0 0 0 3px rgba(var(--brand-rgb),0.12)' }}
              onBlur={e  => { e.target.style.borderColor = borderColor; e.target.style.boxShadow = 'none' }}
            />
            {state.lookupError && (
              <p style={{ fontSize: 14, color: '#EF4444', marginBottom: 16 }}>Reference not found. Please check and try again.</p>
            )}
            {state.lookupLoading && (
              <p style={{ fontSize: 14, color: 'var(--brand-color)', marginBottom: 16 }}>Looking up booking…</p>
            )}
            <button
              className="kiosk-btn kiosk-btn-primary"
              style={{ width: '100%', borderRadius: 16, opacity: state.referenceInput.trim() ? 1 : 0.4, cursor: state.referenceInput.trim() ? 'pointer' : 'not-allowed' }}
              onClick={performLookup}
              disabled={!state.referenceInput.trim() || state.lookupLoading}
            >
              Find Booking
            </button>
          </>
        )}

        {/* ── Vehicle Registration tab ── */}
        {tab === 'rego' && (
          <>
            <input
              type="text"
              placeholder="e.g. ABC123"
              className="kiosk-input"
              style={{ width: '100%', borderRadius: 16, marginBottom: 12, border: `2px solid ${regoBorderColor}`, background: regoBg, color: '#1C1917', padding: '14px 24px', textTransform: 'uppercase', letterSpacing: '0.12em' }}
              value={regoInput}
              onChange={e => { setRegoInput(e.target.value.toUpperCase()); setRegoError(false) }}
              onKeyDown={e => e.key === 'Enter' && handleRegoLookup()}
              onFocus={e => { e.target.style.borderColor = 'var(--brand-color)'; e.target.style.boxShadow = '0 0 0 3px rgba(var(--brand-rgb),0.12)' }}
              onBlur={e  => { e.target.style.borderColor = regoBorderColor; e.target.style.boxShadow = 'none' }}
            />
            {regoError && (
              <p style={{ fontSize: 14, color: '#EF4444', marginBottom: 16 }}>No booking found for that registration. Please try again.</p>
            )}
            {regoLoading && (
              <p style={{ fontSize: 14, color: 'var(--brand-color)', marginBottom: 16 }}>Looking up booking…</p>
            )}
            <button
              className="kiosk-btn kiosk-btn-primary"
              style={{ width: '100%', borderRadius: 16, opacity: regoInput.trim() ? 1 : 0.4, cursor: regoInput.trim() ? 'pointer' : 'not-allowed' }}
              onClick={handleRegoLookup}
              disabled={!regoInput.trim() || regoLoading}
            >
              Find by Rego
            </button>
          </>
        )}

        {/* QR scanner — visible on both tabs */}
        <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          <p style={{ fontSize: 14, color: '#A8A29E', marginBottom: 12 }}>Or scan your QR code</p>
          <button
            onClick={() => goTo('scan')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--brand-color)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <Icon name={ICONS.qrCode} size={18} />
            Use QR Scanner
          </button>
        </div>

      </div>
    </div>
  )
}
