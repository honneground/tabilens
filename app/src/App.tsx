import { useEffect, useState } from 'react'
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import stationData from './data/stations.json'
import { KIND_EMOJI, SpotCard, type Spot } from './SpotCard'

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

const spotIcon = (kind: string, active: boolean) =>
  L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:${active ? 40 : 32}px;height:${active ? 40 : 32}px;border-radius:50%;background:white;border:2px solid ${active ? '#c8102e' : '#1c1a17'};box-shadow:0 2px 6px rgba(0,0,0,.35);font-size:${active ? 20 : 16}px">${KIND_EMOJI[kind] ?? '📍'}</div>`,
    iconSize: [active ? 40 : 32, active ? 40 : 32],
    iconAnchor: [active ? 20 : 16, active ? 20 : 16],
  })

function FitSpots({ spots }: { spots: Spot[] }) {
  const map = useMap()
  useEffect(() => {
    if (!spots.length) return
    map.fitBounds(L.latLngBounds(spots.map((s) => [s.lat, s.lon])).pad(0.3), { maxZoom: 12 })
  }, [map, spots])
  return null
}

interface Progress {
  status: string
  queries?: string[]
  previewed?: { found: number; picked: number; estimate: number }
  unlocked?: { charged: number; balance?: number }
  error?: string
}

const usd = (n: number) => `$${n.toFixed(2)}`

function FlyTo({ target }: { target: LatLng | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 12), { duration: 0.8 })
  }, [map, target])
  return null
}

export default function App() {
  const [basemap, setBasemap] = useState<keyof typeof BASEMAPS>('osm')
  const [query, setQuery] = useState('')
  const [interest, setInterest] = useState<string | null>(null)
  const [you, setYou] = useState<LatLng | null>(null)
  const [pin, setPin] = useState<LatLng | null>(null)
  const [selected, setSelected] = useState<Station | null>(null)
  const [flyTarget, setFlyTarget] = useState<LatLng | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [spots, setSpots] = useState<Spot[]>([])
  const [activeSpot, setActiveSpot] = useState<Spot | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const busy = Boolean(progress && !progress.error && progress.status !== 'Done')

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

  async function explore() {
    if (!query.trim() && !interest) return
    setSpots([])
    setActiveSpot(null)
    setSelected(null)
    setPin(null)
    setNotice(null)
    setProgress({ status: 'Starting' })
    try {
      const res = await fetch('/api/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, interest }),
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
        for (const line of lines.filter(Boolean)) handle(JSON.parse(line))
      }
    } catch (err) {
      setProgress((p) => ({ ...(p ?? { status: '' }), error: String(err) }))
    }
  }

  function handle(event: any) {
    switch (event.type) {
      case 'status':
        return setProgress((p) => ({ ...p, status: event.message }))
      case 'plan':
        return setProgress((p) => ({ ...p, status: 'Searching the magazines', queries: event.queries }))
      case 'previewed':
        return setProgress((p) => ({ ...p!, previewed: event }))
      case 'unlocked':
        return setProgress((p) => ({ ...p!, unlocked: event }))
      case 'done':
        setSpots(event.spots)
        setProgress((p) => ({ ...p!, status: 'Done' }))
        if (event.note || !event.spots.length) setNotice(event.note ?? 'No magazine spots found for this.')
        return
      case 'error':
        return setProgress((p) => ({ ...p!, error: event.message }))
    }
  }

  const nearby = pin ? nearestStations(pin) : []
  const tiles = BASEMAPS[basemap]

  return (
    <div className="relative h-full w-full">
      <MapContainer center={[ASAKUSA.lat, ASAKUSA.lon]} zoom={9} zoomControl={false} className="h-full w-full">
        <TileLayer key={basemap} url={tiles.url} attribution={tiles.attribution} maxZoom={18} />
        <ClickHandler onPick={pick} />
        <FlyTo target={flyTarget} />

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
                setPin(null)
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              {s.name} <span className="text-gray-500">{s.name_en}</span>
            </Tooltip>
          </CircleMarker>
        ))}

        {spots.map((s, i) => (
          <Marker
            key={i}
            position={[s.lat, s.lon]}
            icon={spotIcon(s.kind, activeSpot === s)}
            zIndexOffset={1000}
            eventHandlers={{
              click: () => {
                setActiveSpot(s)
                setSelected(null)
                setPin(null)
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -14]}>
              {s.name_en}
            </Tooltip>
          </Marker>
        ))}
        <FitSpots spots={spots} />

        {you && <Marker position={[you.lat, you.lon]} icon={youIcon} />}
        {pin && pin !== you && <Marker position={[pin.lat, pin.lon]} icon={pinIcon} />}
      </MapContainer>

      {/* Search panel */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-3 sm:p-4">
        <div className="pointer-events-auto mx-auto max-w-xl rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">
              TabiLens <span className="text-gray-400">旅レンズ</span>
            </span>
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              explore()
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
      </div>

      {/* Map controls */}
      <div className="absolute right-3 bottom-40 z-[1000] flex flex-col gap-2 sm:bottom-6">
        <button
          onClick={locate}
          className="h-11 w-11 rounded-full bg-white text-lg shadow-lg"
          aria-label="Show my location"
          title="Show my location"
        >
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

      {/* Bottom sheet */}
      {(selected || pin || notice || activeSpot || progress) && (
        <div className="absolute inset-x-0 bottom-0 z-[1000] p-3 sm:left-4 sm:right-auto sm:bottom-6 sm:w-96 sm:p-0">
          <div className="rounded-2xl bg-white p-4 shadow-lg">
            {notice && (
              <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                <span className="flex-1">{notice}</span>
                <button onClick={() => setNotice(null)} aria-label="Dismiss" className="text-amber-700">
                  ✕
                </button>
              </div>
            )}

            {progress && !activeSpot && (
              <div className="mb-3 text-sm">
                <p className="font-medium">
                  {progress.status === 'Done' ? `${spots.length} magazine spots on the map` : progress.status}
                  {busy && <span className="ml-1 animate-pulse">…</span>}
                </p>
                {progress.queries && <p className="mt-1 text-gray-500">Searched: {progress.queries.join(' · ')}</p>}
                {progress.previewed && (
                  <p className="mt-1 text-gray-600">
                    Previewed {progress.previewed.found} pages for free, unlocked the best {progress.previewed.picked} for{' '}
                    {usd(progress.previewed.estimate)}
                    {progress.unlocked?.balance !== undefined && ` (balance ${usd(progress.unlocked.balance)})`}.
                  </p>
                )}
                {progress.error && <p className="mt-1 text-red-700">{progress.error}</p>}
                {progress.status === 'Done' && spots.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {spots.map((s, i) => (
                      <li key={i}>
                        <button
                          onClick={() => {
                            setActiveSpot(s)
                            setFlyTarget({ lat: s.lat, lon: s.lon })
                          }}
                          className="flex w-full gap-2 rounded-lg px-2 py-1 text-left hover:bg-gray-50"
                        >
                          <span>{KIND_EMOJI[s.kind]}</span>
                          <span className="flex-1">{s.name_en}</span>
                          <span className="text-gray-500">{s.source.journal}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
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
                <p className="mt-2 text-sm text-gray-600">
                  Next: magazine spots around this station and the next trains from Asakusa.
                </p>
              </div>
            )}

            {pin && !selected && (
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
}
