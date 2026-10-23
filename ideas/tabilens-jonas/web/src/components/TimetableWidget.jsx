export default function TimetableWidget({ transit }) {
  if (!transit) return null;
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg font-bold text-moss-dark">Tobu timetable</h2>
      <Legs title="Outbound" legs={transit.outbound} />
      {transit.return?.length > 0 && <Legs title="Return" legs={transit.return} />}
      {transit.notes?.map((n) => (
        <p key={n} className="mt-3 text-xs text-ink/50">{n}</p>
      ))}
    </section>
  );
}

function Legs({ title, legs = [] }) {
  return (
    <div className="mt-4">
      <h3 className="mb-2 text-xs uppercase tracking-wider text-ink/50">{title}</h3>
      <ol className="relative space-y-3 border-l-2 border-line pl-4">
        {legs.map((l, i) => (
          <li key={i} className="relative">
            <span
              className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full ring-2 ring-white ${
                l.type === 'bus' ? 'bg-maple' : 'bg-rail'
              }`}
            />
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-medium">
                {l.type === 'bus' ? '🚌' : '🚆'} {l.service}
                {l.trainNumber && <span className="ml-1 text-xs text-ink/50">#{l.trainNumber}</span>}
              </p>
              <p className="whitespace-nowrap font-mono text-sm">
                {l.depart} → {l.arrive}
              </p>
            </div>
            <p className="text-sm text-ink/70">
              {l.from}
              {l.stop && <span className="ml-1 rounded bg-maple/10 px-1.5 text-xs text-maple">{l.stop}</span>}
              {l.platform && <span className="ml-1 text-xs text-ink/50">Plat. {l.platform}</span>} → {l.to}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
