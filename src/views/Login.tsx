import { useState } from 'react'
import { Icon } from '../components/Icon'
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
  const [show, setShow] = useState(false)
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
      <form className="login-card" onSubmit={submit}>
        <div className="row gap-8" style={{ marginBottom: 16 }}>
          <span className="brand-mark">
            <Icon name="terminal" size={13} />
          </span>
          <div className="brand-text">
            Hermes Ops
            <small>проекты · мониторинг Hermes · ресурсы машин</small>
          </div>
        </div>

        <label htmlFor="login">Логин</label>
        <input
          id="login"
          className="field"
          value={login}
          autoComplete="username"
          autoFocus
          onChange={(e) => setLogin(e.target.value)}
        />

        <label htmlFor="pw">Пароль</label>
        <div className="row gap-6">
          <input
            id="pw"
            className="field"
            type={show ? 'text' : 'password'}
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" className="btn icon" title="Показать пароль" onClick={() => setShow((s) => !s)}>
            <Icon name={show ? 'eyeOff' : 'eye'} />
          </button>
        </div>

        <div style={{ marginTop: 18 }}>
          <button className="btn primary block" style={{ height: 32 }} disabled={busy || !login || !password}>
            {busy ? 'Расшифровываю…' : 'Войти'}
          </button>
        </div>

        {err && <div className="err">{err}</div>}

        <div className="hint">
          Логин: <span className="mono">{LOGIN}</span>. Данные лежат в публичном репозитории, но зашифрованы
          AES-256 — без верного пароля не читаются: пароль здесь и есть ключ расшифровки.
        </div>
      </form>
    </div>
  )
}
