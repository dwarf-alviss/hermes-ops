import { useCallback, useEffect, useState } from 'react'
import { checkCredentials, fetchAndDecrypt, LOGIN } from './lib/api'
import { fmtAgo } from './lib/format'
import { loadProjects, saveProjects } from './lib/store'
import type { Project, StatusPayload } from './lib/types'
import Login from './views/Login'
import Overview from './views/Overview'
import Machines from './views/Machines'
import HermesView from './views/HermesView'
import Projects from './views/Projects'
import Settings from './views/Settings'

type Tab = 'overview' | 'machines' | 'hermes' | 'projects' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Обзор', icon: '◉' },
  { id: 'machines', label: 'Машины', icon: '🖥' },
  { id: 'hermes', label: 'Hermes', icon: '🤖' },
  { id: 'projects', label: 'Проекты', icon: '📁' },
  { id: 'settings', label: 'Настройки', icon: '⚙' },
]

const PW_KEY = 'hermes-ops.pw'

export default function App() {
  const [password, setPassword] = useState<string | null>(() => sessionStorage.getItem(PW_KEY))
  const [data, setData] = useState<StatusPayload | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>(() => loadProjects())

  useEffect(() => {
    saveProjects(projects)
  }, [projects])

  const refresh = useCallback(async (pw: string) => {
    setBusy(true)
    try {
      const { payload } = await fetchAndDecrypt(pw)
      setData(payload)
      setErr(null)
    } finally {
      setBusy(false)
    }
  }, [])

  // Первичная загрузка при наличии сохранённого пароля в рамках вкладки.
  useEffect(() => {
    if (!password) return
    refresh(password).catch((e) => {
      sessionStorage.removeItem(PW_KEY)
      setPassword(null)
      setErr(e instanceof Error ? e.message : 'Не удалось загрузить данные')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Автообновление раз в 5 минут, пока вкладка активна.
  useEffect(() => {
    if (!password) return
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') refresh(password).catch(() => undefined)
    }, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [password, refresh])

  async function handleLogin(login: string, pw: string) {
    const payload = await checkCredentials(login, pw)
    sessionStorage.setItem(PW_KEY, pw)
    setPassword(pw)
    setData(payload)
    setErr(null)
  }

  function logout() {
    sessionStorage.removeItem(PW_KEY)
    setPassword(null)
    setData(null)
  }

  if (password && !data) {
    return (
      <div className="login-wrap">
        <div className="login">
          <h1>🛠️ Hermes Ops</h1>
          <p className="sub">{busy ? 'Расшифровываю данные…' : 'Загружаю…'}</p>
        </div>
      </div>
    )
  }

  if (!password || !data) {
    return <Login onLogin={handleLogin} initialError={err} />
  }

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <span style={{ fontSize: 20 }}>🛠️</span>
          <span>
            Hermes Ops
            <small>
              {LOGIN} · {fmtAgo(data.generated_at)}
            </small>
          </span>
        </div>

        <nav className="nav">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="foot">
          <button className="ghost tiny" style={{ width: '100%', marginBottom: 8 }} onClick={() => refresh(password)} disabled={busy}>
            {busy ? 'обновляю…' : '↻ обновить'}
          </button>
          схема v{data.schema}
          <br />
          {Object.keys(data.hosts).length} машин · {Object.values(data.hermes).reduce((n, h) => n + h.cron.length, 0)} джобов
        </div>
      </aside>

      <main className="main">
        <div className="top">
          <h2>{TABS.find((t) => t.id === tab)?.label}</h2>
          <span className="meta">
            данные: {data.generated_at} ({fmtAgo(data.generated_at)})
          </span>
          <div className="right">
            <button onClick={() => refresh(password)} disabled={busy}>
              {busy ? 'Обновляю…' : 'Обновить'}
            </button>
          </div>
        </div>

        {tab === 'overview' && <Overview data={data} projects={projects} />}
        {tab === 'machines' && <Machines data={data} />}
        {tab === 'hermes' && <HermesView data={data} />}
        {tab === 'projects' && <Projects projects={projects} setProjects={setProjects} />}
        {tab === 'settings' && (
          <Settings data={data} onLogout={logout} onRefresh={() => refresh(password)} busy={busy} />
        )}
      </main>
    </div>
  )
}
