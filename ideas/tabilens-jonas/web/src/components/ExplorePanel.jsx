import { useEffect, useState } from 'react';
import { api } from '../api.js';

// Step 1: research the destination by walking Wikipedia's link graph.
// Each node shows related articles (similar topics) and nearby articles (within 10 km).
export default function ExplorePanel({ spot, places, saved, onToggleSave }) {
  const [trail, setTrail] = useState([]); // titles read so far, in order
  const [node, setNode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nearMe, setNearMe] = useState(null); // { status, items }

  const pin = places?.find((p) => p.kind === 'spot' && p.lat != null);

  async function open(params, keepTrail = true) {
    setLoading(true);
    setError(null);
    try {
      const n = await api.explore(params);
      setNode(n);
      setTrail((t) => {
        const base = keepTrail ? t : [];
        const at = base.indexOf(n.title);
        return at >= 0 ? base.slice(0, at + 1) : [...base, n.title];
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Start from the destination; "nearby" is searched around the spot's map pin.
  useEffect(() => {
    if (!spot) return;
    setNearMe(null);
    const title = spot.history?.source?.name === 'Wikipedia' ? spot.history.source.title : undefined;
    open({ title, name: spot.name, area: spot.area, lat: pin?.lat, lng: pin?.lng }, false);
  }, [spot?.id, spot?.name]);

  function findNearMe() {
    if (!navigator.geolocation) return setNearMe({ status: 'Location is not available in this browser.' });
    setNearMe({ status: 'Finding your location…' });
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { nearby } = await api.nearby(coords.latitude, coords.longitude);
          setNearMe({ items: nearby });
        } catch (e) {
          setNearMe({ status: e.message });
        }
      },
      () => setNearMe({ status: 'Location permission was denied.' }),
      { timeout: 10000 }
    );
  }

  if (!spot) return null;
  const isSaved = node && saved.some((s) => s.title === node.title);

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wider text-maple">Step 1</p>
      <h2 className="font-display text-xl font-bold text-moss-dark">Research your interest</h2>
      <p className="text-sm text-ink/60">
        Start at your destination and follow the links. Green topics are related, blue ones are within 10 km.
      </p>

      {trail.length > 0 && (
        <nav className="mt-3 flex flex-wrap items-center gap-1 text-xs" aria-label="Reading trail">
          {trail.map((t, i) => (
            <span key={t} className="flex items-center gap-1">
              {i > 0 && <span className="text-ink/30">→</span>}
              <button
                onClick={() => open({ title: t })}
                className={`rounded-full px-2 py-0.5 ${t === node?.title ? 'bg-moss text-white' : 'bg-paper hover:bg-line'}`}
              >
                {t}
              </button>
            </span>
          ))}
        </nav>
      )}

      {error && <p className="mt-3 text-sm text-maple">{error}</p>}

      {node && (
        <div className={`mt-4 grid gap-6 lg:grid-cols-2 ${loading ? 'opacity-50' : ''}`}>
          <LinkGraph node={node} onOpen={(title) => open({ title })} />

          <div>
            <div className="flex gap-3">
              {node.thumbnail && (
                <img src={node.thumbnail} alt="" className="h-20 w-20 flex-none rounded-lg object-cover" />
              )}
              <div>
                <h3 className="font-display text-lg font-bold text-moss-dark">{node.title}</h3>
                {node.description && <p className="text-xs text-ink/60">{node.description}</p>}
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed">{node.summary}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <button
                onClick={() => onToggleSave(node)}
                className={`rounded-xl px-4 py-2 font-medium ${
                  isSaved ? 'bg-moss/15 text-moss-dark' : 'bg-moss text-white hover:bg-moss-dark'
                }`}
              >
                {isSaved ? '✓ Saved to trip' : '+ Save to trip notes'}
              </button>
              {node.url && (
                <a href={node.url} target="_blank" rel="noreferrer" className="text-rail underline">
                  Read on Wikipedia →
                </a>
              )}
            </div>

            <TopicList title="Nearby from here" items={node.nearby} onOpen={(title) => open({ title })} />

            <div className="mt-4">
              <button onClick={findNearMe} className="rounded-xl border border-line px-3 py-1.5 text-sm hover:border-rail">
                📍 What’s near me right now?
              </button>
              {nearMe?.status && <p className="mt-2 text-xs text-ink/60">{nearMe.status}</p>}
              {nearMe?.items && <TopicList title="Near you" items={nearMe.items} onOpen={(title) => open({ title })} />}
            </div>

            <p className="mt-4 text-xs text-ink/50">
              Text from Wikipedia, available under{' '}
              <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer" className="underline">
                CC BY-SA 4.0
              </a>
              .
            </p>
          </div>
        </div>
      )}
      {!node && loading && <p className="mt-4 text-sm text-ink/60">Looking up your destination…</p>}
    </section>
  );
}

function TopicList({ title, items, onOpen }) {
  if (!items?.length) return null;
  return (
    <div className="mt-4">
      <h4 className="text-xs uppercase tracking-wider text-ink/50">{title}</h4>
      <ul className="mt-1 divide-y divide-line text-sm">
        {items.map((it) => (
          <li key={it.title}>
            <button onClick={() => onOpen(it.title)} className="flex w-full items-baseline justify-between gap-2 py-1.5 text-left hover:text-rail">
              <span>
                {it.title}
                {it.description && <span className="ml-1 text-xs text-ink/50">{it.description}</span>}
              </span>
              {it.distM != null && <span className="flex-none text-xs text-ink/50">{fmtDist(it.distM)}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const fmtDist = (m) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);

// Current article in the middle; related articles fan out above, nearby ones below.
function LinkGraph({ node, onOpen }) {
  const W = 520;
  const H = 320;
  const cx = W / 2;
  const cy = H / 2;
  const related = node.related.slice(0, 6).map((r) => ({ ...r, kind: 'related' }));
  const nearby = node.nearby
    .filter((n) => !related.some((r) => r.title === n.title))
    .slice(0, 6)
    .map((n) => ({ ...n, kind: 'nearby' }));

  const place = (list, from, to) =>
    list.map((n, i) => {
      const a = list.length === 1 ? (from + to) / 2 : from + ((to - from) * i) / (list.length - 1);
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      // Labels point away from the centre: left-hand nodes get their label on the left, and vice versa.
      const left = cos < 0;
      return { ...n, x: cx + cos * 130, y: cy + sin * 120, anchor: left ? 'end' : 'start', lx: left ? -11 : 11, ly: 4 };
    });
  const nodes = [...place(related, Math.PI * 1.08, Math.PI * 1.92), ...place(nearby, Math.PI * 0.92, Math.PI * 0.08)];
  const color = { related: '#2f5d46', nearby: '#1a4f8b' };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-paper" role="img" aria-label={`Topics linked to ${node.title}`}>
      {nodes.map((n) => (
        <line key={`l-${n.title}`} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke="#ddd3c2" strokeWidth="1.5" />
      ))}
      {nodes.map((n) => (
        <g key={n.title} onClick={() => onOpen(n.title)} className="cursor-pointer" role="button" aria-label={n.title}>
          <title>{n.description ? `${n.title} — ${n.description}` : n.title}</title>
          <circle cx={n.x} cy={n.y} r="7" fill={color[n.kind]} className="transition hover:opacity-70" />
          <text
            x={n.x + n.lx}
            y={n.y + n.ly}
            textAnchor={n.anchor}
            fontSize="11"
            fill="#1d2420"
          >
            {short(n.title)}
          </text>
        </g>
      ))}
      <circle cx={cx} cy={cy} r="12" fill="#c4532d" />
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1f3a2e">
        {short(node.title, 26)}
      </text>
    </svg>
  );
}

const short = (s, n = 18) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
