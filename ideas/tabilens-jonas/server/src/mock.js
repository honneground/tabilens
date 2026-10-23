// Canned payloads that mirror the live Unified JSON Payload shape.
// Lets the frontend be built and demoed before the live Redpine key is wired in.
// One itinerary per suggestion chip in the web app; free-text queries are matched by keyword.

const MOCK_NOTE = '[MOCK DATA — replaced by the ADDIX editorial passage in live mode]';

const ROUTES = {
  // "Beginner hike with scenic lake views and onsen"
  lake: {
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
      summary: `A gentle lakeside trail with views of Mt. Nantai, finishing at a sulfur-spring onsen. Mostly flat, well marked, and reachable by bus from Tobu-Nikko Station. ${MOCK_NOTE}`,
      gear: ['Light hiking shoes', 'Wind layer (lake is ~8°C cooler than Tokyo)', 'Towel for the onsen', 'IC card for the bus'],
      magazine: 'Randonnée',
      history: {
        summary:
          'A volcanic lake that became a sacred mountain retreat for Buddhist monks, then a summer escape for Tokyo’s foreign diplomats.',
        timeline: [
          { when: '~20,000 years ago', text: 'Lava from Mt. Nantai blocks the valley and the water backs up into Lake Chuzenji.' },
          { when: '782', text: 'The monk Shodo Shonin reaches the summit of Mt. Nantai and looks down on the lake.' },
          { when: '784', text: 'Shodo founds Chuzenji Temple on the shore. After a landslide in 1902 it was moved to where it stands today.' },
          { when: '788', text: 'By tradition, Shodo also finds the sulfur springs that become Yumoto Onsen.' },
          { when: '1896–1928', text: 'Diplomats build summer villas on the lake. The British (1896) and Italian (1928) embassy villas are open to visitors today.' },
        ],
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
    },
    // Map pins in trip order (approximate coordinates for the mock).
    places: [
      { id: 'origin', kind: 'origin', name: 'Asakusa Sta. (Tobu)', lat: 35.7115, lng: 139.7976 },
      { id: 'rail-dest', kind: 'station', name: 'Tobu-Nikko Sta.', lat: 36.748, lng: 139.6195 },
      { id: 'bus-stop', kind: 'bus', name: 'Chuzenji Onsen (bus)', lat: 36.7378, lng: 139.4993 },
      { id: 'spot', kind: 'spot', name: 'Lake Chuzenji shoreline walk', lat: 36.73, lng: 139.47 },
      { id: 'spot-end', kind: 'spot', name: 'Yumoto Onsen', lat: 36.804, lng: 139.423 },
    ],
  },

  // "Easy autumn leaves walk near Nikko"
  autumn: {
    intent: {
      activity: 'hiking',
      level: 'beginner',
      keywords_ja: '日光 紅葉 ハイキング 初心者',
    },
    spot: {
      id: 'mock-spot-2',
      name: 'Kanmangafuchi Abyss & Shinkyo Bridge foliage walk',
      name_ja: '神橋〜憾満ヶ淵 紅葉散策',
      area: 'Nikko, Tochigi',
      difficulty: 'Easy',
      distanceKm: 4,
      elevationGainM: 60,
      durationHrs: 2,
      season: 'Late October to mid-November (autumn leaves in Nikko town)',
      summary: `A short riverside stroll along the Daiya River, from the vermilion Shinkyo Bridge to Kanmangafuchi, where a row of moss-covered stone Jizo statues lines the gorge under the maples. Paved or gravel paths the whole way, a short bus ride from Tobu-Nikko Station. ${MOCK_NOTE}`,
      gear: ['Comfortable walking shoes', 'Light jacket (mornings are chilly)', 'Camera', 'IC card for the bus'],
      magazine: 'Randonnée',
      history: {
        summary:
          'The walk follows the river where Nikko’s sacred history begins, from the legendary serpent bridge to a gorge of stone Jizo statues.',
        timeline: [
          { when: '766', text: 'Legend says Shodo Shonin can’t cross the Daiya River until a god throws down two serpents that become a bridge: the origin of Shinkyo, the “sacred bridge”.' },
          { when: '1636', text: 'Shinkyo is rebuilt as a vermilion lacquered bridge during the great reconstruction of Toshogu Shrine.' },
          { when: '1654', text: 'Jiun-ji temple is founded at Kanmangafuchi. A Sanskrit prayer carved into a riverside rock, ending in “kanman”, gives the gorge its name.' },
          { when: 'Edo period', text: 'Disciples of the priest Tenkai line up about 70 stone Jizo statues. They’re nicknamed “Bake Jizo” (ghost Jizo) because no one counts the same number twice.' },
          { when: '1902', text: 'A great flood washes away Shinkyo and part of the Jizo row. The bridge is rebuilt in 1904.' },
          { when: '1999', text: 'Shinkyo becomes part of the “Shrines and Temples of Nikko” UNESCO World Heritage Site.' },
        ],
      },
    },
    transit: {
      outbound: [
        {
          type: 'rail',
          service: 'Limited Express Spacia X',
          trainNumber: 'MOCK-2',
          from: 'Asakusa',
          to: 'Tobu-Nikko',
          depart: '08:00',
          arrive: '09:50',
          platform: '3',
          reserved: true,
        },
        {
          type: 'bus',
          service: 'Tobu Bus — World Heritage loop',
          from: 'Tobu-Nikko Sta.',
          stop: 'Pole 2',
          to: 'Shinkyo',
          depart: '10:00',
          arrive: '10:08',
        },
      ],
      return: [
        { type: 'bus', service: 'Tobu Bus', from: 'Shinkyo', to: 'Tobu-Nikko Sta.', depart: '13:30', arrive: '13:38' },
        { type: 'rail', service: 'Limited Express Spacia X', from: 'Tobu-Nikko', to: 'Asakusa', depart: '14:10', arrive: '16:00' },
      ],
    },
    places: [
      { id: 'origin', kind: 'origin', name: 'Asakusa Sta. (Tobu)', lat: 35.7115, lng: 139.7976 },
      { id: 'rail-dest', kind: 'station', name: 'Tobu-Nikko Sta.', lat: 36.748, lng: 139.6195 },
      { id: 'bus-stop', kind: 'bus', name: 'Shinkyo (bus)', lat: 36.7531, lng: 139.6036 },
      { id: 'spot', kind: 'spot', name: 'Kanmangafuchi Abyss', lat: 36.748, lng: 139.5845 },
    ],
  },

  // "Riverside cycling along Arakawa"
  arakawa: {
    intent: {
      activity: 'cycling',
      level: 'any',
      keywords_ja: '荒川 川沿い サイクリング',
    },
    spot: {
      id: 'mock-spot-3',
      name: 'Arakawa cycling road: Horikiri to Iwabuchi Floodgate',
      name_ja: '荒川サイクリングロード 堀切〜岩淵水門',
      area: 'Arakawa River, Tokyo',
      difficulty: 'Easy',
      distanceKm: 26,
      elevationGainM: 10,
      durationHrs: 2.5,
      season: 'Year-round (spring and autumn are most comfortable)',
      summary: `A flat, car-free path along the Arakawa riverbank with wide open skies and views back to Tokyo Skytree. Ride upstream to the old red Iwabuchi Floodgate (Akasuimon), then turn around and come back the same way. ${MOCK_NOTE}`,
      gear: [
        'Bike (bring your own or rent one in advance)',
        'Bike bag (rinko bag) to take your bike on the train',
        'Helmet',
        'Water and sunscreen (little shade on the riverbank)',
      ],
      magazine: 'BiCYCLE CLUB',
      history: {
        summary:
          'This stretch of the Arakawa isn’t a natural river: it’s a flood channel dug by hand and machine to save Tokyo from floods.',
        timeline: [
          { when: 'Edo period', text: 'Horikiri’s iris fields draw crowds from Edo, and Hiroshige paints them in “One Hundred Famous Views of Edo”.' },
          { when: '1910', text: 'A great flood leaves much of eastern Tokyo under water and pushes the government to act.' },
          { when: '1911–1930', text: 'Workers dig the Arakawa Drainage Channel, about 22 km long, to carry floodwater around the city. Since 1965 it has officially been the main course of the Arakawa.' },
          { when: '1924', text: 'The red Iwabuchi Floodgate is finished where the old river and the new channel split. The project was led by Aoyama Akira, the only Japanese engineer to work on the Panama Canal.' },
          { when: '1982', text: 'A new blue floodgate takes over. The old red gate, “Akasuimon”, is kept as a landmark and is your turnaround point.' },
        ],
      },
    },
    transit: {
      outbound: [
        {
          type: 'rail',
          service: 'Tobu Skytree Line (local)',
          trainNumber: 'MOCK-3',
          from: 'Asakusa',
          to: 'Horikiri',
          depart: '09:00',
          arrive: '09:12',
        },
      ],
      return: [
        { type: 'rail', service: 'Tobu Skytree Line (local)', from: 'Horikiri', to: 'Asakusa', depart: '12:30', arrive: '12:42' },
      ],
    },
    places: [
      { id: 'origin', kind: 'origin', name: 'Asakusa Sta. (Tobu)', lat: 35.7115, lng: 139.7976 },
      { id: 'rail-dest', kind: 'station', name: 'Horikiri Sta.', lat: 35.7475, lng: 139.8178 },
      { id: 'spot', kind: 'spot', name: 'Iwabuchi Floodgate (turnaround)', lat: 35.7853, lng: 139.7217 },
    ],
  },
};

function pickRoute(query = '') {
  if (/cycl|bike|bicycle|arakawa|荒川/i.test(query)) return ROUTES.arakawa;
  if (/lake|onsen|hot spring|chuzenji/i.test(query)) return ROUTES.lake;
  if (/autumn|fall|leaves|koyo|紅葉|walk/i.test(query)) return ROUTES.autumn;
  return ROUTES.lake;
}

export function mockItinerary({ query, origin }) {
  const route = pickRoute(query);
  const { magazine, ...spot } = route.spot;
  return {
    mode: 'mock',
    query,
    origin,
    intent: route.intent,
    spot: {
      ...spot,
      // No editorial photo in mock mode — the web app falls back to a Google Places photo.
      figures: [],
      citation: {
        magazine,
        publisher: 'ADDIX',
        issue: 'Mock issue',
        title: 'Mock article title',
        url: null,
      },
    },
    transit: {
      ...route.transit,
      notes: ['Mock timetable — live mode pulls tobu--rail_departures and tobu--station_bus_links.'],
    },
    places: route.places,
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
