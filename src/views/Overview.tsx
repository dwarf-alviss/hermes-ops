import { Badge, Meter, Sparkline } from '../components/ui'
import { fmtAgo, fmtDuration, fmtMB, pctTone } from '../lib/format'
import type { Project, StatusPayload } from '../lib/types'

export default function Overview({ data, projects }: { data: StatusPayload; projects: Project[] }) {
  const hosts = Object.entries(data.hosts)
  const nodes = Object.entries(data.hermes)
  const jobs = nodes.flatMap(([n, h]) => h.cron.map((j) => ({ node: n, ...j })))
  const failing = jobs.filter((j) => j.last_status && j.last_status !== 'ok' && j.last_status !== 'success')
  const active = projects.filter((p) => p.status === 'active')
  const soon = projects
    .filter((p) => p.deadline)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 5)

  return (
    <>
      <div className="grid c3" style={{ marginBottom: 14 }}>
        <div className="card">
          <h3>Машины</h3>
          {hosts.map(([k, h]) => (
            <div className="kv" key={k}>
              <span>{h.name || k}</span>
              <span className="row" style={{ gap: 6 }}>
                <span className="mono">{h.mem.pct}% RAM</span>
                <Badge tone={h.online ? 'ok' : 'bad'}>{h.online ? 'online' : `offline ${fmtAgo(h.last_seen)}`}</Badge>
              </span>
            </div>
          ))}
          {!hosts.length && <div className="empty">нет данных</div>}
        </div>

        <div className="card">
          <h3>Hermes</h3>
          {nodes.map(([k, n]) => (
            <div className="kv" key={k}>
              <span>{k}</span>
              <span className="row" style={{ gap: 6 }}>
                <span className="mono">{n.cron.length} джобов</span>
                <Badge tone={n.gateway.running ? 'ok' : 'bad'}>{n.gateway.state || (n.gateway.running ? 'running' : 'down')}</Badge>
              </span>
            </div>
          ))}
          {!nodes.length && <div className="empty">нет данных</div>}
        </div>

        <div className="card">
          <h3>Сбои</h3>
          {failing.length === 0 && <div className="kv"><span>Все джобы в норме</span><Badge tone="ok">ok</Badge></div>}
          {failing.slice(0, 6).map((j) => (
            <div className="kv" key={j.node + j.id}>
              <span className="mono" style={{ fontSize: 12 }}>{j.name}</span>
              <Badge tone="bad">{j.last_status}</Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="grid c2" style={{ marginBottom: 14 }}>
        {hosts.map(([k, h]) => {
          const hist = data.history[k] ?? []
          return (
            <div className="card" key={k}>
              <h3>
                <Badge tone={h.online ? 'ok' : 'bad'}>{h.online ? 'online' : 'offline'}</Badge>
                {h.name || k}
                <span className="right">uptime {fmtDuration(h.uptime_s)}</span>
              </h3>
              <div className="row" style={{ gap: 18, alignItems: 'flex-end' }}>
                <div style={{ minWidth: 110 }}>
                  <div className="tiny">load (1m)</div>
                  <div className="big">{h.load.m1.toFixed(2)}</div>
                </div>
                <div style={{ minWidth: 110 }}>
                  <div className="tiny">RAM</div>
                  <div className="big">{h.mem.pct}%</div>
                </div>
                <div style={{ minWidth: 130 }}>
                  <div className="tiny">диск {h.disks[0]?.mount ?? ''}</div>
                  <div className="big">{h.disks[0]?.pct ?? 0}%</div>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <Meter pct={h.mem.pct} tone={pctTone(h.mem.pct)} />
                <div className="tiny" style={{ marginTop: 4 }}>
                  {fmtMB(h.mem.used_mb)} / {fmtMB(h.mem.total_mb)} · {h.cpu_count} CPU
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <div className="tiny">load за сутки</div>
                <Sparkline points={hist.map((p) => p.load1)} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid c2">
        <div className="card">
          <h3>Активные проекты <span className="right">{active.length}</span></h3>
          {active.map((p) => (
            <div className="kv" key={p.id}>
              <span>
                {p.name} <span className="tiny">{p.stack}</span>
              </span>
              <Badge tone={p.priority === 'high' ? 'warn' : 'dim'}>{p.priority}</Badge>
            </div>
          ))}
          {!active.length && <div className="empty">нет активных проектов</div>}
        </div>

        <div className="card">
          <h3>Дедлайны и заметки</h3>
          {soon.map((p) => (
            <div className="kv" key={p.id}>
              <span>{p.name}</span>
              <span className="mono">{p.deadline}</span>
            </div>
          ))}
          {!soon.length && <div className="kv"><span>Дедлайны не заданы</span></div>}
          {data.notes.length > 0 && (
            <ul className="notes" style={{ marginTop: 10 }}>
              {data.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="tiny" style={{ marginTop: 16 }}>
        Данные собраны: {data.generated_at} ({fmtAgo(data.generated_at)}) · схема v{data.schema}
      </div>
    </>
  )
}
