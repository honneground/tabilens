import type { ArticleCard, PlanItem, Spot } from './types'
import { issueLabel } from './types'

export const FIRST_DAY = 'day-1'
export const TRIP_DRAG_TYPE = 'application/x-tabilens-item'
export const itemDay = (item: PlanItem) => item.dayId ?? FIRST_DAY

export function articleItem(a: ArticleCard): PlanItem {
  return { id: `article:${a.id}`, kind: 'article', title: a.headline_en, subtitle: issueLabel(a), photo: a.photos[0], note: '', article: a }
}

export function spotItem(s: Spot): PlanItem {
  return { id: `spot:${s.name_ja}`, kind: 'spot', title: s.name_en, subtitle: `${s.name_ja} · ${s.area_ja}`, photo: s.photos[0], note: '', spot: s }
}

/** Move an existing card, or insert a discovered card, without duplicating it. */
export function placeItem(items: PlanItem[], item: PlanItem, dayId: string, beforeId?: string): PlanItem[] {
  if (item.id === beforeId) return items
  const current = items.find((i) => i.id === item.id) ?? item
  const next = items.filter((i) => i.id !== item.id)
  const before = next.findIndex((i) => i.id === beforeId && itemDay(i) === dayId)
  const last = next.findLastIndex((i) => itemDay(i) === dayId)
  next.splice(before >= 0 ? before : last >= 0 ? last + 1 : next.length, 0, { ...current, dayId })
  return next
}

export type TravelMode = 'walking' | 'driving' | 'bicycling' | 'transit'

/** Split routes to respect the mobile Maps limit; transit needs individual legs. */
export function mapLinks(items: PlanItem[], mode: TravelMode): string[] {
  const points = items.flatMap((i) => i.spot && Number.isFinite(i.spot.lat) && Number.isFinite(i.spot.lon)
    && Math.abs(i.spot.lat) <= 90 && Math.abs(i.spot.lon) <= 180 ? [`${i.spot.lat},${i.spot.lon}`] : [])
  if (!points.length) return []
  if (points.length === 1) return [`https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: points[0] })}`]
  const links: string[] = []
  const step = mode === 'transit' ? 1 : 4
  for (let start = 0; start < points.length - 1; start += step) {
    const segment = points.slice(start, start + step + 1)
    const params = new URLSearchParams({ api: '1', origin: segment[0], destination: segment.at(-1)!, travelmode: mode })
    if (segment.length > 2) params.set('waypoints', segment.slice(1, -1).join('|'))
    links.push(`https://www.google.com/maps/dir/?${params}`)
  }
  return links
}
