// Open-Meteo forecasts reach ~16 days ahead. With a trip date in that window the card
// leads with the trip day; further out it says when the forecast will appear.
export default function WeatherCard({ weather, tripDate }) {
  if (!weather?.days?.length) return null;
  const tripIdx = tripDate ? weather.days.findIndex((d) => d.date === tripDate) : -1;
  const last = weather.days[weather.days.length - 1].date;
  const tooFar = tripDate && tripIdx === -1 && tripDate > last;
  const start = Math.max(0, tripIdx === -1 ? 0 : tripIdx - 1);
  const days = weather.days.slice(start, start + 4);
  const trip = tripIdx >= 0 ? weather.days[tripIdx] : null;

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-bold text-moss-dark">Weather at the spot</h2>
        <span className="text-xs text-ink/50">{weather.source}</span>
      </div>

      {trip && (
        <p className="mt-2 rounded-lg bg-moss/10 px-3 py-2 text-sm text-moss-dark">
          Trip day, {dayLabel(trip.date, true)}: {icon(trip.rainPct)} {fmtTemp(trip.maxC)}, {trip.rainPct ?? '–'}% chance of rain
        </p>
      )}
      {tooFar && (
        <p className="mt-2 rounded-lg bg-paper px-3 py-2 text-sm text-ink/70">
          Your trip on {dayLabel(tripDate, true)} is too far out to forecast. Check back from{' '}
          {dayLabel(addDays(tripDate, -15), true)}. Showing the next few days for now.
        </p>
      )}

      <ol className="mt-3 grid grid-cols-4 gap-2 text-center">
        {days.map((d) => (
          <li
            key={d.date}
            className={`rounded-lg px-2 py-2 ${d.date === tripDate ? 'bg-moss/15 ring-2 ring-moss' : 'bg-paper'}`}
          >
            <p className="text-xs text-ink/50">{dayLabel(d.date)}</p>
            <p className="mt-1 text-lg">{icon(d.rainPct)}</p>
            <p className="font-medium">{fmtTemp(d.maxC)}</p>
            <p className={`text-xs ${d.rainPct >= 50 ? 'text-rail' : 'text-ink/50'}`}>
              {d.rainPct != null ? `${d.rainPct}% rain` : ''}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export const icon = (rainPct) => (rainPct >= 50 ? '🌧' : rainPct >= 20 ? '⛅' : '☀️');
export const fmtTemp = (c) => (c != null ? `${Math.round(c)}°` : '–');

export function dayLabel(iso, long = false) {
  const d = new Date(`${iso}T00:00:00+09:00`);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    ...(long && { month: 'short', day: 'numeric' }),
    timeZone: 'Asia/Tokyo',
  });
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
