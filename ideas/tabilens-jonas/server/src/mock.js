// Canned payload that mirrors the live Unified JSON Payload shape.
// Lets the frontend be built and demoed before the live Redpine key is wired in.

export function mockItinerary({ query, origin }) {
  return {
    mode: 'mock',
    query,
    origin,
    intent: {
      activity: 'hiking',
      level: 'beginner',
      keywords_ja: '日光 紅葉 ハイキング 湖 温泉',
    },
    spot: {
      id: 'mock-spot-1',
      name: 'Lake Chuzenji shoreline walk & Yumoto Onsen',
      name_ja: '中禅寺湖畔ハイク＆湯元温泉',
      area: 'Okunikko, Tochigi',
      difficulty: 'Beginner',
      distanceKm: 7.5,
      elevationGainM: 120,
      durationHrs: 3,
      season: 'Mid-October to early November (autumn leaves)',
      summary:
        'A gentle lakeside trail with views of Mt. Nantai, finishing at a sulfur-spring onsen. Mostly flat, well marked, and reachable by bus from Tobu-Nikko Station. [MOCK DATA — replaced by the ADDIX editorial passage in live mode]',
      gear: ['Light hiking shoes', 'Wind layer (lake is ~8°C cooler than Tokyo)', 'Towel for the onsen', 'IC card for the bus'],
      figures: [
        {
          url: 'https://placehold.co/960x600/1f3a2e/f4e9d8?text=Editorial+photo+(include_figures)',
          caption: 'Placeholder — the magazine photo appears here in live mode',
          credit: 'ADDIX / Randonnée (mock)',
        },
      ],
      citation: {
        magazine: 'Randonnée',
        publisher: 'ADDIX',
        issue: 'Mock issue',
        title: 'Mock article title',
        url: null,
      },
    },
    transit: {
      outbound: [
        {
          type: 'rail',
          service: 'Limited Express Spacia X',
          trainNumber: 'MOCK-1',
          from: 'Asakusa',
          to: 'Tobu-Nikko',
          depart: '08:00',
          arrive: '09:50',
          platform: '3',
          reserved: true,
        },
        {
          type: 'bus',
          service: 'Tobu Bus — Yumoto Onsen line',
          from: 'Tobu-Nikko Sta.',
          stop: 'Pole 2',
          to: 'Chuzenji Onsen',
          depart: '10:05',
          arrive: '10:50',
        },
      ],
      return: [
        { type: 'bus', service: 'Tobu Bus', from: 'Yumoto Onsen', to: 'Tobu-Nikko Sta.', depart: '15:10', arrive: '16:25' },
        { type: 'rail', service: 'Limited Express Spacia X', from: 'Tobu-Nikko', to: 'Asakusa', depart: '16:40', arrive: '18:30' },
      ],
      notes: ['Mock timetable — live mode pulls tobu--rail_departures and tobu--station_bus_links.'],
    },
    // Map pins in trip order (approximate coordinates for the mock).
    places: [
      { id: 'origin', kind: 'origin', name: 'Asakusa Sta. (Tobu)', lat: 35.7115, lng: 139.7976 },
      { id: 'rail-dest', kind: 'station', name: 'Tobu-Nikko Sta.', lat: 36.748, lng: 139.6195 },
      { id: 'bus-stop', kind: 'bus', name: 'Chuzenji Onsen (bus)', lat: 36.7378, lng: 139.4993 },
      { id: 'spot', kind: 'spot', name: 'Lake Chuzenji shoreline walk', lat: 36.73, lng: 139.47 },
      { id: 'spot-end', kind: 'spot', name: 'Yumoto Onsen', lat: 36.804, lng: 139.423 },
    ],
    audio: {
      title: 'Mock commute briefing (2 min)',
      source: 'Chronicle News Connect',
      durationSec: 120,
      url: null,
      transcriptSnippet: 'Audio clip will be attached in live mode via include_audio=true.',
    },
    billing: { spentUsd: 0, items: [] },
    trace: [
      { step: 'intent', status: 'ok', ms: 5 },
      { step: 'redpine.preview(magazines)', status: 'mock', ms: 0 },
      { step: 'redpine.confirm(include_figures)', status: 'mock', ms: 0 },
      { step: 'tobu.find_stop', status: 'mock', ms: 0 },
      { step: 'tobu.rail_departures', status: 'mock', ms: 0 },
      { step: 'tobu.station_bus_links', status: 'mock', ms: 0 },
      { step: 'redpine.confirm(audio)', status: 'mock', ms: 0 },
    ],
  };
}
