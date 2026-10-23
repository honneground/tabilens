// English Wikipedia lookups: destination history and the topic explorer.
// Free and keyless; Wikimedia asks API clients to send a descriptive User-Agent.
const HEADERS = { 'User-Agent': 'TabiLens/0.1 (hackathon demo; https://github.com/jonasterdam69/tabilens)' };

async function getJson(url) {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`Wikipedia ${r.status}`);
  return r.json();
}

// MediaWiki action API (search, geosearch, descriptions).
function actionApi(params) {
  const qs = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', ...params });
  return getJson(`https://en.wikipedia.org/w/api.php?${qs}`);
}

const summaryOf = (title) =>
  getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);

// Spot names are route titles ("Lake Chuzenji shoreline walk & Yumoto Onsen"), which
// Wikipedia search can't match. Split them into place names and drop activity words.
const ACTIVITY_WORDS = /\b(shoreline|riverside|foliage|autumn|leaves|scenic|easy|beginner|walk|walking|hike|hiking|trail|course|cycling|cycle|road|loop|day trip)\b/gi;

export function placeQueries(spot) {
  const parts = String(spot?.name ?? '')
    .split(/\s*(?:&|:|\bto\b|—|–|\band\b)\s*/i)
    .map((p) => p.replace(ACTIVITY_WORDS, '').replace(/\bMt\.?\s/i, 'Mount ').replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 2);
  const area = String(spot?.area ?? '').split(',')[0].trim();
  return [...new Set([...parts, area].filter(Boolean))];
}

const plain = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const IN_JAPAN = /japan|tokyo|prefecture|tochigi|saitama|gunma|chiba|kanto/i;

// A hit counts only if its title starts with the query's first word ("Shinkyo" → "Shinkyō")
// and it's about somewhere in Japan, so "Arakawa" doesn't land on "Hiromu Arakawa".
function isMatch(page, q) {
  const head = plain(q).split(' ')[0];
  if (/ station$/i.test(page.title)) return false; // station pages carry little history
  return plain(page.title).startsWith(head) && IN_JAPAN.test(`${page.description} ${page.excerpt}`);
}

// Tries each query in turn and returns the first real article's summary payload.
async function findPage(queries) {
  for (const q of queries.filter(Boolean)) {
    const search = await getJson(
      `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(q)}&limit=5`
    );
    for (const hit of (search.pages ?? []).filter((p) => isMatch(p, q))) {
      const page = await summaryOf(hit.key);
      if (page.type === 'standard' && page.extract) return page; // skip disambiguation pages
    }
  }
  return null;
}

export async function wikiSummary(queries) {
  const page = await findPage(queries);
  if (!page) return null;
  return {
    summary: page.extract,
    timeline: [],
    // Wikipedia text is CC BY-SA: the card must link back to the article.
    source: { name: 'Wikipedia', title: page.title, url: page.content_urls?.desktop?.page },
  };
}

// ---- Topic explorer ---------------------------------------------------------------

function distanceM(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(h)));
}

// Articles within 10 km of a point, nearest first.
export async function wikiNearby({ lat, lng }, exclude) {
  const res = await actionApi({
    generator: 'geosearch',
    ggscoord: `${lat}|${lng}`,
    ggsradius: '10000',
    ggslimit: '12',
    prop: 'description|coordinates',
  });
  return (res.query?.pages ?? [])
    .filter((p) => p.title !== exclude && p.coordinates?.[0] && !/ station$/i.test(p.title))
    .map((p) => ({
      title: p.title,
      description: p.description ?? '',
      distM: distanceM({ lat, lng }, { lat: p.coordinates[0].lat, lng: p.coordinates[0].lon }),
    }))
    .sort((a, b) => a.distM - b.distM)
    .slice(0, 8);
}

// Articles Wikipedia's search considers similar ("morelike"), in rank order.
async function wikiRelated(title) {
  const res = await actionApi({
    generator: 'search',
    gsrsearch: `morelike:${title}`,
    gsrlimit: '8',
    prop: 'description',
  });
  return (res.query?.pages ?? [])
    .sort((a, b) => a.index - b.index)
    .map((p) => ({ title: p.title, description: p.description ?? '' }));
}

// One node of the link graph: the article plus its related and nearby articles.
// Pass `title` to open a known article, or `queries` to find one from a spot.
// `near` overrides where "nearby" is searched (a river's article point can be 50 km off the route).
export async function wikiExplore({ title, queries, near }) {
  const page = title ? await summaryOf(title) : await findPage(queries ?? []);
  if (!page || page.type !== 'standard') return null;
  const coords = page.coordinates ? { lat: page.coordinates.lat, lng: page.coordinates.lon } : null;
  const center = near ?? coords;
  const [related, nearby] = await Promise.all([
    wikiRelated(page.title).catch(() => []),
    center ? wikiNearby(center, page.title).catch(() => []) : [],
  ]);
  return {
    title: page.title,
    description: page.description ?? '',
    summary: page.extract,
    url: page.content_urls?.desktop?.page,
    thumbnail: page.thumbnail?.source ?? null,
    coords,
    related: related.filter((r) => r.title !== page.title).slice(0, 6),
    nearby,
  };
}
