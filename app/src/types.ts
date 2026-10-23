import type { Spot } from './SpotCard'

export type { Spot }

export interface ArticleCard {
  id: string
  queryId: string
  title: string
  journal?: string
  date?: string
  page?: number
  text: string
  photos: string[]
  headline_en: string
  summary_en: string
}

/** A previewed page that has not been unlocked yet. */
export interface LockedCard {
  id: string
  queryId: string
  title: string
  journal?: string
  date?: string
  page?: number
  cost: number
  snippet: string
  figureCount: number
  relevance: number
}

export interface Run {
  id: string
  query: string
  status: string
  done: boolean
  queries?: string[]
  previewed?: { found: number; picked: number; estimate: number }
  spent: number
  balance?: number
  articles: ArticleCard[]
  spots: Spot[]
  locked: LockedCard[]
  note?: string | null
  error?: string
}

export interface PlanItem {
  id: string
  kind: 'spot' | 'article'
  title: string
  subtitle: string
  photo?: string
  note: string
  spot?: Spot
  article?: ArticleCard
}

export interface SearchEntry {
  id: string
  text: string
  at: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "EVEN · Aug 2026 · p.93" */
export function issueLabel(a: { journal?: string; date?: string; page?: number }) {
  const [y, m] = (a.date ?? '').split('-')
  const issue = y && m ? `${MONTHS[Number(m) - 1]} ${y}` : ''
  return [a.journal, issue, a.page ? `p.${a.page}` : ''].filter(Boolean).join(' · ')
}

export const usd = (n: number) => `$${n.toFixed(2)}`

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable (private mode); state still works for this session
  }
}
