import { useState, useEffect } from 'react'
import { usePageTitle } from '@/lib/usePageTitle'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon, ICONS } from '@/lib/Icon'
import { MyBookingsList } from '@/components/portal/MyBookingsList'
import { getBookingByRef, getBookingsByUserId } from '@/lib/db/bookings'
import { useAuth } from '@/contexts/AuthContext'
import type { Booking } from '@/data/types'

const FIELD: React.CSSProperties = {
  flex: 1, padding: '10px 14px', fontSize: 13.5,
  border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, outline: 'none',
  boxSizing: 'border-box', background: '#fff', color: '#1C1917',
  transition: 'border-color 0.15s ease',
}

export default function MyBookingsPage() {
  usePageTitle('Glido | My Bookings')
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const ref = params.get('ref')?.trim().toUpperCase() ?? ''

  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading]   = useState(false)
  const [search, setSearch]     = useState(ref)

  useEffect(() => {
    if (!ref && !user) return
    setLoading(true)
    const fetch = ref
      ? getBookingByRef(ref).then(b => (b ? [b] : []))
      : user ? getBookingsByUserId(user.id) : Promise.resolve([])
    fetch
      .then(setBookings)
      .catch(() => setBookings([]))
      .finally(() => setLoading(false))
  }, [ref, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) setParams({ ref: search.trim().toUpperCase() })
    else setParams({})
  }

  // ── Not logged in, no search ──
  if (!user && !ref) {
    return (
      <div style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: '#FFF3EC', border: '1px solid rgba(var(--brand-rgb),0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Icon name={ICONS.bookings} size={24} style={{ color: 'var(--brand-color)' }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1C1917', letterSpacing: '-0.03em', marginBottom: 8 }}>
            Sign in to view your bookings
          </h1>
          <p style={{ fontSize: 14, color: '#78716C', lineHeight: 1.65, marginBottom: 28, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
            Log in to see your full booking history, or search by reference number below.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
            <Link to="/visitor-login" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 24px', fontSize: 14, fontWeight: 600, color: '#fff', background: 'var(--brand-color)', borderRadius: 9999, textDecoration: 'none', boxShadow: '0 2px 8px rgba(var(--brand-rgb),0.35)' }}>
              <Icon name={ICONS.user} size={15} /> Sign In <Icon name={ICONS.arrowRight} size={14} />
            </Link>
            <Link to="/book" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 24px', fontSize: 14, fontWeight: 600, color: '#374151', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 9999, textDecoration: 'none' }}>
              <Icon name={ICONS.calendar} size={14} /> Book a New Visit
            </Link>
          </div>

          <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: 24 }}>
            <p style={{ fontSize: 12, color: '#A8A29E', marginBottom: 12 }}>Have a reference number? Look it up directly:</p>
            <form onSubmit={submitSearch} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="GLD-2026-10142"
                style={{ ...FIELD, fontFamily: 'ui-monospace,monospace' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(var(--brand-rgb),0.50)')}
                onBlur={e  => (e.target.style.borderColor = 'rgba(0,0,0,0.12)')}
              />
              <button type="submit" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--brand-color)', border: 'none', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <Icon name={ICONS.search} size={14} /> Search
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // ── Logged in or searching ──
  return (
    <div style={{ padding: '40px 24px 64px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1C1917', letterSpacing: '-0.03em', marginBottom: 4 }}>My Bookings</h1>
          <p style={{ fontSize: 13, color: '#64748B' }}>Track the status of your depot slot bookings.</p>
        </div>

        {/* Search bar */}
        <form onSubmit={submitSearch} style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Booking reference — e.g. GLD-2026-10142"
            style={{ ...FIELD, fontFamily: search ? 'ui-monospace,monospace' : undefined }}
            onFocus={e => (e.target.style.borderColor = 'rgba(var(--brand-rgb),0.50)')}
            onBlur={e  => (e.target.style.borderColor = 'rgba(0,0,0,0.12)')}
          />
          <button type="submit" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--brand-color)', border: 'none', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Search
          </button>
          {ref && (
            <button type="button" onClick={() => { setSearch(''); setParams({}) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#374151', background: '#fff', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Clear
            </button>
          )}
        </form>

        {ref && (
          <p style={{ fontSize: 12, fontWeight: 500, color: '#78716C', marginBottom: 16 }}>
            Results for "{ref}"
          </p>
        )}

        {loading
          ? <div style={{ textAlign: 'center', padding: '48px 0', color: '#A8A29E', fontSize: 14 }}>Loading…</div>
          : <MyBookingsList bookings={bookings} query={ref} onCancelled={() => {
              setLoading(true)
              const fetch = ref
                ? getBookingByRef(ref).then(b => (b ? [b] : []))
                : user ? getBookingsByUserId(user.id) : Promise.resolve([])
              fetch.then(setBookings).catch(() => setBookings([])).finally(() => setLoading(false))
            }} />
        }
      </div>
    </div>
  )
}
