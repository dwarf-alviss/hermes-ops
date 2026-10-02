export type DiskInfo = { mount: string; total_gb: number; used_gb: number; pct: number }

export type HostMetrics = {
  name: string
  kind: string
  online: boolean
  last_seen: string | null
  stale_s: number | null
  uptime_s: number
  cpu_count: number
  load: { m1: number; m5: number; m15: number }
  mem: { total_mb: number; used_mb: number; avail_mb: number; pct: number }
  swap: { total_mb: number; used_mb: number; pct: number } | null
  disks: DiskInfo[]
  procs: { name: string; cpu: number; mem_mb: number }[]
  docker: { name: string; status: string; image: string }[]
  note: string | null
}

export type CronJob = {
  id: string
  name: string
  schedule: string
  enabled: boolean
  last_run: string | null
  last_status: string | null
  last_error: string | null
  next_run: string | null
  runs: number
  fails: number
}

export type ExecRow = {
  job: string
  started: string
  status: string
  duration_s: number | null
  error: string | null
}

export type HermesNode = {
  node: string
  gateway: {
    running: boolean
    pid: number | null
    pid_alive?: boolean
    state: string
    unit_state?: string | null
    updated_at: string | null
    active_agents: number
    platforms: { name: string; state: string }[]
  }
  cron: CronJob[]
  recent: ExecRow[]
  heartbeat: { role: string; gateway: string; ts: string } | null
  sessions_24h: number
  messages_24h: number
  note: string | null
}

export type HistoryPoint = { t: number; load1: number; mem_pct: number; disk_pct: number }

export type StatusPayload = {
  schema: number
  generated_at: string
  hosts: Record<string, HostMetrics>
  hermes: Record<string, HermesNode>
  history: Record<string, HistoryPoint[]>
  notes: string[]
}

export type Project = {
  id: string
  name: string
  status: 'active' | 'paused' | 'done' | 'idea'
  priority: 'high' | 'normal' | 'low'
  stack: string
  repo: string
  url: string
  deadline: string
  value: string
  notes: string
  updated_at: string
}
