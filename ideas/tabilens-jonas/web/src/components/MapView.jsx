import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../lib/loadGoogleMaps.js';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
// Google's public test Map ID — swap for your own Map ID (Cloud Console → Map Management) to style the map.
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

const STYLE = {
  origin: { bg: '#1d2420', glyph: 'S' },
  station: { bg: '#1a4f8b', glyph: '🚆' },
  bus: { bg: '#c4532d', glyph: '🚌' },
  spot: { bg: '#2f5d46', glyph: '★' },
};

export default function MapView({ places = [] }) {
  const el = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!API_KEY || !el.current || places.length === 0) return;
    let cancelled = false;
    const markers = [];

    (async () => {
      try {
        await loadGoogleMaps(API_KEY);
        const { Map, Polyline, LatLngBounds } = await google.maps.importLibrary('maps');
        const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary('marker');
        const { Geocoder } = await google.maps.importLibrary('geocoding');
        if (cancelled) return;

        const resolved = await resolveCoords(places, new Geocoder());
        if (cancelled) return;

        const map = new Map(el.current, {
          mapId: MAP_ID,
          center: resolved[0] ?? { lat: 36.2, lng: 139.6 },
          zoom: 9,
          mapTypeControl: false,
          streetViewControl: false,
        });

        const bounds = new LatLngBounds();
        resolved.forEach((p, i) => {
          if (!p.position) return;
          const s = STYLE[p.kind] ?? STYLE.spot;
          const pin = new PinElement({
            background: s.bg,
            borderColor: '#ffffff',
            glyph: p.kind === 'origin' ? String(i + 1) : s.glyph,
            glyphColor: '#ffffff',
          });
          markers.push(new AdvancedMarkerElement({ map, position: p.position, title: p.name, content: pin.element }));
          bounds.extend(p.position);
        });

        // Trip line: straight segments between stops (illustrative, not the actual track).
        new Polyline({
          map,
          path: resolved.filter((p) => p.position).map((p) => p.position),
          strokeColor: '#2f5d46',
          strokeOpacity: 0.7,
          strokeWeight: 3,
          icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '14px' }],
        });

        if (!bounds.isEmpty()) map.fitBounds(bounds, 48);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();

    return () => {
      cancelled = true;
      markers.forEach((m) => (m.map = null));
    };
  }, [places]);

  const directionsUrl = buildDirectionsUrl(places);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 py-3">
        <h2 className="font-display text-lg font-bold text-moss-dark">Route map</h2>
        {directionsUrl && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-rail px-3 py-1 text-xs font-medium text-white hover:opacity-90"
          >
            Open in Google Maps →
          </a>
        )}
      </div>

      {!API_KEY ? (
        <p className="px-5 pb-5 text-sm text-ink/60">
          Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to <code>web/.env</code> to show the map.
        </p>
      ) : error ? (
        <p className="px-5 pb-5 text-sm text-maple">{error}</p>
      ) : (
        <div ref={el} className="h-80 w-full bg-paper" />
      )}

      <ol className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-5 py-3 text-xs text-ink/70">
        {places.map((p) => (
          <li key={p.id} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: (STYLE[p.kind] ?? STYLE.spot).bg }} />
            {p.name}
          </li>
        ))}
      </ol>
    </section>
  );
}

// Use given coordinates; geocode by name only when they're missing (needs Geocoding API enabled).
async function resolveCoords(places, geocoder) {
  return Promise.all(
    places.map(async (p) => {
      if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) return { ...p, position: { lat: p.lat, lng: p.lng } };
      try {
        const { results } = await geocoder.geocode({ address: p.name, region: 'jp' });
        const loc = results?.[0]?.geometry?.location;
        return { ...p, position: loc ? { lat: loc.lat(), lng: loc.lng() } : null };
      } catch {
        return { ...p, position: null };
      }
    })
  );
}

// Universal Maps URL — works without an API key and opens the app on phones.
function buildDirectionsUrl(places) {
  const pts = places.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (pts.length < 2) return null;
  const fmt = (p) => `${p.lat},${p.lng}`;
  const origin = pts[0];
  const dest = pts[pts.length - 1];
  const waypoints = pts.slice(1, -1).map(fmt).join('|');
  const params = new URLSearchParams({ api: '1', origin: fmt(origin), destination: fmt(dest), travelmode: 'transit' });
  if (waypoints) params.set('waypoints', waypoints);
  return `https://www.google.com/maps/dir/?${params}`;
}
