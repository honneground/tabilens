# TabiLens 旅レンズ (main app)

Map-first day-trip finder: ADDIX outdoor magazine spots pinned on a map, with the nearest Tobu station and real train times. Started from [ideas/tabilens-oskar](../ideas/tabilens-oskar/); pitch in [its PROPOSAL.md](../ideas/tabilens-oskar/PROPOSAL.md).

## What works

- Leaflet map (OpenStreetMap, or GSI topo) with 69 Tobu stations from `src/data/stations.json`, fetched once via Redpine's free `tobu--find_stop` (partial list, 206 exist).
- Tap the map or use your location to get the nearest stations.
- **Explore**: Claude writes Japanese ADDIX searches → free Redpine previews → unlock the best pages (capped at $2.50) with photos → Claude extracts only places named in the pages → free geocoding (Nominatim, then GSI) → emoji pins.
- Spot card: magazine photo, summary, quote, citation (magazine, issue, page), nearest Tobu station and the next trains from Asakusa or Ikebukuro (`tobu--rail_departures`, free).

## Run

```bash
npm install
# .env (never commit):
#   REDPINE_API_KEY=...     app.redpine.ai
#   ANTHROPIC_API_KEY=...   optional, a Console key (sk-ant-api...)
npm run server   # API on :8787 (Node 22.6+ runs the TypeScript directly)
npm run dev      # map on :5173, proxies /api to the server
```

Restart `npm run server` after editing `.env`; it is only read at startup.

### How Claude is called (`server/llm.ts`)

- With a Console key (`sk-ant-api...`) in `.env`: the Anthropic API (`claude-opus-5`).
- Without one: the local `claude -p` CLI on your own Claude Code login. Local prototyping only, never for a hosted or shared app. Each call takes ~5-10 s.
- Force either with `LLM_BACKEND=api` or `LLM_BACKEND=claude-cli`.

Redpine results, geocodes and photos are cached in `.cache/` (gitignored, licensed content), so repeat searches are free and instant.

## Layout

- `src/App.tsx` map, search panel, bottom sheet
- `src/SpotCard.tsx` spot details and train times
- `server/index.ts` HTTP API: `POST /api/explore` (NDJSON progress stream), `GET /api/trains`, `GET /api/figures/:name`
- `server/explore.ts` the explore pipeline (plan → search → unlock → extract → geocode)
- `server/llm.ts` Claude via API or local CLI
- `server/redpine.ts` Redpine MCP client (`https://api.redpine.ai/mcp`): preview, confirm with figures, Tobu tools

## Known gaps

- Photo-to-page matching from `confirm` is unverified; run with `DEBUG_REDPINE=1` to log the response layout.
- ADDIX has few pages near Tobu lines; check coverage before relying on a demo query.
