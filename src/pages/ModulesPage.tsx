import { useNavigate } from 'react-router-dom'
import { usePageTitle } from '@/lib/usePageTitle'
import { Icon, ICONS } from '@/lib/Icon'

const MODULES = [
  {
    label:       'Visitor Portal',
    route:       '/book',
    description: 'Book appointments, check status and manage visits',
    icon:        ICONS.calendar,
    iconBg:      'rgba(252,101,20,0.09)',
    iconFg:      '#FC6514',
  },
  {
    label:       'Reception',
    route:       '/reception',
    description: 'Manage visitors, timeslots and document verification',
    icon:        ICONS.home,
    iconBg:      'rgba(99,102,241,0.09)',
    iconFg:      '#6366F1',
  },
  {
    label:       'Visitor Register',
    route:       '/kiosk',
    description: 'Tablet-based visitor check-in system',
    icon:        ICONS.kiosk,
    iconBg:      'rgba(34,197,94,0.09)',
    iconFg:      '#16A34A',
  },
]

export default function ModulesPage() {
  usePageTitle('Glido | Modules')
  const navigate = useNavigate()

  return (
    <>
      <style>{`
        @media (max-width: 800px)  { .modules-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 520px)  { .modules-grid { grid-template-columns: 1fr !important; } }
        .module-card:hover { transform: translateY(-3px) !important; box-shadow: 0 12px 36px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.07) !important; }
      `}</style>

      <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#1C1917', letterSpacing: '-0.03em', margin: 0 }}>
            Welcome to Glido
          </h1>
          <p style={{ fontSize: 16, color: '#78716C', marginTop: 8, margin: '8px 0 0' }}>
            Select a module to get started
          </p>
        </div>

        {/* Grid */}
        <div
          className="modules-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 24,
            width: '100%',
            maxWidth: 1100,
            margin: '0 auto',
          }}
        >
          {MODULES.map(m => (
            <div
              key={m.route}
              className="module-card"
              onClick={() => navigate(m.route)}
              style={{
                background: '#FFFFFF',
                borderRadius: 20,
                padding: 32,
                minHeight: 280,
                boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.07)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.18s cubic-bezier(0.16,1,0.3,1), box-shadow 0.18s ease',
              }}
            >
              {/* Icon */}
              <div style={{
                width: 72, height: 72, borderRadius: 18,
                background: m.iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 22, flexShrink: 0,
              }}>
                <Icon name={m.icon} size={32} style={{ color: m.iconFg }} />
              </div>

              {/* Label */}
              <p style={{ fontSize: 20, fontWeight: 700, color: '#1C1917', letterSpacing: '-0.02em', marginBottom: 8 }}>
                {m.label}
              </p>

              {/* Description */}
              <p style={{ fontSize: 14, color: '#78716C', lineHeight: 1.55, flex: 1, marginBottom: 24 }}>
                {m.description}
              </p>

              {/* Arrow */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 20, color: '#C7C3BF', lineHeight: 1 }}>→</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </>
  )
}
