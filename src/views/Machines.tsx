import { Badge, Meter, Sparkline } from '../components/ui'
import { fmtAgo, fmtDuration, fmtMB, pctTone } from '../lib/format'
import type { StatusPayload } from '../lib/types'

export default function Machines({ data }: { data: StatusPayload }) {
  const hosts = Object.entries(data.hosts)

  if (!hosts.length) return <div className="empty">Коллектор ещё не отдал данные по машинам.</div>

  return (
    <>
      {hosts.map(([key, h]) => {
        const hist = data.history[key] ?? []
        return (
          <div className="card" key={key} style={{ marginBottom: 14 }}>
            <h3>
              <Badge tone={h.online ? 'ok' : 'bad'}>{h.online ? 'online' : `offline · ${fmtAgo(h.last_seen)}`}</Badge>
              {h.name || key}
              <span className="right">{h.kind} · uptime {fmtDuration(h.uptime_s)}</span>
            </h3>

            <div className="grid c3">
              <div>
                <div className="tiny">CPU load (1 / 5 / 15)</div>
                <div className="big">
                  {h.load.m1.toFixed(2)} <span className="small">{h.load.m5.toFixed(2)} / {h.load.m15.toFixed(2)}</span>
                </div>
                <div className="tiny">{h.cpu_count} vCPU</div>
              </div>
              <div>
                <div className="tiny">Память</div>
                <div className="big">{h.mem.pct}%</div>
                <Meter pct={h.mem.pct} tone={pctTone(h.mem.pct)} />
                <div className="tiny">
                  {fmtMB(h.mem.used_mb)} из {fmtMB(h.mem.total_mb)} · свободно {fmtMB(h.mem.avail_mb)}
                </div>
              </div>
              <div>
                <div className="tiny">Swap</div>
                <div className="big">{h.swap ? `${h.swap.pct}%` : '—'}</div>
                {h.swap ? <Meter pct={h.swap.pct} tone={pctTone(h.swap.pct)} /> : null}
                <div className="tiny">{h.swap ? `${fmtMB(h.swap.used_mb)} из ${fmtMB(h.swap.total_mb)}` : 'нет swap'}</div>
              </div>
            </div>

            <div className="grid c2" style={{ marginTop: 14 }}>
              <div>
                <div className="tiny" style={{ marginBottom: 4 }}>Диски</div>
                {h.disks.map((d) => (
                  <div key={d.mount} style={{ marginBottom: 8 }}>
                    <div className="kv">
                      <span className="mono">{d.mount}</span>
                      <span className="mono">
                        {d.used_gb} / {d.total_gb} ГБ · {d.pct}%
                      </span>
                    </div>
                    <Meter pct={d.pct} tone={pctTone(d.pct)} />
                  </div>
                ))}
              </div>
              <div>
                <div className="tiny" style={{ marginBottom: 4 }}>Топ процессов</div>
                {h.procs.length === 0 && <div className="empty">нет данных</div>}
                {h.procs.map((p) => (
                  <div className="kv" key={p.name + p.cpu}>
                    <span className="proc" style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>{p.name}</span>
                    <span className="mono tiny">
                      {p.cpu.toFixed(1)}% CPU · {fmtMB(p.mem_mb)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {h.docker.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="tiny" style={{ marginBottom: 4 }}>Контейнеры</div>
                <div className="row">
                  {h.docker.map((c) => (
                    <span className="badge" key={c.name}>
                      <i className="dot" style={{ color: /up/i.test(c.status) ? '#4ade80' : '#f87171' }} />
                      {c.name}: {c.status}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid c3" style={{ marginTop: 14 }}>
              <div>
                <div className="tiny">load 1m · сутки</div>
                <Sparkline points={hist.map((p) => p.load1)} />
              </div>
              <div>
                <div className="tiny">RAM % · сутки</div>
                <Sparkline points={hist.map((p) => p.mem_pct)} color="#fbbf24" max={100} />
              </div>
              <div>
                <div className="tiny">диск % · сутки</div>
                <Sparkline points={hist.map((p) => p.disk_pct)} color="#38bdf8" max={100} />
              </div>
            </div>

            {h.note && <div className="tiny" style={{ marginTop: 10 }}>⚠ {h.note}</div>}
          </div>
        )
      })}
    </>
  )
}
