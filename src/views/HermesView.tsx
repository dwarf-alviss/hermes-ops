import { useState } from 'react'
import { Icon } from '../components/Icon'
import { CardHead, KV, Pill, StatusPill } from '../components/primitives'
import { fmtAgo, fmtDuration, plural, stateRu } from '../lib/format'
import type { ExecRow, StatusPayload } from '../lib/types'

export function runTone(s: string | null): 'ok' | 'bad' | 'warn' | 'dim' {
  if (!s) return 'dim'
  const v = s.toLowerCase()
  if (['ok', 'success', 'done', 'completed'].includes(v)) return 'ok'
  if (v.includes('run')) return 'warn'
  if (v.includes('fail') || v.includes('error') || v.includes('timeout')) return 'bad'
  return 'dim'
}

export default function HermesView({ data }: { data: StatusPayload }) {
  const nodes = Object.entries(data.hermes)
  const [expanded, setExpanded] = useState<string | null>(nodes[0]?.[0] ?? null)
  if (!nodes.length) return <div className="empty-box">Коллектор ещё не отдал данные по Hermes</div>

  return (
    <>
      {nodes.map(([key, n]) => {
        const open = expanded === key
        const fails = n.cron.reduce((acc, j) => acc + j.fails, 0)
        return (
          <div className="card" key={key} style={{ marginBottom: 10 }}>
            <div
              className="card-head"
              style={{ marginBottom: open ? 12 : 0, cursor: 'pointer' }}
              onClick={() => setExpanded(open ? null : key)}
            >
              <Icon name={open ? 'chevronDown' : 'chevronRight'} size={13} style={{ color: 'var(--text-4)' }} />
              <Icon name="bot" size={14} style={{ color: 'var(--text-3)' }} />
              <span className="title">{key}</span>
              <StatusPill ok={n.gateway.running} label={stateRu(n.gateway.state) || (n.gateway.running ? 'работает' : 'остановлен')} />
              <span className="right">
                <Pill mono>
                  {n.cron.length} {plural(n.cron.length, 'джоб', 'джоба', 'джобов')}
                </Pill>
                <Pill mono tone={fails > 0 ? 'bad' : 'dim'}>
                  сбоев {fails}
                </Pill>
                <Pill mono>
                  {n.sessions_24h} {plural(n.sessions_24h, 'сессия', 'сессии', 'сессий')} / 24ч
                </Pill>
              </span>
            </div>

            {open && (
              <>
                <div className="grid metrics" style={{ marginBottom: 12 }}>
                  <div className="card" style={{ padding: 10 }}>
                    <div className="label">gateway</div>
                    <div className="t-metric" style={{ fontSize: 15 }}>
                      {stateRu(n.gateway.state)}
                    </div>
                    <div className="dim" style={{ fontSize: 10, marginTop: 2 }}>
                      pid {n.gateway.pid ?? '—'} · {n.gateway.active_agents} агентов
                    </div>
                  </div>
                  <div className="card" style={{ padding: 10 }}>
                    <div className="label">платформы</div>
                    <div className="row wrap gap-4" style={{ marginTop: 4 }}>
                      {n.gateway.platforms.length === 0 && <span className="dim" style={{ fontSize: 11 }}>нет данных</span>}
                      {n.gateway.platforms.map((p) => (
                        <Pill key={p.name} tone={p.state === 'connected' ? 'ok' : 'bad'}>
                          <i className="dot" />
                          {p.name}: {stateRu(p.state)}
                        </Pill>
                      ))}
                    </div>
                  </div>
                  <div className="card" style={{ padding: 10 }}>
                    <div className="label">сообщения 24ч</div>
                    <div className="t-metric">{n.messages_24h}</div>
                  </div>
                  {n.heartbeat && (
                    <div className="card" style={{ padding: 10 }}>
                      <div className="label">HA heartbeat</div>
                      <div className="row gap-6" style={{ marginTop: 4 }}>
                        <Pill mono>role {n.heartbeat.role}</Pill>
                        <Pill mono tone={n.heartbeat.gateway === 'up' ? 'ok' : 'bad'}>
                          gw {stateRu(n.heartbeat.gateway)}
                        </Pill>
                      </div>
                      <div className="dim" style={{ fontSize: 10, marginTop: 4 }}>
                        {fmtAgo(n.heartbeat.ts)}
                      </div>
                    </div>
                  )}
                </div>

                <CardHead title="Расписания" icon="clock" right={`${n.cron.length}`} />
                {n.cron.length === 0 ? (
                  <div className="empty">джобов нет</div>
                ) : (
                  <div className="scroll-x">
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
                            <td style={{ fontWeight: 500 }}>
                              {j.name}
                              {!j.enabled && <span className="dim"> · выключен</span>}
                            </td>
                            <td className="mono dim">{j.schedule}</td>
                            <td className="dim" style={{ fontSize: 11 }}>
                              {j.last_run ? fmtAgo(j.last_run) : '—'}
                            </td>
                            <td>
                              <Pill tone={runTone(j.last_status)} mono>
                                {stateRu(j.last_status)}
                              </Pill>
                            </td>
                            <td className="num">{j.runs}</td>
                            <td className="num" style={{ color: j.fails > 0 ? 'var(--bad)' : undefined }}>
                              {j.fails}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ marginTop: 14 }}>
                  <CardHead title="Последние запуски" icon="terminal" />
                  {n.recent.length === 0 ? (
                    <div className="empty">журнал пуст</div>
                  ) : (
                    <div className="scroll-x">
                      <table>
                        <thead>
                          <tr>
                            <th>Джоб</th>
                            <th>Начало</th>
                            <th>Итог</th>
                            <th>Длит.</th>
                            <th>Ошибка</th>
                          </tr>
                        </thead>
                        <tbody>
                          {n.recent.slice(0, 8).map((r: ExecRow, i) => (
                            <tr key={i}>
                              <td>{r.job}</td>
                              <td className="mono dim" style={{ fontSize: 11 }}>
                                {r.started}
                              </td>
                              <td>
                                <Pill tone={runTone(r.status)} mono>
                                  {stateRu(r.status)}
                                </Pill>
                              </td>
                              <td className="num dim">{fmtDuration(r.duration_s)}</td>
                              <td className="dim truncate" style={{ fontSize: 11, maxWidth: 260 }}>
                                {r.error ?? ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {n.note && (
                  <div className="row gap-6" style={{ marginTop: 12 }}>
                    <Icon name="alert" size={13} style={{ color: 'var(--warn)' }} />
                    <span className="dim" style={{ fontSize: 11 }}>
                      {n.note}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
      <div className="dim" style={{ fontSize: 11, marginTop: 8 }}>
        Управление джобами (включить/выключить, запустить сейчас) появится вместе с API на VPS — сейчас данные
        только для чтения, снимок {fmtAgo(data.generated_at)}.
      </div>
    </>
  )
}
