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

### Search history and trip planning

- Completed search results are stored in this browser, with up to 12 distinct queries retained. Click a search in **My searches** to restore its available results without another MCP request. The refresh arrow explicitly starts a new search and may spend credits. Older history entries without a saved result require a search first.
- Search history and results are local to the browser and origin. Storage failures show a warning. Figure URLs still depend on the local backend and its figure cache.
- Drag an article card or a place chip into **My trip**. Drag a planned card onto another card to insert before it, or onto a day's background to append. The day selector and arrow buttons provide alternatives to dragging.
- Select a day to choose where the + buttons add cards. Insert an empty day after any day for a day gap, or append a day. Trips support up to 14 days; existing cards are restored into Day 1.
- Each day provides Google Maps links for places with coordinates. Article-only cards are excluded. Routes are split into mobile-compatible segments; transit uses individual legs. Links open directions and do not save a multi-day trip to a Google account.
- Run the planning and history checks with `node --test tests/planning.test.mjs`. These checks do not call Redpine or spend credits.

- `src/App.tsx` map, search panel, bottom sheet
- `src/SpotCard.tsx` spot details and train times
- `server/index.ts` HTTP API: `POST /api/explore` (NDJSON progress stream), `GET /api/trains`, `GET /api/figures/:name`
- `server/explore.ts` the explore pipeline (plan → search → unlock → extract → geocode)
- `server/llm.ts` Claude via API or local CLI
- `server/redpine.ts` Redpine MCP client (`https://api.redpine.ai/mcp`): preview, confirm with figures, Tobu tools

## Known gaps

- Photo-to-page matching from `confirm` is unverified; run with `DEBUG_REDPINE=1` to log the response layout.
- ADDIX has few pages near Tobu lines; check coverage before relying on a demo query.
