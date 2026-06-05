import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, ICONS } from '@/lib/Icon'
import { supabase } from '@/lib/supabase'

const FIELD: React.CSSProperties = { width: '100%', padding: '11px 14px', fontSize: 14, color: '#1C1917', background: '#F7F6F5', border: '1px solid rgba(0,0,0,0.10)', borderRadius: 10, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s ease, box-shadow 0.15s ease' }
const focus = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = 'rgba(252,101,20,0.50)'; e.target.style.boxShadow = '0 0 0 3px rgba(252,101,20,0.12)' }
const blur  = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = 'rgba(0,0,0,0.10)'; e.target.style.boxShadow = 'none' }

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    }).catch(() => {})
    setSent(true)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 56px - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: 'linear-gradient(160deg,#FAFAF9 0%,#F7F6F5 100%)', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'radial-gradient(rgba(0,0,0,0.05) 1px,transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400 }}>
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 24, padding: '44px 40px', boxShadow: '0 2px 8px rgba(0,0,0,0.04),0 16px 48px rgba(0,0,0,0.09)' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#FF7A2A 0%,#E85A0A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 4px 14px rgba(252,101,20,0.38)' }}>
              <Icon name={ICONS.users} size={24} style={{ color: '#fff' }} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1C1917', letterSpacing: '-0.03em', marginBottom: 6 }}>Reset your password</h1>
            <p style={{ fontSize: 13, color: '#78716C', lineHeight: 1.6 }}>Enter your email and we'll send you a reset link.</p>
          </div>

          {sent ? (
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: '#16A34A', textAlign: 'center', lineHeight: 1.5 }}>
              Check your inbox — a password reset link is on its way. It may take a minute or two.
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#78716C', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" style={FIELD} onFocus={focus} onBlur={blur} />
              </div>
              <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px 20px', fontSize: 14, fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg,#FF7A2A,#E85A0A)', border: 'none', borderRadius: 9999, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 2px 8px rgba(252,101,20,0.35)', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Sending…' : <>Send Reset Link <Icon name={ICONS.arrowRight} size={14} /></>}
              </button>
            </form>
          )}

          <p style={{ textAlign: 'center', fontSize: 12, color: '#A8A29E', marginTop: 20 }}>
            <Link to="/login" style={{ color: '#FC6514', textDecoration: 'none', fontWeight: 500 }}>← Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
