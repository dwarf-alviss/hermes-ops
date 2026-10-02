import { useState } from 'react'
import { LineChart } from '../components/Chart'
import { Icon } from '../components/Icon'
import { Bar, CardHead, Pill, StatusPill, toneFor } from '../components/primitives'
import { fmtAgo, fmtDuration, fmtMB } from '../lib/format'
import type { StatusPayload } from '../lib/types'

const RANGES = [
  { id: '1h', label: '1 час', sec: 3600 },
  { id: '6h', label: '6 часов', sec: 6 * 3600 },
  { id: '24h', label: '24 часа', sec: 24 * 3600 },
] as const

export default function Machines({ data }: { data: StatusPayload }) {
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('6h')
  const hosts = Object.entries(data.hosts)
  const sec = RANGES.find((r) => r.id === range)!.sec
  const since = Math.floor(Date.now() / 1000) - sec
  const allPoints = Object.values(data.history).flatMap((h) => h.map((p) => p.t))
  const histSpanMin = allPoints.length > 1 ? Math.round((Math.max(...allPoints) - Math.min(...allPoints)) / 60) : 0

  if (!hosts.length) {
    return <div className="empty-box">Коллектор ещё не отдал данные по машинам</div>
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="label">период графиков</span>
        <div className="row gap-4">
          {RANGES.map((r) => (
            <button key={r.id} className={`btn sm ${range === r.id ? 'primary' : 'ghost'}`} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <span className="dim" style={{ fontSize: 11 }}>
          история: {histSpanMin} мин{histSpanMin < sec / 60 ? ' (собирается дальше)' : ''}
        </span>
      </div>

      {hosts.map(([key, h]) => {
        const hist = (data.history[key] ?? []).filter((p) => p.t >= since)
        return (
          <div className="card" key={key} style={{ marginBottom: 12 }}>
            <div className="card-head">
              <StatusPill ok={h.online} />
              <span className="title">{h.name}</span>
              <span className="right">
                <Pill mono>{h.kind}</Pill>
                <Pill mono>uptime {fmtDuration(h.uptime_s)}</Pill>
                {!h.online && <Pill tone="bad">молчит {fmtAgo(h.last_seen)}</Pill>}
              </span>
            </div>

            <div className="grid metrics" style={{ marginBottom: 12 }}>
              <div className="card" style={{ padding: 10 }}>
                <div className="label">load 1 / 5 / 15</div>
                <div className="t-metric">
                  {h.load.m1.toFixed(2)}
                  <small>
                    {' '}
                    {h.load.m5.toFixed(2)} / {h.load.m15.toFixed(2)}
                  </small>
                </div>
                <div className="dim" style={{ fontSize: 10, marginTop: 4 }}>
                  {h.cpu_count} vCPU
                </div>
              </div>
              <div className="card" style={{ padding: 10 }}>
                <div className="label">память</div>
                <div className="t-metric">
                  {h.mem.pct}
                  <small> %</small>
                </div>
                <Bar pct={h.mem.pct} tone={toneFor(h.mem.pct)} />
                <div className="dim" style={{ fontSize: 10, marginTop: 4 }}>
                  {fmtMB(h.mem.used_mb)} / {fmtMB(h.mem.total_mb)}
                </div>
              </div>
              <div className="card" style={{ padding: 10 }}>
                <div className="label">swap</div>
                <div className="t-metric">{h.swap ? `${h.swap.pct}%` : '—'}</div>
                {h.swap ? <Bar pct={h.swap.pct} tone={toneFor(h.swap.pct)} /> : null}
                <div className="dim" style={{ fontSize: 10, marginTop: 4 }}>
                  {h.swap ? `${fmtMB(h.swap.used_mb)} / ${fmtMB(h.swap.total_mb)}` : 'не используется'}
                </div>
              </div>
              {h.disks.map((d) => (
                <div className="card" style={{ padding: 10 }} key={d.mount}>
                  <div className="label">диск {d.mount}</div>
                  <div className="t-metric">
                    {d.pct}
                    <small> %</small>
                  </div>
                  <Bar pct={d.pct} tone={toneFor(d.pct)} />
                  <div className="dim" style={{ fontSize: 10, marginTop: 4 }}>
                    {d.used_gb} / {d.total_gb} ГБ
                  </div>
                </div>
              ))}
            </div>

            <div className="grid thirds">
              <div>
                <div className="label" style={{ marginBottom: 4 }}>
                  load
                </div>
                <LineChart data={hist.map((p) => ({ t: p.t, v: p.load1 }))} height={92} />
              </div>
              <div>
                <div className="label" style={{ marginBottom: 4 }}>
                  память
                </div>
                <LineChart data={hist.map((p) => ({ t: p.t, v: p.mem_pct }))} color="#d9a441" max={100} height={92} unit="%" />
              </div>
              <div>
                <div className="label" style={{ marginBottom: 4 }}>
                  диск
                </div>
                <LineChart data={hist.map((p) => ({ t: p.t, v: p.disk_pct }))} color="#38bdf8" max={100} height={92} unit="%" />
              </div>
            </div>

            <div className="grid split" style={{ marginTop: 12 }}>
              <div>
                <CardHead title="Топ процессов" icon="terminal" />
                {h.procs.length === 0 && <div className="empty">нет данных</div>}
                {h.procs.map((p) => (
                  <div className="row" key={p.name + p.cpu} style={{ padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <Icon name="zap" size={12} style={{ color: 'var(--text-4)' }} />
                    <span className="truncate" style={{ fontSize: 12 }}>
                      {p.name}
                    </span>
                    <span className="spacer" />
                    <span className="num dim" style={{ fontSize: 11 }}>
                      {p.cpu.toFixed(1)}% · {fmtMB(p.mem_mb)}
                    </span>
                    <div style={{ width: 60 }}>
                      <Bar pct={Math.min(100, p.cpu)} tone={p.cpu > 50 ? 'warn' : 'accent'} />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <CardHead title="Контейнеры" icon="layers" right={h.docker.length ? String(h.docker.length) : '—'} />
                {h.docker.length === 0 && <div className="empty">контейнеров нет</div>}
                {h.docker.map((c) => (
                  <div className="row" key={c.name} style={{ padding: '5px 0' }}>
                    <span className="dot" style={{ color: /up/i.test(c.status) ? 'var(--ok)' : 'var(--bad)' }} />
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{c.name}</span>
                    <span className="dim truncate" style={{ fontSize: 11 }}>
                      {c.image}
                    </span>
                    <span className="spacer" />
                    <span className="mono dim" style={{ fontSize: 11 }}>
                      {c.status}
                    </span>
                  </div>
                ))}
                {h.note && (
                  <div className="row gap-6" style={{ marginTop: 10 }}>
                    <Icon name="alert" size={13} style={{ color: 'var(--warn)' }} />
                    <span className="dim" style={{ fontSize: 11 }}>
                      {h.note}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
