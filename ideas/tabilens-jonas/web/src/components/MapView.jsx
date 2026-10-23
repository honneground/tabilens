import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../lib/loadGoogleMaps.js';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

const STYLE = {
  origin: { bg: '#1d2420', glyph: 'S' },
  station: { bg: '#1a4f8b', glyph: '🚆' },
  bus: { bg: '#c4532d', glyph: '🚌' },
  spot: { bg: '#2f5d46', glyph: '★' },
};

export default function MapView({ places = [] }) {
  const el = useRef(null);
  const [useLeaflet, setUseLeaflet] = useState(!API_KEY);

  useEffect(() => {
    if (!el.current || places.length === 0) return;
    let cancelled = false;

    if (!API_KEY || useLeaflet) {
      renderLeafletMap(el.current, places);
      return;
    }

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
        console.warn('Google Maps unavailable, falling back to Leaflet:', e.message);
        if (!cancelled) {
          setUseLeaflet(true);
          renderLeafletMap(el.current, places);
        }
      }
    })();

    return () => {
      cancelled = true;
      markers.forEach((m) => (m.map = null));
      if (el.current?._leaflet_map) {
        el.current._leaflet_map.remove();
        delete el.current._leaflet_map;
      }
    };
  }, [places, useLeaflet]);

  const directionsUrl = buildDirectionsUrl(places);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-bold text-moss-dark">Route map</h2>
          {useLeaflet && (
            <span className="rounded-full bg-sand px-2 py-0.5 text-[10px] font-mono text-ink/60">
              OpenStreetMap
            </span>
          )}
        </div>
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

      <div ref={el} className="h-80 w-full bg-sand-light" />

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

function renderLeafletMap(container, places) {
  if (!window.L || !container) return;
  if (container._leaflet_map) {
    container._leaflet_map.remove();
    delete container._leaflet_map;
  }

  const validPlaces = places.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const center = validPlaces[0] ? [validPlaces[0].lat, validPlaces[0].lng] : [36.2, 139.6];

  const map = window.L.map(container, {
    zoomControl: false,
    attributionControl: false,
  }).setView(center, 9);
  container._leaflet_map = map;

  window.L.control.zoom({ position: 'topright' }).addTo(map);

  window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 18,
    subdomains: 'abcd',
  }).addTo(map);

  const latlngs = [];
  validPlaces.forEach((p, idx) => {
    const s = STYLE[p.kind] ?? STYLE.spot;
    const glyph = p.kind === 'origin' ? String(idx + 1) : s.glyph;
    const icon = window.L.divIcon({
      className: 'custom-leaflet-pin',
      html: `<div style="background:${s.bg}; color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #fff; font-size:12px; font-weight:bold; box-shadow:0 2px 6px rgba(0,0,0,0.3);">${glyph}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const marker = window.L.marker([p.lat, p.lng], { icon }).addTo(map);
    marker.bindPopup(`<strong>${p.name}</strong>`);
    latlngs.push([p.lat, p.lng]);
  });

  if (latlngs.length > 1) {
    window.L.polyline(latlngs, {
      color: '#2f5d46',
      weight: 3.5,
      dashArray: '6, 8',
      opacity: 0.8,
    }).addTo(map);
    map.fitBounds(latlngs, { padding: [40, 40] });
  }
}

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
