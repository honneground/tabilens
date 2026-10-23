import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const REDPINE_URL = process.env.REDPINE_MCP_URL ?? 'https://api.redpine.ai'
export const CACHE_DIR = path.join(process.cwd(), '.cache')

/** An ADDIX search hit from a free preview. */
export interface Hit {
  id: string
  queryId: string
  title: string
  journal?: string
  date?: string
  page?: number
  relevance: number
  cost: number
  figureCount: number
  snippet: string
}

export interface Article extends Hit {
  text: string
  /** File names under .cache/figures, served at /api/figures/<name>. */
  figures: string[]
}

let clientPromise: Promise<Client> | null = null

function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const key = process.env.REDPINE_API_KEY
      if (!key) throw new Error('REDPINE_API_KEY is not set (add it to tabilens/.env)')
      const transport = new StreamableHTTPClientTransport(new URL(REDPINE_URL), {
        requestInit: { headers: { Authorization: `Bearer ${key}` } },
      })
      const client = new Client({ name: 'tabilens', version: '0.1.0' })
      await client.connect(transport)
      return client
    })().catch((err) => {
      clientPromise = null
      throw err
    })
  }
  return clientPromise
}

type ToolResult = { content?: any[]; structuredContent?: any; isError?: boolean }

async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const client = await getClient()
  return (await client.callTool({ name, arguments: args })) as ToolResult
}

// Redpine tools answer with JSON either as structuredContent or inside a text block.
function parseJson(result: ToolResult): any {
  const structured = result.structuredContent
  if (structured && typeof structured === 'object' && Object.keys(structured).length) return structured
  for (const block of result.content ?? []) {
    if (block.type !== 'text' || !block.text) continue
    const start = block.text.indexOf('{')
    if (start === -1) continue
    try {
      return JSON.parse(block.text.slice(start))
    } catch {
      // not the JSON block, keep looking
    }
  }
  const message = (result.content ?? []).map((b) => b.text ?? `[${b.type}]`).join('\n').slice(0, 500)
  throw new Error(`Redpine returned no JSON${result.isError ? ' (error)' : ''}: ${message}`)
}

export async function cached<T>(kind: string, key: unknown, fn: () => Promise<T>): Promise<T> {
  const hash = createHash('sha256').update(JSON.stringify(key)).digest('hex').slice(0, 24)
  const file = path.join(CACHE_DIR, kind, `${hash}.json`)
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch {
    const value = await fn()
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, JSON.stringify(value, null, 2))
    return value
  }
}

/** Free: ranked ADDIX hits with snippets and per-row unlock cost. */
export function previewAddix(query: string, limit = 8): Promise<Hit[]> {
  return cached('preview', { query, limit }, async () => {
    const data = parseJson(
      await callTool('preview', { tool_name: 'search', arguments: { collection: 'addix', query, limit } }),
    )
    return (data.results ?? []).map(
      (row: any): Hit => ({
        id: row.id,
        queryId: data.queryId,
        title: row.title,
        journal: row.journal,
        date: row.publication_date,
        page: row.page,
        relevance: Number(row.relevance ?? 0),
        cost: Number(row.cost_to_unlock ?? 0),
        figureCount: Number(row.figure_count ?? 0),
        snippet: row.chunks?.[0]?.snippet ?? '',
      }),
    )
  })
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

/** Paid: unlocks hits from one preview, with their magazine photos. */
export function unlockAddix(hits: Hit[]): Promise<{ articles: Article[]; charged: number; balance?: number }> {
  const { queryId } = hits[0]
  const ids = hits.map((h) => h.id).sort()
  return cached('unlock', { queryId, ids }, async () => {
    const result = await callTool('confirm', { queryId, result_ids: ids, include_figures: true })
    const data = parseJson(result)
    const byId = new Map(hits.map((h) => [h.id, h]))
    const unlocked = (data.results ?? []).filter((row: any) => byId.has(row.id) && row.locked === false)

    // Images arrive as separate content blocks. Attribute each to the result id named in the
    // nearest preceding text block; otherwise hand them out in order to results that have figures.
    const figures = new Map<string, string[]>()
    const withFigures = unlocked.filter((r: any) => Number(r.figure_count ?? 0) > 0).map((r: any) => r.id)
    let lastId: string | null = null
    let fallback = 0
    await mkdir(path.join(CACHE_DIR, 'figures'), { recursive: true })
    for (const block of result.content ?? []) {
      if (block.type === 'text') {
        const match = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/.exec(block.text ?? '')
        if (match && byId.has(match[1]) && block.text.length < 400) lastId = match[1]
        continue
      }
      if (block.type !== 'image' || !block.data) continue
      const owner = lastId ?? withFigures[fallback++ % Math.max(withFigures.length, 1)]
      if (!owner) continue
      const name = `${owner}-${(figures.get(owner) ?? []).length}.${EXT[block.mimeType] ?? 'jpg'}`
      await writeFile(path.join(CACHE_DIR, 'figures', name), Buffer.from(block.data, 'base64'))
      figures.set(owner, [...(figures.get(owner) ?? []), name])
    }
    if (process.env.DEBUG_REDPINE) {
      console.log('confirm content blocks:', (result.content ?? []).map((b) => b.type + (b.text ? `:${b.text.slice(0, 80)}` : '')))
    }

    const articles: Article[] = unlocked.map((row: any) => ({
      ...byId.get(row.id)!,
      text: (row.chunks ?? []).map((c: any) => c.text ?? '').join('\n'),
      figures: figures.get(row.id) ?? [],
    }))
    return {
      articles,
      charged: Number(data.receipt?.cost_charged ?? data.cost_charged ?? 0),
      balance: data.balance_remaining ? Number(data.balance_remaining) : undefined,
    }
  })
}

/** Free: direct Tobu trains between two stations. */
export async function railDepartures(from: string, to: string, after?: string) {
  const data = parseJson(
    await callTool('call-tool', {
      tool_name: 'tobu--rail_departures',
      arguments: { from, to, limit: 5, ...(after ? { after } : {}) },
    }),
  )
  return data
}
