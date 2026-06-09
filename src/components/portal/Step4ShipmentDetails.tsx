import { useEffect, useState, useRef } from 'react'
import { useWizard } from '@/contexts/WizardContext'
import { getTenant } from '@/lib/db/tenants'
import { getSlotsByDate } from '@/lib/db/slots'
import { Icon, ICONS } from '@/lib/Icon'
import { toast } from '@/lib/toast'
import { todaySydney, TZ } from '@/lib/time'
import { DEFAULT_TENANT_ID } from '@/lib/supabase'
import type { TimeSlot } from '@/data/types'
import type { TenantRow } from '@/lib/db/tenants'

const TZ_OPT = { timeZone: TZ }

// ─── Tenant config types ──────────────────────────────────────────────────────

interface DayHours { enabled: boolean; open: string; close: string }
interface WorkingHoursConfig {
  mon: DayHours; tue: DayHours; wed: DayHours; thu: DayHours
  fri: DayHours; sat: DayHours; sun: DayHours
  periods?: PeriodConfig
}
interface PeriodDef { enabled: boolean; label: string; start: string; end: string }
interface PeriodConfig { morning: PeriodDef; afternoon: PeriodDef; evening: PeriodDef }

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

const DEFAULT_PERIODS: PeriodConfig = {
  morning:   { enabled: true,  label: 'Morning Slots',   start: '00:00', end: '12:00' },
  afternoon: { enabled: true,  label: 'Afternoon Slots', start: '12:00', end: '17:00' },
  evening:   { enabled: true,  label: 'Evening Slots',   start: '17:00', end: '24:00' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function getDayKey(isoDate: string): typeof DAY_KEYS[number] {
  // Parse using Sydney local time
  const d = new Date(isoDate + 'T00:00:00')
  const dow = parseInt(d.toLocaleDateString('en-AU', { weekday: 'short', timeZone: TZ })
    .slice(0, 2).toLowerCase() === 'su' ? '0' :
    d.toLocaleDateString('en-AU', { weekday: 'narrow', timeZone: TZ }) === 'M' ? '1' :
    d.toLocaleDateString('en-AU', { weekday: 'narrow', timeZone: TZ }) === 'T' &&
    d.toLocaleDateString('en-AU', { weekday: 'short', timeZone: TZ }).startsWith('Tu') ? '2' :
    d.toLocaleDateString('en-AU', { weekday: 'short', timeZone: TZ }).startsWith('W') ? '3' :
    d.toLocaleDateString('en-AU', { weekday: 'short', timeZone: TZ }).startsWith('Th') ? '4' :
    d.toLocaleDateString('en-AU', { weekday: 'short', timeZone: TZ }).startsWith('F') ? '5' :
    d.toLocaleDateString('en-AU', { weekday: 'short', timeZone: TZ }).startsWith('Sa') ? '6' : '0')
  // Simpler: use getDay on the date parsed in Sydney time
  const sydneyDate = new Date(new Date(isoDate + 'T12:00:00').toLocaleString('en-US', TZ_OPT))
  return DAY_KEYS[sydneyDate.getDay()]
}

function generateSlotsFromConfig(
  date: string,
  dayCfg: DayHours,
  durationMin: number,
  capacity: number,
  dbSlots: TimeSlot[],
): TimeSlot[] {
  const openMin  = timeToMin(dayCfg.open)
  const closeMin = timeToMin(dayCfg.close)
  const slots: TimeSlot[] = []

  for (let start = openMin; start + durationMin <= closeMin; start += durationMin) {
    const startTime = minToTime(start)
    const endTime   = minToTime(start + durationMin)
    const id        = `gen-${date}-${startTime.replace(':', '')}`

    // Merge with DB slot if one exists for this exact time
    const dbSlot = dbSlots.find(s => s.startTime === startTime)

    const confirmed = dbSlot?.confirmed ?? 0
    const held      = dbSlot?.held      ?? 0
    const busyness  = confirmed >= capacity
      ? 'full'
      : confirmed / capacity >= 0.6 ? 'busy' : 'available'

    slots.push({
      id:        dbSlot?.id ?? id,
      date,
      startTime,
      endTime,
      capacity,
      confirmed,
      held,
      busyness:  busyness as TimeSlot['busyness'],
    })
  }
  return slots
}

function groupSlotsByPeriods(slots: TimeSlot[], periods: PeriodConfig) {
  const groups: { period: PeriodDef; key: string; slots: TimeSlot[] }[] = []

  for (const [key, period] of Object.entries(periods) as [string, PeriodDef][]) {
    if (!period.enabled) continue
    const periodSlots = slots.filter(s =>
      s.startTime >= period.start && s.startTime < period.end
    )
    if (periodSlots.length > 0) {
      groups.push({ period, key, slots: periodSlots })
    }
  }

  // Any slots not covered by a period → append at end
  const covered = new Set(groups.flatMap(g => g.slots.map(s => s.id)))
  const uncovered = slots.filter(s => !covered.has(s.id))
  if (uncovered.length > 0) {
    groups.push({
      key: 'other',
      period: { enabled: true, label: 'Other Slots', start: '00:00', end: '24:00' },
      slots: uncovered,
    })
  }

  return groups
}

// ─── Date strip ───────────────────────────────────────────────────────────────

function calendarDays(n: number) {
  const days = []
  const todayIso = todaySydney()
  const startMs = new Date(new Date().toLocaleString('en-US', TZ_OPT)).setHours(0, 0, 0, 0)
  let ms = startMs
  while (days.length < n) {
    const d   = new Date(ms)
    const iso = d.toLocaleDateString('sv-SE', TZ_OPT)
    days.push({
      iso,
      isToday: iso === todayIso,
      dayFull: d.toLocaleDateString('en-AU', { weekday: 'long',    timeZone: TZ }),
      num:     d.toLocaleDateString('en-AU', { day: 'numeric',     timeZone: TZ }),
      dayKey:  DAY_KEYS[new Date(new Date(iso + 'T12:00:00').toLocaleString('en-US', TZ_OPT)).getDay()],
    })
    ms += 86400000
  }
  return days
}

// DATES is now computed dynamically inside the component from tenant config

// Period icon mapping
const PERIOD_ICONS: Record<string, string> = {
  morning:   ICONS.bell,
  afternoon: ICONS.clock,
  evening:   ICONS.star,
  other:     ICONS.calendar,
}

// ─── Main component ────────────────────────────────────────────────────────────

export function Step4ShipmentDetails() {
  const { state, dispatch } = useWizard()
  const [applyAll, setApplyAll] = useState(false)

  // Tenant config — loaded once on mount
  const [tenant,        setTenant]        = useState<TenantRow | null>(null)
  const [tenantLoading, setTenantLoading] = useState(true)

  useEffect(() => {
    getTenant(DEFAULT_TENANT_ID)
      .then(t => setTenant(t ?? null))
      .catch(() => setTenant(null))
      .finally(() => setTenantLoading(false))
  }, [])

  const multi = state.slotCount > 1

  // ── Single-slot: existing state-driven slot loading ────────────────────────
  useEffect(() => {
    if (multi || !state.selectedDate || tenantLoading) return
    let cancelled = false
    dispatch({ type: 'SET_SLOTS', slots: [], loading: true })
    const wh     = tenant?.working_hours as unknown as WorkingHoursConfig | null
    const dayKey = getDayKey(state.selectedDate)
    const dayCfg = wh?.[dayKey]
    if (dayCfg && !dayCfg.enabled) {
      if (!cancelled) dispatch({ type: 'SET_SLOTS', slots: [], loading: false })
      return
    }
    const durationMin = tenant?.slot_duration_min     ?? 60
    const capacity    = tenant?.max_bookings_per_slot ?? 10
    getSlotsByDate(state.selectedDate)
      .then(dbSlots => {
        if (cancelled) return
        const slots: TimeSlot[] = dayCfg?.enabled && dayCfg.open && dayCfg.close
          ? generateSlotsFromConfig(state.selectedDate, dayCfg, durationMin, capacity, dbSlots)
          : dbSlots.map(s => ({ ...s, capacity: s.capacity > 0 ? s.capacity : capacity }))
        dispatch({ type: 'SET_SLOTS', slots, loading: false })
      })
      .catch(() => { if (!cancelled) dispatch({ type: 'SET_SLOTS', slots: [], loading: false }) })
    return () => { cancelled = true }
  }, [state.selectedDate, tenant, tenantLoading, multi]) // eslint-disable-line react-hooks/exhaustive-deps

  const wh       = tenant?.working_hours as unknown as WorkingHoursConfig | null
  const periods: PeriodConfig = {
    morning:   { ...(wh?.periods?.morning   ?? DEFAULT_PERIODS.morning)   },
    afternoon: { ...(wh?.periods?.afternoon ?? DEFAULT_PERIODS.afternoon) },
    evening:   { ...(wh?.periods?.evening   ?? DEFAULT_PERIODS.evening)   },
  }
  const advanceDays        = tenant?.advance_booking_days ?? 14
  const cutoff             = tenant?.same_day_cutoff_time ?? null
  const isTodayPastCutoff  = (() => {
    if (!cutoff) return false
    const now = new Date(); const [ch, cm] = cutoff.split(':').map(Number)
    return now.getHours() * 60 + now.getMinutes() >= ch * 60 + cm
  })()
  const dates = calendarDays(advanceDays)

  // ── Single-slot UI (unchanged) ─────────────────────────────────────────────
  if (!multi) {
    const selectSlot = (slot: TimeSlot) =>
      dispatch({ type: 'SELECT_SLOT', slotId: slot.id, label: `${slot.startTime} – ${slot.endTime}` })
    const slotGroups   = groupSlotsByPeriods(state.slots, periods)
    const isLoading    = state.slotsLoading || tenantLoading
    return (
      <div>
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1C1917', letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 8 }}>Pick Date &amp; Time</h2>
          <p style={{ fontSize: 14, color: '#4F4F4F', lineHeight: 1.5 }}>Select a date and time slot and please ensure your vehicle arrives within the chosen window to avoid delays.</p>
        </div>
        <DateStrip dates={dates} selectedDate={state.selectedDate} wh={wh} cutoff={cutoff} isTodayPastCutoff={isTodayPastCutoff}
          onSelect={iso => dispatch({ type: 'SELECT_DATE', date: iso })} />
        {isLoading && <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF', fontSize: 14 }}>Loading slots…</div>}
        {!isLoading && state.slots.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 8, padding: '48px 0', color: '#9CA3AF' }}>
            <Icon name={ICONS.calendar} size={32} style={{ opacity: 0.35 }} />
            <p style={{ fontSize: 14 }}>No slots available for this date.</p>
          </div>
        )}
        {!isLoading && slotGroups.map(({ key, period, slots }) => (
          <SlotGroup key={key} label={period.label} icon={PERIOD_ICONS[key] ?? ICONS.clock}
            slots={slots} selectedId={state.selectedSlotId} onSelect={selectSlot} />
        ))}
      </div>
    )
  }

  // ── Multi-slot UI ──────────────────────────────────────────────────────────
  const dispatchSlotDetail = (slotIndex: number, field: string, value: any) =>
    dispatch({ type: 'SET_SLOT_DETAIL', slotIndex, field, value })

  const handleSlotSelect = (slotIndex: number, slot: TimeSlot) => {
    const label = `${slot.startTime} – ${slot.endTime}`
    if (applyAll) {
      for (const cfg of state.slotConfigs) {
        dispatchSlotDetail(cfg.index, 'selectedSlotId',    slot.id)
        dispatchSlotDetail(cfg.index, 'selectedSlotLabel', label)
      }
    } else {
      dispatchSlotDetail(slotIndex, 'selectedSlotId',    slot.id)
      dispatchSlotDetail(slotIndex, 'selectedSlotLabel', label)
    }
  }

  const handleDateSelect = (slotIndex: number, iso: string) => {
    if (applyAll) {
      for (const cfg of state.slotConfigs) {
        dispatchSlotDetail(cfg.index, 'selectedDate',      iso)
        dispatchSlotDetail(cfg.index, 'selectedSlotId',    null)
        dispatchSlotDetail(cfg.index, 'selectedSlotLabel', '')
      }
    } else {
      dispatchSlotDetail(slotIndex, 'selectedDate',      iso)
      dispatchSlotDetail(slotIndex, 'selectedSlotId',    null)
      dispatchSlotDetail(slotIndex, 'selectedSlotLabel', '')
    }
  }

  const panelSlotConfigs = applyAll ? [state.slotConfigs[0]] : state.slotConfigs

  return (
    <div>
      {/* Header + Apply All toggle */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1C1917', letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 8 }}>Pick Date &amp; Time</h2>
          <p style={{ fontSize: 14, color: '#4F4F4F', lineHeight: 1.5 }}>Select a date and time slot for each booking.</p>
        </div>
        <ApplyAllToggle on={applyAll} onToggle={() => setApplyAll(v => !v)} slotCount={state.slotCount} field="date &amp; time" />
      </div>

      {panelSlotConfigs.map(cfg => (
        <div key={cfg.index} style={{ marginBottom: 36 }}>
          {!applyAll && (
            <p style={{ fontSize: 12, fontWeight: 700, color: '#78716C', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>
              Slot {cfg.index}
            </p>
          )}
          <SlotPickerForSlot
            slotIndex={cfg.index}
            tenant={tenant}
            tenantLoading={tenantLoading}
            dates={dates}
            wh={wh}
            cutoff={cutoff}
            isTodayPastCutoff={isTodayPastCutoff}
            periods={periods}
            onDateSelect={iso => handleDateSelect(cfg.index, iso)}
            onSlotSelect={slot => handleSlotSelect(cfg.index, slot)}
          />
        </div>
      ))}
    </div>
  )
}

// ─── Apply-all toggle (same pattern as Steps 2/3) ─────────────────────────────
function ApplyAllToggle({ on, onToggle, slotCount, field }: { on: boolean; onToggle: () => void; slotCount: number; field: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <button type="button" onClick={onToggle}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 9999,
          background: on ? 'rgba(252,101,20,0.10)' : 'rgba(0,0,0,0.06)',
          border: `1.5px solid ${on ? 'rgba(252,101,20,0.30)' : 'rgba(0,0,0,0.12)'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
        <span style={{ position: 'relative', width: 28, height: 16, borderRadius: 9999, background: on ? 'var(--brand-color,#FC6514)' : '#D1D5DB', display: 'inline-block', flexShrink: 0, transition: 'background 0.15s' }}>
          <span style={{ position: 'absolute', top: 2, left: on ? 14 : 2, width: 12, height: 12, borderRadius: 9999, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.18)', transition: 'left 0.15s' }} />
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: on ? 'var(--brand-color,#FC6514)' : '#6B7280', whiteSpace: 'nowrap' }}>Apply to all bookings</span>
      </button>
      <span style={{ fontSize: 11, color: '#A8A29E' }}>
        {on ? `Same ${field} for all ${slotCount} bookings` : `Use the same ${field} for all ${slotCount} bookings`}
      </span>
    </div>
  )
}

// ─── Per-slot date/time picker ─────────────────────────────────────────────────
function SlotPickerForSlot({ slotIndex, tenant, tenantLoading, dates, wh, cutoff, isTodayPastCutoff, periods, onDateSelect, onSlotSelect }: {
  slotIndex:           number
  tenant:              TenantRow | null
  tenantLoading:       boolean
  dates:               ReturnType<typeof calendarDays>
  wh:                  WorkingHoursConfig | null
  cutoff:              string | null
  isTodayPastCutoff:   boolean
  periods:             PeriodConfig
  onDateSelect:        (iso: string) => void
  onSlotSelect:        (slot: TimeSlot) => void
}) {
  const { state } = useWizard()
  const cfg = state.slotConfigs.find(c => c.index === slotIndex)!

  const [slots,   setSlots]   = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)

  const cancelRef = useRef<boolean>(false)

  useEffect(() => {
    if (!cfg.selectedDate || tenantLoading) return
    cancelRef.current = false
    setLoading(true)
    setSlots([])
    const dayKey = getDayKey(cfg.selectedDate)
    const dayCfg = wh?.[dayKey]
    const durationMin = tenant?.slot_duration_min     ?? 60
    const capacity    = tenant?.max_bookings_per_slot ?? 10
    if (dayCfg && !dayCfg.enabled) { setLoading(false); return }
    getSlotsByDate(cfg.selectedDate)
      .then(dbSlots => {
        if (cancelRef.current) return
        const generated: TimeSlot[] = dayCfg?.enabled && dayCfg.open && dayCfg.close
          ? generateSlotsFromConfig(cfg.selectedDate, dayCfg, durationMin, capacity, dbSlots)
          : dbSlots.map(s => ({ ...s, capacity: s.capacity > 0 ? s.capacity : capacity }))
        setSlots(generated)
      })
      .catch(() => {})
      .finally(() => { if (!cancelRef.current) setLoading(false) })
    return () => { cancelRef.current = true }
  }, [cfg.selectedDate, tenant, tenantLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const slotGroups = groupSlotsByPeriods(slots, periods)

  return (
    <div>
      <DateStrip dates={dates} selectedDate={cfg.selectedDate} wh={wh} cutoff={cutoff} isTodayPastCutoff={isTodayPastCutoff} onSelect={onDateSelect} />
      {loading && <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF', fontSize: 14 }}>Loading slots…</div>}
      {!loading && slots.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '32px 0', color: '#9CA3AF' }}>
          <Icon name={ICONS.calendar} size={24} style={{ opacity: 0.35 }} />
          <p style={{ fontSize: 14 }}>No slots available for this date.</p>
        </div>
      )}
      {!loading && slotGroups.map(({ key, period, slots: gs }) => (
        <SlotGroup key={key} label={period.label} icon={PERIOD_ICONS[key] ?? ICONS.clock}
          slots={gs} selectedId={cfg.selectedSlotId} onSelect={onSlotSelect} />
      ))}
    </div>
  )
}

// ─── Date strip (extracted for reuse) ────────────────────────────────────────
function DateStrip({ dates, selectedDate, wh, cutoff, isTodayPastCutoff, onSelect }: {
  dates: ReturnType<typeof calendarDays>
  selectedDate: string
  wh: WorkingHoursConfig | null
  cutoff: string | null
  isTodayPastCutoff: boolean
  onSelect: (iso: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 32, overflowX: 'auto', paddingBottom: 4 }}>
      {dates.map(d => {
        const sel            = selectedDate === d.iso
        const dayCfg         = wh?.[d.dayKey]
        const closedDay      = dayCfg ? !dayCfg.enabled : false
        const cutoffDisabled = d.isToday && isTodayPastCutoff
        const disabled       = closedDay || cutoffDisabled
        return (
          <button key={d.iso} type="button"
            onClick={() => {
              if (cutoffDisabled) toast(`Same-day booking unavailable after ${cutoff}`, 'info')
              else if (closedDay) toast(`${d.dayFull} is not a working day — no slots available.`, 'info')
              else onSelect(d.iso)
            }}
            style={{ flex: '0 0 80px', width: 80, height: 96, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '12px 4px 10px', borderRadius: 12, textAlign: 'center', transition: 'all 0.18s ease', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.38 : 1, border: `1.5px solid ${sel ? 'var(--brand-color)' : '#8B8B8B'}`, background: sel ? 'rgba(var(--brand-rgb),0.06)' : '#fff', boxShadow: sel ? '0 0 0 1px var(--brand-color),0 4px 14px rgba(var(--brand-rgb),0.18)' : 'none' }}>
            <p style={{ fontSize: 11, fontWeight: sel ? 700 : 500, marginBottom: 6, color: sel ? 'var(--brand-color)' : '#101010', transition: 'all 0.18s ease', width: '100%', overflow: 'visible', textOverflow: 'clip', whiteSpace: 'nowrap' }}>{d.dayFull}</p>
            <p className="slot-num" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: '#101010' }}>{d.num}</p>
            <div style={{ height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
              {d.isToday && cutoffDisabled && cutoff ? <p style={{ fontSize: 9, color: '#EF4444', lineHeight: 1.2, margin: 0 }}>After {cutoff}</p>
                : d.isToday ? <div style={{ width: 5, height: 5, borderRadius: 9999, background: 'var(--brand-color)' }} /> : null}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function SlotGroup({ label, icon, slots, selectedId, onSelect }: {
  label: string; icon: string; slots: TimeSlot[]; selectedId: string | null; onSelect: (s: TimeSlot) => void
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Icon name={icon} size={18} style={{ color: 'var(--brand-color)', flexShrink: 0 }} />
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1C1917' }}>{label}</h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {slots.map(slot => {
          const full      = slot.busyness === 'full' || slot.busyness === 'closed'
          const selected  = slot.id === selectedId
          const remaining = Math.max(0, slot.capacity - slot.confirmed - slot.held)
          const remainColor = full ? '#EF4444' : remaining === 0 ? '#EF4444' : remaining <= 5 ? 'var(--brand-color)' : '#16A34A'

          return (
            <button
              key={slot.id}
              type="button"
              disabled={full}
              onClick={() => !full && onSelect(slot)}
              style={{
                width: '100%', position: 'relative', display: 'flex', flexDirection: 'column',
                padding: 16, borderRadius: 16, textAlign: 'left', transition: 'all 0.18s ease',
                background: selected ? 'rgba(var(--brand-rgb),0.05)' : '#fff',
                border: `1.5px solid ${selected ? 'var(--brand-color)' : '#C8C8C8'}`,
                boxShadow: selected ? '0 0 0 1px var(--brand-color),0 4px 14px rgba(var(--brand-rgb),0.12)' : 'none',
                cursor: full ? 'not-allowed' : 'pointer',
                opacity: full ? 0.45 : 1,
                boxSizing: 'border-box',
              }}
            >
              <p className="slot-num" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 10, color: full ? '#EF4444' : '#1C1917' }}>
                {slot.startTime}
              </p>

              {selected ? (
                <div style={{ marginTop: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 9999, background: 'var(--brand-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-color)' }}>Selected</span>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 13, fontWeight: 500, marginTop: 'auto', color: remainColor }}>
                  {full ? 'All Spots Booked' : `${remaining} Spots available`}
                </p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
