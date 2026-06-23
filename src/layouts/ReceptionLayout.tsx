import { useState, useEffect, useCallback } from 'react'
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
  const [open, setOpen] = useState(() => localStorage.getItem('glido-sidebar') !== '0')
  const [walkInCount, setWalkInCount] = useState(0)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [sidebarExtra, setSidebarExtra] = useState<React.ReactNode>(null)
  const setSidebarExtraStable = useCallback((node: React.ReactNode) => setSidebarExtra(node), [])

  // Staff profile loaded directly from Supabase session — no AuthContext
  const [staffName,   setStaffName]   = useState<string | null>(null)
  const tenant = useTenantInfo()
  const [tenantName,  setTenantName]  = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  // Apply tenant brand colour to CSS variables whenever it loads
  useEffect(() => {
    const color = tenant?.primaryColor ?? 'var(--brand-color)'
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    document.documentElement.style.setProperty('--brand-color', color)
    document.documentElement.style.setProperty('--brand-rgb', `${r},${g},${b}`)
    const luminance = (0.2126 * (r/255)**2.2 + 0.7152 * (g/255)**2.2 + 0.0722 * (b/255)**2.2)
    const contrastWithBlack = (luminance + 0.05) / 0.05
    const contrastWithWhite = 1.05 / (luminance + 0.05)
    const brandText = contrastWithBlack >= contrastWithWhite ? '#000000' : '#ffffff'
    document.documentElement.style.setProperty('--brand-text', brandText)
    try { localStorage.setItem('glido_brand_color', color) } catch(e) {}
  }, [tenant?.primaryColor])

  // Page title from current nav
  const activeNav = NAV.find(n => pathname === n.to || (n.to !== '/reception' && pathname.startsWith(n.to)))
  // Some routes use a shorter nav label but need a longer page heading
  const PAGE_TITLE_OVERRIDE: Record<string, string> = {
    '/reception/visitors': 'Visitor Management',
  }
  const title = PAGE_TITLE_OVERRIDE[pathname] ?? activeNav?.label ?? 'Dashboard'

  const PAGE_SUBTITLE: Record<string, string> = {
    '/reception/bookings':  'Manage and track all depot bookings',
    '/reception/visitors':  'Visitor check-ins and walk-ins',
    '/reception/reports':   'Analytics, exports and ABF logs',
    '/reception/settings':  'Configure your facility',
  }
  // Dashboard shows the live date instead of a static description
  const todayLabel = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Australia/Sydney',
  })
  const subtitle = pathname === '/reception'
    ? todayLabel
    : (PAGE_SUBTITLE[pathname] ?? '')

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
        .nav-item { display: flex; align-items: center; gap: 0; padding: 0; border-radius: 22px; text-decoration: none; transition: background 0.15s ease, border-radius 0.28s ease, gap 0.28s cubic-bezier(0.16,1,0.3,1); overflow: hidden; flex-shrink: 0; position: relative; }
        .sidebar-col:not(.is-open) .nav-item { overflow: visible; }
        .sidebar-col.is-open .nav-item { gap: 6px; border-radius: 14px; }
        .nav-item-icon { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 19px; transition: background 0.15s ease; }
        .nav-item-label { font-size: 13px; font-weight: 500; white-space: nowrap; color: #ffffff; padding-right: 10px; flex: 1; opacity: 0; max-width: 0; overflow: hidden; pointer-events: none; transition: color 0.15s ease, opacity 0.14s ease, max-width 0.28s cubic-bezier(0.16,1,0.3,1); }
        .sidebar-col.is-open .nav-item-label { opacity: 1; max-width: 160px; pointer-events: auto; transition: color 0.15s ease, opacity 0.2s ease 0.14s, max-width 0.28s cubic-bezier(0.16,1,0.3,1); }
        .nav-item.active .nav-item-icon { background: rgba(255,255,255,0.12); }
        .sidebar-col.is-open .nav-item.active { background: rgba(255,255,255,0.09); }
        .nav-item.active .nav-item-label { color: #ffffff; font-weight: 600; }
        .nav-item:not(.active):hover .nav-item-icon { background: rgba(255,255,255,0.06); }
        .sidebar-col.is-open .nav-item:not(.active):hover { background: rgba(255,255,255,0.05); }
        .nav-item:not(.active):hover .nav-item-label { color: #ffffff; }
        /* Tooltip for collapsed sidebar */
        .sidebar-col:not(.is-open) .nav-item:hover::after {
          content: attr(data-label);
          position: absolute;
          left: calc(100% + 10px);
          top: 50%;
          transform: translateY(-50%);
          background: #1C1917;
          color: #FFFFFF;
          font-size: 13px;
          font-weight: 500;
          padding: 5px 10px;
          border-radius: 6px;
          white-space: nowrap;
          pointer-events: none;
          z-index: 2147483647;
          box-shadow: 0 4px 12px rgba(0,0,0,0.18);
        }
        .sidebar-col:not(.is-open) .nav-item:hover::before {
          content: '';
          position: absolute;
          left: calc(100% + 6px);
          top: 50%;
          transform: translateY(-50%);
          border: 4px solid transparent;
          border-right-color: #1C1917;
          pointer-events: none;
          z-index: 2147483647;
        }
        .action-btn { width: 48px; height: 48px; border-radius: 999px; background: var(--brand-color); color: var(--brand-text); display: flex; align-items: center; justify-content: center; gap: 0; border: none; cursor: pointer; flex-shrink: 0; transition: width 0.28s cubic-bezier(0.16,1,0.3,1), gap 0.28s ease, box-shadow 0.15s ease; box-shadow: 0 4px 16px rgba(var(--brand-rgb),0.38), 0 1px 4px rgba(var(--brand-rgb),0.20); text-decoration: none; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; position: relative; }
        .sidebar-col:not(.is-open) .action-btn { overflow: visible; }
        .sidebar-col.is-open .action-btn { width: 176px; gap: 8px; padding: 0 18px; justify-content: center; }
        .action-btn:hover { box-shadow: 0 6px 24px rgba(var(--brand-rgb),0.48), 0 2px 8px rgba(var(--brand-rgb),0.24); }
        .action-btn-label { opacity: 0; max-width: 0; overflow: hidden; pointer-events: none; transition: opacity 0.14s ease, max-width 0.28s cubic-bezier(0.16,1,0.3,1); }
        .sidebar-col.is-open .action-btn-label { opacity: 1; max-width: 140px; pointer-events: auto; transition: opacity 0.2s ease 0.14s, max-width 0.28s cubic-bezier(0.16,1,0.3,1); }
        .sidebar-toggle-btn { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 9px; border: 1px solid rgba(0,0,0,0.09); background: #FFFFFF; color: #78716C; cursor: pointer; flex-shrink: 0; transition: background 0.13s ease, border-color 0.13s ease, color 0.13s ease; }
        .sidebar-toggle-btn:hover { background: #F3F2F1; border-color: rgba(0,0,0,0.14); color: #1C1917; }
        .sidebar-badge { flex-shrink: 0; opacity: 0; max-width: 0; overflow: hidden; pointer-events: none; transition: opacity 0.14s ease, max-width 0.28s cubic-bezier(0.16,1,0.3,1); }
        .sidebar-col.is-open .sidebar-badge { opacity: 1; max-width: 36px; pointer-events: auto; }
        .user-menu-item { display: flex; align-items: center; gap: 9px; padding: 9px 12px; border-radius: 9px; font-size: 13px; font-weight: 500; color: #374151; cursor: pointer; text-decoration: none; transition: background 0.12s ease; }
        .user-menu-item:hover { background: rgba(0,0,0,0.04); }
        .user-menu-item.danger { color: #EF4444; }
        .user-menu-item.danger:hover { background: rgba(239,68,68,0.07); }
      `}</style>

      {/* ── Sidebar ── */}
      <aside className={`sidebar-col${open ? ' is-open' : ''}`}>

        {/* Logo */}
        <Link to="/reception" style={{ display: 'flex', alignItems: 'center', width: 40, justifyContent: 'center', transition: 'width 0.28s cubic-bezier(0.16,1,0.3,1)', ...(open ? { width: '100%' } : {}) }}>
          <GlidoLogo height={open ? 17 : 11} onDark={false} />
        </Link>

        {/* Nav pill */}
        <nav className="nav-pill">
          {NAV.filter(item => !(item.to === '/reception/settings' && isStaff)).map(item => {
            const isActive = item.to === '/reception'
              ? pathname === '/reception'
              : pathname.startsWith(item.to) && pathname !== '/reception/bookings/new'
            const hasChildren = 'children' in item && item.children
            return (
              <div key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/reception'}
                  className={() => `nav-item${isActive ? ' active' : ''}`}
                  data-label={item.label}
                >
                  <div className="nav-item-icon">
                    <Icon name={item.icon} size={18} style={{ color: isActive ? '#fff' : '#C7C7C6' }} />
                  </div>
                  <span className="nav-item-label">{item.label}</span>
                  {'badge' in item && item.badge && walkInCount > 0 && (
                    <span className="sidebar-badge" style={{ width: 20, height: 20, borderRadius: 'var(--r-full)', background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 4 }}>
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
                          fontSize: 13, fontWeight: a ? 600 : 400,
                          color: a ? '#ffffff' : 'rgba(255,255,255,0.75)',
                          textDecoration: 'none', padding: '4px 0',
                          whiteSpace: 'normal', lineHeight: 1.3, transition: 'color 0.15s ease',
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

        <button type="button" className="action-btn" onClick={() => navigate('/reception/bookings/new')}>
          <Icon name={ICONS.add} size={18} style={{ color: 'var(--brand-text)', flexShrink: 0 }} />
          <span className="action-btn-label">New Booking</span>
        </button>

        {/* Page-injected sidebar slot */}
        {sidebarExtra && (
          open ? (
            <div style={{ width: 176 }}>
              {sidebarExtra}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              data-label="Filters"
              aria-label="Filters"
              className="nav-item"
              style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
            >
              <div className="nav-item-icon" style={{ background: '#1C1917', borderRadius: 'var(--r-full)', width: 48, height: 48 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 4h18l-7 8v6l-4 2v-8z"/>
                </svg>
              </div>
            </button>
          )
        )}

      </aside>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#f9f9f9' }}>
        {/* Header */}
        <header style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: '#f9f9f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="sidebar-toggle-btn" type="button" onClick={() => setOpen(v => !v)} title="Toggle sidebar">
              {open ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M9 3v18"/>
                  <path d="M15 9l-3 3 3 3"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M9 3v18"/>
                  <path d="M12 9l3 3-3 3"/>
                </svg>
              )}
            </button>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1C1917', letterSpacing: '-0.02em', margin: 0, lineHeight: 1.15 }}>{title}</h1>
              {subtitle && (
                <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: '2px 0 0', lineHeight: 1.2 }}>{subtitle}</p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {tenant?.logoUrl && (
              <>
                <img src={tenant.logoUrl} alt="Company logo" style={{ height: 30, objectFit: 'contain', maxWidth: 100 }} />
                <span style={{ width: 1, height: 26, background: 'rgba(0,0,0,0.10)', flexShrink: 0 }} />
              </>
            )}

            {/* User avatar + popover */}
            <div style={{ position: 'relative' }}>
              {userMenuOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 9100 }} onClick={() => setUserMenuOpen(false)} />
                  <div style={{ position: 'fixed', top: 56, right: 16, zIndex: 9101, width: 232, background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.09)', borderRadius: 'var(--r-lg)', boxShadow: '0 12px 40px rgba(0,0,0,0.15),0 3px 10px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'rgba(var(--brand-rgb),0.025)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 'var(--r-full)', background: 'var(--brand-color)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--brand-text)', flexShrink: 0 }}>{initials}</div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 15, fontWeight: 600, color: '#1C1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName}</p>
                        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{tenantLine}</p>
                      </div>
                    </div>
                    <div style={{ padding: 6 }}>
                      <button onClick={handleSignOut} className="user-menu-item danger" style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                        <Icon name={ICONS.logout} size={15} style={{ flexShrink: 0 }} />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
              <div
                onClick={() => setUserMenuOpen(v => !v)}
                title="Account menu"
                style={{ width: 36, height: 36, borderRadius: 'var(--r-full)', background: 'var(--brand-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--brand-text)', flexShrink: 0, cursor: 'pointer' }}
              >
                {profileLoading ? '·' : initials}
              </div>
            </div>

          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '14px 22px 22px' }}>
          <Outlet context={{ setSidebarExtra: setSidebarExtraStable }} />
        </main>
      </div>
    </div>
  )
}
