import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { CardHead, Pill, StatusPill } from '../components/primitives'
import { useToast } from '../components/hooks'
import { ctrl, ctrlUrl, CtrlError, setCtrlUrl, type Command, type CtrlStatus } from '../lib/ctrl'
import { fmtAgo } from '../lib/format'
import type { StatusPayload } from '../lib/types'

const ACTION_LABEL: Record<string, string> = { start: 'запустить', stop: 'остановить', restart: 'перезапустить' }
const STATUS_TONE: Record<Command['status'], 'ok' | 'warn' | 'bad' | 'dim'> = {
  pending: 'warn',
  running: 'warn',
  done: 'ok',
  failed: 'bad',
  expired: 'dim',
}
const STATUS_LABEL: Record<Command['status'], string> = {
  pending: 'в очереди',
  running: 'выполняется',
  done: 'выполнено',
  failed: 'ошибка',
  expired: 'истекла',
}

function nodeStateLabel(st: CtrlStatus['nodes'][string] | undefined): { ok: boolean; text: string } {
  if (!st) return { ok: false, text: 'нет данных' }
  if (st.running) return { ok: true, text: 'работает' }
  if (st.unit_state === 'failed') return { ok: false, text: 'упал (failed)' }
  if (st.unit_state === 'activating') return { ok: false, text: 'запускается' }
  if (st.unit_state === 'active') return { ok: false, text: 'юнит активен, процесса нет' }
  return { ok: false, text: 'остановлен' }
}

export default function Admin({
  data,
  projectsCount,
  onSyncProjects,
}: {
  data: StatusPayload
  projectsCount: number
  onSyncProjects: () => Promise<string>
}) {
  const toast = useToast()
  const [state, setState] = useState<CtrlStatus | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busyNode, setBusyNode] = useState<string | null>(null)
  const [confirmTakeover, setConfirmTakeover] = useState<{ node: string; action: 'start' | 'restart'; other?: string } | null>(null)
  const [urlDraft, setUrlDraft] = useState(ctrlUrl())
  const [urlMsg, setUrlMsg] = useState<string | null>(null)
  const [syncedAt, setSyncedAt] = useState<number>(Date.now())

  const load = useCallback(
    async (silent = true) => {
      try {
        const s = await ctrl.status()
        setState(s)
        setErr(null)
        setSyncedAt(Date.now())
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'ошибка API')
      }
    },
    [],
  )

  useEffect(() => {
    load()
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, 10_000)
    return () => window.clearInterval(t)
  }, [load])

  useEffect(() => {
    if (!state) return
    const pending = state.commands.some((c) => c.status === 'pending' || c.status === 'running')
    if (pending) {
      const t = window.setTimeout(() => load(), 3000)
      return () => window.clearTimeout(t)
    }
  }, [state, load])

  async function fire(node: string, action: 'start' | 'stop' | 'restart', takeover = false) {
    setBusyNode(node)
    try {
      const r = await ctrl.gateway(node, action, { takeover })
      const c = r.command
      if (r.queued) toast(`${ACTION_LABEL[action]} ${node}: задача отправлена на узел`, 'ok')
      else if (c.status === 'done') toast(`${ACTION_LABEL[action]} ${node}: готово`, 'ok')
      else toast(`${ACTION_LABEL[action]} ${node}: ${c.result || 'ошибка'}`, 'err')
      await load()
    } catch (e) {
      if (e instanceof CtrlError && e.needTakeover) {
        setConfirmTakeover({ node, action: action === 'stop' ? 'start' : action, other: String(e.other?.node || '').toUpperCase() })
      } else {
        toast(e instanceof Error ? e.message : 'не удалось выполнить', 'err')
      }
    } finally {
      setBusyNode(null)
    }
  }

  async function checkUrl() {
    setUrlMsg('проверяю…')
    setCtrlUrl(urlDraft)
    try {
      const h = await ctrl.health()
      setUrlMsg(h.ok ? 'API отвечает' : 'API ответил странно')
      toast('Связь с API есть', 'ok')
      load()
    } catch (e) {
      setUrlMsg(e instanceof Error ? e.message : 'нет связи')
      toast('API не отвечает — проверь URL и Tailscale Funnel', 'err')
    }
  }

  const nodeName = (key: string) => (data.hosts[key]?.name ?? key).split(' · ')[0]

  return (
    <>
      {err && (
        <div className="card alert-card bad" style={{ padding: 12, marginBottom: 12 }}>
          <div className="row gap-8">
            <Icon name="alert" size={14} style={{ color: 'var(--bad)' }} />
            <span style={{ fontSize: 12.5 }}>
              API управления недоступен: {err}. Кнопки ниже не работают, пока не поднят канал (
              <span className="mono">{ctrlUrl()}</span>).
            </span>
          </div>
        </div>
      )}

      <div className="grid split">
        <div className="card">
          <CardHead
            icon="power"
            title="Gateway по машинам"
            right={
              <span className="row gap-6">
                <span className="dim mono" style={{ fontSize: 10 }}>
                  обновлено {fmtAgo(new Date(syncedAt).toISOString())}
                </span>
                <button className="btn sm ghost icon" title="Обновить" onClick={() => load(false)}>
                  <Icon name="refresh" size={12} />
                </button>
              </span>
            }
          />
          <div className="col gap-8">
            {['vps', 'pc'].map((key) => {
              const st = state?.nodes?.[key]
              const lbl = nodeStateLabel(st)
              const busy = busyNode === key
              return (
                <div className="card" key={key} style={{ padding: 10, background: 'var(--surface-2)' }}>
                  <div className="row gap-8 wrap">
                    <Icon name="server" size={14} style={{ color: 'var(--text-3)' }} />
                    <span style={{ fontWeight: 590 }}>{nodeName(key)}</span>
                    <StatusPill ok={lbl.ok} label={lbl.text} />
                    {st?.unit_state && <Pill mono>unit {st.unit_state}</Pill>}
                    {st?.pids?.length ? <Pill mono>pid {st.pids.join(', ')}</Pill> : null}
                    {st?.source && <Pill tone="dim" mono>{st.source}</Pill>}
                    {st?.age_s != null && <Pill mono>{st.age_s} с</Pill>}
                    <span className="spacer" />
                    <span className="row gap-4 nowrap">
                      <button
                        className="btn sm"
                        disabled={busy}
                        title="Запустить gateway"
                        onClick={() => fire(key, 'start')}
                      >
                        <Icon name="play" size={12} />
                        <span className="hide-mobile">start</span>
                      </button>
                      <button className="btn sm" disabled={busy} title="Остановить gateway" onClick={() => fire(key, 'stop')}>
                        <Icon name="power" size={12} />
                        <span className="hide-mobile">stop</span>
                      </button>
                      <button
                        className="btn sm primary"
                        disabled={busy}
                        title="Перезапустить gateway"
                        onClick={() => fire(key, 'restart')}
                      >
                        <Icon name={busy ? 'refresh' : 'restart'} size={12} className={busy ? 'spin' : ''} />
                        <span className="hide-mobile">restart</span>
                      </button>
                    </span>
                  </div>
                  {key === 'pc' && (
                    <div className="dim" style={{ fontSize: 10.5, marginTop: 6 }}>
                      restart на ПК оборвёт текущий диалог с ботом: он вернётся через 5–15 с, история сохранится.
                    </div>
                  )}
                  {key === 'vps' && st?.unit_state === 'inactive' && (
                    <div className="dim" style={{ fontSize: 10.5, marginTop: 6 }}>
                      gateway на VPS лежит — бот сейчас работает на ПК. start поднимет второго бота на том же токене.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="card">
          <CardHead
            icon="clock"
            title="Журнал действий"
            right={<Pill mono>{state?.commands.length ?? 0}</Pill>}
          />
          {!state?.commands.length && <div className="empty">Пока пусто</div>}
          <div className="col gap-6">
            {state?.commands.slice(0, 12).map((c) => (
              <div className="row gap-8" key={c.id} style={{ fontSize: 11.5 }}>
                <Pill tone={STATUS_TONE[c.status]} mono>
                  {STATUS_LABEL[c.status]}
                </Pill>
                <span className="mono">
                  {c.node} · {ACTION_LABEL[c.action] ?? c.action}
                </span>
                <span className="dim truncate" style={{ flex: 1 }} title={c.result || ''}>
                  {c.result || '—'}
                </span>
                <span className="dim mono" style={{ fontSize: 10 }}>
                  {c.finished ? fmtAgo(c.finished) : c.created.slice(11, 19)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid split" style={{ marginTop: 12 }}>
        <div className="card">
          <CardHead icon="shield" title="Канал управления" />
          <div className="label" style={{ marginBottom: 6 }}>
            адрес API (Tailscale Funnel)
          </div>
          <div className="row gap-6 wrap">
            <input
              className="field grow-mobile"
              style={{ flex: '1 1 220px' }}
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://vps-hermes.<tailnet>.ts.net"
            />
            <button className="btn sm" onClick={checkUrl}>
              <Icon name="shield" size={12} />
              проверить
            </button>
          </div>
          {urlMsg && (
            <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>
              {urlMsg}
            </div>
          )}
          <div className="dim" style={{ fontSize: 10.5, marginTop: 8, lineHeight: 1.6 }}>
            API даёт ровно три действия над gateway и статус — произвольных команд через него нет.
            Токен считается из твоего пароля (PBKDF2), отдельный пароль помнить не нужно.
            Управление ПК идёт через SSH-очередь: входящих портов на ПК не открывается.
          </div>
        </div>

        <div className="card">
          <CardHead icon="folder" title="Синхронизация данных" />
          <div className="row gap-8 wrap" style={{ marginBottom: 8 }}>
            <Pill mono>проектов {projectsCount}</Pill>
            <Pill mono>rev {state?.projects_rev ?? '—'}</Pill>
            {state?.projects_at && <Pill mono>правка {fmtAgo(state.projects_at)}</Pill>}
          </div>
          <div className="row gap-6 wrap">
            <button
              className="btn sm"
              onClick={async () => {
                const msg = await onSyncProjects()
                toast(msg, 'ok')
                load()
              }}
            >
              <Icon name="refresh" size={12} />
              синхронизировать сейчас
            </button>
          </div>
          <div className="dim" style={{ fontSize: 10.5, marginTop: 8, lineHeight: 1.6 }}>
            Проекты хранятся на VPS и подтягиваются на любое устройство; localStorage остаётся
            офлайн-копией. Конфликты решаются по времени последней правки.
          </div>
        </div>
      </div>

      {confirmTakeover && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setConfirmTakeover(null)}>
          <div className="card" style={{ maxWidth: 460, padding: 16 }}>
            <div className="row gap-8" style={{ marginBottom: 8 }}>
              <Icon name="alert" size={15} style={{ color: 'var(--warn)' }} />
              <span style={{ fontWeight: 590 }}>Это перехват роли</span>
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              На узле <b>{confirmTakeover.other || 'другой машины'}</b> gateway сейчас работает. Запуск на{' '}
              <b>{confirmTakeover.node.toUpperCase()}</b> приведёт к двум ботам на одном Telegram-токене: сообщения
              начнут расходиться между ними. Продолжать стоит, только если ты осознанно переносишь бота.
            </div>
            <div className="row gap-8" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
              <button className="btn sm" onClick={() => setConfirmTakeover(null)}>
                отмена
              </button>
              <button
                className="btn sm primary"
                onClick={() => {
                  const { node, action } = confirmTakeover
                  setConfirmTakeover(null)
                  fire(node, action, true)
                }}
              >
                да, перехватить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
