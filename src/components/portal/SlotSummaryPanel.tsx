import { useState } from 'react'
import { Icon, ICONS } from '@/lib/Icon'
import type { SlotConfig } from '@/contexts/WizardContext'

const svc = (s: string | null) => s === 'pickup' ? 'Pick Up' : s === 'dropoff' ? 'Drop Off' : null

export function SlotSummaryPanel({ slots }: { slots: SlotConfig[] }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ position: 'fixed', right: 20, bottom: 142, zIndex: 40, width: 280, maxWidth: 'calc(100vw - 40px)', animation: 'slot-panel-in 0.28s cubic-bezier(0.16,1,0.3,1)' }}>
      <style>{`@keyframes slot-panel-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 'var(--r-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.12),0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {/* Header */}
        <button type="button" onClick={() => setOpen(v => !v)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '11px 14px', background: 'rgba(var(--brand-rgb),0.04)', border: 'none', borderBottom: open ? '1px solid rgba(0,0,0,0.06)' : 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icon name={ICONS.calendar} size={15} style={{ color: 'var(--brand-color)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1C1917' }}>Your Slots</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>{slots.length}</span>
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>

        {/* List */}
        {open && (
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {slots.map((c, i) => {
              const service = svc(c.serviceType)
              const load = c.loadType ? c.loadType.toUpperCase() : null
              const done = !!(service && load && c.selectedSlotLabel)
              return (
                <div key={i} style={{
                  display: 'flex', gap: 11, padding: '13px 14px',
                  borderTop: i === 0 ? 'none' : '1px solid rgba(0,0,0,0.06)',
                }}>
                  <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 'var(--r-full)',
                    background: done ? 'rgba(var(--brand-rgb),0.10)' : 'rgba(0,0,0,0.05)',
                    color: done ? 'var(--brand-color)' : 'var(--text-tertiary)',
                    fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {i + 1}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {/* Service · Load */}
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: '#1C1917', margin: 0 }}>
                      {service && load ? `${service} · ${load}`
                        : service ? service
                        : <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>Not set yet</span>}
                    </p>
                    {/* Timing — only render if present, on its own quiet line */}
                    {c.selectedSlotLabel && (
                      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg>
                        {c.selectedDate} · {c.selectedSlotLabel}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
