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

  const periodEntries = Object.entries(periods) as [string, PeriodDef][]
  const lastKey = [...periodEntries].reverse().find(([, p]) => p.enabled)?.[0]

  for (const [key, period] of periodEntries) {
    if (!period.enabled) continue
    const isLast = key === lastKey
    const periodSlots = slots.filter(s =>
      s.startTime >= period.start && (isLast ? s.startTime <= period.end : s.startTime < period.end)
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

  // Tab state for multi-slot — start on first slot without a selection
  const firstIncomplete4 = state.slotConfigs.findIndex(c => !c.selectedSlotId)
  const [activeSlot, setActiveSlot] = useState(firstIncomplete4 === -1 ? 0 : firstIncomplete4)

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
          <SlotGroup key={key} label={period.label}
            slots={slots} selectedId={state.selectedSlotId} onSelect={selectSlot} />
        ))}
      </div>
    )
  }

  // ── Multi-slot UI ──────────────────────────────────────────────────────────
  const [applyAll, setApplyAll] = useState(false)

  const toggleApplyAll = (newVal: boolean) => {
    setApplyAll(newVal)
    if (!newVal) return
    const anySelected = state.slotConfigs.some(c => !!c.selectedSlotId)
    if (anySelected) {
      toast(`Same slot applied to all ${state.slotCount} bookings`, 'success')
    } else {
      toast("Select a slot — it'll apply to all bookings automatically", 'info')
    }
  }

  const dispatchSlotDetail = (slotIndex: number, field: string, value: any) =>
    dispatch({ type: 'SET_SLOT_DETAIL', slotIndex, field, value })

  const handleSlotSelect = (slotIndex: number, slot: TimeSlot) => {
    const label = `${slot.startTime} – ${slot.endTime}`
    if (applyAll) {
      for (const cfg of state.slotConfigs) {
        dispatchSlotDetail(cfg.index, 'selectedSlotId',    slot.id)
        dispatchSlotDetail(cfg.index, 'selectedSlotLabel', label)
      }
      toast(`Same slot applied to all ${state.slotCount} bookings`, 'success')
    } else {
      dispatchSlotDetail(slotIndex, 'selectedSlotId',    slot.id)
      dispatchSlotDetail(slotIndex, 'selectedSlotLabel', label)
    }
    // Auto-advance to next tab
    setActiveSlot(a => Math.min(a + 1, state.slotConfigs.length - 1))
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

  const activeCfg4 = state.slotConfigs[activeSlot]

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1C1917', letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 8 }}>Pick Date &amp; Time</h2>
          <p style={{ fontSize: 14, color: '#4F4F4F', lineHeight: 1.5 }}>Select a date and time slot for each booking.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <button
            type="button"
            onClick={() => toggleApplyAll(!applyAll)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '5px 12px', borderRadius: 9999,
              background: applyAll ? 'rgba(252,101,20,0.10)' : 'rgba(0,0,0,0.06)',
              border: `1.5px solid ${applyAll ? 'rgba(252,101,20,0.30)' : 'rgba(0,0,0,0.12)'}`,
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
            }}
          >
            <span style={{
              position: 'relative', width: 28, height: 16, borderRadius: 9999,
              background: applyAll ? 'var(--brand-color, #FC6514)' : '#D1D5DB',
              display: 'inline-block', flexShrink: 0, transition: 'background 0.15s',
            }}>
              <span style={{
                position: 'absolute', top: 2, left: applyAll ? 14 : 2,
                width: 12, height: 12, borderRadius: 9999,
                background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.18)', transition: 'left 0.15s',
              }} />
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: applyAll ? 'var(--brand-color, #FC6514)' : '#6B7280', whiteSpace: 'nowrap' }}>
              Apply to all bookings
            </span>
          </button>
          <span style={{ fontSize: 11, color: '#A8A29E' }}>
            {applyAll
              ? `Same time slot for all ${state.slotCount} bookings`
              : `Use the same time slot for all ${state.slotCount} bookings`}
          </span>
        </div>
      </div>

      {/* Tab bar */}
      {(() => {
        const allDone = state.slotConfigs.every(c => !!c.selectedSlotId)
        return (
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
            {state.slotConfigs.map((cfg, i) => {
              const done   = !!cfg.selectedSlotId
              const active = activeSlot === i
              const bg = active
                ? (allDone ? '#16A34A' : 'var(--brand-color, #FC6514)')
                : '#F3F4F6'
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveSlot(i)}
                  style={{
                    padding: '8px 20px', borderRadius: 999, border: 'none',
                    background: bg,
                    color: active ? '#fff' : '#6B7280',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                >
                  {done && (
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                      <path d="M1 5L4.5 8.5L11 1" stroke={active ? '#fff' : '#22C55E'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  Slot {i + 1}
                </button>
              )
            })}
          </div>
        )
      })()}

      {/* Active slot picker */}
      {activeCfg4 && (
        <SlotPickerForSlot
          slotIndex={activeCfg4.index}
          tenant={tenant}
          tenantLoading={tenantLoading}
          dates={dates}
          wh={wh}
          cutoff={cutoff}
          isTodayPastCutoff={isTodayPastCutoff}
          periods={periods}
          onDateSelect={iso => handleDateSelect(activeCfg4.index, iso)}
          onSlotSelect={slot => handleSlotSelect(activeCfg4.index, slot)}
        />
      )}
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
    <div style={{ overflowX: 'auto', overflowY: 'visible', marginBottom: 28 }}>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', paddingTop: 12, paddingBottom: 8, paddingRight: 12 }}>
      {dates.map(d => {
        const sel            = selectedDate === d.iso
        const dayCfg         = wh?.[d.dayKey]
        const closedDay      = dayCfg ? !dayCfg.enabled : false
        const cutoffDisabled = d.isToday && isTodayPastCutoff
        const disabled       = closedDay || cutoffDisabled
        // Short day name: MON, TUE, etc.
        const shortDay = d.dayFull.slice(0, 3).toUpperCase()
        return (
          <button key={d.iso} type="button"
            onClick={() => {
              if (cutoffDisabled) toast(`Same-day booking unavailable after ${cutoff}`, 'info')
              else if (closedDay) toast(`${d.dayFull} is not a working day — no slots available.`, 'info')
              else onSelect(d.iso)
            }}
            style={{
              position: 'relative', flex: '0 0 64px', width: 64,
              padding: '10px 0', borderRadius: 12, textAlign: 'center',
              transition: 'all 0.15s ease', cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.38 : 1,
              border: sel ? '2px solid var(--brand-color)' : '1.5px solid rgba(0,0,0,0.08)',
              background: sel ? 'rgba(252,101,20,0.04)' : '#fff',
              boxShadow: 'none', boxSizing: 'border-box',
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 600, color: sel ? 'var(--brand-color)' : '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              {shortDay}
            </p>
            <p style={{ fontSize: 22, fontWeight: 800, color: sel ? 'var(--brand-color)' : '#1C1917', lineHeight: 1, fontFamily: 'inherit' }}>
              {d.num}
            </p>
            {d.isToday && !cutoffDisabled && (
              <div style={{ width: 4, height: 4, borderRadius: 999, background: 'var(--brand-color)', margin: '6px auto 0' }} />
            )}
            {d.isToday && cutoffDisabled && cutoff && (
              <p style={{ fontSize: 9, color: '#EF4444', lineHeight: 1.2, margin: '4px 0 0' }}>After {cutoff}</p>
            )}
            {sel && (
              <div style={{ position: 'absolute', top: -7, right: -7, width: 18, height: 18, borderRadius: 999, background: 'var(--brand-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: 1 }}>✓</span>
              </div>
            )}
          </button>
        )
      })}
    </div>
    </div>
  )
}

function SlotGroup({ label, slots, selectedId, onSelect }: {
  label: string; icon?: string; slots: TimeSlot[]; selectedId: string | null; onSelect: (s: TimeSlot) => void
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      {/* Section header — clean label + thin divider, no icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 12px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#9CA3AF', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {slots.map(slot => {
          const full      = slot.busyness === 'full' || slot.busyness === 'closed'
          const selected  = slot.id === selectedId
          const available = Math.max(0, slot.capacity - slot.confirmed - slot.held)
          const fillPct   = slot.capacity > 0 ? ((slot.capacity - available) / slot.capacity) * 100 : 100
          const barColor  = available <= 2 ? '#EF4444' : 'var(--brand-color, #FC6514)'

          return (
            <button
              key={slot.id}
              type="button"
              disabled={full}
              onClick={() => !full && onSelect(slot)}
              style={{
                width: '100%', position: 'relative', display: 'flex', flexDirection: 'column',
                padding: '14px 18px', borderRadius: 12, textAlign: 'left',
                transition: 'all 0.15s ease', boxSizing: 'border-box', fontFamily: 'inherit',
                border: selected ? '2px solid var(--brand-color)' : '1.5px solid rgba(0,0,0,0.08)',
                background: full ? '#FAFAFA' : selected ? 'rgba(252,101,20,0.03)' : '#fff',
                cursor: full ? 'not-allowed' : 'pointer',
                opacity: full ? 0.5 : 1,
              }}
            >
              {/* Time + check/full indicator */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: full ? '#9CA3AF' : '#1C1917' }}>
                  {slot.startTime}
                </span>
                {selected && (
                  <div style={{ width: 20, height: 20, borderRadius: 999, background: 'var(--brand-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="10" height="8" viewBox="0 0 12 10" fill="none">
                      <path d="M1 5L4.5 8.5L11 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
                {full && !selected && <span style={{ fontSize: 11, fontWeight: 600, color: '#EF4444' }}>Full</span>}
              </div>
              {/* Capacity bar */}
              <div style={{ height: 3, borderRadius: 999, background: '#F3F4F6', marginBottom: 6 }}>
                <div style={{ height: '100%', borderRadius: 999, width: `${fillPct}%`, background: barColor, transition: 'width 0.2s' }} />
              </div>
              {/* Spots label */}
              <span style={{ fontSize: 11, color: full ? '#EF4444' : available <= 2 ? '#EF4444' : '#6B7280', fontWeight: 500 }}>
                {full ? 'No spots available' : `${available} spot${available !== 1 ? 's' : ''} left`}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
