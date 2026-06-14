import { Link } from 'react-router-dom'
import { Icon, ICONS } from '@/lib/Icon'

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: 'calc(100vh - 56px - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: 'linear-gradient(160deg,#FAFAF9 0%,#F7F6F5 100%)', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'radial-gradient(rgba(0,0,0,0.05) 1px,transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400 }}>
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 24, padding: '44px 40px', boxShadow: '0 2px 8px rgba(0,0,0,0.04),0 16px 48px rgba(0,0,0,0.09)' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#FF7A2A 0%,#E85A0A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 4px 14px rgba(var(--brand-rgb),0.38)' }}>
              <Icon name={ICONS.users} size={24} style={{ color: '#fff' }} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1C1917', letterSpacing: '-0.03em', marginBottom: 6 }}>Set a new password</h1>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6 }}>This link was sent to your email. Choose a new password below.</p>
          </div>
          <div style={{ background: 'rgba(var(--brand-rgb),0.08)', border: '1px solid rgba(var(--brand-rgb),0.22)', borderRadius: 10, padding: '14px 16px', fontSize: 15, color: 'var(--brand-color)', textAlign: 'center', lineHeight: 1.5 }}>
            Password reset via email link is handled by Supabase Auth. Use the link in your email to set a new password through the Supabase-hosted reset page.
          </div>
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-tertiary)', marginTop: 20 }}>
            <Link to="/login" style={{ color: 'var(--brand-color)', textDecoration: 'none', fontWeight: 500 }}>← Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
