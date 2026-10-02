import { useMemo, useState } from 'react'
import { Badge } from '../components/ui'
import { download, newProject } from '../lib/store'
import type { Project } from '../lib/types'

const STATUS: Record<Project['status'], string> = {
  active: 'в работе',
  paused: 'пауза',
  done: 'готово',
  idea: 'идея',
}

const TONE: Record<Project['status'], 'ok' | 'warn' | 'bad' | 'dim'> = {
  active: 'ok',
  paused: 'warn',
  done: 'dim',
  idea: 'dim',
}

export default function Projects({
  projects,
  setProjects,
}: {
  projects: Project[]
  setProjects: (p: Project[]) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | Project['status']>('all')

  const list = useMemo(() => {
    const order = { high: 0, normal: 1, low: 2 }
    return projects
      .filter((p) => filter === 'all' || p.status === filter)
      .slice()
      .sort((a, b) => order[a.priority] - order[b.priority] || a.name.localeCompare(b.name))
  }, [projects, filter])

  function update(id: string, patch: Partial<Project>) {
    setProjects(
      projects.map((p) => (p.id === id ? { ...p, ...patch, updated_at: new Date().toISOString() } : p)),
    )
  }

  function remove(id: string) {
    if (!confirm('Удалить проект из списка?')) return
    setProjects(projects.filter((p) => p.id !== id))
  }

  function add() {
    const p = newProject()
    setProjects([...projects, p])
    setEditing(p.id)
  }

  return (
    <>
      <div className="top">
        <div className="row right" style={{ marginLeft: 'auto' }}>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} style={{ width: 150 }}>
            <option value="all">Все ({projects.length})</option>
            <option value="active">В работе</option>
            <option value="paused">Пауза</option>
            <option value="idea">Идеи</option>
            <option value="done">Готовые</option>
          </select>
          <button onClick={() => download('projects.json', JSON.stringify(projects, null, 2))}>Экспорт</button>
          <button className="primary" onClick={add}>
            + Проект
          </button>
        </div>
      </div>

      <div className="grid c2">
        {list.map((p) => (
          <div className="card" key={p.id}>
            {editing === p.id ? (
              <div className="pcard">
                <input value={p.name} onChange={(e) => update(p.id, { name: e.target.value })} />
                <div className="row">
                  <select value={p.status} onChange={(e) => update(p.id, { status: e.target.value as Project['status'] })}>
                    {Object.entries(STATUS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <select value={p.priority} onChange={(e) => update(p.id, { priority: e.target.value as Project['priority'] })}>
                    <option value="high">высокий</option>
                    <option value="normal">обычный</option>
                    <option value="low">низкий</option>
                  </select>
                  <input
                    type="date"
                    value={p.deadline}
                    onChange={(e) => update(p.id, { deadline: e.target.value })}
                    style={{ width: 150 }}
                  />
                </div>
                <input placeholder="Стек" value={p.stack} onChange={(e) => update(p.id, { stack: e.target.value })} />
                <input placeholder="Репозиторий" value={p.repo} onChange={(e) => update(p.id, { repo: e.target.value })} />
                <input placeholder="URL" value={p.url} onChange={(e) => update(p.id, { url: e.target.value })} />
                <input placeholder="Ценность / источник дохода" value={p.value} onChange={(e) => update(p.id, { value: e.target.value })} />
                <textarea placeholder="Заметки" value={p.notes} onChange={(e) => update(p.id, { notes: e.target.value })} />
                <div className="row">
                  <button className="primary" onClick={() => setEditing(null)}>
                    Готово
                  </button>
                  <button className="ghost" onClick={() => remove(p.id)}>
                    Удалить
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="name">
                  {p.name}
                  <Badge tone={TONE[p.status]}>{STATUS[p.status]}</Badge>
                  {p.priority === 'high' && <Badge tone="warn">высокий</Badge>}
                </div>
                <div className="meta">
                  {p.stack}
                  {p.value ? ` · ${p.value}` : ''}
                  {p.deadline ? ` · до ${p.deadline}` : ''}
                </div>
                {p.notes && <div className="small">{p.notes}</div>}
                <div className="row">
                  {p.repo && (
                    <a className="tiny" href={p.repo.startsWith('http') ? p.repo : `https://github.com/${p.repo}`} target="_blank" rel="noreferrer">
                      {p.repo}
                    </a>
                  )}
                  {p.url && (
                    <a className="tiny" href={p.url} target="_blank" rel="noreferrer">
                      открыть
                    </a>
                  )}
                  <button className="ghost tiny" style={{ marginLeft: 'auto' }} onClick={() => setEditing(p.id)}>
                    Изменить
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {!list.length && <div className="empty">Пусто. Добавь проект кнопкой «+ Проект».</div>}
      <div className="tiny" style={{ marginTop: 14 }}>
        Проекты хранятся локально в браузере (localStorage). Кнопка «Экспорт» выгружает JSON — перенос между
        устройствами вручную.
      </div>
    </>
  )
}
