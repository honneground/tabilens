// Map raw Redpine / Tobu payloads into the frontend's Unified JSON Payload.
// The exact response shapes are unknown until we inspect them live —
// every function here is defensive and marked with TODOs to tighten at the venue.

const first = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== '');

function results(payload) {
  return payload?.results ?? payload?.data ?? payload?.items ?? [];
}

export function spotFrom(payload, intent) {
  const r = results(payload)[0];
  if (!r) return null;
  // TODO(live): confirm field names from inspect-tool on the ADDIX search tool.
  return {
    id: first(r.id, r.result_id),
    name: first(r.title, r.heading, 'Untitled spot'),
    area: first(r.metadata?.area, r.area, ''),
    difficulty: first(r.metadata?.difficulty, intent.level),
    summary: first(r.text, r.passage, r.snippet, ''),
    nearestStation: first(r.metadata?.nearest_station, null),
    figures: (r.figures ?? r.images ?? []).map((f) => ({
      url: first(f.url, f.src),
      caption: first(f.caption, ''),
      credit: first(f.credit, r.publisher, 'ADDIX'),
    })),
    citation: {
      magazine: first(r.journal, r.magazine, r.source, intent.magazineHint),
      publisher: first(r.publisher, 'ADDIX'),
      issue: first(r.issue, r.publication_date, ''),
      title: first(r.title, ''),
      url: first(r.url, r.doi ? `https://doi.org/${r.doi}` : null),
    },
  };
}

// Pull lat/lng out of whatever shape a stop or spot comes back in.
// TODO(live): confirm coordinate field names on tobu--find_stop and ADDIX metadata.
export function coords(obj) {
  const r = results(obj)[0] ?? obj;
  if (!r) return null;
  const lat = Number(first(r.lat, r.latitude, r.location?.lat, r.metadata?.lat, r.metadata?.latitude));
  const lng = Number(first(r.lng, r.lon, r.longitude, r.location?.lng, r.location?.lon, r.metadata?.lng, r.metadata?.lon, r.metadata?.longitude));
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

// Map pins in trip order. Pins without coordinates are kept (lat/lng null)
// so the frontend can geocode them by name.
export function placesFrom({ origin, originStop, destName, destStop, transit, spot, spotRaw }) {
  const bus = transit?.outbound?.find((l) => l.type === 'bus');
  return [
    { id: 'origin', kind: 'origin', name: `${origin} Sta.`, ...(coords(originStop) ?? { lat: null, lng: null }) },
    { id: 'rail-dest', kind: 'station', name: `${destName} Sta.`, ...(coords(destStop) ?? { lat: null, lng: null }) },
    bus?.to && { id: 'bus-stop', kind: 'bus', name: `${bus.to} (bus)`, lat: null, lng: null },
    spot && { id: 'spot', kind: 'spot', name: spot.name, ...(coords(spotRaw) ?? { lat: null, lng: null }) },
  ].filter(Boolean);
}

export function stopId(payload) {
  // TODO(live): tobu--find_stop response shape.
  const r = results(payload)[0] ?? payload;
  return first(r?.station_id, r?.stop_id, r?.id, null);
}

export function transitFrom({ departures, busLinks, origin, destName }) {
  // TODO(live): tobu--rail_departures / tobu--station_bus_links shapes.
  const rail = results(departures).slice(0, 3).map((d) => ({
    type: 'rail',
    service: first(d.train_type, d.service, d.name, 'Tobu Line'),
    trainNumber: first(d.train_number, d.number, ''),
    from: origin,
    to: destName,
    depart: first(d.departure_time, d.depart, d.departure),
    arrive: first(d.arrival_time, d.arrive, d.arrival),
    platform: first(d.platform, ''),
  }));
  const bus = results(busLinks).slice(0, 3).map((b) => ({
    type: 'bus',
    service: first(b.route_name, b.route, 'Tobu Bus'),
    from: destName,
    stop: first(b.pole, b.stop_name, b.platform, ''),
    to: first(b.destination, b.to, ''),
    depart: first(b.departure_time, b.depart, ''),
    arrive: first(b.arrival_time, b.arrive, ''),
  }));
  return {
    outbound: [rail[0], bus[0]].filter(Boolean),
    alternatives: { rail: rail.slice(1), bus: bus.slice(1) },
    return: [],
    notes: rail.length ? [] : ['No live departures returned — check station IDs.'],
  };
}

export function rideMinutes(transit) {
  const leg = transit?.outbound?.find((l) => l.type === 'rail');
  if (!leg?.depart || !leg?.arrive) return null;
  const toMin = (t) => {
    const [h, m] = String(t).slice(-5).split(':').map(Number);
    return h * 60 + m;
  };
  return toMin(leg.arrive) - toMin(leg.depart);
}

export function audioFrom(payload, rideMinutes) {
  const r = results(payload)[0];
  if (!r) return null;
  // TODO(live): confirm where include_audio puts the playable URL.
  return {
    title: first(r.title, 'Commute briefing'),
    source: first(r.publisher, r.source, 'Chronicle News Connect'),
    url: first(r.audio_url, r.audio?.url, r.media?.url, null),
    durationSec: first(r.duration_sec, r.audio?.duration, null),
    transcriptSnippet: first(r.snippet, r.text, ''),
    fitsRide: rideMinutes ? `${rideMinutes} min ride` : null,
  };
}
