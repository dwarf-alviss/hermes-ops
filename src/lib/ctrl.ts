/**
 * Клиент hermes-ctrl — API управления gateway (живёт на VPS, наружу через Tailscale Funnel).
 *
 * Авторизация: Bearer-токен = PBKDF2-SHA256(пароль дашборда, salt 'hermes-ctrl-v1', 200k),
 * та же производная считается на сервере. Второй пароль помнить не нужно, а ключ API
 * не совпадает с ключом расшифровки данных.
 *
 * Токен считается один раз при входе и живёт в памяти вкладки: в localStorage его не кладём.
 */
import type { Project } from './types'

const URL_KEY = 'hermes-ops.ctrl.url'
export const DEFAULT_CTRL_URL = 'https://vps-hermes.tailnet.ts.net'

let token: string | null = null

export function ctrlUrl(): string {
  return (localStorage.getItem(URL_KEY) || DEFAULT_CTRL_URL).replace(/\/+$/, '')
}

export function setCtrlUrl(url: string): void {
  localStorage.setItem(URL_KEY, url.trim().replace(/\/+$/, ''))
}

async function derive(password: string): Promise<string> {
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode('hermes-ctrl-v1'), iterations: 200000, hash: 'SHA-256' },
    baseKey,
    256,
  )
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Вызывается при входе: готовит токен для последующих запросов. */
export async function startSession(password: string): Promise<void> {
  token = await derive(password)
}

export function endSession(): void {
  token = null
}

export type NodeState = {
  unit_state: string | null
  running: boolean
  pids: number[]
  source: string
  updated_at: string | null
  age_s?: number | null
}

export type Command = {
  id: string
  node: string
  action: string
  unit: string
  takeover?: boolean
  status: 'pending' | 'running' | 'done' | 'failed' | 'expired'
  created: string
  finished: string | null
  result: string | null
  rc: number | null
}

export type CtrlStatus = {
  nodes: Record<string, NodeState>
  commands: Command[]
  projects_rev: number
  projects_at: string | null
  ts: string
}

export class CtrlError extends Error {
  status: number
  needTakeover: boolean
  other?: { node: string } & NodeState
  constructor(message: string, status: number, needTakeover = false, other?: any) {
    super(message)
    this.status = status
    this.needTakeover = needTakeover
    this.other = other
  }
}

async function call<T>(path: string, init: RequestInit = {}, timeoutMs = 12000): Promise<T> {
  if (!token) throw new CtrlError('нет сессии API — войди заново', 0)
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(`${ctrlUrl()}${path}`, {
      ...init,
      signal: ctl.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    })
  } catch (e) {
    clearTimeout(t)
    throw new CtrlError('нет связи с API управления (проверь URL и Tailscale)', 0)
  }
  clearTimeout(t)
  const text = await res.text()
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { error: text?.slice(0, 200) }
  }
  if (!res.ok) {
    throw new CtrlError(body?.error || `HTTP ${res.status}`, res.status, !!body?.need_takeover, body?.other)
  }
  return body as T
}

export const ctrl = {
  status: () => call<CtrlStatus>('/api/status'),
  commands: () => call<{ commands: Command[] }>('/api/commands'),
  health: async () => {
    const r = await fetch(`${ctrlUrl()}/api/health`)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return (await r.json()) as { ok: boolean; ts: string }
  },
  gateway: (node: string, action: 'start' | 'stop' | 'restart', opts: { unit?: string; takeover?: boolean } = {}) =>
    call<{ command: Command; queued?: boolean }>(`/api/nodes/${node}/gateway/${action}`, {
      method: 'POST',
      body: JSON.stringify({ unit: opts.unit || 'hermes-gateway.service', confirm_takeover: !!opts.takeover }),
    }),
  projects: () => call<{ rev: number; updated_at: string | null; projects: Project[] }>('/api/projects'),
  saveProjects: (rev: number, projects: Project[]) =>
    call<{ rev: number; updated_at: string }>('/api/projects', {
      method: 'PUT',
      body: JSON.stringify({ rev, projects }),
    }),
}
