import { LineChart } from '../components/Chart'
import { Icon } from '../components/Icon'
import { Bar, KV, Metric, Pill, SectionTitle, StatusPill, toneFor } from '../components/primitives'
import { fmtAgo, fmtDuration, fmtMB, plural } from '../lib/format'
import type { Project, StatusPayload } from '../lib/types'

const STATUS_LABEL: Record<Project['status'], string> = {
  active: 'в работе',
  paused: 'пауза',
  done: 'готово',
  idea: 'идея',
}

export default function Overview({
  data,
  projects,
  onOpen,
}: {
  data: StatusPayload
  projects: Project[]
  onOpen: (tab: 'machines' | 'hermes' | 'projects') => void
}) {
  const hosts = Object.entries(data.hosts)
  const nodes = Object.entries(data.hermes)
  const jobs = nodes.flatMap(([n, h]) => h.cron.map((j) => ({ node: n, ...j })))
  const failing = jobs.filter((j) => j.last_status && !['ok', 'success', 'completed', 'done'].includes(j.last_status))
  const active = projects.filter((p) => p.status === 'active')
  const soon = projects
    .filter((p) => p.deadline)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 4)
  const maxMem = Math.max(0, ...hosts.map(([, h]) => h.mem.pct))
  const maxDisk = Math.max(0, ...hosts.flatMap(([, h]) => h.disks.map((d) => d.pct)))
  const online = hosts.filter(([, h]) => h.online).length

  return (
    <>
      <div className="grid metrics">
        <Metric
          icon="server"
          label="Узлы"
          value={
            <>
              {online}
              <small> / {hosts.length}</small>
            </>
          }
          sub={hosts.map(([, h]) => h.name.split(' · ')[0]).join(' · ')}
        />
        <Metric
          icon="memory"
          label="Пик RAM"
          value={
            <>
              {maxMem}
              <small> %</small>
            </>
          }
          bar={maxMem}
          tone={toneFor(maxMem)}
        />
        <Metric
          icon="disk"
          label="Пик диска"
          value={
            <>
              {maxDisk}
              <small> %</small>
            </>
          }
          bar={maxDisk}
          tone={toneFor(maxDisk)}
        />
        <Metric
          icon={failing.length ? 'alert' : 'check'}
          label="Сбои джобов"
          value={failing.length}
          sub={failing.length ? failing.map((f) => f.name).slice(0, 2).join(', ') : 'всё в норме'}
        />
        <Metric icon="layers" label="Расписаний" value={jobs.length} sub={`на ${nodes.length} ${plural(nodes.length, 'узле', 'узлах', 'узлах')}`} />
      </div>

      {data.notes.length > 0 && (
        <>
          <SectionTitle>Требует внимания</SectionTitle>
          <div className="grid split">
            {data.notes.map((n, i) => (
              <div className={`card alert-card ${/диск|ошиб|сбой|заполнен/i.test(n) ? 'bad' : ''}`} key={i} style={{ padding: '11px 12px' }}>
                <div className="row gap-8">
                  <Icon name="alert" size={14} style={{ color: 'var(--warn)', flex: 'none' }} />
                  <span style={{ fontSize: 12.5 }}>{n}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle>Машины</SectionTitle>
      <div className="grid split">
        {hosts.map(([key, h]) => {
          const hist = (data.history[key] ?? []).map((p) => ({ t: p.t, v: p.load1 }))
          return (
            <div className="card interactive" key={key} onClick={() => onOpen('machines')} style={{ cursor: 'pointer' }}>
              <div className="card-head">
                <StatusPill ok={h.online} />
                <span className="title">{h.name}</span>
                <span className="right">
                  <span className="mono">uptime {fmtDuration(h.uptime_s)}</span>
                  <Icon name="chevronRight" size={13} />
                </span>
              </div>
              <div className="row" style={{ gap: 20, alignItems: 'flex-end', marginBottom: 10 }}>
                <div>
                  <div className="label">load 1m</div>
                  <div className="t-metric">{h.load.m1.toFixed(2)}</div>
                </div>
                <div style={{ minWidth: 96 }}>
                  <div className="label">RAM</div>
                  <div className="t-metric">
                    {h.mem.pct}
                    <small> %</small>
                  </div>
                  <Bar pct={h.mem.pct} tone={toneFor(h.mem.pct)} />
                </div>
                <div style={{ minWidth: 96 }}>
                  <div className="label">диск {h.disks[0]?.mount ?? ''}</div>
                  <div className="t-metric">
                    {h.disks[0]?.pct ?? 0}
                    <small> %</small>
                  </div>
                  <Bar pct={h.disks[0]?.pct ?? 0} tone={toneFor(h.disks[0]?.pct ?? 0)} />
                </div>
              </div>
              <LineChart data={hist} height={64} showAxis={false} />
            </div>
          )
        })}
      </div>

      <div className="grid split" style={{ marginTop: 10 }}>
        <div className="card">
          <div className="card-head">
            <Icon name="bot" size={13} style={{ color: 'var(--text-3)' }} />
            <span className="title">Hermes</span>
            <span className="right">
              <button className="btn sm ghost" onClick={() => onOpen('hermes')}>
                подробнее
              </button>
            </span>
          </div>
          {nodes.map(([key, n]) => (
            <div className="list-row" key={key}>
              <span className="dot" style={{ color: n.gateway.running ? 'var(--ok)' : 'var(--bad)' }} />
              <span style={{ fontWeight: 500 }}>{key}</span>
              <Pill tone={n.gateway.running ? 'ok' : 'bad'} mono>
                {n.gateway.state}
              </Pill>
              <span className="spacer" />
              <span className="dim mono" style={{ fontSize: 11 }}>
                {n.cron.length} {plural(n.cron.length, 'джоб', 'джоба', 'джобов')} · {n.sessions_24h} {plural(n.sessions_24h, 'сессия', 'сессии', 'сессий')}
              </span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-head">
            <Icon name="folder" size={13} style={{ color: 'var(--text-3)' }} />
            <span className="title">Проекты в работе</span>
            <span className="right">
              <span className="mono">{active.length}</span>
              <button className="btn sm ghost" onClick={() => onOpen('projects')}>
                все
              </button>
            </span>
          </div>
          {active.length === 0 && <div className="empty">нет активных</div>}
          {active.map((p) => (
            <div className="list-row" key={p.id}>
              <span className="dot" style={{ color: p.priority === 'high' ? 'var(--warn)' : 'var(--text-4)' }} />
              <span style={{ fontWeight: 500 }}>{p.name}</span>
              <span className="dim truncate" style={{ fontSize: 11, maxWidth: 220 }}>
                {p.stack}
              </span>
              <span className="spacer" />
              {p.deadline && <span className="num dim">{p.deadline.slice(5)}</span>}
              <Pill>{STATUS_LABEL[p.status]}</Pill>
            </div>
          ))}
          {soon.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
              {soon.map((p) => (
                <KV key={p.id} k={p.name} v={p.deadline} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="dim" style={{ marginTop: 16, fontSize: 11 }}>
        снимок {fmtAgo(data.generated_at)} · схема v{data.schema} · суммарно RAM{' '}
        {fmtMB(hosts.reduce((n, [, h]) => n + h.mem.total_mb, 0))}
      </div>
    </>
  )
}
