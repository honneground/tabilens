import { useEffect, useState } from 'react'

export interface Spot {
  name_en: string
  name_ja: string
  area_ja: string
  kind: string
  summary_en: string
  why_match: string
  quote_ja: string
  quote_en: string
  lat: number
  lon: number
  geocodedAs: string
  geocoder: 'osm' | 'gsi'
  source: { title: string; journal?: string; date?: string; page?: number }
  photos: string[]
  nearestStation: { id: string; name: string; name_en: string; line: string; km: number } | null
  articleId?: string
}

export const KIND_EMOJI: Record<string, string> = {
  hike: '🥾',
  cycle: '🚲',
  onsen: '♨️',
  golf: '⛳',
  view: '🌄',
  food: '🍱',
  stay: '🛖',
  other: '📍',
}

interface Train {
  train_no: string
  type: string
  type_en: string
  dep: string
  arr_at_to: string
}

// Tojo and Ogose line stations are reached from Ikebukuro; everything else from Asakusa.
const originFor = (line: string) => (line === 'tojo' || line === 'ogose' ? { id: 'TJ-01', name: 'Ikebukuro' } : { id: 'TS-01', name: 'Asakusa' })

const hhmm = (t: string) => t.slice(0, 5)

export function Trains({ station }: { station: NonNullable<Spot['nearestStation']> }) {
  const origin = originFor(station.line)
  const [trains, setTrains] = useState<Train[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (station.id === origin.id) return
    let cancelled = false
    fetch(`/api/trains?from=${origin.id}&to=${station.id}&after=08:00`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d.error) setError(d.error)
        else setTrains(d.results ?? [])
      })
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [station.id, origin.id])

  if (station.id === origin.id) return null
  return (
    <div className="mt-2 rounded-lg bg-gray-50 p-2 text-sm">
      <p className="font-medium">
        Trains {origin.name} → {station.name_en} <span className="text-gray-500">from 08:00</span>
      </p>
      {error && <p className="text-red-700">{error}</p>}
      {!trains && !error && <p className="text-gray-500">Loading timetable…</p>}
      {trains?.length === 0 && <p className="text-gray-500">No direct train; you will need to change.</p>}
      <ul className="mt-1 space-y-0.5">
        {trains?.slice(0, 3).map((t) => (
          <li key={t.train_no + t.dep} className="flex gap-2">
            <span className="w-24 text-gray-600">{t.type_en}</span>
            <span className="font-mono">
              {hhmm(t.dep)} → {hhmm(t.arr_at_to)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SpotCard({ spot, onClose }: { spot: Spot; onClose: () => void }) {
  return (
    <div className="max-h-[60vh] overflow-y-auto">
      {spot.photos[0] && (
        <img src={spot.photos[0]} alt={spot.name_en} className="mb-3 max-h-48 w-full rounded-xl object-cover" />
      )}
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <p className="text-xs text-gray-500">
            {KIND_EMOJI[spot.kind]} {spot.kind} · {spot.area_ja}
          </p>
          <h2 className="text-xl font-semibold">
            {spot.name_en} <span className="text-base font-normal text-gray-500">{spot.name_ja}</span>
          </h2>
        </div>
        <button onClick={onClose} aria-label="Close" className="text-gray-400">
          ✕
        </button>
      </div>
      <p className="mt-2 text-sm leading-relaxed">{spot.summary_en}</p>
      <p className="mt-2 text-sm text-gray-600">{spot.why_match}</p>
      <blockquote className="mt-3 border-l-2 border-[#c8102e] pl-3 text-sm">
        <p>“{spot.quote_en}”</p>
        <p className="mt-1 text-gray-500">{spot.quote_ja}</p>
      </blockquote>
      <p className="mt-2 text-xs text-gray-500">
        Source: {spot.source.journal} {spot.source.date?.slice(0, 7)}
        {spot.source.page ? `, p.${spot.source.page}` : ''} · “{spot.source.title}” · ADDIX
      </p>
      {spot.nearestStation && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-sm">
            Nearest Tobu station: <b>{spot.nearestStation.name}</b> {spot.nearestStation.name_en}{' '}
            <span className="text-gray-500">({spot.nearestStation.km} km)</span>
          </p>
          {spot.nearestStation.km < 40 ? (
            <Trains station={spot.nearestStation} />
          ) : (
            <p className="mt-1 text-sm text-gray-500">This spot is far from the Tobu network.</p>
          )}
        </div>
      )}
      <p className="mt-3 text-[11px] text-gray-400">
        Location matched to “{spot.geocodedAs}” via {spot.geocoder === 'osm' ? 'OpenStreetMap' : '国土地理院'}.
      </p>
    </div>
  )
}
