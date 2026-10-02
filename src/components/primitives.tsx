import type { ReactNode } from 'react'
import { Icon } from './Icon'

export function Pill({
  tone = 'dim',
  children,
  mono = false,
  title,
}: {
  tone?: 'ok' | 'warn' | 'bad' | 'accent' | 'dim'
  children: ReactNode
  mono?: boolean
  title?: string
}) {
  const cls = ['pill', tone === 'dim' ? '' : tone, mono ? 'mono' : ''].filter(Boolean).join(' ')
  return (
    <span className={cls} title={title}>
      {children}
    </span>
  )
}

export function StatusPill({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <Pill tone={ok ? 'ok' : 'bad'}>
      <i className={`dot ${ok ? 'pulse' : ''}`} />
      {label ?? (ok ? 'online' : 'offline')}
    </Pill>
  )
}

export function Bar({ pct, tone = 'accent' }: { pct: number; tone?: 'ok' | 'warn' | 'bad' | 'accent' }) {
  const cls = tone === 'accent' ? 'bar' : `bar ${tone}`
  return (
    <div className={cls}>
      <i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}

export function toneFor(pct: number): 'ok' | 'warn' | 'bad' {
  if (pct >= 90) return 'bad'
  if (pct >= 75) return 'warn'
  return 'ok'
}

export function Metric({
  label,
  value,
  sub,
  bar,
  tone = 'accent',
  icon,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  bar?: number
  tone?: 'ok' | 'warn' | 'bad' | 'accent'
  icon?: string
}) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row" style={{ marginBottom: 6 }}>
        {icon && <Icon name={icon} size={12} style={{ color: 'var(--text-4)' }} />}
        <span className="label">{label}</span>
      </div>
      <div className="t-metric">{value}</div>
      {bar != null && (
        <div style={{ marginTop: 8 }}>
          <Bar pct={bar} tone={tone} />
        </div>
      )}
      {sub && (
        <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

export function KV({ k, v, mono = true }: { k: ReactNode; v: ReactNode; mono?: boolean }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', gap: 12, padding: '3px 0' }}>
      <span className="muted" style={{ fontSize: 12 }}>
        {k}
      </span>
      <span className={mono ? 'num' : ''} style={{ fontSize: 12, textAlign: 'right' }}>
        {v}
      </span>
    </div>
  )
}

export function CardHead({
  title,
  right,
  icon,
}: {
  title: ReactNode
  right?: ReactNode
  icon?: string
}) {
  return (
    <div className="card-head">
      {icon && <Icon name={icon} size={13} style={{ color: 'var(--text-3)' }} />}
      <span className="title">{title}</span>
      {right && <span className="right">{right}</span>}
    </div>
  )
}

export function Skeleton({ h = 12, w = '100%', style }: { h?: number; w?: number | string; style?: React.CSSProperties }) {
  return <div className="skel" style={{ height: h, width: w, ...style }} />
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="section-title">{children}</div>
}

export function EmptyBox({ children }: { children: ReactNode }) {
  return <div className="empty-box">{children}</div>
}
