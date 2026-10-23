import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import stationData from './data/stations.json'
import { PlanPanel } from './PlanPanel'
import { Reader, RunResults } from './Results'
import { KIND_EMOJI, SpotCard } from './SpotCard'
import { issueLabel, load, save, type ArticleCard, type LockedCard, type PlanItem, type Run, type SearchEntry, type Spot } from './types'

type Station = (typeof stationData.stations)[number]
type LatLng = { lat: number; lon: number }

const STATIONS: Station[] = stationData.stations
const ASAKUSA: LatLng = { lat: 35.711944, lon: 139.798333 }

const LINE_COLORS: Record<string, string> = {
  main: '#c8102e',
  tojo: '#0067c0',
  ogose: '#00a7a0',
  urban_park: '#2e9b3c',
}

const LINE_NAMES: Record<string, string> = {
  main: 'Isesaki / Nikko lines',
  tojo: 'Tojo line',
  ogose: 'Ogose line',
  urban_park: 'Urban Park line',
}

const BASEMAPS = {
  osm: {
    label: 'Map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  gsi: {
    label: 'Topo',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
    attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
  },
} as const

const INTERESTS = ['🥾 Hike', '🚲 Cycle', '♨️ Onsen', '⛳ Golf', '🍁 Autumn leaves']

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#1c1a17;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const youIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 0 6px rgba(37,99,235,.25)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

const spotIcon = (kind: string, active: boolean) =>
  L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:${active ? 40 : 32}px;height:${active ? 40 : 32}px;border-radius:50%;background:white;border:2px solid ${active ? '#c8102e' : '#1c1a17'};box-shadow:0 2px 6px rgba(0,0,0,.35);font-size:${active ? 20 : 16}px">${KIND_EMOJI[kind] ?? '📍'}</div>`,
    iconSize: [active ? 40 : 32, active ? 40 : 32],
    iconAnchor: [active ? 20 : 16, active ? 20 : 16],
  })

function distanceKm(a: LatLng, b: LatLng) {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

function nearestStations(point: LatLng, n = 3) {
  return STATIONS.map((s) => ({ station: s, km: distanceKm(point, s) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n)
}

function ClickHandler({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lon: e.latlng.lng }) })
  return null
}

function FitSpots({ spots }: { spots: Spot[] }) {
  const map = useMap()
  useEffect(() => {
    if (!spots.length) return
    map.fitBounds(L.latLngBounds(spots.map((s) => [s.lat, s.lon])).pad(0.3), { maxZoom: 12 })
  }, [map, spots])
  return null
}

function FlyTo({ target }: { target: LatLng | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 12), { duration: 0.8 })
  }, [map, target])
  return null
}

// Leaflet must be told when its container changes size (the layout grows into columns).
function ResizeWatcher() {
  const map = useMap()
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}

const newId = () => Math.random().toString(36).slice(2, 10)

export default function App() {
  const [basemap, setBasemap] = useState<keyof typeof BASEMAPS>('osm')
  const [query, setQuery] = useState('')
  const [interest, setInterest] = useState<string | null>(null)
  const [you, setYou] = useState<LatLng | null>(null)
  const [pin, setPin] = useState<LatLng | null>(null)
  const [selected, setSelected] = useState<Station | null>(null)
  const [flyTarget, setFlyTarget] = useState<LatLng | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [activeSpot, setActiveSpot] = useState<Spot | null>(null)
  const [reading, setReading] = useState<{ article: ArticleCard; runId: string } | null>(null)
  const [plan, setPlan] = useState<PlanItem[]>(() => load('tabilens.plan', []))
  const [searches, setSearches] = useState<SearchEntry[]>(() => load('tabilens.searches', []))

  useEffect(() => save('tabilens.plan', plan), [plan])
  useEffect(() => save('tabilens.searches', searches), [searches])

  const researching = runs.length > 0 || plan.length > 0
  const latest = runs[0]
  const busy = Boolean(latest && !latest.done && !latest.error)
  const allSpots = useMemo(() => runs.flatMap((r) => r.spots), [runs])
  const latestSpots = useMemo(() => latest?.spots ?? [], [latest])
  const planned = useMemo(() => new Set(plan.map((p) => p.id)), [plan])

  const updateRun = (id: string, patch: (r: Run) => Partial<Run>) =>
    setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch(r) } : r)))

  function locate() {
    if (!navigator.geolocation) return setNotice('Location is not available in this browser.')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        setYou(here)
        setPin(here)
        setSelected(null)
        setFlyTarget(here)
      },
      () => setNotice('Could not get your location, so the map starts at Asakusa.'),
    )
  }

  function pick(point: LatLng) {
    setPin(point)
    setSelected(null)
    setActiveSpot(null)
    setFlyTarget(null)
  }

  function showSpot(s: Spot) {
    setActiveSpot(s)
    setSelected(null)
    setPin(null)
    setFlyTarget({ lat: s.lat, lon: s.lon })
  }

  async function explore(text = [interest, query].filter(Boolean).join(' ')) {
    if (!text.trim() || busy) return
    const id = newId()
    setRuns((rs) => [{ id, query: text, status: 'Starting', done: false, spent: 0, articles: [], spots: [], locked: [] }, ...rs])
    setSearches((s) => [{ id, text, at: Date.now() }, ...s.filter((e) => e.text !== text)])
    setActiveSpot(null)
    setSelected(null)
    setPin(null)
    setQuery('')
    setInterest(null)
    try {
      const res = await fetch('/api/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      })
      if (!res.ok || !res.body) throw new Error(`Backend error ${res.status}. Is \`npm run server\` running?`)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines.filter(Boolean)) handle(id, JSON.parse(line))
      }
    } catch (err) {
      updateRun(id, () => ({ error: String(err) }))
    }
  }

  function handle(id: string, event: any) {
    switch (event.type) {
      case 'status':
        return updateRun(id, () => ({ status: event.message }))
      case 'plan':
        return updateRun(id, () => ({ status: 'Searching the magazines', queries: event.queries }))
      case 'previewed':
        return updateRun(id, () => ({ previewed: event }))
      case 'unlocked':
        return updateRun(id, (r) => ({ spent: r.spent + event.charged, balance: event.balance }))
      case 'done':
        return updateRun(id, () => ({
          done: true,
          articles: event.articles,
          spots: event.spots,
          locked: event.locked ?? [],
          note: event.note,
        }))
      case 'error':
        return updateRun(id, () => ({ error: event.message }))
    }
  }

  async function unlock(run: Run, hit: LockedCard) {
    const res = await fetch('/api/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request: run.query, hit }),
    })
    const data = await res.json()
    if (data.error) return updateRun(run.id, () => ({ error: data.error }))
    updateRun(run.id, (r) => ({
      articles: [...r.articles, ...data.articles.filter((a: ArticleCard) => !r.articles.some((x) => x.id === a.id))],
      spots: [...r.spots, ...data.spots],
      locked: r.locked.filter((l) => l.id !== hit.id),
      spent: r.spent + (data.charged ?? 0),
      balance: data.balance ?? r.balance,
    }))
  }

  function addArticle(a: ArticleCard) {
    const id = `article:${a.id}`
    if (planned.has(id)) return
    setPlan((p) => [...p, { id, kind: 'article', title: a.headline_en, subtitle: issueLabel(a), photo: a.photos[0], note: '', article: a }])
  }

  function addSpot(s: Spot) {
    const id = `spot:${s.name_ja}`
    if (planned.has(id)) return
    setPlan((p) => [...p, { id, kind: 'spot', title: s.name_en, subtitle: `${s.name_ja} · ${s.area_ja}`, photo: s.photos[0], note: '', spot: s }])
  }

  const nearby = pin ? nearestStations(pin) : []
  const tiles = BASEMAPS[basemap]
  const readingRun = reading ? runs.find((r) => r.id === reading.runId) : undefined

  const searchBox = (
    <div className="pointer-events-auto rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur">
      <span className="text-lg font-semibold tracking-tight">
        TabiLens <span className="text-gray-400">旅レンズ</span>
      </span>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void explore()
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Where do you want to escape to? e.g. easy lake walk with onsen"
          className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-400"
        />
        <button disabled={busy} className="rounded-xl bg-[#c8102e] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy ? 'Exploring…' : 'Explore'}
        </button>
      </form>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {INTERESTS.map((i) => (
          <button
            key={i}
            onClick={() => setInterest(interest === i ? null : i)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
              interest === i ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            {i}
          </button>
        ))}
      </div>
    </div>
  )

  const map = (
    <div className="relative h-full w-full">
      <MapContainer center={[ASAKUSA.lat, ASAKUSA.lon]} zoom={9} zoomControl={false} className="h-full w-full">
        <TileLayer key={basemap} url={tiles.url} attribution={tiles.attribution} maxZoom={18} />
        <ClickHandler onPick={pick} />
        <FlyTo target={flyTarget} />
        <ResizeWatcher />

        {STATIONS.map((s) => (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lon]}
            radius={selected?.id === s.id ? 9 : 6}
            pathOptions={{ color: 'white', weight: 2, fillColor: LINE_COLORS[s.line], fillOpacity: 1 }}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e)
                setSelected(s)
                setActiveSpot(null)
                setPin(null)
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              {s.name} <span className="text-gray-500">{s.name_en}</span>
            </Tooltip>
          </CircleMarker>
        ))}

        {allSpots.map((s, i) => (
          <Marker
            key={`${s.name_ja}-${i}`}
            position={[s.lat, s.lon]}
            icon={spotIcon(s.kind, activeSpot === s)}
            zIndexOffset={1000}
            eventHandlers={{ click: () => showSpot(s) }}
          >
            <Tooltip direction="top" offset={[0, -14]}>
              {s.name_en}
            </Tooltip>
          </Marker>
        ))}
        <FitSpots spots={latestSpots} />

        {you && <Marker position={[you.lat, you.lon]} icon={youIcon} />}
        {pin && pin !== you && <Marker position={[pin.lat, pin.lon]} icon={pinIcon} />}
      </MapContainer>

      {!researching && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-4">
          <div className="mx-auto max-w-xl">{searchBox}</div>
        </div>
      )}

      <div className="absolute right-3 bottom-6 z-[1000] flex flex-col gap-2">
        <button onClick={locate} className="h-11 w-11 rounded-full bg-white text-lg shadow-lg" aria-label="Show my location" title="Show my location">
          ◎
        </button>
        <button
          onClick={() => setBasemap(basemap === 'osm' ? 'gsi' : 'osm')}
          className="h-11 w-11 rounded-full bg-white text-xs font-medium shadow-lg"
          title="Switch map style"
        >
          {BASEMAPS[basemap === 'osm' ? 'gsi' : 'osm'].label}
        </button>
      </div>

      {(selected || pin || notice || activeSpot) && (
        <div className="absolute bottom-6 left-4 z-[1000] w-96">
          <div className="rounded-2xl bg-white p-4 shadow-lg">
            {notice && (
              <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                <span className="flex-1">{notice}</span>
                <button onClick={() => setNotice(null)} aria-label="Dismiss" className="text-amber-700">
                  ✕
                </button>
              </div>
            )}

            {activeSpot && <SpotCard spot={activeSpot} onClose={() => setActiveSpot(null)} />}

            {selected && (
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: LINE_COLORS[selected.line] }} />
                  <span className="text-xs text-gray-500">
                    {LINE_NAMES[selected.line]} · {selected.id}
                  </span>
                </div>
                <h2 className="mt-1 text-xl font-semibold">
                  {selected.name} <span className="text-base font-normal text-gray-500">{selected.name_en}</span>
                </h2>
              </div>
            )}

            {pin && !selected && !activeSpot && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500">{pin === you ? 'You are here' : 'Dropped pin'} · nearest Tobu stations</h2>
                <ul className="mt-2 space-y-1">
                  {nearby.map(({ station, km }) => (
                    <li key={station.id}>
                      <button
                        onClick={() => {
                          setSelected(station)
                          setFlyTarget({ lat: station.lat, lon: station.lon })
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-gray-50"
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: LINE_COLORS[station.line] }} />
                        <span className="flex-1">
                          {station.name} <span className="text-sm text-gray-500">{station.name_en}</span>
                        </span>
                        <span className="text-sm text-gray-500">{km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )

  if (!researching) return <div className="h-full w-full">{map}</div>

  return (
    <div className="grid h-full w-full grid-cols-[minmax(0,1fr)_440px_360px]">
      <div className="flex min-h-0 flex-col">
        <div className="z-[1001] p-3 pb-0">{searchBox}</div>
        <div className="min-h-0 flex-1 p-3">
          <div className="h-full overflow-hidden rounded-2xl shadow">{map}</div>
        </div>
      </div>

      <main className="min-h-0 space-y-8 overflow-y-auto bg-[#faf8f4] p-4">
        {runs.length === 0 && <p className="text-sm text-gray-500">Search to discover places from the magazines.</p>}
        {runs.map((run) => (
          <RunResults
            key={run.id}
            run={run}
            onSpot={showSpot}
            onRead={(article) => setReading({ article, runId: run.id })}
            onAddArticle={addArticle}
            onAddSpot={addSpot}
            onUnlock={unlock}
            planned={planned}
          />
        ))}
      </main>

      <PlanPanel
        items={plan}
        onUpdate={(id, note) => setPlan((p) => p.map((i) => (i.id === id ? { ...i, note } : i)))}
        onRemove={(id) => setPlan((p) => p.filter((i) => i.id !== id))}
        onShowSpot={showSpot}
        searches={searches}
        onEditSearch={(id, text) => setSearches((s) => s.map((e) => (e.id === id ? { ...e, text } : e)))}
        onDeleteSearch={(id) => setSearches((s) => s.filter((e) => e.id !== id))}
        onRunSearch={(text) => void explore(text)}
        onCombine={(texts) => setQuery(texts.length === 1 ? texts[0] : texts.join('. Also: '))}
      />

      {reading && (
        <Reader
          article={reading.article}
          run={readingRun}
          onClose={() => setReading(null)}
          onUnlock={unlock}
          onAddArticle={addArticle}
          planned={planned}
        />
      )}
    </div>
  )
}
