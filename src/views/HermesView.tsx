import { Badge } from '../components/ui'
import { fmtAgo, fmtDuration } from '../lib/format'
import type { StatusPayload } from '../lib/types'

function statusTone(s: string | null): 'ok' | 'bad' | 'warn' | 'dim' {
  if (!s) return 'dim'
  const v = s.toLowerCase()
  if (v === 'ok' || v === 'success' || v === 'done') return 'ok'
  if (v.includes('run')) return 'warn'
  if (v.includes('fail') || v.includes('error') || v.includes('timeout')) return 'bad'
  return 'dim'
}

export default function HermesView({ data }: { data: StatusPayload }) {
  const nodes = Object.entries(data.hermes)
  if (!nodes.length) return <div className="empty">Коллектор ещё не отдал данные по Hermes.</div>

  return (
    <>
      {nodes.map(([key, n]) => (
        <div key={key} style={{ marginBottom: 18 }}>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3>
              <Badge tone={n.gateway.running ? 'ok' : 'bad'}>
                gateway {n.gateway.state || (n.gateway.running ? 'running' : 'down')}
              </Badge>
              {key}
              <span className="right">
                {n.gateway.pid ? `pid ${n.gateway.pid} · ` : ''}
                {n.gateway.active_agents} агентов · обновлено {fmtAgo(n.gateway.updated_at)}
              </span>
            </h3>
            <div className="row" style={{ gap: 8 }}>
              {n.gateway.platforms.map((p) => (
                <span className="badge" key={p.name}>
                  <i className="dot" style={{ color: p.state === 'connected' ? '#4ade80' : '#f87171' }} />
                  {p.name}: {p.state}
                </span>
              ))}
              {n.heartbeat && (
                <span className="badge">
                  HA: {n.heartbeat.role} · {n.heartbeat.gateway} · {fmtAgo(n.heartbeat.ts)}
                </span>
              )}
              <span className="badge">сессии 24ч: {n.sessions_24h}</span>
              <span className="badge">сообщения 24ч: {n.messages_24h}</span>
            </div>
            {n.note && <div className="tiny" style={{ marginTop: 8 }}>⚠ {n.note}</div>}
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h3>Расписания <span className="right">{n.cron.length}</span></h3>
            {n.cron.length === 0 ? (
              <div className="empty">Джобов нет</div>
            ) : (
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Джоб</th>
                      <th>Расписание</th>
                      <th>Последний запуск</th>
                      <th>Статус</th>
                      <th>Прогонов</th>
                      <th>Сбоев</th>
                    </tr>
                  </thead>
                  <tbody>
                    {n.cron.map((j) => (
                      <tr key={j.id}>
                        <td>
                          {j.name}
                          {!j.enabled && <span className="tiny"> · выключен</span>}
                        </td>
                        <td className="mono tiny">{j.schedule}</td>
                        <td className="tiny">{j.last_run ? fmtAgo(j.last_run) : '—'}</td>
                        <td>
                          <Badge tone={statusTone(j.last_status)}>{j.last_status ?? 'нет данных'}</Badge>
                        </td>
                        <td className="mono">{j.runs}</td>
                        <td className="mono" style={{ color: j.fails > 0 ? '#f87171' : undefined }}>{j.fails}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <h3>Последние запуски</h3>
            {n.recent.length === 0 ? (
              <div className="empty">Журнал пуст</div>
            ) : (
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Джоб</th>
                      <th>Начало</th>
                      <th>Итог</th>
                      <th>Длительность</th>
                      <th>Ошибка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {n.recent.map((r, i) => (
                      <tr key={i}>
                        <td>{r.job}</td>
                        <td className="tiny">{r.started}</td>
                        <td>
                          <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                        </td>
                        <td className="mono tiny">{fmtDuration(r.duration_s)}</td>
                        <td className="tiny" style={{ color: '#f87171', maxWidth: 320 }}>
                          {r.error ?? ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  )
}
