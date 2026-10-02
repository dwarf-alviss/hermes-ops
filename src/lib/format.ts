export function fmtDuration(sec: number | null | undefined): string {
  if (sec == null || !isFinite(sec) || sec < 0) return '—'
  const s = Math.floor(sec)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}д ${h}ч`
  if (h > 0) return `${h}ч ${m}м`
  if (m > 0) return `${m}м ${s % 60}с`
  return `${s}с`
}

export function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (isNaN(t)) return '—'
  const diff = (Date.now() - t) / 1000
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return `${Math.floor(diff / 86400)} дн назад`
}

export function fmtMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} ГБ`
  return `${Math.round(mb)} МБ`
}

export function pctTone(pct: number): 'ok' | 'warn' | 'bad' {
  if (pct >= 90) return 'bad'
  if (pct >= 75) return 'warn'
  return 'ok'
}

export function nowISO(): string {
  return new Date().toISOString()
}

/** Русские формы: plural(3, 'джоб', 'джоба', 'джобов') → 'джоба'. */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}

const STATE_RU: Record<string, string> = {
  connected: 'подключено',
  disconnected: 'отключено',
  running: 'работает',
  down: 'остановлен',
  stopped: 'остановлен',
  up: 'работает',
  ok: 'ок',
  completed: 'успех',
  success: 'успех',
  failed: 'сбой',
  claimed: 'в очереди',
  unknown: 'неизвестно',
}

/** Человеческие подписи состояний вместо служебных слов из БД. */
export function stateRu(s: string | null | undefined): string {
  if (!s) return '—'
  return STATE_RU[s.toLowerCase()] ?? s
}
