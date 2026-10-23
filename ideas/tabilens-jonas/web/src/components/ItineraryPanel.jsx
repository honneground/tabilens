import { buildDirectionsUrl } from './MapView.jsx';
import { dayLabel, fmtTemp, icon } from './WeatherCard.jsx';
import { downloadMarkdown, legLine, longDate, tripWeather } from '../lib/itinerary.js';

// Step 2: the trip document. The preview below is exactly what prints,
// so "Save as PDF" in the print dialog gives a one-page-ish PDF.
export default function ItineraryPanel({ plan, saved, onRemoveSaved }) {
  if (!plan?.spot) return null;
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-maple">Step 2</p>
          <h2 className="font-display text-xl font-bold text-moss-dark">Your trip document</h2>
          <p className="text-sm text-ink/60">
            Everything for the day on one page, including the {saved.length} topic{saved.length === 1 ? '' : 's'} you saved.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="rounded-xl bg-moss px-4 py-2 font-medium text-white hover:bg-moss-dark">
            Print / Save as PDF
          </button>
          <button onClick={() => downloadMarkdown(plan, saved)} className="rounded-xl border border-line px-4 py-2 font-medium hover:border-moss">
            Download .md
          </button>
        </div>
      </div>

      <TripDoc plan={plan} saved={saved} onRemoveSaved={onRemoveSaved} />
    </section>
  );
}

function TripDoc({ plan, saved, onRemoveSaved }) {
  const { spot, transit = {} } = plan;
  const w = tripWeather(plan);
  const maps = buildDirectionsUrl(plan.places ?? []);
  const h = spot.history;

  return (
    <article id="trip-doc" className="mt-5 rounded-xl border border-line bg-paper/40 p-6 text-sm leading-relaxed">
      <h1 className="font-display text-2xl font-bold text-moss-dark">Day trip: {spot.name}</h1>
      <p className="text-ink/70">
        <strong>{longDate(plan.tripDate)}</strong> · from {plan.origin} · {spot.area}
      </p>

      <DocSection title="Overview">
        <p className="text-ink/70">
          {[
            spot.difficulty && `Level: ${spot.difficulty}`,
            spot.distanceKm && `${spot.distanceKm} km`,
            spot.elevationGainM && `+${spot.elevationGainM} m`,
            spot.durationHrs && `${spot.durationHrs} h`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="mt-1">{spot.summary}</p>
        {spot.season && <p className="mt-1 text-ink/70">Best season: {spot.season}</p>}
      </DocSection>

      <DocSection title="Weather">
        {w?.day ? (
          <p>
            {icon(w.day.rainPct)} {dayLabel(w.day.date, true)}: high {fmtTemp(w.day.maxC)}, {w.day.rainPct ?? '–'}% chance of rain
          </p>
        ) : (
          <p className="text-ink/70">
            {w?.tooFar ? 'Too far ahead to forecast. Check again about two weeks before the trip.' : 'No forecast available.'}
          </p>
        )}
      </DocSection>

      <DocSection title="Getting there">
        <Legs title="Outbound" legs={transit.outbound} />
        <Legs title="Return" legs={transit.return} />
        {transit.notes?.map((n) => (
          <p key={n} className="mt-1 text-xs italic text-ink/60">{n}</p>
        ))}
        {maps && (
          <a href={maps} target="_blank" rel="noreferrer" className="mt-2 inline-block text-rail underline">
            Open the route in Google Maps
          </a>
        )}
      </DocSection>

      {spot.gear?.length > 0 && (
        <DocSection title="Bring">
          <ul className="grid gap-1 sm:grid-cols-2">
            {spot.gear.map((g) => (
              <li key={g}>☐ {g}</li>
            ))}
          </ul>
        </DocSection>
      )}

      {(h?.summary || h?.timeline?.length > 0) && (
        <DocSection title="A little history">
          {h.summary && <p>{h.summary}</p>}
          <ul className="mt-1 space-y-1">
            {h.timeline?.map((t) => (
              <li key={t.when + t.text}>
                <strong>{t.when}:</strong> {t.text}
              </li>
            ))}
          </ul>
          {h.source?.url && (
            <p className="mt-1 text-xs text-ink/60">
              From <a href={h.source.url} className="underline">{h.source.title}</a> on {h.source.name}.
            </p>
          )}
        </DocSection>
      )}

      <DocSection title="Research notes">
        {saved.length === 0 ? (
          <p className="no-print text-ink/60">Nothing saved yet. Use “Save to trip notes” in step 1.</p>
        ) : (
          saved.map((s) => (
            <div key={s.title} className="mt-2">
              <p className="font-semibold">
                {s.title}
                <button onClick={() => onRemoveSaved(s)} className="no-print ml-2 text-xs font-normal text-maple underline">
                  remove
                </button>
              </p>
              <p>{s.summary}</p>
              <a href={s.url} className="text-xs text-rail underline">{s.url}</a>
            </div>
          ))
        )}
      </DocSection>

      <DocSection title="Sources">
        <ul className="text-xs text-ink/70">
          <li>
            Spot: {spot.citation?.magazine} ({spot.citation?.publisher}){spot.citation?.issue && `, ${spot.citation.issue}`}
          </li>
          <li>Weather: Open-Meteo</li>
          {(saved.length > 0 || h?.source?.name === 'Wikipedia') && (
            <li>Wikipedia text is available under CC BY-SA 4.0</li>
          )}
        </ul>
      </DocSection>
    </article>
  );
}

function DocSection({ title, children }) {
  return (
    <section className="doc-section mt-5">
      <h2 className="mb-1 border-b border-line pb-1 font-display text-base font-bold text-moss-dark">{title}</h2>
      {children}
    </section>
  );
}

function Legs({ title, legs }) {
  if (!legs?.length) return null;
  return (
    <div className="mt-1">
      <p className="font-semibold">{title}</p>
      <ul>
        {legs.map((l, i) => (
          <li key={i}>{legLine(l)}</li>
        ))}
      </ul>
    </div>
  );
}
