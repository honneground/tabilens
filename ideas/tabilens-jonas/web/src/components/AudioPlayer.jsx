export default function AudioPlayer({ audio }) {
  if (!audio) return null;
  const mins = audio.durationSec ? Math.round(audio.durationSec / 60) : null;
  return (
    <section className="rounded-2xl border border-line bg-moss-dark p-5 text-paper shadow-sm">
      <p className="text-xs uppercase tracking-wider text-paper/60">For the ride · {audio.source}</p>
      <h2 className="mt-1 font-display text-lg font-bold">{audio.title}</h2>
      {mins && <p className="text-xs text-paper/60">{mins} min{audio.fitsRide && ` · ${audio.fitsRide}`}</p>}
      {audio.url ? (
        <audio controls src={audio.url} className="mt-3 w-full" />
      ) : (
        <p className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-sm text-paper/80">{audio.transcriptSnippet}</p>
      )}
    </section>
  );
}
