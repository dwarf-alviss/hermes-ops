import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { useToast } from '../components/hooks'
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

const PRIORITY_LABEL: Record<Project['priority'], string> = {
  high: 'высокий',
  normal: 'обычный',
  low: 'низкий',
}

export default function Projects({
  projects,
  setProjects,
  syncMsg,
}: {
  projects: Project[]
  setProjects: (p: Project[]) => void
  syncMsg?: string | null
}) {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | Project['status']>('all')
  const [openNotes, setOpenNotes] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return projects.filter((p) => {
      if (filter !== 'all' && p.status !== filter) return false
      if (!needle) return true
      return `${p.name} ${p.stack} ${p.repo} ${p.notes} ${p.value}`.toLowerCase().includes(needle)
    })
  }, [projects, q, filter])

  function update(id: string, patch: Partial<Project>) {
    setProjects(projects.map((p) => (p.id === id ? { ...p, ...patch, updated_at: new Date().toISOString() } : p)))
  }

  /** Удаление без модалки: тост с «вернуть» вместо confirm — на телефоне быстрее и не мешает. */
  function remove(p: Project) {
    const rest = projects.filter((x) => x.id !== p.id)
    setProjects(rest)
    toast(`«${p.name}» удалён`, 'ok', {
      label: 'вернуть',
      fn: () => {
        setProjects(projects)
        toast('Возвращено', 'ok')
      },
    })
  }

  function add() {
    const p = newProject()
    setProjects([p, ...projects])
    setOpenNotes(p.id)
    toast('Проект добавлен — правь поля прямо в строке', 'ok')
  }

  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return
    const arr = projects.slice()
    const from = arr.findIndex((p) => p.id === fromId)
    const to = arr.findIndex((p) => p.id === toId)
    if (from < 0 || to < 0) return
    const [moved] = arr.splice(from, 1)
    arr.splice(to, 0, moved)
    setProjects(arr)
  }

  function sortByPriority() {
    const order = { high: 0, normal: 1, low: 2 }
    setProjects(projects.slice().sort((a, b) => order[a.priority] - order[b.priority] || a.name.localeCompare(b.name)))
    toast('Отсортировано по приоритету')
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: projects.length }
    projects.forEach((p) => (c[p.status] = (c[p.status] ?? 0) + 1))
    return c
  }, [projects])

  return (
    <>
      <div className="row wrap" style={{ marginBottom: 12, gap: 8 }}>
        <div className="field-wrap grow-mobile" style={{ width: 240 }}>
          <Icon name="search" size={13} />
          <input className="field" placeholder="Поиск по проектам" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="row gap-4 scroll-x">
          {(['all', 'active', 'paused', 'idea', 'done'] as const).map((s) => (
            <button
              key={s}
              className={`btn sm ${filter === s ? 'primary' : 'ghost'}`}
              onClick={() => setFilter(s)}
            >
              {s === 'all' ? 'все' : STATUS[s]}
              <span className="dim"> {counts[s] ?? 0}</span>
            </button>
          ))}
        </div>

        <span className="spacer hide-mobile" />

        <button className="btn sm" onClick={sortByPriority} title="Разложить по приоритету">
          <Icon name="layers" size={13} />
          <span className="hide-mobile">сортировать</span>
        </button>
        <button
          className="btn sm"
          title="Скачать projects.json"
          onClick={() => {
            download('projects.json', JSON.stringify(projects, null, 2))
            toast('projects.json выгружен', 'ok')
          }}
        >
          <Icon name="download" size={13} />
          <span className="hide-mobile">экспорт</span>
        </button>
        <button className="btn sm primary" onClick={add}>
          <Icon name="plus" size={13} />
          проект
        </button>
      </div>

      {list.length === 0 && <div className="empty-box">Ничего не найдено</div>}

      <div className="col gap-6">
        {list.map((p) => {
          const notesOpen = openNotes === p.id
          return (
            <div
              key={p.id}
              className={`card ${dragId === p.id ? 'dragging' : ''}`}
              style={{ padding: 10 }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) reorder(dragId, p.id)
                setDragId(null)
              }}
            >
              <div className="row gap-8 wrap">
                <span
                  className="drag-handle hide-mobile"
                  draggable
                  onDragStart={() => setDragId(p.id)}
                  onDragEnd={() => setDragId(null)}
                  title="Перетащить"
                >
                  <Icon name="grip" size={14} />
                </span>

                <span
                  className="dot"
                  style={{ color: p.priority === 'high' ? 'var(--warn)' : 'var(--text-4)' }}
                  title={`приоритет: ${PRIORITY_LABEL[p.priority]}`}
                />

                <input
                  className="inline-edit"
                  style={{ fontWeight: 590, flex: '1 1 150px', minWidth: 0, maxWidth: 260 }}
                  value={p.name}
                  title={p.name}
                  onChange={(e) => update(p.id, { name: e.target.value })}
                />

                <span className="dim truncate hide-mobile" style={{ fontSize: 11, maxWidth: 200 }}>
                  {p.stack}
                </span>

                <span className="spacer hide-mobile" />

                <select
                  className={`field tone-${TONE[p.status]}`}
                  style={{ width: 108, height: 28 }}
                  title="Статус"
                  value={p.status}
                  onChange={(e) => update(p.id, { status: e.target.value as Project['status'] })}
                >
                  {Object.entries(STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>

                <select
                  className="field hide-mobile"
                  style={{ width: 100, height: 28 }}
                  title="Приоритет"
                  value={p.priority}
                  onChange={(e) => update(p.id, { priority: e.target.value as Project['priority'] })}
                >
                  {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>

                <input
                  className="field hide-mobile"
                  type="date"
                  style={{ width: 132, height: 28 }}
                  title="Дедлайн"
                  value={p.deadline}
                  onChange={(e) => update(p.id, { deadline: e.target.value })}
                />

                {/* действия одной группой: при переносе на узком экране они не расходятся по строкам */}
                <span className="row gap-4 nowrap">
                  <button
                    className="btn sm icon ghost"
                    title="Детали"
                    onClick={() => setOpenNotes(notesOpen ? null : p.id)}
                  >
                    <Icon name={notesOpen ? 'chevronDown' : 'edit'} size={13} />
                  </button>
                  <button className="btn sm icon ghost danger" title="Удалить" onClick={() => remove(p)}>
                    <Icon name="trash" size={13} />
                  </button>
                </span>
              </div>

              {notesOpen && (
                <div className="grid split" style={{ marginTop: 10 }}>
                  <div className="col gap-6">
                    <input
                      className="field"
                      placeholder="стек"
                      value={p.stack}
                      onChange={(e) => update(p.id, { stack: e.target.value })}
                    />
                    <input
                      className="field"
                      placeholder="репозиторий (owner/name или URL)"
                      value={p.repo}
                      onChange={(e) => update(p.id, { repo: e.target.value })}
                    />
                    <input
                      className="field"
                      placeholder="URL"
                      value={p.url}
                      onChange={(e) => update(p.id, { url: e.target.value })}
                    />
                    <input
                      className="field"
                      placeholder="ценность / источник дохода"
                      value={p.value}
                      onChange={(e) => update(p.id, { value: e.target.value })}
                    />
                    <div className="row gap-6">
                      <input
                        className="field"
                        type="date"
                        value={p.deadline}
                        onChange={(e) => update(p.id, { deadline: e.target.value })}
                      />
                      <select
                        className="field"
                        value={p.priority}
                        onChange={(e) => update(p.id, { priority: e.target.value as Project['priority'] })}
                      >
                        {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="col gap-6">
                    <textarea
                      className="field"
                      placeholder="заметки, следующий шаг, договорённости"
                      value={p.notes}
                      onChange={(e) => update(p.id, { notes: e.target.value })}
                    />
                    <div className="row gap-8 wrap">
                      {p.repo && (
                        <a
                          className="btn sm ghost"
                          href={p.repo.startsWith('http') ? p.repo : `https://github.com/${p.repo}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Icon name="git" size={13} />
                          {p.repo}
                        </a>
                      )}
                      {p.url && (
                        <a className="btn sm ghost" href={p.url} target="_blank" rel="noreferrer">
                          <Icon name="external" size={13} />
                          открыть
                        </a>
                      )}
                      <span className="spacer" />
                      <span className="dim" style={{ fontSize: 10 }}>
                        изменён {p.updated_at ? p.updated_at.slice(0, 16).replace('T', ' ') : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="dim" style={{ fontSize: 11, marginTop: 12 }}>
        {syncMsg ? <span className="pill mono" style={{ marginRight: 8 }}>{syncMsg}</span> : null}
        Проекты хранятся на VPS и подтягиваются на любое устройство (локальная копия — в localStorage, работает
        офлайн). Правки уходят на сервер через полторы секунды после изменения.
      </div>
    </>
  )
}
