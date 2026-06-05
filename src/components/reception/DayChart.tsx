import { useEffect, useRef } from 'react'
import type { Booking } from '@/data/types'

declare const echarts: any

const HOURS = ['07','08','09','10','11','12','13','14','15','16','17']

interface Props {
  bookings: Booking[]
  loading?: boolean
}

export function DayChart({ bookings, loading }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  const scheduled = HOURS.map(h => bookings.filter(b => b.slotStartTime.startsWith(h) && b.status === 'scheduled').length)
  const checkedIn = HOURS.map(h => bookings.filter(b => b.slotStartTime.startsWith(h) && (b.status === 'checked_in' || b.status === 'completed')).length)

  useEffect(() => {
    if (!ref.current) return
    let chart: any

    const init = () => {
      if (typeof echarts === 'undefined') { setTimeout(init, 100); return }
      if (!ref.current) return
      chart = echarts.init(ref.current, null, { renderer: 'svg' })
      chart.setOption({
        animation: false,
        grid: { top: 12, right: 12, bottom: 52, left: 32, containLabel: false },
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(28,25,23,0.88)',
          borderColor: 'transparent',
          textStyle: { color: '#FCFBF8', fontFamily: 'Inter,ui-sans-serif,sans-serif', fontSize: 12 },
          axisPointer: { type: 'shadow' },
        },
        legend: {
          bottom: 0, left: 'center',
          itemWidth: 10, itemHeight: 10,
          textStyle: { color: '#A8A29E', fontFamily: 'Inter,ui-sans-serif,sans-serif', fontSize: 11 },
          icon: 'circle',
        },
        xAxis: {
          type: 'category',
          data: HOURS.map(h => `${h}:00`),
          axisLine: { lineStyle: { color: 'rgba(214,211,209,0.5)' } },
          axisTick: { show: false },
          axisLabel: { color: '#A8A29E', fontFamily: 'Inter,ui-sans-serif,sans-serif', fontSize: 11 },
        },
        yAxis: {
          type: 'value', minInterval: 1,
          splitLine: { lineStyle: { color: 'rgba(0,0,0,0.06)', type: 'dashed' } },
          axisLabel: { color: '#A8A29E', fontFamily: 'Inter,ui-sans-serif,sans-serif', fontSize: 11 },
        },
        series: [
          {
            name: 'Scheduled', type: 'bar', stack: 'day', data: scheduled, barMaxWidth: 28,
            itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(252,101,20,0.55)' }, { offset: 1, color: 'rgba(252,101,20,0.15)' }] }, borderRadius: [4, 4, 0, 0] },
          },
          {
            name: 'On Site', type: 'bar', stack: 'day', data: checkedIn, barMaxWidth: 28,
            itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#FC6514' }, { offset: 1, color: '#FC8A3C' }] }, borderRadius: [4, 4, 0, 0] },
          },
        ],
      })
      const onResize = () => chart?.resize()
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }
    init()
    return () => chart?.dispose()
  }, [bookings.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14, padding: '18px 20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04),0 4px 20px rgba(0,0,0,0.07)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: '#1C1917', letterSpacing: '-0.01em' }}>Day at a Glance</h2>
        <span style={{ fontSize: 11, color: '#A8A29E' }}>Today · hourly schedule</span>
      </div>
      {loading ? (
        <div style={{ height: 160, display: 'flex', alignItems: 'flex-end', gap: 6, padding: '0 4px' }}>
          {[40,65,30,80,55,45,70,35,60,50,25].map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '4px 4px 0 0', background: 'rgba(0,0,0,0.07)', animation: 'dash-pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.07}s` }} />
          ))}
          <style>{`@keyframes dash-pulse{0%,100%{opacity:1}50%{opacity:0.45}}`}</style>
        </div>
      ) : (
        <div ref={ref} style={{ height: 160, width: '100%' }} />
      )}
    </div>
  )
}
