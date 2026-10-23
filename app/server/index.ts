import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { explore, moreFromIssue, unlockOne } from './explore.ts'
import { LLM_BACKEND } from './llm.ts'
import { CACHE_DIR, railDepartures } from './redpine.ts'

const PORT = Number(process.env.PORT ?? 8787)

async function readJson(req: import('node:http').IncomingMessage) {
  let body = ''
  for await (const chunk of req) body += chunk
  return JSON.parse(body || '{}')
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  try {
    if (req.method === 'POST' && url.pathname === '/api/explore') {
      const { query = '', interest = '' } = await readJson(req)
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8' })
      const send = (event: Record<string, unknown>) => res.write(JSON.stringify(event) + '\n')
      try {
        await explore([interest, query].filter(Boolean).join(' '), send)
      } catch (err) {
        console.error(err)
        send({ type: 'error', message: err instanceof Error ? err.message : String(err) })
      }
      return res.end()
    }

    if (req.method === 'POST' && url.pathname === '/api/unlock') {
      const { request = '', hit } = await readJson(req)
      const data = await unlockOne(request, hit)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify(data))
    }

    if (req.method === 'POST' && url.pathname === '/api/more') {
      const { article } = await readJson(req)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ locked: await moreFromIssue(article) }))
    }

    if (req.method === 'GET' && url.pathname === '/api/trains') {
      const from = url.searchParams.get('from') ?? 'TS-01'
      const to = url.searchParams.get('to') ?? ''
      const data = await railDepartures(from, to, url.searchParams.get('after') ?? undefined)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify(data))
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/figures/')) {
      const name = path.basename(url.pathname)
      const file = await readFile(path.join(CACHE_DIR, 'figures', name))
      const type = name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'max-age=86400' })
      return res.end(file)
    }

    res.writeHead(404).end('Not found')
  } catch (err) {
    console.error(err)
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
  }
}).listen(PORT, () => console.log(`TabiLens API on http://localhost:${PORT} (Claude via ${LLM_BACKEND})`))
