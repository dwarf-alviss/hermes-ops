import { useMemo, useRef, useState } from 'react'

export type Series = { t: number; v: number }

/**
 * Линейный график с осями, сеткой и hover-курсором.
 * Сознательно без библиотеки: точек ≤ 300, нужен полный контроль над стилем.
 */
export function LineChart({
  data,
  color = '#7170ff',
  height = 96,
  max,
  min = 0,
  unit = '',
  invert = false,
  formatValue,
  formatTime,
  showAxis = true,
}: {
  data: Series[]
  color?: string
  height?: number
  max?: number
  min?: number
  unit?: string
  invert?: boolean
  formatValue?: (v: number) => string
  formatTime?: (t: number) => string
  showAxis?: boolean
}) {
  const W = 600
  const padTop = 6
  const padBottom = showAxis ? 16 : 2
  const H = height
  const [hover, setHover] = useState<number | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)

  const { path, area, points, hi, lo } = useMemo(() => {
    const vals = data.map((d) => d.v)
    const hiRaw = max ?? Math.max(...vals, 0.0001)
    const loRaw = Math.min(...vals, min)
    const hi = hiRaw === loRaw ? hiRaw + 1 : hiRaw
    const lo = loRaw
    const innerH = H - padTop - padBottom
    const step = data.length > 1 ? W / (data.length - 1) : W
    const pts = data.map((d, i) => {
      const frac = (d.v - lo) / (hi - lo)
      const y = padTop + (1 - (invert ? 1 - frac : frac)) * innerH
      return { x: i * step, y, t: d.t, v: d.v }
    })
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    return {
      path: line,
      area: pts.length ? `${line} L${pts[pts.length - 1].x.toFixed(1)},${H - padBottom} L0,${H - padBottom} Z` : '',
      points: pts,
      hi,
      lo,
    }
  }, [data, H, max, min, invert, showAxis])

  const fmtV = formatValue ?? ((v: number) => `${Math.round(v)}`)
  const fmtT = formatTime ?? ((t: number) => new Date(t * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))
  const gridY = [0.25, 0.5, 0.75]
  const hoverPoint = hover != null ? points[hover] : null
  const id = useMemo(() => `g${Math.random().toString(36).slice(2, 7)}`, [])

  if (!data.length) {
    return (
      <div className="empty" style={{ padding: '18px 0' }}>
        нет данных
      </div>
    )
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const xr = ((e.clientX - rect.left) / rect.width) * W
          const step = points.length > 1 ? W / (points.length - 1) : W
          const idx = Math.max(0, Math.min(points.length - 1, Math.round(xr / step)))
          setHover(idx)
        }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridY.map((g) => (
          <line
            key={g}
            x1={0}
            x2={W}
            y1={padTop + g * (H - padTop - padBottom)}
            y2={padTop + g * (H - padTop - padBottom)}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />
        ))}

        <path d={area} fill={`url(#${id})`} stroke="none" />
        <path d={path} fill="none" stroke={color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />

        {hoverPoint && (
          <>
            <line x1={hoverPoint.x} x2={hoverPoint.x} y1={padTop} y2={H - padBottom} stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
            <circle cx={hoverPoint.x} cy={hoverPoint.y} r={2.6} fill={color} stroke="#08090a" strokeWidth={1.4} />
          </>
        )}
      </svg>

      {showAxis && (
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 2 }}>
          <span className="label">{fmtT(data[0].t)}</span>
          <span className="label">
            {fmtV(lo)}
            {unit} — {fmtV(hi)}
            {unit}
          </span>
          <span className="label">{fmtT(data[data.length - 1].t)}</span>
        </div>
      )}

      {hoverPoint && (
        <div
          className="chart-tip"
          style={{
            position: 'absolute',
            top: 0,
            left: `${(hover! / Math.max(1, points.length - 1)) * 100}%`,
            transform: `translate(${hover! > points.length / 2 ? '-105%' : '5%'}, 0)`,
          }}
        >
          {fmtV(hoverPoint.v)}
          {unit} · {fmtT(hoverPoint.t)}
        </div>
      )}
    </div>
  )
}
