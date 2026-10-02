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
  return (
    <>
      <div className="grid c2">
        <div className="card">
          <h3>Доступ</h3>
          <div className="kv">
            <span>Логин</span>
            <span className="mono">{LOGIN}</span>
          </div>
          <div className="kv">
            <span>Шифрование данных</span>
            <span className="mono tiny">AES-256-CBC · PBKDF2-SHA256 · 200k</span>
          </div>
          <p className="small" style={{ marginTop: 10 }}>
            Приложение статическое (GitHub Pages), поэтому проверка логина не серверная: пароль — это ключ
            расшифровки данных. Без верного пароля файл данных не читается: в репозитории лежит только шифртекст.
            Слабый пароль можно подобрать офлайн — держи его длинным и уникальным.
          </p>
          <div className="row" style={{ marginTop: 12 }}>
            <button onClick={onRefresh} disabled={busy}>
              {busy ? 'Обновляю…' : 'Обновить данные'}
            </button>
            <button className="ghost" onClick={onLogout}>
              Выйти
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Источник данных</h3>
          <div className="kv">
            <span>Собрано</span>
            <span className="mono tiny">
              {data.generated_at} · {fmtAgo(data.generated_at)}
            </span>
          </div>
          <div className="kv">
            <span>Схема</span>
            <span className="mono">v{data.schema}</span>
          </div>
          <div className="kv">
            <span>Машин</span>
            <span className="mono">{Object.keys(data.hosts).length}</span>
          </div>
          <div className="kv">
            <span>Джобов Hermes</span>
            <span className="mono">{Object.values(data.hermes).reduce((n, h) => n + h.cron.length, 0)}</span>
          </div>
          <div className="tiny" style={{ marginTop: 10, wordBreak: 'break-all' }}>
            {DATA_URL}
          </div>
          <p className="small" style={{ marginTop: 10 }}>
            Коллектор обновляет файл раз в 5 минут, CDN GitHub отдаёт кэш до ~5 минут — фактическая задержка
            до ~10 минут.
          </p>
        </div>

        <div className="card">
          <h3>Репозитории</h3>
          <div className="kv">
            <span>Приложение</span>
            <a href="https://github.com/dwarf-alviss/hermes-ops" target="_blank" rel="noreferrer" className="mono tiny">
              dwarf-alviss/hermes-ops
            </a>
          </div>
          <div className="kv">
            <span>Данные (шифртекст)</span>
            <a href="https://github.com/dwarf-alviss/hermes-ops-data" target="_blank" rel="noreferrer" className="mono tiny">
              dwarf-alviss/hermes-ops-data
            </a>
          </div>
          <p className="small" style={{ marginTop: 10 }}>
            Данные обновляет cron-коллектор на VPS: он собирает метрики VPS, статус Hermes, а также то, что
            присылает ПК. Каждый снапшот шифруется и пушится одним коммитом.
          </p>
        </div>

        <div className="card">
          <h3>Экспорт</h3>
          <p className="small">Скачать текущий расшифрованный снимок (JSON) — для отладки и бэкапа.</p>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = `hermes-ops-${data.generated_at.slice(0, 10)}.json`
              a.click()
              URL.revokeObjectURL(a.href)
            }}
          >
            Скачать JSON
          </button>
        </div>
      </div>
    </>
  )
}
