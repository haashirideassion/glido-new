import { useState, useEffect, useRef } from 'react'

export interface SelectOption { value: string; label: string }

interface Props {
  placeholder: string
  options: SelectOption[]
  value: string
  onChange: (v: string) => void
  width?: string | number
  onBlur?: () => void
  /** When true, selected value renders in dark text with neutral border — no orange active state */
  neutral?: boolean
}

export function CustomSelect({ placeholder, options, value, onChange, width = '100%', onBlur, neutral }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const allOpts = [{ value: '', label: placeholder }, ...options]
  const label  = allOpts.find(o => o.value === value)?.label ?? placeholder
  const active = value !== ''

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        onBlur?.()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onBlur])

  return (
    <div ref={ref} style={{ position: 'relative', width }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          fontSize: 14, padding: '11px 14px', height: 44, borderRadius: 10,
          cursor: 'pointer', outline: 'none', transition: 'all 0.12s ease', boxSizing: 'border-box',
          background: (active && !neutral) ? 'rgba(252,101,20,0.05)' : '#F7F6F5',
          border: `1px solid ${(active && !neutral) ? 'rgba(252,101,20,0.40)' : 'rgba(0,0,0,0.10)'}`,
          color: (active && !neutral) ? '#FC6514' : active ? '#1C1917' : '#78716C',
          fontFamily: 'inherit', fontWeight: active ? 600 : 400,
          boxShadow: open ? '0 0 0 3px rgba(252,101,20,0.12)' : 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{label}</span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ flexShrink: 0, opacity: 0.55, transition: 'transform 0.15s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 5px)', left: 0, zIndex: 9999,
          width: '100%', minWidth: 200, background: '#FFFFFF',
          border: '1px solid rgba(0,0,0,0.09)', borderRadius: 12,
          boxShadow: '0 8px 28px rgba(0,0,0,0.11),0 2px 6px rgba(0,0,0,0.06)',
          padding: 5,
          maxHeight: 200, overflowY: 'auto',
        }}>
          {allOpts.map(opt => {
            const selected = opt.value === value
            return (
              <button
                key={opt.value || '__placeholder__'}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); onBlur?.() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '9px 10px', borderRadius: 8,
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  fontSize: 14, fontFamily: 'inherit',
                  background: selected ? 'rgba(252,101,20,0.08)' : 'transparent',
                  color: selected ? '#FC6514' : '#1C1917',
                  transition: 'background 0.12s ease',
                }}
                onMouseOver={e => { if (!selected) e.currentTarget.style.background = 'rgba(0,0,0,0.04)' }}
                onMouseOut={e  => { if (!selected) e.currentTarget.style.background = 'transparent' }}
              >
                {/* Fixed-width checkmark slot */}
                <span style={{ width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {selected && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6L4.5 8.5 10 3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <span>{opt.label || placeholder}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
