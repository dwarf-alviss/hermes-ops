import { useMemo, useRef, useState } from 'react'

export type Series = { t: number; v: number }

/**
 * Линейный график с осью Y, сеткой и hover-курсором.
 * Без библиотеки: точек ≤ 300, нужен полный контроль над стилем.
 * autoZoom: если реальные значения сильно ниже заданного max (например, RAM 20% при max=100),
 * шкала подстраивается под данные, а в подписи остаётся фактический диапазон.
 */
export function LineChart({
  data,
  color = '#7170ff',
  height = 96,
  max,
  min = 0,
  unit = '',
  formatValue,
  formatTime,
  showAxis = true,
  autoZoom = true,
}: {
  data: Series[]
  color?: string
  height?: number
  max?: number
  min?: number
  unit?: string
  formatValue?: (v: number) => string
  formatTime?: (t: number) => string
  showAxis?: boolean
  autoZoom?: boolean
}) {
  const W = 600
  const padTop = 6
  const padBottom = 2
  const H = height
  const [hover, setHover] = useState<number | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)

  const { path, area, points, hi, lo } = useMemo(() => {
    const vals = data.map((d) => d.v)
    const dataMax = vals.length ? Math.max(...vals) : 1
    const dataMin = vals.length ? Math.min(...vals) : 0
    const zoom = autoZoom && max != null && dataMax < max * 0.5
    let hiRaw = max ?? dataMax * 1.15
    let loRaw = min
    if (zoom) {
      hiRaw = Math.max(dataMax * 1.1, dataMin + (dataMax - dataMin) * 0.3, 1)
      loRaw = Math.max(0, dataMin - (dataMax - dataMin) * 0.25)
    }
    if (hiRaw === loRaw) hiRaw = loRaw + 1
    const innerH = H - padTop - padBottom
    const step = data.length > 1 ? W / (data.length - 1) : W
    const pts = data.map((d, i) => {
      const frac = (d.v - loRaw) / (hiRaw - loRaw)
      return { x: i * step, y: padTop + (1 - Math.max(0, Math.min(1, frac))) * innerH, t: d.t, v: d.v }
    })
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    const spread = hiRaw - loRaw
    return {
      path: line,
      // почти плоская линия (диск, swap) не заливается — иначе график выглядит как плашка
      area:
        pts.length && spread > (max ?? 100) * 0.03
          ? `${line} L${pts[pts.length - 1].x.toFixed(1)},${H - padBottom} L0,${H - padBottom} Z`
          : '',
      points: pts,
      hi: hiRaw,
      lo: loRaw,
    }
  }, [data, H, max, min, autoZoom])

  const fmtV = formatValue ?? ((v: number) => (v >= 100 ? String(Math.round(v)) : v.toFixed(v < 10 ? 1 : 0)))
  const fmtT = formatTime ?? ((t: number) => new Date(t * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))
  const hoverPoint = hover != null ? points[hover] : null
  const id = useMemo(() => `g${Math.random().toString(36).slice(2, 7)}`, [])

  if (!data.length) {
    return (
      <div className="empty" style={{ padding: '18px 0' }}>
        нет данных
      </div>
    )
  }

  const midIdx = Math.floor(points.length / 2)

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {showAxis && (
          <div className="chart-axis-y" style={{ height: H }}>
            <span>{fmtV(hi)}{unit}</span>
            <span>{fmtV((hi + lo) / 2)}{unit}</span>
            <span>{fmtV(lo)}{unit}</span>
          </div>
        )}

        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          preserveAspectRatio="none"
          style={{ overflow: 'visible' }}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
            const xr = ((e.clientX - rect.left) / rect.width) * W
            const step = points.length > 1 ? W / (points.length - 1) : W
            setHover(Math.max(0, Math.min(points.length - 1, Math.round(xr / step))))
          }}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.24" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 0.5, 1].map((g) => (
            <line
              key={g}
              x1={0}
              x2={W}
              y1={padTop + g * (H - padTop - padBottom)}
              y2={padTop + g * (H - padTop - padBottom)}
              stroke="rgba(255,255,255,0.09)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <path d={area} fill={`url(#${id})`} stroke="none" />
          <path d={path} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />

          {hoverPoint && (
            <>
              <line
                x1={hoverPoint.x}
                x2={hoverPoint.x}
                y1={padTop}
                y2={H - padBottom}
                stroke="rgba(255,255,255,0.28)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={hoverPoint.x} cy={hoverPoint.y} r={2.8} fill={color} stroke="#08090a" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
      </div>

      {showAxis && (
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 3, paddingLeft: 34 }}>
          <span className="label">{fmtT(data[0].t)}</span>
          <span className="label hide-mobile">{fmtT(data[midIdx].t)}</span>
          <span className="label">{fmtT(data[data.length - 1].t)}</span>
        </div>
      )}

      {hoverPoint && (
        <div
          className="chart-tip"
          style={{
            position: 'absolute',
            top: 0,
            left: `${34 + (hover! / Math.max(1, points.length - 1)) * 100}%`,
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
