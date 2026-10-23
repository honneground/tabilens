# TabiLens (旅レンズ)

Autonomous editorial day-trip & transit copilot — Team 19, Redpine × NordicNinja × KDDI Tokyo Hackathon 2026.

Mood prompt → ADDIX magazine spot (with editorial photo) → live Tobu rail + bus timetable → Chronicle audio for the ride.

## Quick start

```bash
npm install
cp server/.env.example server/.env   # mock mode by default
npm run dev                          # API :8787 + web :5173
```

Open http://localhost:5173. Mock mode returns a canned Nikko itinerary so the UI and demo flow work with zero credits spent.

## Google Maps

The route map needs a browser key in `web/.env` (`VITE_GOOGLE_MAPS_API_KEY`). In Google Cloud Console, enable **Maps JavaScript API** (and **Geocoding API** if live stops come back without coordinates), and restrict the key to HTTP referrers `localhost:5173/*`, `localhost:8787/*` plus your demo URL. The "Open in Google Maps" button needs no key.

## Going live

1. In `server/.env` set `TABILENS_MODE=live`, `REDPINE_MCP_URL`, `REDPINE_API_KEY`.
2. Check the connection: `curl localhost:8787/api/health` (returns your balance).
3. Confirm the real tool names for your account: `curl "localhost:8787/api/tools?q=addix"`, `?q=tobu`, `?q=chronicle`. Update the `*_TOOL` vars in `.env` if they differ.
4. Run one query, look at the raw responses, and tighten the field mapping in `server/src/normalize.js` (every spot is marked `TODO(live)`).

`MAX_AUTO_CONFIRM_USD` caps what a single search can spend without a human click — anything pricier comes back in `billing.pending`.

## Layout

```
server/src/
  index.js          Express API (/api/health, /api/plan, /api/confirm, /api/tools)
  orchestrator.js   The 3-step pipeline: editorial → transit → audio
  redpine.js        MCP client: preview / confirm / call-tool + guarded auto-confirm
  intent.js         English mood → Japanese magazine query (rule-based)
  normalize.js      Raw Redpine/Tobu payloads → Unified JSON Payload
  mock.js           Demo payload in the same shape
web/src/
  App.jsx
  components/       QueryInput, SpotCard, TimetableWidget, AudioPlayer, PipelineTrace
```

## Demo build

`npm run build && npm start` serves the built frontend from the API on :8787 — one process, one URL for the live demo.

## Next steps

- Wire live tool responses into `normalize.js`
- Return-trip routing (second `rail_departures` call, reversed)
- Spacia X affiliate deep-link button
- LLM-based intent parsing instead of the rule table
