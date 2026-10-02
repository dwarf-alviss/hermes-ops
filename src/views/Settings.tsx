import { Icon } from '../components/Icon'
import { KV, Pill } from '../components/primitives'
import { useTicker, useToast } from '../components/hooks'
import { DATA_URL, LOGIN } from '../lib/api'
import { fmtAgo } from '../lib/format'
import type { StatusPayload } from '../lib/types'

export default function Settings({
  data,
  onLogout,
  onRefresh,
  busy,
}: {
  data: StatusPayload
  onLogout: () => void
  onRefresh: () => void
  busy: boolean
}) {
  const toast = useToast()
  useTicker()

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast(`${label} скопирован`, 'ok')
    } catch {
      toast('Браузер не дал доступ к буферу', 'err')
    }
  }

  return (
    <div className="grid split">
      <div className="card">
        <div className="card-head">
          <Icon name="shield" size={13} style={{ color: 'var(--text-3)' }} />
          <span className="title">Доступ</span>
        </div>
        <KV k="логин" v={LOGIN} />
        <KV k="шифрование" v="AES-256-CBC · PBKDF2-SHA256 · 200k" />
        <KV k="состояние" v={busy ? 'обновляю…' : `снимок ${fmtAgo(data.generated_at)}`} />
        <p className="muted" style={{ marginTop: 10, fontSize: 12, lineHeight: 1.55 }}>
          Приложение статическое (GitHub Pages), поэтому авторизация клиентская: пароль — это ключ расшифровки.
          В публичном репозитории лежит только шифртекст. Стойкость = стойкость пароля к офлайн-перебору, поэтому
          он длинный и уникальный. Настоящий серверный вход появится вместе с API (Фаза 2).
        </p>
        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <button className="btn" onClick={onRefresh} disabled={busy}>
            <Icon name={busy ? 'refresh' : 'refresh'} size={13} className={busy ? 'spin' : ''} />
            {busy ? 'Обновляю…' : 'Обновить данные'}
          </button>
          <button className="btn ghost" onClick={() => copy(location.href, 'адрес дашборда')}>
            <Icon name="copy" size={13} />
            Ссылка
          </button>
          <button className="btn ghost danger" onClick={onLogout}>
            <Icon name="user" size={13} />
            Выйти
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <Icon name="key" size={13} style={{ color: 'var(--text-3)' }} />
          <span className="title">Секреты (.env)</span>
          <span className="right">
            <Pill tone="accent">Фаза 2</Pill>
          </span>
        </div>
        <p className="muted" style={{ fontSize: 12, lineHeight: 1.55, marginTop: 0 }}>
          Хранилище ключей шифруется у тебя в браузере (Argon2id → мастер-ключ → каждый секрет отдельным
          AES-GCM), наружу уходит только шифртекст. Сервер не видит ни ключей, ни мастер-пароля.
        </p>
        <div className="col gap-6" style={{ marginTop: 6 }}>
          {[
            ['API на VPS с серверным входом', 'в работе'],
            ['HTTPS через Cloudflare-туннель', 'нужен домен'],
            ['Хранилище секретов + экспорт .env', 'план'],
            ['Маскирование, копирование, ротация', 'план'],
          ].map(([t, s]) => (
            <div className="row gap-8" key={t as string}>
              <Icon
                name={s === 'в работе' ? 'refresh' : 'clock'}
                size={12}
                style={{ color: s === 'в работе' ? 'var(--accent)' : 'var(--text-4)' }}
              />
              <span style={{ fontSize: 12 }}>{t}</span>
              <span className="spacer" />
              <span className="dim" style={{ fontSize: 11 }}>
                {s}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <Icon name="layers" size={13} style={{ color: 'var(--text-3)' }} />
          <span className="title">Источник данных</span>
        </div>
        <KV k="собрано" v={`${fmtAgo(data.generated_at)}`} />
        <KV k="схема" v={`v${data.schema}`} />
        <KV k="машин в снимке" v={Object.keys(data.hosts).length} />
        <KV k="джобов Hermes" v={Object.values(data.hermes).reduce((n, h) => n + h.cron.length, 0)} />
        <KV k="точек истории" v={Object.values(data.history).reduce((n, h) => n + h.length, 0)} />
        <div className="dim mono" style={{ marginTop: 10, fontSize: 10, wordBreak: 'break-all' }}>
          {DATA_URL}
        </div>
        <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          Коллектор на VPS пишет снимок раз в 5 минут, CDN GitHub кэширует ещё до ~5 минут. Живые обновления
          (секунды) появятся с API.
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <Icon name="git" size={13} style={{ color: 'var(--text-3)' }} />
          <span className="title">Репозитории и экспорт</span>
        </div>
        <div className="row gap-8 wrap" style={{ marginBottom: 10 }}>
          <a className="btn sm" href="https://github.com/dwarf-alviss/hermes-ops" target="_blank" rel="noreferrer">
            <Icon name="github" size={13} />
            hermes-ops
            <Icon name="external" size={11} />
          </a>
          <a className="btn sm" href="https://github.com/dwarf-alviss/hermes-ops-data" target="_blank" rel="noreferrer">
            <Icon name="git" size={13} />
            hermes-ops-data
            <Icon name="external" size={11} />
          </a>
        </div>
        <button
          className="btn"
          onClick={() =>
            copy(JSON.stringify(data, null, 2), 'JSON снимка')
          }
        >
          <Icon name="copy" size={13} />
          Скопировать снимок в буфер
        </button>
        <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          Данные собирает cron-коллектор на VPS: метрики VPS, состояние Hermes и то, что присылает ПК. Каждый
          снапшот шифруется и пушится одним коммитом (force-push одного снапшота).
        </p>
      </div>
    </div>
  )
}
