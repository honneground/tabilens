import { readFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { ask } from './llm.ts'
import { cached, previewAddix, unlockAddix, type Article, type Hit } from './redpine.ts'

const UNLOCK_BUDGET_USD = 2.5
const MAX_ARTICLES = 6
const MAX_LOCKED = 8

type Station = { id: string; name: string; name_en: string; line: string; lat: number; lon: number }
const STATIONS: Station[] = JSON.parse(
  readFileSync(path.join(process.cwd(), 'src/data/stations.json'), 'utf8'),
).stations

export type Send = (event: Record<string, unknown> & { type: string }) => void

const PlanSchema = z.object({
  intent_en: z.string().describe('What the traveller is looking for, one short sentence.'),
  queries_ja: z
    .array(z.string())
    .describe('2-3 short Japanese keyword searches for the ADDIX outdoor magazines, e.g. "日光 紅葉 ハイキング".'),
})

const ReadSchema = z.object({
  articles: z.array(
    z.object({
      source_id: z.string(),
      headline_en: z.string().describe('A short, inviting English headline for this magazine page.'),
      summary_en: z.string().describe('Two or three sentences in English on what the page says, for a curious traveller.'),
    }),
  ),
  spots: z.array(
    z.object({
      name_en: z.string(),
      name_ja: z.string().describe('The place name exactly as written in the article.'),
      area_ja: z.string().describe('Municipality and prefecture in Japanese if the article or common knowledge gives it, e.g. "栃木県日光市". Empty if unknown.'),
      kind: z.enum(['hike', 'cycle', 'onsen', 'golf', 'view', 'food', 'stay', 'other']),
      summary_en: z.string().describe('Two sentences on what the magazine says about it.'),
      why_match: z.string().describe('Why it fits the request, or how it falls short.'),
      source_id: z.string(),
      quote_ja: z.string().describe('A short verbatim excerpt from the article about this place.'),
      quote_en: z.string(),
    }),
  ),
  note: z
    .string()
    .nullable()
    .describe('One or two sentences: how well the pages answer the request, and what to explore next. Null if they answer it well.'),
})
type Read = z.infer<typeof ReadSchema>

function plan(request: string) {
  return ask(
    PlanSchema,
    'You turn a traveller request into searches over Japanese outdoor magazines (PEAKS mountaineering, Randonnee hiking, BiCYCLE CLUB cycling, EVEN golf). Use short Japanese keywords: place, activity, season, feature.',
    request,
    { effort: 'low', maxTokens: 2000 },
  )
}

function pick(hits: Hit[]): Hit[] {
  const picked: Hit[] = []
  let spent = 0
  for (const hit of hits) {
    if (hit.relevance < 0.25) continue
    if (picked.length >= MAX_ARTICLES || spent + hit.cost > UNLOCK_BUDGET_USD) continue
    picked.push(hit)
    spent += hit.cost
  }
  return picked
}

function dedupe(hits: Hit[]): Hit[] {
  const seen = new Set<string>()
  return [...hits].sort((a, b) => b.relevance - a.relevance).filter((h) => !seen.has(h.id) && seen.add(h.id))
}

function readArticles(request: string, articles: Article[]) {
  const sources = articles
    .map((a) => `<article id="${a.id}">\n${a.journal} ${a.date} p.${a.page ?? '?'} - ${a.title}\n\n${a.text}\n</article>`)
    .join('\n\n')
  return ask(
    ReadSchema,
    `You read Japanese outdoor magazine pages (PEAKS, Randonnee, BiCYCLE CLUB, EVEN) for a traveller.
For every article write an English headline and summary that makes the traveller curious.
List as spots only places actually named in the articles (trails, mountains, lakes, onsen, viewpoints, routes, golf courses, inns, huts). Never invent places.
Quotes must be short verbatim excerpts; the content is licensed.`,
    `Traveller request: ${request}\n\n${sources}`,
    { effort: 'medium', maxTokens: 8000 },
  )
}

type Point = { lat: number; lon: number; label: string; via: 'osm' | 'gsi' }

// Nominatim's usage policy allows at most one request per second.
let nextNominatimAt = 0
async function nominatimSlot() {
  const wait = nextNominatimAt - Date.now()
  nextNominatimAt = Math.max(Date.now(), nextNominatimAt) + 1100
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}

/** Free geocoding: OpenStreetMap Nominatim for named places, GSI (国土地理院) for addresses. */
function geocode(name: string, area: string): Promise<Point | null> {
  return cached('geocode', { name, area }, async () => {
    const nominatim = async (q: string) => {
      await nominatimSlot()
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=jp&q=${encodeURIComponent(q)}`
      const res = await fetch(url, { headers: { 'User-Agent': 'TabiLens hackathon prototype (Redpine Tokyo 2026)' } })
      const [hit] = res.ok ? ((await res.json()) as any[]) : []
      return hit ? ({ lat: Number(hit.lat), lon: Number(hit.lon), label: hit.display_name, via: 'osm' } as Point) : null
    }
    const gsi = async (q: string) => {
      const res = await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`)
      const [hit] = res.ok ? ((await res.json()) as any[]) : []
      if (!hit) return null
      const [lon, lat] = hit.geometry.coordinates
      return { lat, lon, label: hit.properties.title, via: 'gsi' } as Point
    }
    return (
      (await nominatim(`${name} ${area}`.trim())) ??
      (await nominatim(name)) ??
      (await gsi(`${area}${name}`)) ??
      (area ? await gsi(area) : null)
    )
  })
}

function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

const lockedCard = ({ id, queryId, title, journal, date, page, cost, snippet, figureCount, relevance }: Hit) => ({
  id, queryId, title, journal, date, page, cost, snippet, figureCount, relevance,
})

/** Article cards plus geocoded spots for a set of unlocked pages. */
async function present(request: string, articles: Article[], read: Read) {
  const byId = new Map(articles.map((a) => [a.id, a]))
  const summaries = new Map(read.articles.map((a) => [a.source_id, a]))
  const cards = articles.map((a) => ({
    id: a.id,
    queryId: a.queryId,
    title: a.title,
    journal: a.journal,
    date: a.date,
    page: a.page,
    text: a.text,
    photos: a.figures.map((f) => `/api/figures/${f}`),
    headline_en: summaries.get(a.id)?.headline_en ?? a.title,
    summary_en: summaries.get(a.id)?.summary_en ?? '',
  }))
  const spots = []
  for (const spot of read.spots) {
    const article = byId.get(spot.source_id)
    const point = article && (await geocode(spot.name_ja, spot.area_ja))
    if (!point || !article) continue
    const nearest = STATIONS.map((s) => ({ ...s, km: distanceKm(point, s) })).sort((a, b) => a.km - b.km)[0]
    spots.push({
      ...spot,
      articleId: article.id,
      lat: point.lat,
      lon: point.lon,
      geocodedAs: point.label,
      geocoder: point.via,
      source: { title: article.title, journal: article.journal, date: article.date, page: article.page },
      photos: article.figures.map((f) => `/api/figures/${f}`),
      nearestStation: nearest ? { ...nearest, km: Math.round(nearest.km * 10) / 10 } : null,
    })
  }
  return { articles: cards, spots }
}

async function unlockAll(hits: Hit[]) {
  const groups = new Map<string, Hit[]>()
  for (const h of hits) groups.set(h.queryId, [...(groups.get(h.queryId) ?? []), h])
  const unlocked = await Promise.all([...groups.values()].map(unlockAddix))
  return {
    articles: unlocked.flatMap((u) => u.articles),
    charged: unlocked.reduce((s, u) => s + u.charged, 0),
    balance: unlocked.map((u) => u.balance).filter((b) => b !== undefined).at(-1),
  }
}

export async function explore(request: string, send: Send) {
  send({ type: 'status', message: 'Reading your request' })
  const { intent_en, queries_ja } = await plan(request)
  send({ type: 'plan', intent: intent_en, queries: queries_ja })

  const hits = dedupe((await Promise.all(queries_ja.map((q) => previewAddix(q)))).flat())
  const picked = pick(hits)
  const pickedIds = new Set(picked.map((h) => h.id))
  const locked = hits.filter((h) => !pickedIds.has(h.id) && h.relevance >= 0.15).slice(0, MAX_LOCKED).map(lockedCard)
  send({ type: 'previewed', found: hits.length, picked: picked.length, estimate: picked.reduce((s, h) => s + h.cost, 0) })
  if (!picked.length) {
    send({ type: 'done', articles: [], spots: [], locked, note: 'The ADDIX magazines have nothing close to this request. Try a hike, cycling route, onsen or golf near Tokyo.' })
    return
  }

  send({ type: 'status', message: `Unlocking ${picked.length} magazine pages` })
  const { articles, charged, balance } = await unlockAll(picked)
  send({ type: 'unlocked', count: articles.length, charged, balance })

  send({ type: 'status', message: 'Reading the articles' })
  const read = await readArticles(request, articles)
  send({ type: 'status', message: `Placing ${read.spots.length} spots on the map` })
  const result = await present(request, articles, read)
  send({ type: 'done', ...result, locked, note: read.note })
}

/** Unlock one more page the user chose, and read it. */
export async function unlockOne(request: string, hit: Hit) {
  const { articles, charged, balance } = await unlockAll([hit])
  const read = await readArticles(request, articles)
  return { ...(await present(request, articles, read)), charged, balance, note: read.note }
}

/** Dig deeper: more pages from the same magazine issue, nearest page numbers first. */
export async function moreFromIssue(article: { id: string; title: string; journal?: string; date?: string; page?: number; text: string }) {
  const query = `${article.title} ${article.text.slice(0, 120)}`
  const filters = { journal: article.journal, publication_date: article.date }
  const hits = await previewAddix(query, 15, filters)
  return hits
    .filter((h) => h.id !== article.id)
    .sort((a, b) => Math.abs((a.page ?? 999) - (article.page ?? 0)) - Math.abs((b.page ?? 999) - (article.page ?? 0)))
    .slice(0, 6)
    .map(lockedCard)
}
