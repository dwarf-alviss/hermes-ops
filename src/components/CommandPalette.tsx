import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'

export type PaletteAction = {
  id: string
  label: string
  hint?: string
  icon?: string
  group?: string
  run: () => void
}

export function CommandPalette({
  open,
  onClose,
  actions,
}: {
  open: boolean
  onClose: () => void
  actions: PaletteAction[]
}) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return actions
    return actions.filter((a) => `${a.label} ${a.group ?? ''} ${a.hint ?? ''}`.toLowerCase().includes(needle))
  }, [q, actions])

  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
      window.setTimeout(() => inputRef.current?.focus(), 20)
    }
  }, [open])

  useEffect(() => setActive(0), [q])

  if (!open) return null

  const run = (a?: PaletteAction) => {
    if (!a) return
    onClose()
    window.setTimeout(a.run, 40)
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true">
        <input
          ref={inputRef}
          value={q}
          placeholder="Действие, раздел, проект…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((n) => Math.min(n + 1, filtered.length - 1))
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((n) => Math.max(n - 1, 0))
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              run(filtered[active])
            }
          }}
        />
        <div className="palette-list">
          {filtered.length === 0 && <div className="palette-empty">Ничего не найдено</div>}
          {filtered.map((a, i) => (
            <button
              key={a.id}
              className="palette-item"
              data-active={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(a)}
            >
              <Icon name={a.icon ?? 'arrowRight'} size={14} style={{ color: 'var(--text-4)' }} />
              <span>{a.label}</span>
              {a.hint && <span className="hint">{a.hint}</span>}
            </button>
          ))}
        </div>
        <div className="row" style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)', gap: 12 }}>
          <span className="label">↑↓ выбрать</span>
          <span className="label">↵ выполнить</span>
          <span className="label">esc закрыть</span>
        </div>
      </div>
    </div>
  )
}
