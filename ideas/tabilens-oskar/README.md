# TabiLens 旅レンズ (prototype)

Map-first day-trip finder: ADDIX outdoor magazine spots pinned on a map, with the nearest Tobu station and real train times. Full pitch in [PROPOSAL.md](PROPOSAL.md).

## What works

- Leaflet map (OpenStreetMap, or GSI topo) with 69 Tobu stations from `src/data/stations.json`, fetched once via Redpine's free `tobu--find_stop` (partial list, 206 exist).
- Tap the map or use your location to get the nearest stations.
- **Explore** (needs keys): Claude writes Japanese ADDIX searches → free Redpine previews → unlock the best pages (capped at $2.50) with photos → Claude extracts only places named in the pages → free geocoding (Nominatim, then GSI) → emoji pins.
- Spot card: magazine photo, summary, quote, citation (magazine, issue, page), nearest Tobu station and the next trains from Asakusa or Ikebukuro (`tobu--rail_departures`, free).

## Run

```bash
npm install
# .env (never commit):
#   ANTHROPIC_API_KEY=...   console.anthropic.com
#   REDPINE_API_KEY=...     app.redpine.ai
npm run server   # API on :8787 (Node 22.6+ runs the TypeScript directly)
npm run dev      # map on :5173, proxies /api to the server
```

Redpine results, geocodes and photos are cached in `.cache/` (gitignored, licensed content), so repeat searches are free.

## Layout

- `src/App.tsx` map, search panel, bottom sheet
- `src/SpotCard.tsx` spot details and train times
- `server/redpine.ts` Redpine MCP client (preview, confirm with figures, Tobu tools)
- `server/explore.ts` the explore pipeline (Claude plan → search → unlock → extract → geocode)

## Known gaps

- Not yet run against live keys: Redpine API-key auth and the photo-to-page matching are unverified.
- ADDIX has few pages near Tobu lines; check coverage before relying on a demo query.
