// Map raw Redpine / Tobu payloads into the frontend's Unified JSON Payload.

const first = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== '');

function results(payload) {
  return payload?.results ?? payload?.data ?? payload?.items ?? [];
}

export function spotFrom(payload, intent) {
  const r = results(payload)[0];
  if (!r) return null;
  return {
    id: first(r.id, r.result_id),
    name: first(r.title, r.heading, 'Untitled spot'),
    area: first(r.metadata?.area, r.area, intent.areaHint || 'Tochigi'),
    difficulty: first(r.metadata?.difficulty, intent.level, 'Moderate'),
    summary: first(r.text, r.passage, r.chunks?.[0]?.snippet, r.snippet, ''),
    nearestStation: first(r.metadata?.nearest_station, intent.destinationStation, 'Tobu-Nikko'),
    figures: (r.figures ?? r.images ?? []).map((f) => ({
      url: first(f.url, f.src, f.image_url),
      caption: first(f.caption, ''),
      credit: first(f.credit, r.publisher, 'ADDIX'),
    })),
    citation: {
      magazine: first(r.journal, r.magazine, r.source, intent.magazineHint),
      publisher: first(r.publisher, 'ADDIX'),
      issue: first(r.issue, r.publication_date, r.year, ''),
      title: first(r.title, ''),
      url: first(r.url, r.doi ? `https://doi.org/${r.doi}` : null),
    },
  };
}

// Pull lat/lng out of whatever shape a stop or spot comes back in.
export function coords(obj) {
  const r = obj?.rail?.[0] ?? obj?.bus?.[0] ?? results(obj)[0] ?? obj;
  if (!r) return null;
  const lat = Number(first(r.lat, r.latitude, r.location?.lat, r.metadata?.lat));
  const lng = Number(first(r.lng, r.lon, r.longitude, r.location?.lng, r.location?.lon, r.metadata?.lng, r.metadata?.lon));
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
  const rail0 = payload?.rail?.[0];
  if (rail0?.station_id) return rail0.station_id;
  const bus0 = payload?.bus?.[0];
  if (bus0?.stop_id || bus0?.station_id) return bus0.stop_id || bus0.station_id;
  const r = results(payload)[0] ?? payload;
  return first(r?.station_id, r?.stop_id, r?.id, null);
}

export function transitFrom({ departures, busLinks, origin, destName }) {
  const railResults = departures?.results ?? results(departures);
  const rail = railResults.slice(0, 3).map((d) => ({
    type: 'rail',
    service: first(d.type_en, d.type, d.train_type, 'Limited Express'),
    trainNumber: first(d.train_no, d.number, ''),
    from: departures?.from?.name_en || origin,
    to: departures?.to?.name_en || destName,
    depart: first(d.dep, d.departure_time),
    arrive: first(d.arr_at_to, d.arrival_time),
    platform: first(d.platform, ''),
  }));
  const busStops = busLinks?.bus_stops ?? results(busLinks);
  const bus = busStops.slice(0, 3).map((b) => ({
    type: 'bus',
    service: first(b.name_en, b.name, 'Tobu Bus'),
    from: destName,
    stop: first(b.poles?.[0]?.pole ? `Pole ${b.poles[0].pole}` : null, b.stop_code, ''),
    to: first(b.poles?.[0]?.destinations?.[0], b.office, ''),
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
    const parts = String(t).split(':').map(Number);
    if (parts.length >= 2) return parts[0] * 60 + parts[1];
    return null;
  };
  const d = toMin(leg.depart);
  const a = toMin(leg.arrive);
  if (d === null || a === null) return null;
  return a >= d ? a - d : a + 24 * 60 - d;
}

export function audioFrom(payload, rideMinutes) {
  const r = results(payload)[0];
  if (!r) return null;
  return {
    title: first(r.title, 'Chronicle Commute Briefing'),
    source: first(r.journal, r.source, 'Chronicle News Connect'),
    durationSec: Number(first(r.metadata?.duration_sec, r.duration_sec, 120)),
    url: first(r.audio_url, r.url, null),
    transcriptSnippet: first(r.text, r.chunks?.[0]?.snippet, r.snippet, ''),
    rideMinutes,
  };
}

// Open-Meteo daily forecast → one row per day.
export function weatherFrom(payload) {
  const d = payload?.daily;
  if (!d?.time?.length) return null;
  return {
    source: 'Open-Meteo',
    days: d.time.map((date, i) => ({
      date,
      maxC: d.temperature_2m_max?.[i] ?? null,
      rainPct: d.precipitation_probability_max?.[i] ?? null,
    })),
  };
}
