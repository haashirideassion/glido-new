import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation, Link, useNavigate } from 'react-router-dom'
import { GlidoLogo } from '@/lib/GlidoLogo'
import { todaySydney } from '@/lib/time'
import { Icon, ICONS } from '@/lib/Icon'
import { initToast, toast } from '@/lib/toast'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useReceptionAuth } from '@/contexts/ReceptionAuthContext'
import { useTenantInfo } from '@/lib/useTenantInfo'

const NAV = [
  { to: '/reception',           label: 'Dashboard', icon: ICONS.home,     badge: false },
  { to: '/reception/bookings',  label: 'Bookings',  icon: ICONS.bookings, badge: false },
  { to: '/reception/visitors',  label: 'Visitors',  icon: ICONS.walkIn,   badge: true  },
  { to: '/reception/reports',   label: 'Reports',   icon: ICONS.reports,  badge: false, children: [
    { to: '/reception/reports/visitor-log', label: 'ABF Visitor Log'   },
    { to: '/reception/reports/configure',    label: 'Configure Reports' },
  ]},
  { to: '/reception/settings',  label: 'Settings',  icon: ICONS.settings, badge: false },
] as const

declare global { interface Window { __echarts?: any } }

export default function ReceptionLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user: _user } = useAuth()
  const { isStaff, role: staffRole } = useReceptionAuth()

  // Block reception_staff from accessing Settings — redirect with toast
  useEffect(() => {
    if (isStaff && pathname.startsWith('/reception/settings')) {
      toast('You do not have permission to access Settings.', 'error')
      navigate('/reception', { replace: true })
    }
  }, [isStaff, pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }
  const [open, setOpen] = useState(() => localStorage.getItem('glido-sidebar') === '1')
  const [walkInCount, setWalkInCount] = useState(0)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // Staff profile loaded directly from Supabase session — no AuthContext
  const [staffName,   setStaffName]   = useState<string | null>(null)
  const tenant = useTenantInfo()
  const [tenantName,  setTenantName]  = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  // Page title from current nav
  const activeNav = NAV.find(n => pathname === n.to || (n.to !== '/reception' && pathname.startsWith(n.to)))
  // Some routes use a shorter nav label but need a longer page heading
  const PAGE_TITLE_OVERRIDE: Record<string, string> = {
    '/reception/visitors': 'Visitor Management',
  }
  const title = PAGE_TITLE_OVERRIDE[pathname] ?? activeNav?.label ?? 'Dashboard'

  useEffect(() => { initToast() }, [])

  // Fetch staff name + tenant on mount
  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted || !session?.user) { if (mounted) setProfileLoading(false); return }

      const { data: userRow } = await supabase
        .from('users')
        .select('first_name, last_name, tenant_id')
        .eq('id', session.user.id)
        .single()

      if (!mounted) return

      if (userRow) {
        const name = [userRow.first_name, userRow.last_name].filter(Boolean).join(' ').trim()
        setStaffName(name || session.user.email || null)

        if (userRow.tenant_id) {
          const { data: tenantRow } = await supabase
            .from('tenants')
            .select('name')
            .eq('id', userRow.tenant_id)
            .single()
          if (mounted && tenantRow?.name) setTenantName(tenantRow.name)
        }
      } else {
        setStaffName(session.user.email ?? null)
      }

      if (mounted) setProfileLoading(false)
    }).catch(() => { if (mounted) setProfileLoading(false) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    localStorage.setItem('glido-sidebar', open ? '1' : '0')
  }, [open])

  // Realtime walk-in badge — initial fetch + live updates via WebSocket
  useEffect(() => {
    const today = todaySydney()
    const fetch = () =>
      supabase.from('walk_ins').select('id', { count: 'exact', head: true })
        .eq('dismissed', false)
        .gte('arrived_at', today)
        .then(({ count }) => setWalkInCount(count ?? 0))
    fetch()
    const channel = supabase
      .channel('reception-layout-walk-ins')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'walk_ins' }, () => { fetch() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const initials   = staffName ? staffName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'
  const fullName   = staffName ?? 'Reception Agent'
  const tenantLine = tenantName ?? 'CFS'

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'Red Hat Display', ui-sans-serif, system-ui, sans-serif" }}>
      <style>{`
        *, *::before, *::after { font-family: 'Red Hat Display', ui-sans-serif, system-ui, sans-serif; }
        .sidebar-col { position: sticky; top: 0; height: 100vh; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; padding: 20px 12px; gap: 12px; width: 72px; transition: width 0.28s cubic-bezier(0.16,1,0.3,1); background: #f9f9f9; }
        .sidebar-col.is-open { width: 200px; }
        .nav-pill { background: #1C1917; border-radius: 28px; padding: 6px; display: flex; flex-direction: column; gap: 2px; box-shadow: 0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.07); width: 52px; transition: width 0.28s cubic-bezier(0.16,1,0.3,1), border-radius 0.28s ease; }
        .sidebar-col.is-open .nav-pill { width: 176px; border-radius: 20px; }
        .nav-item { display: flex; align-items: center; gap: 0; padding: 0; border-radius: 22px; text-decoration: none; transition: background 0.15s ease, border-radius 0.28s ease, gap 0.28s cubic-bezier(0.16,1,0.3,1); overflow: hidden; flex-shrink: 0; }
        .sidebar-col.is-open .nav-item { gap: 6px; border-radius: 14px; }
        .nav-item-icon { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 19px; transition: background 0.15s ease; }
        .nav-item-label { font-size: 13px; font-weight: 500; white-space: nowrap; color: rgba(255,255,255,0.55); padding-right: 10px; flex: 1; opacity: 0; max-width: 0; overflow: hidden; pointer-events: none; transition: color 0.15s ease, opacity 0.14s ease, max-width 0.28s cubic-bezier(0.16,1,0.3,1); }
        .sidebar-col.is-open .nav-item-label { opacity: 1; max-width: 160px; pointer-events: auto; transition: color 0.15s ease, opacity 0.2s ease 0.14s, max-width 0.28s cubic-bezier(0.16,1,0.3,1); }
        .nav-item.active .nav-item-icon { background: rgba(255,255,255,0.12); }
        .sidebar-col.is-open .nav-item.active { background: rgba(255,255,255,0.09); }
        .nav-item.active .nav-item-label { color: #ffffff; font-weight: 600; }
        .nav-item:not(.active):hover .nav-item-icon { background: rgba(255,255,255,0.06); }
        .sidebar-col.is-open .nav-item:not(.active):hover { background: rgba(255,255,255,0.05); }
        .nav-item:not(.active):hover .nav-item-label { color: rgba(255,255,255,0.80); }
        .action-btn { width: 48px; height: 48px; border-radius: 999px; background: #FC6514; color: #fff; display: flex; align-items: center; justify-content: center; gap: 0; border: none; cursor: pointer; flex-shrink: 0; transition: width 0.28s cubic-bezier(0.16,1,0.3,1), gap 0.28s ease, box-shadow 0.15s ease; box-shadow: 0 4px 16px rgba(252,101,20,0.38), 0 1px 4px rgba(252,101,20,0.20); text-decoration: none; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; }
        .sidebar-col.is-open .action-btn { width: 176px; gap: 8px; padding: 0 18px; justify-content: center; }
        .action-btn:hover { box-shadow: 0 6px 24px rgba(252,101,20,0.48), 0 2px 8px rgba(252,101,20,0.24); }
        .action-btn-label { opacity: 0; max-width: 0; overflow: hidden; pointer-events: none; transition: opacity 0.14s ease, max-width 0.28s cubic-bezier(0.16,1,0.3,1); }
        .sidebar-col.is-open .action-btn-label { opacity: 1; max-width: 140px; pointer-events: auto; transition: opacity 0.2s ease 0.14s, max-width 0.28s cubic-bezier(0.16,1,0.3,1); }
        .sidebar-toggle-btn { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 9px; border: 1px solid rgba(0,0,0,0.09); background: #FFFFFF; color: #78716C; cursor: pointer; flex-shrink: 0; transition: background 0.13s ease, border-color 0.13s ease, color 0.13s ease; }
        .sidebar-toggle-btn:hover { background: #F3F2F1; border-color: rgba(0,0,0,0.14); color: #1C1917; }
        .sidebar-badge { flex-shrink: 0; opacity: 0; max-width: 0; overflow: hidden; pointer-events: none; transition: opacity 0.14s ease, max-width 0.28s cubic-bezier(0.16,1,0.3,1); }
        .sidebar-col.is-open .sidebar-badge { opacity: 1; max-width: 36px; pointer-events: auto; }
        .sidebar-user { display: flex; align-items: center; gap: 0; width: 100%; justify-content: center; overflow: hidden; transition: gap 0.28s ease; border-radius: 12px; padding: 4px; cursor: pointer; }
        .sidebar-col.is-open .sidebar-user { gap: 10px; justify-content: flex-start; padding-left: 4px; }
        .sidebar-user:hover { background: rgba(0,0,0,0.04); }
        .sidebar-user-info { min-width: 0; opacity: 0; max-width: 0; overflow: hidden; pointer-events: none; transition: opacity 0.14s ease, max-width 0.28s cubic-bezier(0.16,1,0.3,1); }
        .sidebar-col.is-open .sidebar-user-info { opacity: 1; max-width: 140px; pointer-events: auto; transition: opacity 0.2s ease 0.14s, max-width 0.28s cubic-bezier(0.16,1,0.3,1); }
        .user-menu-item { display: flex; align-items: center; gap: 9px; padding: 9px 12px; border-radius: 9px; font-size: 13px; font-weight: 500; color: #374151; cursor: pointer; text-decoration: none; transition: background 0.12s ease; }
        .user-menu-item:hover { background: rgba(0,0,0,0.04); }
        .user-menu-item.danger { color: #EF4444; }
        .user-menu-item.danger:hover { background: rgba(239,68,68,0.07); }
      `}</style>

      {/* ── Sidebar ── */}
      <aside className={`sidebar-col${open ? ' is-open' : ''}`}>

        {/* Logo */}
        <a href="/reception" style={{ display: 'flex', alignItems: 'center', width: 40, justifyContent: 'center', transition: 'width 0.28s cubic-bezier(0.16,1,0.3,1)', ...(open ? { width: '100%' } : {}) }}>
          <GlidoLogo height={open ? 17 : 11} onDark={false} />
        </a>

        {/* Nav pill */}
        <nav className="nav-pill">
          {NAV.filter(item => !(item.to === '/reception/settings' && isStaff)).map(item => {
            const isActive = item.to === '/reception' ? pathname === '/reception' : pathname.startsWith(item.to)
            const hasChildren = 'children' in item && item.children
            return (
              <div key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/reception'}
                  className={({ isActive: a }) => `nav-item${a ? ' active' : ''}`}
                >
                  <div className="nav-item-icon">
                    <Icon name={item.icon} size={18} style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.55)' }} />
                  </div>
                  <span className="nav-item-label">{item.label}</span>
                  {'badge' in item && item.badge && walkInCount > 0 && (
                    <span className="sidebar-badge" style={{ width: 20, height: 20, borderRadius: 9999, background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 4 }}>
                      {walkInCount}
                    </span>
                  )}
                </NavLink>

                {/* Sub-items — only visible when sidebar is open and parent is active */}
                {hasChildren && isActive && open && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '2px 4px 4px 44px' }}>
                    {(item as any).children.map((sub: { to: string; label: string }) => (
                      <NavLink
                        key={sub.to}
                        to={sub.to}
                        className={({ isActive: a }) => a ? 'nav-subitem active' : 'nav-subitem'}
                        style={({ isActive: a }) => ({
                          fontSize: 13, fontWeight: a ? 700 : 500,
                          color: a ? '#ffffff' : 'rgba(255,255,255,0.45)',
                          textDecoration: 'none', padding: '5px 0',
                          whiteSpace: 'nowrap', transition: 'color 0.15s ease',
                          display: 'block',
                        })}
                      >
                        {sub.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* New Booking button */}
        <button type="button" className="action-btn" onClick={() => navigate('/reception/bookings/new')}>
          <Icon name={ICONS.add} size={18} style={{ color: '#fff', flexShrink: 0 }} />
          <span className="action-btn-label">New Booking</span>
        </button>

        {/* User footer */}
        <div style={{ marginTop: 'auto', width: '100%', position: 'relative' }}>
          {/* User menu popover */}
          {userMenuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 9100 }} onClick={() => setUserMenuOpen(false)} />
              <div style={{ position: 'fixed', bottom: 76, left: 12, zIndex: 9101, width: 232, background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.09)', borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.15),0 3px 10px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'rgba(252,101,20,0.025)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 9999, background: 'rgba(252,101,20,0.12)', border: '1.5px solid rgba(252,101,20,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#FC6514', flexShrink: 0 }}>{initials}</div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName}</p>
                    <p style={{ fontSize: 11, color: '#A8A29E', whiteSpace: 'nowrap' }}>{tenantLine}</p>
                  </div>
                </div>
                <div style={{ padding: 6 }}>
                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', margin: '4px 0' }} />
                  <button onClick={handleSignOut} className="user-menu-item danger" style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <Icon name={ICONS.logout} size={15} style={{ flexShrink: 0 }} />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="sidebar-user" onClick={() => setUserMenuOpen(v => !v)} title="Account menu">
            <div style={{ width: 32, height: 32, borderRadius: 9999, background: 'rgba(252,101,20,0.12)', border: '1px solid rgba(252,101,20,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#FC6514', flexShrink: 0 }}>
              {profileLoading ? '·' : initials}
            </div>
            <div className="sidebar-user-info" style={{ minWidth: 0, overflow: 'hidden' }}>
              {profileLoading ? (
                <>
                  <div style={{ height: 12, width: 96, borderRadius: 6, background: 'rgba(0,0,0,0.08)', marginBottom: 5 }} />
                  <div style={{ height: 10, width: 64, borderRadius: 6, background: 'rgba(0,0,0,0.06)' }} />
                </>
              ) : (
                <>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', minWidth: 0 }}>{fullName}</p>
                  <p style={{ fontSize: 13, color: '#4B5563', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', minWidth: 0 }}>{tenantLine}</p>
                  {staffRole && (() => {
                    const badge =
                      staffRole === 'super_admin'      ? { label: 'Super Admin', bg: '#F5F3FF', color: '#7C3AED' } :
                      staffRole === 'reception_admin'  ? { label: 'Admin',       bg: '#EFF6FF', color: '#2563EB' } :
                                                         { label: 'Staff',       bg: '#F3F4F6', color: '#6B7280' }
                    return (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 500, display: 'inline-block', marginTop: 2, background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    )
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#f9f9f9' }}>
        {/* Header */}
        <header style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: '#f9f9f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="sidebar-toggle-btn" type="button" onClick={() => setOpen(v => !v)} title="Toggle sidebar">
              {open ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M2 4h11M2 7.5h11M2 11h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
            </button>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: '#1C1917', letterSpacing: '-0.02em' }}>{title}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {tenant?.logoUrl && (
              <img src={tenant.logoUrl} alt="Company logo" style={{ height: 32, objectFit: 'contain', maxWidth: 100 }} />
            )}
            <button
              type="button"
              onClick={() => navigate('/reception/bookings/new')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 14, fontWeight: 600, color: '#FC6514', background: 'rgba(252,101,20,0.07)', border: '1px solid rgba(252,101,20,0.22)', borderRadius: 9999, letterSpacing: '-0.01em', transition: 'all 0.14s ease', boxShadow: '0 1px 3px rgba(252,101,20,0.08)', cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(252,101,20,0.13)'; e.currentTarget.style.borderColor = 'rgba(252,101,20,0.38)' }}
              onMouseOut={e  => { e.currentTarget.style.background = 'rgba(252,101,20,0.07)'; e.currentTarget.style.borderColor = 'rgba(252,101,20,0.22)' }}
            >
              <Icon name={ICONS.add} size={13} />
              New Booking
            </button>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
