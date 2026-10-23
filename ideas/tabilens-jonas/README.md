# TabiLens (旅レンズ)

Autonomous editorial day-trip & transit copilot — Team 19, Redpine × NordicNinja × KDDI Tokyo Hackathon 2026.

Mood prompt → ADDIX magazine spot (with editorial photo) → live Tobu rail + bus timetable → route map, weather and history for the destination.

Then two steps:

1. **Research your interest**: walk Wikipedia's link graph from the destination (related topics, places within 10 km, places near you) and save what you want to remember.
2. **Your trip document**: one page with the plan, the trip-day forecast and your saved notes. Print it or save it as a PDF, or download it as Markdown.

## Quick start

Requires Node.js 22.9 or newer (the server uses `--env-file-if-exists`).

```bash
npm install
cp server/.env.example server/.env   # mock mode by default
cp web/.env.example web/.env         # add your Google Maps key here
npm run dev                          # API :8787 + web :5173
```

Open http://localhost:5173. Mock mode returns a canned itinerary so the UI and demo flow work with zero credits spent. Each suggestion chip has its own route:

| Query | Mock route |
|---|---|
| Beginner hike with scenic lake views and onsen | Lake Chuzenji shoreline walk & Yumoto Onsen |
| Easy autumn leaves walk near Nikko | Kanmangafuchi Abyss & Shinkyo Bridge |
| Riverside cycling along Arakawa | Arakawa cycling road, Horikiri to Iwabuchi Floodgate |

Typed queries are matched by keyword (cycling/bike/Arakawa, lake/onsen, autumn/leaves/walk); anything else gets the lake route. Mock timetables are made up; the places are real. The weather, destination photo, history explorer and Wikipedia lookups are real even in mock mode.

## Google Maps and Places

The route map and destination photo need a browser key in `web/.env` (`VITE_GOOGLE_MAPS_API_KEY`). In Google Cloud Console, on the key's project, enable:

- **Maps JavaScript API**: the route map
- **Places API (New)**: the destination photo (not the older "Places API")
- **Geocoding API**: only needed if live stops come back without coordinates

If the key has API restrictions, allow the same APIs there. Restrict it to HTTP referrers `localhost:5173/*`, `localhost:8787/*` plus your demo URL. The "Open in Google Maps" button needs no key. Newly enabled APIs can take a few minutes to start working.

**Destination photo.** When the spot has no editorial photo (always the case in mock mode), the spot card searches Google Places for the spot's name and area and shows the top photo. Google's terms require the photographer credit shown in the caption, so keep it.

## Weather

The plan includes a 16-day daily forecast (high temperature, chance of rain) for the spot, or the destination station if the spot has no coordinates. It comes from [Open-Meteo](https://open-meteo.com/), which is free and needs no key. If the call fails, the plan still returns, with `weather: null`.

Pick a trip date next to the origin station. If it's within the forecast range, the weather card and trip document lead with that day. If it's further out, they say when the forecast will be available (about 15 days before).

## History

Each mock route has a hand-written history: a short intro and a timeline. It was written for the demo, so check the details before presenting them.

In live mode, a spot without its own history gets the summary of its English Wikipedia article (`server/src/wikipedia.js`). Route titles like "Lake Chuzenji shoreline walk & Yumoto Onsen" are split into place names ("Lake Chuzenji", "Yumoto Onsen", then the area), and a match must start with that name and be about somewhere in Japan. Station and disambiguation pages are skipped.

## Step 1: Research your interest

The explorer opens on the destination's Wikipedia article and draws it as a small link graph:

- **Green**: related articles (Wikipedia's `morelike:` search)
- **Blue**: articles within 10 km. For the starting topic this is measured from the spot's map pin, because an article's own point can be far off the route (the Arakawa River's is in Kumagaya).

Click any topic to move there; the reading trail lets you jump back. "What's near me right now?" uses the browser's location, for use during the trip. "Save to trip notes" adds the topic to the step 2 document. Saved topics are kept until you plan a new trip or reload.

API: `GET /api/explore?title=…` or `?name=<spot name>&area=<spot area>[&lat=&lng=]`, and `GET /api/nearby?lat=&lng=`.

Wikipedia text is CC BY-SA 4.0. The app credits it wherever it appears; keep those credits.

## Step 2: Your trip document

One page with the overview, trip-day weather, trains and buses (with a Google Maps link), a gear checklist, the history, your research notes and sources. The preview on screen is exactly what prints:

- **Print / Save as PDF** prints only the document (the rest of the page is hidden by print styles); choose "Save as PDF" in the print dialog.
- **Download .md** saves the same content as Markdown, for notes apps or editing.

## Going live

1. In `server/.env` set `TABILENS_MODE=live`, `REDPINE_MCP_URL`, `REDPINE_API_KEY`.
2. Check the connection: `curl localhost:8787/api/health` (returns your balance).
3. Confirm the real tool names for your account: `curl "localhost:8787/api/tools?q=addix"`, `?q=tobu`, `?q=chronicle`. Update the `*_TOOL` vars in `.env` if they differ.
4. Run one query, look at the raw responses, and tighten the field mapping in `server/src/normalize.js` (every spot is marked `TODO(live)`).

`MAX_AUTO_CONFIRM_USD` caps what a single search can spend without a human click — anything pricier comes back in `billing.pending`.

## Layout

```
server/src/
  index.js          Express API (/api/health, /api/plan, /api/confirm, /api/tools, /api/explore, /api/nearby)
  orchestrator.js   The pipeline: editorial → transit → audio → history → weather
  wikipedia.js      Wikipedia lookups: history summary, related and nearby articles
  redpine.js        MCP client: preview / confirm / call-tool + guarded auto-confirm
  intent.js         English mood → Japanese magazine query (rule-based)
  normalize.js      Raw Redpine/Tobu payloads → Unified JSON Payload
  mock.js           Demo payloads in the same shape, one per suggestion
web/src/
  App.jsx
  components/       QueryInput, SpotCard, HistoryCard, MapView, WeatherCard, TimetableWidget,
                    ExplorePanel (step 1), ItineraryPanel (step 2)
  lib/              loadGoogleMaps (script loader), placePhoto (Places photo lookup),
                    itinerary (trip document and Markdown export)
```

The server still runs the Chronicle audio search in live mode and returns `audio` and `trace` in the plan, but the web app no longer shows them.

## Demo build

`npm run build && npm start` serves the built frontend from the API on :8787 — one process, one URL for the live demo.

## Next steps

- Wire live tool responses into `normalize.js`
- Return-trip routing (second `rail_departures` call, reversed)
- Spacia X affiliate deep-link button
- LLM-based intent parsing instead of the rule table
- Drop the Chronicle audio step from the server, or show it again (it spends credits in live mode)
- Remember interactions (saved topics, past trips) for personalized suggestions
