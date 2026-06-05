import { useKiosk } from '@/contexts/KioskContext'
import { Icon, ICONS } from '@/lib/Icon'

export function IDScanScreen() {
  const { state, dispatch, simulateScan, completeCheckIn } = useKiosk()
  if (state.currentScreen !== 'idscan') return null

  const ld = state.licenceData
  const match = ld?.nameMatchResult

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 448, textAlign: 'center', marginTop: 200 }}>
        <div style={{ width: 64, height: 64, background: 'rgba(252,101,20,0.09)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Icon name={ICONS.shield} size={36} style={{ color: '#FC6514' }} />
        </div>
        <h2 style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: 8, color: '#1C1917' }}>Identity Verification</h2>
        <p style={{ color: '#78716C', marginBottom: 32 }}>Scan your driver's licence to verify your identity</p>

        {!ld ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { title: 'Option 1 — Card Reader', icon: ICONS.shield, desc: 'Insert driver\'s licence face down', sub: 'Thales double-sided card reader' },
              { title: 'Option 2 — Digital Licence', icon: ICONS.qrCode, desc: 'Show NSW Digital Licence QR code', sub: 'NSW Service App or Digital Wallet' },
            ].map(opt => (
              <div key={opt.title} style={{ background: '#FFFFFF', border: '1.5px solid rgba(0,0,0,0.10)', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#A8A29E', marginBottom: 12 }}>{opt.title}</p>
                <div style={{ height: 112, background: '#F7F6F5', border: '1.5px dashed rgba(0,0,0,0.12)', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Icon name={opt.icon} size={36} style={{ color: '#C7C1BB' }} />
                  <p style={{ fontSize: 14, color: '#A8A29E', marginTop: 4 }}>{opt.desc}</p>
                </div>
                <p style={{ fontSize: 12, color: '#A8A29E' }}>{opt.sub}</p>
              </div>
            ))}
            <button className="kiosk-btn" style={{ width: '100%', borderRadius: 16, background: 'rgba(252,101,20,0.07)', border: '1px solid rgba(252,101,20,0.25)', color: '#FC6514', cursor: 'pointer' }} onClick={simulateScan}>
              Simulate ID Scan (Demo)
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Icon name={ICONS.check} size={18} style={{ color: '#FC6514' }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: '#FC6514' }}>Licence Scanned</p>
              </div>
              {[['Name', ld.name], ['Licence No.', ld.licenceNo], ['Date of Birth', ld.dob], ['Expiry', ld.expiry], ['Address', ld.address]].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', fontSize: 14 }}>
                  <span style={{ color: '#A8A29E' }}>{label}</span>
                  <span style={{ fontWeight: 500, color: '#1C1917', textAlign: 'right' }}>{val}</span>
                </div>
              ))}
            </div>

            {state.licenceExpired && (
              <Alert type="error" title="Licence Expired">
                Your licence has expired. You cannot check in at the kiosk. Please speak with the reception team.
              </Alert>
            )}
            {!state.licenceExpired && match === 'mismatch' && (
              <Alert type="error" title="Name Does Not Match Booking">
                The name on your licence does not match the name on the booking. Please see the reception team.
              </Alert>
            )}
            {!state.licenceExpired && match === 'warning' && (
              <Alert type="warning" title="Name Similarity Warning">
                Your licence name is similar but may not exactly match the booking. You can still proceed — reception will verify.
              </Alert>
            )}
            {!state.licenceExpired && match === 'matched' && (
              <Alert type="success" title="Name Confirmed">
                Licence name matches the booking driver name.
              </Alert>
            )}

            {!state.licenceExpired && match !== 'mismatch' && (
              <button className="kiosk-btn kiosk-btn-primary" style={{ width: '100%', borderRadius: 16 }} onClick={completeCheckIn}>
                <Icon name={ICONS.arrowRight} size={24} />
                Proceed to Check-In
              </button>
            )}
            {(state.licenceExpired || match === 'mismatch') && (
              <p style={{ textAlign: 'center', fontSize: 14, color: '#78716C' }}>Please proceed to the reception desk for assistance.</p>
            )}
            <button className="kiosk-btn kiosk-btn-secondary" style={{ width: '100%', borderRadius: 16, fontSize: 14 }}
              onClick={() => dispatch({ type: 'SET_LICENCE', data: null, expired: false })}>
              Scan Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Alert({ type, title, children }: { type: 'error' | 'warning' | 'success'; title: string; children: React.ReactNode }) {
  const cfg = {
    error:   { bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.25)',  icon: ICONS.close,   iconC: '#DC2626', titleC: '#DC2626', bodyC: '#EF4444' },
    warning: { bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.30)', icon: ICONS.warning, iconC: '#D97706', titleC: '#D97706', bodyC: '#B45309' },
    success: { bg: 'rgba(22,163,74,0.07)',  border: 'rgba(22,163,74,0.25)',  icon: ICONS.check,   iconC: '#16A34A', titleC: '#16A34A', bodyC: '#15803D' },
  }[type]
  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Icon name={cfg.icon} size={18} style={{ color: cfg.iconC }} />
        <p style={{ fontWeight: 700, fontSize: 14, color: cfg.titleC }}>{title}</p>
      </div>
      <p style={{ fontSize: 12, color: cfg.bodyC }}>{children}</p>
    </div>
  )
}
