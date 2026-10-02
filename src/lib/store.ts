import type { Project } from './types'

const KEY = 'hermes-ops.projects.v1'

export const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'portfolio',
    name: 'portfolio',
    status: 'active',
    priority: 'high',
    stack: 'Next.js · TS · Vercel',
    repo: 'ph1zmat/portfolio',
    url: '',
    deadline: '',
    value: 'портфолио / входящие заказы',
    notes: 'Приоритет: пересобрать. Раздел кейсов + услуги.',
    updated_at: '',
  },
  {
    id: 'hermes-ops',
    name: 'hermes-ops',
    status: 'active',
    priority: 'normal',
    stack: 'Vite · React · TS · GH Pages',
    repo: 'dwarf-alviss/hermes-ops',
    url: 'https://dwarf-alviss.github.io/hermes-ops/',
    deadline: '',
    value: 'внутренний инструмент',
    notes: 'Этот дашборд: проекты + мониторинг Hermes и машин.',
    updated_at: '',
  },
  {
    id: 'aurasveta',
    name: 'aurasveta',
    status: 'active',
    priority: 'normal',
    stack: 'Next.js · Prisma · hoster.by',
    repo: '',
    url: '',
    deadline: '',
    value: 'живой клиент',
    notes: 'Редкие правки БД/сервера/промптов по просьбе клиента.',
    updated_at: '',
  },
  {
    id: 'ig-demos',
    name: 'Аутрич для IG-бизнеса',
    status: 'active',
    priority: 'high',
    stack: 'HTML · CSS · JS · GH Pages',
    repo: 'dwarf-alviss/ig-demos',
    url: 'https://dwarf-alviss.github.io/ig-demos/',
    deadline: '',
    value: 'канал поиска клиентов',
    notes: 'Демо-сайты + скрипты первого касания.',
    updated_at: '',
  },
  {
    id: 'moko-se',
    name: 'MOKO SE',
    status: 'active',
    priority: 'normal',
    stack: 'Python · автоматизация',
    repo: '',
    url: '',
    deadline: '',
    value: 'партнёрская разработка',
    notes: 'Среда автотестов, API. Справочник: ~/research/notes/moko-se-api.md',
    updated_at: '',
  },
  {
    id: 'workspace',
    name: 'workspace (монорепа)',
    status: 'paused',
    priority: 'low',
    stack: 'TS · монорепо · CI',
    repo: 'dwarf-alviss/workspace',
    url: '',
    deadline: '',
    value: 'инфраструктура',
    notes: 'Общие пакеты и CI для проектов.',
    updated_at: '',
  },
]

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_PROJECTS
    const parsed = JSON.parse(raw) as Project[]
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PROJECTS
    return parsed
  } catch {
    return DEFAULT_PROJECTS
  }
}

export function saveProjects(list: Project[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function newProject(): Project {
  return {
    id: `p-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Новый проект',
    status: 'idea',
    priority: 'normal',
    stack: '',
    repo: '',
    url: '',
    deadline: '',
    value: '',
    notes: '',
    updated_at: new Date().toISOString(),
  }
}

export function download(name: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
