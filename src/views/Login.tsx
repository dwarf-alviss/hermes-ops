import { useState } from 'react'
import { LOGIN } from '../lib/api'

export default function Login({
  onLogin,
  initialError,
}: {
  onLogin: (login: string, password: string) => Promise<void>
  initialError?: string | null
}) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(initialError ?? null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      await onLogin(login, password)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка входа')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login" onSubmit={submit}>
        <h1>🛠️ Hermes Ops</h1>
        <p className="sub">Проекты · мониторинг Hermes · ресурсы машин</p>

        <label htmlFor="login">Логин</label>
        <input
          id="login"
          value={login}
          autoComplete="username"
          autoFocus
          onChange={(e) => setLogin(e.target.value)}
        />

        <label htmlFor="pw">Пароль</label>
        <input
          id="pw"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
        />

        <div style={{ marginTop: 18 }}>
          <button className="primary" style={{ width: '100%' }} disabled={busy || !login || !password}>
            {busy ? 'Проверяю…' : 'Войти'}
          </button>
        </div>

        {err && <div className="err">{err}</div>}

        <div className="hint">
          Данные лежат в публичном репозитории, но зашифрованы AES-256: без пароля их не прочитать.
          Логин: <span className="mono">{LOGIN}</span>
        </div>
      </form>
    </div>
  )
}
