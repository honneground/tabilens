export default function HistoryCard({ history, place }) {
  if (!history?.summary && !history?.timeline?.length) return null;
  const src = history.source;
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg font-bold text-moss-dark">A little history</h2>
      {place && <p className="text-xs uppercase tracking-wider text-maple">{place}</p>}
      {history.summary && <p className="mt-3 leading-relaxed">{history.summary}</p>}
      {history.timeline?.length > 0 && (
        <ol className="relative mt-4 space-y-3 border-l-2 border-line pl-4">
          {history.timeline.map((t) => (
            <li key={t.when + t.text} className="relative">
              <span className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full bg-maple ring-2 ring-white" />
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{t.when}</p>
              <p className="text-sm leading-relaxed">{t.text}</p>
            </li>
          ))}
        </ol>
      )}
      {src?.url && (
        // Wikipedia text is CC BY-SA 4.0: credit the article and the license.
        <p className="mt-4 border-t border-line pt-3 text-xs text-ink/60">
          From{' '}
          <a href={src.url} target="_blank" rel="noreferrer" className="text-rail underline">
            “{src.title}” on {src.name}
          </a>
          {src.name === 'Wikipedia' && (
            <>
              , available under{' '}
              <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer" className="underline">
                CC BY-SA 4.0
              </a>
            </>
          )}
        </p>
      )}
    </section>
  );
}
