import type { Run } from './types'

export function completedSearches(runs: Run[]): Run[] {
  if (!Array.isArray(runs)) return []
  const seen = new Set<string>()
  return runs.filter((r) => {
    if (!r || !r.done || r.error || typeof r.query !== 'string'
      || !Array.isArray(r.articles) || !Array.isArray(r.spots) || !Array.isArray(r.locked)) return false
    const key = r.query.trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 12)
}

export function cachedSearch(runs: Run[], query: string): Run | undefined {
  return runs.find((r) => r.query.trim() === query.trim() && r.done && !r.error)
}
