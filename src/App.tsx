import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { checkCredentials, fetchAndDecrypt, LOGIN } from './lib/api'
import { loadProjects, saveProjects } from './lib/store'
import { ctrl, endSession, startSession } from './lib/ctrl'
import { plural } from './lib/format'
import type { Project, StatusPayload } from './lib/types'
import Login from './views/Login'
import Overview from './views/Overview'
import Machines from './views/Machines'
import HermesView from './views/HermesView'
import Projects from './views/Projects'
import Admin from './views/Admin'
import Settings from './views/Settings'
import { CommandPalette, type PaletteAction } from './components/CommandPalette'
import { Icon, type IconName } from './components/Icon'
import { Pill, Skeleton } from './components/primitives'
import { ToastProvider, useHotkey, useTicker } from './components/hooks'

type Tab = 'overview' | 'machines' | 'hermes' | 'projects' | 'admin' | 'settings'

const NAV: { id: Tab; label: string; icon: IconName; group: string; key?: string }[] = [
  { id: 'overview', label: 'Обзор', icon: 'overview', group: 'Мониторинг' },
  { id: 'machines', label: 'Машины', icon: 'server', group: 'Мониторинг', key: 'm' },
  { id: 'hermes', label: 'Hermes', icon: 'bot', group: 'Мониторинг', key: 'h' },
  { id: 'projects', label: 'Проекты', icon: 'folder', group: 'Работа', key: 'p' },
  { id: 'admin', label: 'Админка', icon: 'power', group: 'Система', key: 'a' },
  { id: 'settings', label: 'Настройки', icon: 'settings', group: 'Система' },
]

const PW_KEY = 'hermes-ops.pw'
const PROJ_LOCAL_AT = 'hermes-ops.projects.local_at'
const PROJ_REV = 'hermes-ops.projects.rev'
const REFRESH_MS = 30_000

function Shell() {
  const [password, setPassword] = useState<string | null>(() => sessionStorage.getItem(PW_KEY))
  const [data, setData] = useState<StatusPayload | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>(() => loadProjects())
  const [projRev, setProjRev] = useState<number>(() => Number(localStorage.getItem(PROJ_REV) || 0))
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const now = useTicker(1000)
  const pushTimer = useRef<number | null>(null)

  useEffect(() => saveProjects(projects), [projects])

  const refresh = useCallback(async (pw: string, silent = false) => {
    if (!silent) setBusy(true)
    try {
      const { payload } = await fetchAndDecrypt(pw)
      setData(payload)
      setErr(null)
    } finally {
      if (!silent) setBusy(false)
    }
  }, [])

  /**
   * Синхронизация проектов: сервер (VPS) — источник правды для всех устройств,
   * localStorage — офлайн-копия. Конфликты решаются по времени последней правки.
   */
  const pullProjects = useCallback(async (): Promise<string> => {
    const local = loadProjects()
    const localAt = localStorage.getItem(PROJ_LOCAL_AT)
    const remote = await ctrl.projects()
    if (remote.rev > 0 && remote.projects?.length) {
      const remoteAt = Date.parse(remote.updated_at || '1970-01-01')
      const localTime = localAt ? Date.parse(localAt) : 0
      if (localTime > remoteAt) {
        const r = await ctrl.saveProjects(remote.rev, local)
        setProjRev(r.rev)
        localStorage.setItem(PROJ_REV, String(r.rev))
        localStorage.removeItem(PROJ_LOCAL_AT)
        setSyncMsg(`локальная версия ушла на сервер (rev ${r.rev})`)
        return 'Локальные проекты отправлены на сервер'
      }
      setProjects(remote.projects)
      setProjRev(remote.rev)
      localStorage.setItem(PROJ_REV, String(remote.rev))
      localStorage.removeItem(PROJ_LOCAL_AT)
      setSyncMsg(`взял версию с сервера (rev ${remote.rev})`)
      return 'Проекты подтянуты с сервера'
    }
    const r = await ctrl.saveProjects(remote.rev || 0, local)
    setProjRev(r.rev)
    localStorage.setItem(PROJ_REV, String(r.rev))
    setSyncMsg(`залил локальные проекты (rev ${r.rev})`)
    return 'Локальные проекты залиты на сервер'
  }, [])

  /** Правки проектов: сразу в UI и localStorage, на сервер — с задержкой. */
  const updateProjects = useCallback(
    (next: Project[]) => {
      setProjects(next)
      localStorage.setItem(PROJ_LOCAL_AT, new Date().toISOString())
      if (pushTimer.current) window.clearTimeout(pushTimer.current)
      pushTimer.current = window.setTimeout(async () => {
        try {
          const r = await ctrl.saveProjects(projRev, next)
          setProjRev(r.rev)
          localStorage.setItem(PROJ_REV, String(r.rev))
          localStorage.removeItem(PROJ_LOCAL_AT)
          setSyncMsg(`синхронизировано (rev ${r.rev})`)
        } catch {
          setSyncMsg('API недоступен — проекты пока только в этом браузере')
        }
      }, 1500)
    },
    [projRev],
  )

  useEffect(() => {
    const t = window.setTimeout(() => {
      pullProjects().catch(() => setSyncMsg('API недоступен — проекты только в этом браузере'))
    }, 600)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!password) return
    refresh(password).catch((e) => {
      sessionStorage.removeItem(PW_KEY)
      setPassword(null)
      setErr(e instanceof Error ? e.message : 'Не удалось загрузить данные')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!password) return
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh(password, true).catch(() => undefined)
    }, REFRESH_MS)
    return () => window.clearInterval(t)
  }, [password, refresh])

  useHotkey('k', () => setPaletteOpen((o) => !o), { meta: true })
  useHotkey('/', () => setPaletteOpen(true))

  async function handleLogin(login: string, pw: string) {
    const payload = await checkCredentials(login, pw)
    await startSession(pw)                       // токен API управления (в памяти вкладки)
    sessionStorage.setItem(PW_KEY, pw)
    setPassword(pw)
    setData(payload)
    setErr(null)
    pullProjects()
      .then((m) => setSyncMsg(m))
      .catch(() => setSyncMsg('API недоступен — проекты только в этом браузере'))
  }

  function logout() {
    sessionStorage.removeItem(PW_KEY)
    endSession()
    setPassword(null)
    setData(null)
  }

  const actions: PaletteAction[] = useMemo(() => {
    const nav: PaletteAction[] = NAV.map((n) => ({
      id: `nav-${n.id}`,
      label: `Перейти: ${n.label}`,
      group: n.group,
      hint: n.key ? `g ${n.key}` : undefined,
      icon: n.icon,
      run: () => setTab(n.id),
    }))
    const rest: PaletteAction[] = [
      {
        id: 'refresh',
        label: 'Обновить данные',
        icon: 'refresh',
        hint: 'r',
        run: () => password && refresh(password),
      },
      {
        id: 'sync-projects',
        label: 'Синхронизировать проекты',
        icon: 'layers',
        run: () =>
          pullProjects()
            .then((m) => setSyncMsg(m))
            .catch(() => setSyncMsg('API недоступен')),
      },
      {
        id: 'copy-link',
        label: 'Скопировать ссылку на дашборд',
        icon: 'copy',
        run: () => navigator.clipboard.writeText(location.href).catch(() => undefined),
      },
      {
        id: 'open-app-repo',
        label: 'Открыть репозиторий приложения',
        icon: 'git',
        run: () => window.open('https://github.com/dwarf-alviss/hermes-ops', '_blank'),
      },
      { id: 'logout', label: 'Выйти', icon: 'user', run: logout },
    ]
    return [...nav, ...rest]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password, refresh, pullProjects])

  if (password && !data) {
    return (
      <div className="page" style={{ maxWidth: 1180 }}>
        <div className="grid metrics">
          {[0, 1, 2, 3, 4].map((i) => (
            <div className="card" key={i} style={{ padding: 12 }}>
              <Skeleton h={10} w="40%" />
              <Skeleton h={22} w="60%" style={{ marginTop: 10 }} />
            </div>
          ))}
        </div>
        <div className="grid split" style={{ marginTop: 12 }}>
          {[0, 1].map((i) => (
            <div className="card" key={i}>
              <Skeleton h={12} w="30%" />
              <Skeleton h={90} style={{ marginTop: 12 }} />
            </div>
          ))}
        </div>
        <div className="dim" style={{ marginTop: 14, fontSize: 12 }}>
          {busy ? 'Расшифровываю снимок…' : 'Загружаю…'}
        </div>
      </div>
    )
  }

  if (!password || !data) {
    return <Login onLogin={handleLogin} initialError={err} />
  }

  const hosts = Object.entries(data.hosts)
  const onlineCount = hosts.filter(([, h]) => h.online).length
  const jobs = Object.values(data.hermes).flatMap((h) => h.cron)
  const fails = jobs.reduce((n, j) => n + j.fails, 0)
  const lastSec = Math.max(0, Math.round((now - Date.parse(data.generated_at)) / 1000))
  const current = NAV.find((n) => n.id === tab)!

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="terminal" size={13} />
          </span>
          <div className="brand-text">
            Hermes Ops
            <small>
              {LOGIN} · узлов {onlineCount}/{hosts.length}
            </small>
          </div>
        </div>

        {['Мониторинг', 'Работа', 'Система'].map((group) => (
          <div className="nav-group" key={group} style={{ marginBottom: 6 }}>
            <div className="nav-label">{group}</div>
            {NAV.filter((n) => n.group === group).map((n) => (
              <button key={n.id} className={`nav-item ${tab === n.id ? 'active' : ''}`} onClick={() => setTab(n.id)}>
                <Icon name={n.icon} size={15} />
                <span>{n.label}</span>
                {n.id === 'projects' && <span className="count">{projects.filter((p) => p.status === 'active').length}</span>}
                {n.id === 'hermes' && <span className="count">{jobs.length}</span>}
              </button>
            ))}
          </div>
        ))}

        <div className="side-foot">
          <button className="btn sm block" style={{ marginBottom: 8 }} onClick={() => setPaletteOpen(true)}>
            <Icon name="search" size={12} />
            Поиск действий
            <span className="kbd" style={{ marginLeft: 'auto' }}>
              ⌘K
            </span>
          </button>
          <div className="dim mono" style={{ fontSize: 10, lineHeight: 1.6 }}>
            схема v{data.schema}
            <br />
            {hosts.length} {plural(hosts.length, 'машина', 'машины', 'машин')} · {jobs.length}{' '}
            {plural(jobs.length, 'джоб', 'джоба', 'джобов')}
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <Icon name={current.icon} size={15} style={{ color: 'var(--text-3)' }} />
          <span style={{ fontWeight: 590, fontSize: 14, letterSpacing: '-0.01em' }}>{current.label}</span>

          <span className="spacer" />

          <span className="live hide-mobile">
            <span className={`spin`} style={{ display: busy ? 'inline-flex' : 'none' }}>
              <Icon name="refresh" size={11} />
            </span>
            <span className="dot" style={{ color: onlineCount === hosts.length ? 'var(--ok)' : 'var(--bad)' }} />
            {lastSec < 60 ? `${lastSec} с назад` : `${Math.round(lastSec / 60)} мин назад`}
          </span>

          {fails > 0 && (
            <Pill tone="bad" mono>
              {fails} сбоев
            </Pill>
          )}

          <button className="btn sm hide-mobile" onClick={() => setPaletteOpen(true)} title="⌘K">
            <Icon name="search" size={13} />
          </button>
          <button className="btn sm" onClick={() => refresh(password)} disabled={busy}>
            <Icon name="refresh" size={13} className={busy ? 'spin' : ''} />
            <span className="hide-mobile">{busy ? 'обновляю' : 'обновить'}</span>
          </button>
        </div>

        <div className="page">
          {tab === 'overview' && <Overview data={data} projects={projects} onOpen={setTab} />}
          {tab === 'machines' && <Machines data={data} />}
          {tab === 'hermes' && <HermesView data={data} />}
          {tab === 'projects' && <Projects projects={projects} setProjects={updateProjects} syncMsg={syncMsg} />}
          {tab === 'admin' && (
            <Admin data={data} projectsCount={projects.length} onSyncProjects={pullProjects} />
          )}
          {tab === 'settings' && (
            <Settings data={data} onLogout={logout} onRefresh={() => refresh(password)} busy={busy} />
          )}
        </div>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} actions={actions} />
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  )
}
