import { useMemo } from 'react'

export function Meter({ pct, tone = 'acc' }: { pct: number; tone?: 'ok' | 'warn' | 'bad' | 'acc' }) {
  const t = tone === 'acc' ? 'acc' : tone
  return (
    <div className={`meter ${t}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}

export function Sparkline({
  points,
  color = '#5eead4',
  height = 40,
  max,
}: {
  points: number[]
  color?: string
  height?: number
  max?: number
}) {
  const w = 240
  const path = useMemo(() => {
    if (!points.length) return ''
    const hi = max ?? Math.max(...points, 1)
    const step = points.length > 1 ? w / (points.length - 1) : w
    return points
      .map((p, i) => {
        const x = i * step
        const y = height - (Math.max(0, Math.min(hi, p)) / hi) * (height - 4) - 2
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [points, height, max])

  if (!points.length) return <div className="tiny">нет данных</div>

  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" />
      <path d={`${path} L${w},${height} L0,${height} Z`} fill={color} opacity="0.09" stroke="none" />
    </svg>
  )
}

export function Badge({ tone, children }: { tone: 'ok' | 'bad' | 'warn' | 'dim'; children: React.ReactNode }) {
  const cls = tone === 'dim' ? 'badge' : `badge ${tone}`
  return (
    <span className={cls}>
      <i className="dot" />
      {children}
    </span>
  )
}
