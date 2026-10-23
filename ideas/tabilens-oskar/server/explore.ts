import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { cached, previewAddix, unlockAddix, type Article, type Hit } from './redpine.ts'

const MODEL = 'claude-opus-5'
const anthropic = new Anthropic()
// Server-side refusal fallback: a declined request is re-run on Anthropic's recommended model.
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }

const UNLOCK_BUDGET_USD = 2.5
const MAX_ARTICLES = 6

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

const SpotsSchema = z.object({
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
  no_match_note: z
    .string()
    .nullable()
    .describe('If the magazines do not really cover the request, say so plainly and what they offer instead.'),
})
export type Spot = z.infer<typeof SpotsSchema>['spots'][number]

async function plan(request: string) {
  const response = await anthropic.beta.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    ...FALLBACK,
    output_config: { effort: 'low', format: betaZodOutputFormat(PlanSchema) },
    system:
      'You turn a traveller request into searches over Japanese outdoor magazines (PEAKS mountaineering, Randonnee hiking, BiCYCLE CLUB cycling, EVEN golf). Use short Japanese keywords: place, activity, season, feature.',
    messages: [{ role: 'user', content: request }],
  })
  if (!response.parsed_output) throw new Error('Claude could not plan the search')
  return response.parsed_output
}

function pick(hits: Hit[]): Hit[] {
  const seen = new Set<string>()
  const picked: Hit[] = []
  let spent = 0
  for (const hit of [...hits].sort((a, b) => b.relevance - a.relevance)) {
    if (seen.has(hit.id) || hit.relevance < 0.25) continue
    seen.add(hit.id)
    if (picked.length >= MAX_ARTICLES || spent + hit.cost > UNLOCK_BUDGET_USD) continue
    picked.push(hit)
    spent += hit.cost
  }
  return picked
}

async function extractSpots(request: string, articles: Article[]) {
  const sources = articles
    .map((a) => `<article id="${a.id}">\n${a.journal} ${a.date} p.${a.page ?? '?'} - ${a.title}\n\n${a.text}\n</article>`)
    .join('\n\n')
  const response = await anthropic.beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    ...FALLBACK,
    output_config: { effort: 'medium', format: betaZodOutputFormat(SpotsSchema) },
    system: `You extract places a traveller could visit from Japanese outdoor magazine pages.
Only list places actually named in the articles (trails, mountains, lakes, onsen, viewpoints, routes, golf courses, huts). Never invent places.
Write English for a visitor. Quotes must be short verbatim excerpts; the content is licensed.`,
    messages: [{ role: 'user', content: `Traveller request: ${request}\n\n${sources}` }],
  })
  if (!response.parsed_output) throw new Error('Claude could not read the articles')
  return response.parsed_output
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

export async function explore(request: string, send: Send) {
  send({ type: 'status', message: 'Reading your request' })
  const { intent_en, queries_ja } = await plan(request)
  send({ type: 'plan', intent: intent_en, queries: queries_ja })

  const hits = (await Promise.all(queries_ja.map((q) => previewAddix(q)))).flat()
  const picked = pick(hits)
  send({
    type: 'previewed',
    found: new Set(hits.map((h) => h.id)).size,
    picked: picked.length,
    estimate: picked.reduce((s, h) => s + h.cost, 0),
  })
  if (!picked.length) {
    send({ type: 'done', spots: [], note: 'The ADDIX magazines have nothing close to this request. Try a hike, cycling route, onsen or golf near Tokyo.' })
    return
  }

  send({ type: 'status', message: `Unlocking ${picked.length} magazine pages` })
  const groups = new Map<string, Hit[]>()
  for (const h of picked) groups.set(h.queryId, [...(groups.get(h.queryId) ?? []), h])
  const unlocked = await Promise.all([...groups.values()].map(unlockAddix))
  const articles = unlocked.flatMap((u) => u.articles)
  send({
    type: 'unlocked',
    count: articles.length,
    charged: unlocked.reduce((s, u) => s + u.charged, 0),
    balance: unlocked.map((u) => u.balance).filter((b) => b !== undefined).at(-1),
  })

  send({ type: 'status', message: 'Finding the places in the articles' })
  const { spots, no_match_note } = await extractSpots(request, articles)

  send({ type: 'status', message: `Placing ${spots.length} spots on the map` })
  const byId = new Map(articles.map((a) => [a.id, a]))
  const placed = []
  for (const spot of spots) {
    const point = await geocode(spot.name_ja, spot.area_ja)
    const article = byId.get(spot.source_id)
    if (!point || !article) continue
    const nearest = STATIONS.map((s) => ({ ...s, km: distanceKm(point, s) })).sort((a, b) => a.km - b.km)[0]
    placed.push({
      ...spot,
      lat: point.lat,
      lon: point.lon,
      geocodedAs: point.label,
      geocoder: point.via,
      source: { title: article.title, journal: article.journal, date: article.date, page: article.page },
      photos: article.figures.map((f) => `/api/figures/${f}`),
      nearestStation: nearest ? { ...nearest, km: Math.round(nearest.km * 10) / 10 } : null,
    })
  }
  send({ type: 'done', spots: placed, unplaced: spots.length - placed.length, note: no_match_note })
}
