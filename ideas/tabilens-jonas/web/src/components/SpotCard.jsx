import { useEffect, useState } from 'react';
import { findPlacePhoto } from '../lib/placePhoto.js';

export default function SpotCard({ spot }) {
  const [googlePhoto, setGooglePhoto] = useState(null);
  const hasFigure = Boolean(spot?.figures?.[0]?.url);

  // No editorial photo → fall back to a Google Places photo of the destination.
  useEffect(() => {
    setGooglePhoto(null);
    if (!spot || hasFigure) return;
    let cancelled = false;
    findPlacePhoto([spot.name, spot.area].filter(Boolean).join(', '))
      .then((p) => !cancelled && setGooglePhoto(p))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [spot?.name, spot?.area, hasFigure]);

  if (!spot) {
    return (
      <div className="rounded-2xl border border-line bg-white p-6 text-ink/60">
        No editorial spot found for this query.
      </div>
    );
  }
  const fig = hasFigure ? spot.figures[0] : googlePhoto;
  const c = spot.citation || {};

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      {fig?.url && (
        <figure className="relative">
          <img src={fig.url} alt={fig.caption || spot.name} className="aspect-[16/10] w-full object-cover" />
          <figcaption className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8 text-xs text-white/90">
            {fig.caption}{' '}
            {fig.credit && (
              <span className="opacity-70">
                · Photo:{' '}
                {fig.creditUrl ? (
                  <a href={fig.creditUrl} target="_blank" rel="noreferrer" className="underline">
                    {fig.credit}
                  </a>
                ) : (
                  fig.credit
                )}
              </span>
            )}
          </figcaption>
        </figure>
      )}

      <div className="p-6">
        <p className="text-xs uppercase tracking-wider text-maple">{spot.area}</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-moss-dark">{spot.name}</h2>
        {spot.name_ja && <p className="text-sm text-ink/60">{spot.name_ja}</p>}

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Level" value={spot.difficulty} />
          <Stat label="Distance" value={spot.distanceKm && `${spot.distanceKm} km`} />
          <Stat label="Elevation" value={spot.elevationGainM && `+${spot.elevationGainM} m`} />
          <Stat label="Time" value={spot.durationHrs && `${spot.durationHrs} h`} />
        </dl>

        <p className="mt-5 leading-relaxed">{spot.summary}</p>

        {spot.gear?.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-moss-dark">Bring</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {spot.gear.map((g) => (
                <li key={g} className="rounded-full bg-paper px-3 py-1 text-xs">{g}</li>
              ))}
            </ul>
          </div>
        )}

        <footer className="mt-6 border-t border-line pt-4 text-xs text-ink/70">
          Source:{' '}
          <span className="font-medium">
            {c.magazine} ({c.publisher}){c.issue && `, ${c.issue}`}
          </span>
          {c.title && <> — “{c.title}”</>}
          {c.url && (
            <a href={c.url} target="_blank" rel="noreferrer" className="ml-2 text-rail underline">
              Read the full issue on ADDIX →
            </a>
          )}
        </footer>
      </div>
    </article>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-paper px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-ink/50">{label}</dt>
      <dd className="font-medium">{value || '—'}</dd>
    </div>
  );
}
