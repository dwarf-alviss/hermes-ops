import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

type ToastKind = 'info' | 'ok' | 'err'
type Toast = { id: number; text: string; kind: ToastKind }

const ToastCtx = createContext<(text: string, kind?: ToastKind) => void>(() => {})

export function useToast() {
  return useContext(ToastCtx)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([])
  const seq = useRef(0)

  const push = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = ++seq.current
    setList((prev) => [...prev, { id, text, kind }])
    window.setTimeout(() => setList((prev) => prev.filter((t) => t.id !== id)), kind === 'err' ? 6000 : 3000)
  }, [])

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {list.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'err' ? 'err' : t.kind === 'ok' ? 'ok' : ''}`}>
            <span className="dot" style={{ marginTop: 5, color: t.kind === 'err' ? 'var(--bad)' : t.kind === 'ok' ? 'var(--ok)' : 'var(--accent)' }} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/** Живой счётчик: перерисовка раз в секунду, возвращает Date.now(). */
export function useTicker(intervalMs = 1000) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), intervalMs)
    return () => window.clearInterval(t)
  }, [intervalMs])
  return Date.now()
}

/** Хоткей вида 'k' + meta/ctrl, либо Escape. */
export function useHotkey(key: string, handler: () => void, opts: { meta?: boolean; shift?: boolean } = {}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (opts.meta && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault()
        handler()
        return
      }
      if (!opts.meta && !typing && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault()
        handler()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [key, handler, opts.meta, opts.shift])
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false))
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatches(mq.matches)
    mq.addEventListener('change', on)
    on()
    return () => mq.removeEventListener('change', on)
  }, [query])
  return matches
}
